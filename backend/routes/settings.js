const express = require('express');
const db = require('../db');
const { Logger } = require('../lib/logger');
const { requireAuth, isAuthEnabled } = require('../middleware/auth');
const settingsManager = require('../lib/settings-manager');
const apiKeyManager = require('../lib/api-key-manager');
const { getErrorMessage } = require('../lib/i18n');

const router = express.Router();
const logger = new Logger('SettingsRoutes', { debug: process.env.DEBUG === 'true' });

router.get('/', (req, res) => {
  try {
    const userId = isAuthEnabled() && req.session?.userId ? req.session.userId : null;
    const settings = settingsManager.getUserSettings(userId);

    res.json(settings);
  } catch (error) {
    logger.error('Error fetching settings:', error.message);
    res.status(500).json({ error: getErrorMessage('fetchSettingsFailed') });
  }
});

router.put('/', (req, res) => {
  try {
    const userId = isAuthEnabled() && req.session?.userId ? req.session.userId : null;
    const settings = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: getErrorMessage('invalidSettingsData') });
    }

    settingsManager.updateUserSettings(userId, settings);
    const updated = settingsManager.getUserSettings(userId);

    res.json(updated);
  } catch (error) {
    logger.error('Error updating settings:', error.message);
    res.status(500).json({ error: getErrorMessage('updateSettingsFailed') });
  }
});

router.get('/defaults', (req, res) => {
  const defaults = settingsManager.getDefaultSettings();
  res.json(defaults);
});

router.post('/servers/:serverId/api-key', requireAuth, async (req, res) => {
  try {
    const { serverId } = req.params;

    if (!serverId) {
      return res.status(400).json({ error: getErrorMessage('serverIdRequired') });
    }

    const server = db.prepare('SELECT id, label FROM servers WHERE id = ?').get(serverId);
    if (!server) {
      return res.status(404).json({ error: getErrorMessage('serverNotFound') });
    }

    if (serverId !== 'local') {
      return res.status(400).json({ error: getErrorMessage('apiKeyLocalOnly') });
    }

    const result = await apiKeyManager.generateApiKey(serverId);
    if (!result) {
      return res.status(500).json({ error: getErrorMessage('generateApiKeyFailed') });
    }

    logger.info(`API key generated for server: ${serverId} (${server.label})`);

    res.json({
      success: true,
      apiKey: result.apiKey,
      createdAt: result.createdAt,
      message: getErrorMessage('apiKeyGenerated')
    });
  } catch (error) {
    logger.error('Error generating API key:', error.message);
    res.status(500).json({ error: getErrorMessage('generateApiKeyFailed') });
  }
});

router.get('/servers/:serverId/api-key', requireAuth, (req, res) => {
  try {
    const { serverId } = req.params;

    if (!serverId) {
      return res.status(400).json({ error: getErrorMessage('serverIdRequired') });
    }

    const info = apiKeyManager.getApiKeyInfo(serverId);
    if (!info) {
      return res.status(404).json({ error: getErrorMessage('serverNotFound') });
    }

    res.json(info);
  } catch (error) {
    logger.error('Error fetching API key info:', error.message);
    res.status(500).json({ error: getErrorMessage('fetchApiKeyInfoFailed') });
  }
});

router.delete('/servers/:serverId/api-key', requireAuth, (req, res) => {
  try {
    const { serverId } = req.params;

    if (!serverId) {
      return res.status(400).json({ error: getErrorMessage('serverIdRequired') });
    }

    if (serverId !== 'local') {
      return res.status(400).json({ error: getErrorMessage('revokeApiKeyLocalOnly') });
    }

    const revoked = apiKeyManager.revokeApiKey(serverId);
    if (!revoked) {
      return res.status(404).json({ error: getErrorMessage('revokeApiKeyNotFound') });
    }

    logger.info(`API key revoked for server: ${serverId}`);

    res.json({
      success: true,
      message: getErrorMessage('apiKeyRevoked')
    });
  } catch (error) {
    logger.error('Error revoking API key:', error.message);
    res.status(500).json({ error: getErrorMessage('revokeApiKeyFailed') });
  }
});

module.exports = router;
