/**
 * Router Configuration Routes
 * 
 * Handles router connection management and port forwarding CRUD operations.
 * Supports OpenWrt-based routers with Luci JSON-RPC API.
 */

const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { Logger } = require('../lib/logger');
const { requireAuth } = require('../middleware/auth');
const { encryptPassword, decryptPassword } = require('../lib/router-encryption');
const { OpenWrtClient, createClientFromDbConfig } = require('../lib/openwrt-api');
const { getErrorMessage } = require('../lib/i18n');

const router = express.Router();
const logger = new Logger('RouterRoutes', { debug: process.env.DEBUG === 'true' });

/**
 * Get all router configurations
 */
router.get('/config', requireAuth, (req, res) => {
  try {
    const configs = db.prepare(`
      SELECT id, name, router_url, port, username, last_sync_at, sync_enabled, created_at, updated_at
      FROM router_config
      ORDER BY created_at DESC
    `).all();

    // Return configs without sensitive data
    const safeConfigs = configs.map(config => ({
      ...config,
      hasPassword: !!config.username
    }));

    res.json({ routers: safeConfigs });
  } catch (error) {
    logger.error('Error fetching router configs:', error.message);
    res.status(500).json({ error: getErrorMessage('fetchRouterConfigsFailed') });
  }
});

/**
 * Get a single router configuration
 */
router.get('/config/:id', requireAuth, (req, res) => {
  try {
    const config = db.prepare('SELECT * FROM router_config WHERE id = ?').get(req.params.id);

    if (!config) {
      return res.status(404).json({ error: getErrorMessage('routerNotFound') });
    }

    // Return without sensitive data
    res.json({
      ...config,
      hasPassword: !!config.username
    });
  } catch (error) {
    logger.error('Error fetching router config:', error.message);
    res.status(500).json({ error: getErrorMessage('fetchRouterConfigFailed') });
  }
});

/**
 * Test router connection
 */
router.post('/config/test', requireAuth, async (req, res) => {
  try {
    const { routerUrl, port, username, password } = req.body;

    if (!routerUrl) {
      return res.status(400).json({ error: getErrorMessage('routerUrlRequired') });
    }

    const client = new OpenWrtClient({
      url: routerUrl.includes('://') ? routerUrl : `http://${routerUrl}`,
      port: port || 22,
      username,
      password
    });

    const result = await client.testConnection();
    res.json(result);
  } catch (error) {
    logger.error('Router connection test failed:', error.message);
    res.json({ 
      success: false, 
      message: error.message || getErrorMessage('routerConnectionFailed') 
    });
  }
});

/**
 * Add a new router configuration
 */
router.post('/config', requireAuth, (req, res) => {
  try {
    const { name, routerUrl, port, username, password } = req.body;

    if (!name || !routerUrl) {
      return res.status(400).json({ error: getErrorMessage('nameAndUrlRequired') });
    }

    // Encrypt password if provided
    let encryptedPassword = null;
    let encryptionIv = null;
    let encryptionTag = null;

    if (password) {
      const encrypted = encryptPassword(password);
      encryptedPassword = encrypted.encryptedPassword;
      encryptionIv = encrypted.encryptionIv;
      encryptionTag = encrypted.encryptionTag;
    }

    const id = `router_${crypto.randomUUID().substring(0, 8)}`;

    db.prepare(`
      INSERT INTO router_config (id, name, router_url, port, username, encrypted_password, encryption_iv, encryption_tag)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name.trim(),
      routerUrl.trim(),
      port || 22,
      username?.trim() || null,
      encryptedPassword,
      encryptionIv,
      encryptionTag
    );

    logger.info(`Router config added: ${name} (${routerUrl})`);

    res.status(201).json({
      id,
      name,
      routerUrl,
      port,
      message: getErrorMessage('routerAddedSuccess')
    });
  } catch (error) {
    logger.error('Error adding router config:', error.message);
    res.status(500).json({ error: getErrorMessage('addRouterFailed') });
  }
});

/**
 * Update a router configuration
 */
router.put('/config/:id', requireAuth, (req, res) => {
  try {
    const { name, routerUrl, authType, username, password } = req.body;
    const configId = req.params.id;

    const existing = db.prepare('SELECT * FROM router_config WHERE id = ?').get(configId);
    if (!existing) {
      return res.status(404).json({ error: getErrorMessage('routerNotFound') });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (routerUrl !== undefined) {
      updates.push('router_url = ?');
      values.push(routerUrl.trim());
    }
    if (authType !== undefined) {
      updates.push('auth_type = ?');
      values.push(authType);
    }
    if (username !== undefined) {
      updates.push('username = ?');
      values.push(username.trim() || null);
    }
    if (password !== undefined) {
      if (password) {
        const encrypted = encryptPassword(password);
        updates.push('encrypted_password = ?');
        values.push(encrypted.encryptedPassword);
        updates.push('encryption_iv = ?');
        values.push(encrypted.encryptionIv);
        updates.push('encryption_tag = ?');
        values.push(encrypted.encryptionTag);
      } else {
        // Clear password if empty string provided
        updates.push('encrypted_password = NULL');
        values.push(null);
        updates.push('encryption_iv = NULL');
        values.push(null);
        updates.push('encryption_tag = NULL');
        values.push(null);
      }
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(configId);

      db.prepare(`UPDATE router_config SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      
      logger.info(`Router config updated: ${configId}`);
    }

    res.json({ message: getErrorMessage('routerUpdatedSuccess') });
  } catch (error) {
    logger.error('Error updating router config:', error.message);
    res.status(500).json({ error: getErrorMessage('updateRouterFailed') });
  }
});

