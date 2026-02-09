/**
 * OpenWrt Router API Client
 * Implements UCI and Luci JSON-RPC integration for OpenWrt-based routers
 */

const { decryptPassword } = require('./router-encryption');
const { Logger } = require('./logger');

const logger = new Logger('OpenWrtAPI');

// Default Luci RPC path
const DEFAULT_RPC_PATH = '/cgi-bin/luci/rpc';
const DEFAULT_TIMEOUT = 10000;

/**
 * Parse router URL to get base URL and RPC path
 * @param {string} url - Router URL (e.g., http://192.168.1.1:8080)
 * @returns {object} - { baseUrl, rpcPath }
 */
function parseRouterUrl(url) {
  try {
    const urlObj = new URL(url);
    return {
      baseUrl: `${urlObj.protocol}//${urlObj.host}`,
      rpcPath: urlObj.pathname || DEFAULT_RPC_PATH
    };
  } catch (error) {
    throw new Error(`Invalid router URL: ${url}`);
  }
}

/**
 * Generate a UCI-compatible name from a service name
 * @param {string} name - Service name
 * @returns {string} - UCI-compatible name
 */
function generateUciName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .substring(0, 32);
}

/**
 * Check if a string is a valid IP address
 * @param {string} ip - IP address to validate
 * @returns {boolean}
 */
function isValidIpAddress(ip) {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ip);
}

/**
 * Validate port number
 * @param {number} port - Port number
 * @returns {boolean}
 */