/**
 * Delete a router configuration
 */
router.delete('/config/:id', requireAuth, (req, res) => {
  try {
    const configId = req.params.id;

    const existing = db.prepare('SELECT * FROM router_config WHERE id = ?').get(configId);
    if (!existing) {
      return res.status(404).json({ error: getErrorMessage('routerNotFound') });
    }

    // Delete associated port forwardings
    db.prepare('DELETE FROM port_forwardings WHERE router_id = ?').run(configId);
    
    // Delete router config
    db.prepare('DELETE FROM router_config WHERE id = ?').run(configId);

    logger.info(`Router config deleted: ${configId}`);

    res.json({ message: getErrorMessage('routerDeletedSuccess') });
  } catch (error) {
    logger.error('Error deleting router config:', error.message);
    res.status(500).json({ error: getErrorMessage('deleteRouterFailed') });
  }
});

/**
 * Get port forwardings for a router
 */
router.get('/config/:id/forwardings', requireAuth, async (req, res) => {
  try {
    const configId = req.params.id;

    const config = db.prepare('SELECT * FROM router_config WHERE id = ?').get(configId);
    if (!config) {
      return res.status(404).json({ error: getErrorMessage('routerNotFound') });
    }

    // Get local port forwardings
    const localForwardings = db.prepare(`
      SELECT * FROM port_forwardings WHERE router_id = ? ORDER BY created_at DESC
    `).all(configId);

    // Optionally fetch from router
    const fromRouter = req.query.fetch === 'true';
    let routerForwardings = [];

    if (fromRouter && config.username && config.encrypted_password) {
      try {
        const client = await createClientFromDbConfig(config);
        routerForwardings = await client.getPortForwardings();
      } catch (error) {
        logger.warn('Failed to fetch forwardings from router:', error.message);
      }
    }

    res.json({
      local: localForwardings,
      router: routerForwardings
    });
  } catch (error) {
    logger.error('Error fetching port forwardings:', error.message);
    res.status(500).json({ error: getErrorMessage('fetchForwardingsFailed') });
  }
});

/**
 * Add a port forwarding rule
 */
router.post('/config/:id/forwardings', requireAuth, async (req, res) => {
  try {
    const configId = req.params.id;
    const { name, protocol, externalPort, internalIp, internalPort, description } = req.body;

    const config = db.prepare('SELECT * FROM router_config WHERE id = ?').get(configId);
    if (!config) {
      return res.status(404).json({ error: getErrorMessage('routerNotFound') });
    }

    if (!name || !externalPort || !internalIp || !internalPort) {
      return res.status(400).json({ error: getErrorMessage('forwardingDetailsRequired') });
    }

    // Add to router if configured
    let uciName = null;
    if (config.username && config.encrypted_password) {
      try {
        const client = await createClientFromDbConfig(config);
        const result = await client.addPortForwarding({
          name,
          protocol,
          externalPort,
          internalIp,
          internalPort
        });
        uciName = result.uciName;
      } catch (error) {
        logger.warn('Failed to add forwarding to router:', error.message);
        // Continue to save locally anyway
      }
    }

    // Save locally
    const id = `fw_${crypto.randomUUID().substring(0, 8)}`;
    
    db.prepare(`
      INSERT INTO port_forwardings (id, router_id, name, protocol, external_port, internal_ip, internal_port, description, uci_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      configId,
      name,
      protocol || 'tcp',
      externalPort,
      internalIp,
      internalPort,
      description || null,
      uciName
    );

    logger.info(`Port forwarding added: ${name} (${configId})`);

    res.status(201).json({
      id,
      uciName,
      name,
      protocol: protocol || 'tcp',
      externalPort,
      internalIp,
      internalPort,
      message: getErrorMessage('forwardingAddedSuccess')
    });
  } catch (error) {
    logger.error('Error adding port forwarding:', error.message);
    res.status(500).json({ error: getErrorMessage('addForwardingFailed') });
  }
});

/**
 * Update a port forwarding rule
 */
router.put('/forwardings/:id', requireAuth, async (req, res) => {
  try {
    const forwardingId = req.params.id;
    const { name, protocol, externalPort, internalIp, internalPort, enabled } = req.body;

    const forwarding = db.prepare('SELECT * FROM port_forwardings WHERE id = ?').get(forwardingId);
    if (!forwarding) {
      return res.status(404).json({ error: getErrorMessage('forwardingNotFound') });
    }

    // Update on router if applicable
    if (forwarding.uci_name) {
      const config = db.prepare('SELECT * FROM router_config WHERE id = ?').get(forwarding.router_id);
      if (config?.username && config?.encrypted_password) {
        try {
          const client = await createClientFromDbConfig(config);
          await client.updatePortForwarding(forwarding.uci_name, {
            name,
            protocol,
            externalPort,
            internalIp,
            internalPort,
            enabled
          });
        } catch (error) {
          logger.warn('Failed to update forwarding on router:', error.message);
        }
      }
    }

    // Update locally
    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (protocol !== undefined) { updates.push('protocol = ?'); values.push(protocol); }
    if (externalPort !== undefined) { updates.push('external_port = ?'); values.push(externalPort); }
    if (internalIp !== undefined) { updates.push('internal_ip = ?'); values.push(internalIp); }
    if (internalPort !== undefined) { updates.push('internal_port = ?'); values.push(internalPort); }
    if (enabled !== undefined) { updates.push('enabled = ?'); values.push(enabled ? 1 : 0); }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(forwardingId);
      
      db.prepare(`UPDATE port_forwardings SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    logger.info(`Port forwarding updated: ${forwardingId}`);

    res.json({ message: getErrorMessage('forwardingUpdatedSuccess') });
  } catch (error) {
    logger.error('Error updating port forwarding:', error.message);
    res.status(500).json({ error: getErrorMessage('updateForwardingFailed') });
  }
});

/**
 * Delete a port forwarding rule
 */
router.delete('/forwardings/:id', requireAuth, async (req, res) => {
  try {
    const forwardingId = req.params.id;

    const forwarding = db.prepare('SELECT * FROM port_forwardings WHERE id = ?').get(forwardingId);
    if (!forwarding) {
      return res.status(404).json({ error: getErrorMessage('forwardingNotFound') });
    }

    // Delete from router if applicable
    if (forwarding.uci_name) {
      const config = db.prepare('SELECT * FROM router_config WHERE id = ?').get(forwarding.router_id);
      if (config?.username && config?.encrypted_password) {
        try {
          const client = await createClientFromDbConfig(config);
          await client.deletePortForwarding(forwarding.uci_name);
        } catch (error) {
          logger.warn('Failed to delete forwarding from router:', error.message);
        }
      }
    }

    // Delete locally
    db.prepare('DELETE FROM port_forwardings WHERE id = ?').run(forwardingId);

    logger.info(`Port forwarding deleted: ${forwardingId}`);

    res.json({ message: getErrorMessage('forwardingDeletedSuccess') });
  } catch (error) {
    logger.error('Error deleting port forwarding:', error.message);
    res.status(500).json({ error: getErrorMessage('deleteForwardingFailed') });
  }
});

/**
 * Sync all port forwardings to router
 */
router.post('/config/:id/sync', requireAuth, async (req, res) => {
  try {
    const configId = req.params.id;

    const config = db.prepare('SELECT * FROM router_config WHERE id = ?').get(configId);
    if (!config) {
      return res.status(404).json({ error: getErrorMessage('routerNotFound') });
    }

    if (!config.username || !config.encrypted_password) {
      return res.status(400).json({ error: getErrorMessage('routerCredentialsRequired') });
    }

    const client = await createClientFromDbConfig(config);
    
    // Get all local forwardings
    const forwardings = db.prepare('SELECT * FROM port_forwardings WHERE router_id = ? AND uci_name IS NULL').all(configId);
    
    const results = {
      added: 0,
      failed: 0,
      errors: []
    };

    for (const fw of forwardings) {
      try {
        const result = await client.addPortForwarding({
          name: fw.name,
          protocol: fw.protocol,
          externalPort: fw.external_port,
          internalIp: fw.internal_ip,
          internalPort: fw.internal_port
        });

        // Update with UCI name
        db.prepare('UPDATE port_forwardings SET uci_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(result.uciName, fw.id);
        
        results.added++;
      } catch (error) {
        results.failed++;
        results.errors.push({ id: fw.id, name: fw.name, error: error.message });
      }
    }

    // Update sync timestamp
    db.prepare('UPDATE router_config SET last_sync_at = CURRENT_TIMESTAMP WHERE id = ?').run(configId);

    logger.info(`Router sync completed: ${results.added} added, ${results.failed} failed`);

    res.json({
      message: getErrorMessage('syncCompleted'),
      ...results
    });
  } catch (error) {
    logger.error('Error syncing router:', error.message);
    res.status(500).json({ error: getErrorMessage('syncFailed') });
  }
});

/**
 * Batch operations for port forwardings
 */
router.post('/batch', requireAuth, async (req, res) => {
  try {
    const { routerId, operation, forwardingIds } = req.body;

    if (!routerId || !operation || !forwardingIds || !Array.isArray(forwardingIds)) {
      return res.status(400).json({ error: getErrorMessage('invalidBatchRequest') });
    }

    const config = db.prepare('SELECT * FROM router_config WHERE id = ?').get(routerId);
    if (!config) {
      return res.status(404).json({ error: getErrorMessage('routerNotFound') });
    }

    let client = null;
    if (config.username && config.encrypted_password) {
      client = await createClientFromDbConfig(config);
    }

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const id of forwardingIds) {
      try {
        const forwarding = db.prepare('SELECT * FROM port_forwardings WHERE id = ? AND router_id = ?').get(id, routerId);
        if (!forwarding) continue;

        switch (operation) {
          case 'enable':
            if (forwarding.uci_name && client) {
              await client.setPortForwardingEnabled(forwarding.uci_name, true);
            }
            db.prepare('UPDATE port_forwardings SET enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
            break;

          case 'disable':
            if (forwarding.uci_name && client) {
              await client.setPortForwardingEnabled(forwarding.uci_name, false);
            }
            db.prepare('UPDATE port_forwardings SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
            break;

          case 'delete':
            if (forwarding.uci_name && client) {
              await client.deletePortForwarding(forwarding.uci_name);
            }
            db.prepare('DELETE FROM port_forwardings WHERE id = ?').run(id);
            break;

          default:
            throw new Error(`Unknown operation: ${operation}`);
        }

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({ id, error: error.message });
      }
    }

    res.json(results);
  } catch (error) {
    logger.error('Error in batch operation:', error.message);
    res.status(500).json({ error: getErrorMessage('batchOperationFailed') });
  }
});

/**
 * Import port forwardings from router to local database
 */
router.post('/config/:id/import-forwardings', requireAuth, async (req, res) => {
  try {
    const configId = req.params.id;

    const config = db.prepare('SELECT * FROM router_config WHERE id = ?').get(configId);
    if (!config) {
      return res.status(404).json({ error: getErrorMessage('routerNotFound') });
    }

    if (!config.username || !config.encrypted_password) {
      return res.status(400).json({ error: getErrorMessage('routerCredentialsRequired') });
    }

    // Fetch forwardings from router
    const client = await createClientFromDbConfig(config);
    const routerForwardings = await client.getPortForwardings();

    const results = {
      imported: 0,
      skipped: 0,
      errors: []
    };

    for (const fw of routerForwardings) {
      try {
        // Check if already exists by uci_name
        const existing = db.prepare(
          'SELECT * FROM port_forwardings WHERE router_id = ? AND uci_name = ?'
        ).get(configId, fw.id);

        if (existing) {
          results.skipped++;
          continue;
        }

        // Insert new forwarding from router
        db.prepare(`
          INSERT INTO port_forwardings (router_id, name, protocol, external_port, internal_ip, internal_port, description, uci_name, enabled)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          configId,
          fw.name,
          fw.protocol,
          fw.external_port,
          fw.internal_ip,
          fw.internal_port,
          fw.description || '',
          fw.id,
          fw.enabled ? 1 : 0
        );

        results.imported++;
      } catch (err) {
        results.errors.push({ id: fw.id, error: err.message });
      }
    }

    res.json(results);
  } catch (error) {
    logger.error('Error importing forwardings from router:', error.message);
    res.status(500).json({ error: getErrorMessage('importForwardingsFailed') });
  }
});

module.exports = router;