function isValidPort(port) {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

class OpenWrtClient {
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.rpcPath = config.rpcPath || DEFAULT_RPC_PATH;
    this.username = config.username;
    this.password = config.password;
    this.authToken = null;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    
    logger.info(`Initialized OpenWrt client for ${this.baseUrl}`);
  }

  /**
   * Authenticate with the router and get auth token
   * @returns {Promise<string>} - Auth token
   */
  async authenticate() {
    try {
      const response = await this.callRpc('auth', {
        method: 'login',
        params: [this.username, this.password]
      });

      if (response.error) {
        throw new Error(`Authentication failed: ${response.error}`);
      }

      this.authToken = response.result;
      logger.info('Successfully authenticated with router');
      return this.authToken;
    } catch (error) {
      logger.error('Authentication error:', error.message);
      throw error;
    }
  }

  /**
   * Make a JSON-RPC call to Luci
   * @param {string} methodGroup - Method group (e.g., 'uci', 'sys', 'auth')
   * @param {string} method - Method name
   * @param {Array} params - Parameters
   * @returns {Promise<object>} - RPC response
   */
  async callRpc(methodGroup, method, params = []) {
    const fullRpcUrl = `${this.baseUrl}${this.rpcPath}/${methodGroup}`;
    
    const payload = {
      id: Math.floor(Math.random() * 10000),
      method,
      params
    };

    const fetch = (await import('node-fetch')).default;
    const response = await fetch(fullRpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.authToken && { 'X-LuCI-Auth': this.authToken })
      },
      body: JSON.stringify(payload),
      timeout: this.timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Execute a UCI command
   * @param {string} command - UCI command (e.g., 'add', 'set', 'get')
   * @param {Array} params - Command parameters
   * @returns {Promise<any>}
   */
  async uci(command, params = []) {
    if (!this.authToken) {
      await this.authenticate();
    }
    return this.callRpc('uci', command, params);
  }

  /**
   * Test connection to the router
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      // Try to authenticate
      await this.authenticate();
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { 
        success: false, 
        message: error.message || 'Failed to connect to router'
      };
    }
  }

  /**
   * Get router system info
   * @returns {Promise<object>}
   */
  async getSystemInfo() {
    if (!this.authToken) {
      await this.authenticate();
    }

    try {
      const [uptime, memory, hostname] = await Promise.all([
        this.callRpc('sys', 'exec', { command: 'uptime' }),
        this.callRpc('sys', 'exec', { command: 'cat /proc/meminfo | grep -E "MemTotal|MemFree"' }),
        this.callRpc('sys', 'get', ['system', '@system[0]', 'hostname'])
      ]);

      return {
        hostname: hostname?.result || 'Unknown',
        uptime: uptime?.result || 'Unknown',
        memory: memory?.result || 'Unknown'
      };
    } catch (error) {
      logger.warn('Failed to get system info:', error.message);
      return { hostname: 'Unknown', uptime: 'Unknown', memory: 'Unknown' };
    }
  }

  /**
   * Get all port forwarding rules from the router
   * @returns {Promise<Array>}
   */
  async getPortForwardings() {
    if (!this.authToken) {
      await this.authenticate();
    }

    try {
      const response = await this.uci('get_all', ['firewall']);
      
      if (response.error) {
        throw new Error(`UCI error: ${response.error}`);
      }

      const rules = [];
      const result = response.result || {};

      // Parse firewall config to find redirect rules
      Object.keys(result).forEach((key) => {
        const section = result[key];
        if (section['.type'] === 'redirect') {
          rules.push({
            uciName: key,
            name: section.name || key,
            target: section.target,
            src: section.src,
            dest: section.dest,
            proto: section.proto,
            srcDport: section.src_dport,
            destIp: section.dest_ip,
            destPort: section.dest_port,
            enabled: section.enabled !== '0',
            reflection: section.reflection
          });
        }
      });

      return rules;
    } catch (error) {
      logger.error('Failed to get port forwardings:', error.message);
      throw error;
    }
  }

  /**
   * Add a new port forwarding rule
   * @param {object} config - Port forwarding configuration
   * @returns {Promise<object>}
   */
  async addPortForwarding(config) {
    if (!this.authToken) {
      await this.authenticate();
    }

    const {
      name,
      protocol = 'tcp',
      externalPort,
      internalIp,
      internalPort,
      src = 'wan',
      dest = 'lan',
      target = 'DNAT'
    } = config;

    // Validate inputs
    if (!isValidIpAddress(internalIp)) {
      throw new Error(`Invalid internal IP address: ${internalIp}`);
    }
    if (!isValidPort(externalPort)) {
      throw new Error(`Invalid external port: ${externalPort}`);
    }
    if (!isValidPort(internalPort)) {
      throw new Error(`Invalid internal port: ${internalPort}`);
    }

    const uciName = generateUciName(name);

    try {
      // Add redirect
      const addResult = await this.uci('add', ['firewall', 'redirect']);
      if (addResult.error) {
        throw new Error(`Failed to add redirect: ${addResult.error}`);
      }

      // Rename to our custom name
      const renameResult = await this.uci('rename', ['firewall', '@redirect[-1]', uciName]);
      if (renameResult.error) {
        throw new Error(`Failed to rename redirect: ${renameResult.error}`);
      }

      // Set configuration
      const setOps = [
        ['set', ['firewall', uciName, 'name', name]],
        ['set', ['firewall', uciName, 'target', target]],
        ['set', ['firewall', uciName, 'src', src]],
        ['set', ['firewall', uciName, 'dest', dest]],
        ['set', ['firewall', uciName, 'proto', protocol]],
        ['set', ['firewall', uciName, 'src_dport', String(externalPort)]],
        ['set', ['firewall', uciName, 'dest_ip', internalIp]],
        ['set', ['firewall', uciName, 'dest_port', String(internalPort)]],
        ['set', ['firewall', uciName, 'enabled', '1']]
      ];

      for (const op of setOps) {
        const result = await this.uci(op[0], op[1]);
        if (result.error) {
          throw new Error(`Failed to set ${op[1][1]}: ${result.error}`);
        }
      }

      // Commit changes
      const commitResult = await this.uci('commit', ['firewall']);
      if (commitResult.error) {
        throw new Error(`Failed to commit firewall config: ${commitResult.error}`);
      }

      logger.info(`Added port forwarding rule: ${name} (${externalPort} -> ${internalIp}:${internalPort})`);

      return {
        success: true,
        uciName,
        message: `Port forwarding "${name}" added successfully`
      };
    } catch (error) {
      logger.error('Failed to add port forwarding:', error.message);
      throw error;
    }
  }

  /**
   * Update an existing port forwarding rule
   * @param {string} uciName - UCI config name
   * @param {object} config - Updated configuration
   * @returns {Promise<object>}
   */
  async updatePortForwarding(uciName, config) {
    if (!this.authToken) {
      await this.authenticate();
    }

    const {
      name,
      protocol,
      externalPort,
      internalIp,
      internalPort,
      enabled
    } = config;

    try {
      const updates = [];
      
      if (name) updates.push(['set', ['firewall', uciName, 'name', name]]);
      if (protocol) updates.push(['set', ['firewall', uciName, 'proto', protocol]]);
      if (externalPort) updates.push(['set', ['firewall', uciName, 'src_dport', String(externalPort)]]);
      if (internalIp) updates.push(['set', ['firewall', uciName, 'dest_ip', internalIp]]);
      if (internalPort) updates.push(['set', ['firewall', uciName, 'dest_port', String(internalPort)]]);
      if (typeof enabled === 'boolean') updates.push(['set', ['firewall', uciName, 'enabled', enabled ? '1' : '0']]);

      for (const op of updates) {
        const result = await this.uci(op[0], op[1]);
        if (result.error) {
          throw new Error(`Failed to update ${op[1][1]}: ${result.error}`);
        }
      }

      const commitResult = await this.uci('commit', ['firewall']);
      if (commitResult.error) {
        throw new Error(`Failed to commit firewall config: ${commitResult.error}`);
      }

      logger.info(`Updated port forwarding rule: ${uciName}`);

      return {
        success: true,
        uciName,
        message: `Port forwarding "${name || uciName}" updated successfully`
      };
    } catch (error) {
      logger.error('Failed to update port forwarding:', error.message);
      throw error;
    }
  }

  /**
   * Delete a port forwarding rule
   * @param {string} uciName - UCI config name
   * @returns {Promise<object>}
   */
  async deletePortForwarding(uciName) {
    if (!this.authToken) {
      await this.authenticate();
    }

    try {
      // Delete the redirect
      const deleteResult = await this.uci('delete', ['firewall', uciName]);
      if (deleteResult.error) {
        throw new Error(`Failed to delete redirect: ${deleteResult.error}`);
      }

      // Commit changes
      const commitResult = await this.uci('commit', ['firewall']);
      if (commitResult.error) {
        throw new Error(`Failed to commit firewall config: ${commitResult.error}`);
      }

      logger.info(`Deleted port forwarding rule: ${uciName}`);

      return {
        success: true,
        uciName,
        message: `Port forwarding "${uciName}" deleted successfully`
      };
    } catch (error) {
      logger.error('Failed to delete port forwarding:', error.message);
      throw error;
    }
  }

  /**
   * Enable/disable a port forwarding rule
   * @param {string} uciName - UCI config name
   * @param {boolean} enabled - Enable or disable
   * @returns {Promise<object>}
   */
  async setPortForwardingEnabled(uciName, enabled) {
    return this.updatePortForwarding(uciName, { enabled });
  }

  /**
   * Reload firewall to apply changes
   * @returns {Promise<object>}
   */
  async reloadFirewall() {
    if (!this.authToken) {
      await this.authenticate();
    }

    try {
      const result = await this.callRpc('sys', 'exec', { command: '/etc/init.d/firewall reload' });
      
      logger.info('Firewall reloaded');
      
      return {
        success: true,
        message: 'Firewall reloaded successfully'
      };
    } catch (error) {
      logger.warn('Failed to reload firewall:', error.message);
      // Don't throw - firewall might not need reload for UCI changes
      return {
        success: false,
        message: `Failed to reload firewall: ${error.message}`
      };
    }
  }
}

/**
 * Create a router client from database config
 * @param {object} dbConfig - Database router config object
 * @returns {Promise<OpenWrtClient>}
 */
async function createClientFromDbConfig(dbConfig) {
  const { routerUrl, username, encryptedPassword, encryptionIv, encryptionTag } = dbConfig;
  
  // Decrypt password
  const password = decryptPassword({
    encryptedPassword,
    encryptionIv,
    encryptionTag
  });

  const { baseUrl } = parseRouterUrl(routerUrl);

  return new OpenWrtClient({
    baseUrl,
    username,
    password
  });
}

module.exports = {
  OpenWrtClient,
  createClientFromDbConfig,
  parseRouterUrl,
  generateUciName,
  isValidIpAddress,
  isValidPort
};
