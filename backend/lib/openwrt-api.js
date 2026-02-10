/**
 * OpenWrt Router API Client
 * Supports both JSON-RPC (luci-mod-rpc) and SSH+UCI modes
 */

const { decryptPassword } = require('./router-encryption');
const { Logger } = require('./logger');
const { Client } = require('ssh2');

const logger = new Logger('OpenWrtAPI');

// Default Luci RPC path
const DEFAULT_RPC_PATH = '/cgi-bin/luci/rpc';
const DEFAULT_TIMEOUT = 10000;

/**
 * Parse router URL to get hostname and port
 */
function parseRouterUrl(url) {
  let hostname = url;
  let port = 22; // Default SSH port

  // Remove protocol if present
  if (url.includes('://')) {
    const withoutProtocol = url.split('://')[1];
    // Check for port in URL
    const portMatch = withoutProtocol.match(/:(\d+)/);
    if (portMatch) {
      hostname = withoutProtocol.split(':')[0];
      port = parseInt(portMatch[1], 10);
    } else {
      hostname = withoutProtocol.split('/')[0];
    }
  } else {
    // Check for port in URL without protocol
    const portMatch = url.match(/:(\d+)/);
    if (portMatch) {
      hostname = url.split(':')[0];
      port = parseInt(portMatch[1], 10);
    }
  }

  return {
    hostname,
    port,
    baseUrl: `http://${hostname}:${port}`
  };
}

/**
 * Generate a UCI-compatible name from a service name
 */
function generateUciName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .substring(0, 32);
}

/**
 * Check if a string is a valid IP address
 */
function isValidIpAddress(ip) {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ip);
}

/**
 * Validate port number
 */
function isValidPort(port) {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

/**
 * SSH-based UCI Client (no plugins required)
 */
class SshUciClient {
  constructor(config) {
    this.hostname = config.hostname || '192.168.1.1';
    this.port = config.port || 22;
    this.username = config.username || 'root';
    this.password = config.password;
    this.timeout = config.timeout || 15000;
  }

  /**
   * Execute a command via SSH and return the result
   */
  async exec(command) {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      
      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end();
            return reject(err);
          }
          
          let stdout = '';
          let stderr = '';
          
          stream.on('close', (code, signal) => {
            conn.end();
            if (code === 0) {
              resolve(stdout.trim());
            } else {
              reject(new Error(`Command exited with code ${code}: ${stderr}`));
            }
          });
          
          stream.on('data', (data) => {
            stdout += data.toString();
          });
          
          stream.stderr.on('data', (data) => {
            stderr += data.toString();
          });
        });
      });
      
      conn.on('error', (err) => {
        conn.end();
        reject(err);
      });
      
      conn.connect({
        host: this.hostname,
        port: this.port,
        username: this.username,
        password: this.password,
        readyTimeout: this.timeout,
        timeout: this.timeout
      });
    });
  }

  /**
   * Execute UCI command
   */
  async uci(command) {
    return this.exec(`uci ${command}`);
  }

  /**
   * Get all redirect rules from firewall config
   */
  async getRedirects() {
    try {
      const output = await this.exec("uci show firewall 2>/dev/null | grep '=redirect'");
      const rules = [];
      
      if (!output) return rules;
      
      const lines = output.split('\n');
      for (const line of lines) {
        // Match both named rules (firewall.name=redirect) and anonymous rules (firewall.@redirect[0]=redirect)
        const match = line.match(/firewall\.([^=]+)=redirect/);
        if (match) {
          const uciName = match[1];
          const name = await this.exec(`uci get firewall.${uciName}.name 2>/dev/null`);
          const target = await this.exec(`uci get firewall.${uciName}.target 2>/dev/null`);
          const src = await this.exec(`uci get firewall.${uciName}.src 2>/dev/null`);
          const dest = await this.exec(`uci get firewall.${uciName}.dest 2>/dev/null`);
          const proto = await this.exec(`uci get firewall.${uciName}.proto 2>/dev/null`);
          const srcPort = await this.exec(`uci get firewall.${uciName}.src_dport 2>/dev/null`);
          const destIp = await this.exec(`uci get firewall.${uciName}.dest_ip 2>/dev/null`);
          const destPort = await this.exec(`uci get firewall.${uciName}.dest_port 2>/dev/null`);
          const enabled = await this.exec(`uci get firewall.${uciName}.enabled 2>/dev/null`);
          
          rules.push({
            id: uciName,
            name: name || `Redirect ${uciName.replace('@redirect[', '').replace(']', '')}`,
            target,
            src,
            dest,
            protocol: proto || 'tcp',
            external_port: parseInt(srcPort) || 0,
            internal_ip: destIp || '',
            internal_port: parseInt(destPort) || 0,
            enabled: enabled !== '0'
          });
        }
      }
      
      return rules;
    } catch (error) {
      logger.error('Failed to get redirects:', error.message);
      return [];
    }
  }

  /**
   * Add a new port forwarding rule
   */
  async addRedirect(config) {
    const uciName = generateUciName(config.name || 'port_forward');
    
    // Add redirect
    await this.exec(`uci add firewall redirect`);
    await this.exec(`uci set firewall.@redirect[-1].name='${uciName}'`);
    await this.exec(`uci set firewall.@redirect[-1].target='DNAT'`);
    await this.exec(`uci set firewall.@redirect[-1].src='wan'`);
    await this.exec(`uci set firewall.@redirect[-1].dest='lan'`);
    await this.exec(`uci set firewall.@redirect[-1].proto='${config.protocol || 'tcp'}'`);
    await this.exec(`uci set firewall.@redirect[-1].src_dport='${config.externalPort}'`);
    await this.exec(`uci set firewall.@redirect[-1].dest_ip='${config.internalIp}'`);
    await this.exec(`uci set firewall.@redirect[-1].dest_port='${config.internalPort}'`);
    await this.exec(`uci set firewall.@redirect[-1].enabled='1'`);
    
    // Commit changes
    await this.exec('uci commit firewall');
    
    // Restart firewall
    await this.exec('/etc/init.d/firewall restart 2>/dev/null || true');
    
    return { success: true, id: uciName };
  }

  /**
   * Delete a port forwarding rule
   */
  async deleteRedirect(id) {
    await this.exec(`uci delete firewall.${id}`);
    await this.exec('uci commit firewall');
    await this.exec('/etc/init.d/firewall restart 2>/dev/null || true');
    return { success: true };
  }

  /**
   * Test connection - returns detailed info
   */
  async testConnection() {
    try {
      // First, try to execute a simple command to verify connection
      const version = await this.exec('cat /etc/openwrt_release 2>/dev/null | head -1 || uname -r');
      return {
        success: true,
        message: `Connected to OpenWrt (${version})`,
        version: version || 'Unknown'
      };
    } catch (error) {
      logger.error('SSH connection error:', error.message, error.code);
      return {
        success: false,
        message: `SSH failed: ${error.message}`,
        code: error.code || 'UNKNOWN'
      };
    }
  }
}

/**
 * JSON-RPC Client (requires luci-mod-rpc)
 */
class OpenWrtRpcClient {
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.rpcPath = config.rpcPath || DEFAULT_RPC_PATH;
    this.username = config.username;
    this.password = config.password;
    this.authToken = null;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    
    logger.info(`Initialized RPC client for ${this.baseUrl}`);
  }

  /**
   * Make a JSON-RPC call to Luci
   */
  async callRpc(method, params = []) {
    const url = `${this.baseUrl}${this.rpcPath}/${method}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        method: 'call',
        params: [this.authToken, 'uci', ...params]
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Execute UCI command via JSON-RPC
   */
  async uci(method, params = []) {
    return this.callRpc('call', [this.authToken, 'uci', method, params]);
  }

  /**
   * Authenticate with the router
   */
  async authenticate() {
    const url = `${this.baseUrl}${this.rpcPath}/auth`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        method: 'login',
        params: [this.username, this.password]
      })
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`Authentication failed: ${data.error}`);
    }

    this.authToken = data.result;
    return this.authToken;
  }

  /**
   * Test connection (JSON-RPC mode)
   */
  async testConnection() {
    try {
      // Try authentication first
      await this.authenticate();
      
      // Get system info
      const sysInfo = await this.callRpc('call', [this.authToken, 'uci', 'get', ['system', 'info']]);
      
      return {
        success: true,
        message: 'JSON-RPC connection successful',
        mode: 'rpc'
      };
    } catch (error) {
      return {
        success: false,
        message: `JSON-RPC failed: ${error.message}`,
        mode: 'rpc'
      };
    }
  }
}

/**
 * Unified OpenWrt Client - auto-detects best mode
 */
class OpenWrtClient {
  constructor(config) {
    this.connectionMode = config.connectionMode || 'auto'; // 'rpc', 'ssh', or 'auto'
    this.rpcClient = null;
    this.sshClient = null;
    
    // Parse URL and override with explicit port if provided
    const parsed = parseRouterUrl(config.url);
    this.hostname = parsed.hostname;
    this.port = config.port || parsed.port || 22;
    this.baseUrl = parsed.baseUrl;
    this.username = config.username;
    this.password = config.password;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    
    logger.info(`Initialized OpenWrt client for ${this.hostname}:${this.port}`);
  }

  /**
   * Initialize the appropriate client based on connection mode
   */
  async initialize() {
    if (this.connectionMode === 'ssh') {
      this.sshClient = new SshUciClient({
        hostname: this.hostname,
        port: this.port,
        username: this.username,
        password: this.password,
        timeout: this.timeout
      });
      return;
    }

    if (this.connectionMode === 'rpc') {
      this.rpcClient = new OpenWrtRpcClient({
        baseUrl: this.baseUrl,
        username: this.username,
        password: this.password,
        timeout: this.timeout
      });
      return;
    }

    // Auto-detect mode: try SSH first (works without plugins)
    this.sshClient = new SshUciClient({
      hostname: this.hostname,
      port: this.port,
      username: this.username,
      password: this.password,
      timeout: this.timeout
    });

    try {
      const sshResult = await this.sshClient.testConnection();
      if (sshResult.success) {
        this.connectionMode = 'ssh';
        logger.info('Using SSH+UCI mode (no plugins required)');
        return;
      }
    } catch (e) {
      logger.debug('SSH connection failed, trying JSON-RPC...');
    }

    // Fallback to JSON-RPC
    if (this.rpcClient === null) {
      this.rpcClient = new OpenWrtRpcClient({
        baseUrl: this.baseUrl,
        username: this.username,
        password: this.password,
        timeout: this.timeout
      });
    }

    try {
      const rpcResult = await this.rpcClient.testConnection();
      if (rpcResult.success) {
        await this.rpcClient.authenticate();
        this.connectionMode = 'rpc';
        logger.info('Using JSON-RPC mode');
        return;
      }
    } catch (e) {
      logger.debug('JSON-RPC connection failed');
    }

    throw new Error('Unable to connect to router. Please check your settings.');
  }

  /**
   * Test connection and return mode info
   */
  async testConnection() {
    // Try SSH first (no plugins needed)
    const sshClient = new SshUciClient({
      hostname: this.hostname,
      port: this.port,
      username: this.username,
      password: this.password,
      timeout: this.timeout
    });

    try {
      const result = await sshClient.testConnection();
      this.sshClient = sshClient;
      this.connectionMode = 'ssh';
      return { ...result, mode: 'ssh', requiresPlugins: false };
    } catch (sshError) {
      logger.debug('SSH failed:', sshError.message);
      return {
        success: false,
        message: `SSH 连接失败: ${sshError.message}`,
        hint: '请检查: 1) 用户名和密码是否正确 2) SSH 密码认证是否启用 3) root 用户登录是否允许',
        mode: 'ssh',
        requiresPlugins: false
      };
    }

    // Try JSON-RPC
    const rpcClient = new OpenWrtRpcClient({
      baseUrl: this.baseUrl,
      username: this.username,
      password: this.password,
      timeout: this.timeout
    });

    try {
      const result = await rpcClient.testConnection();
      this.rpcClient = rpcClient;
      this.connectionMode = 'rpc';
      return { ...result, mode: 'rpc', requiresPlugins: true };
    } catch (rpcError) {
      logger.debug('JSON-RPC failed:', rpcError.message);
    }

    return {
      success: false,
      message: 'Unable to connect via SSH or JSON-RPC',
      hints: [
        'Ensure SSH is enabled on your router (default: port 22)',
        'For JSON-RPC, install luci-mod-rpc: opkg install luci-mod-rpc'
      ]
    };
  }

  /**
   * Get all port forwarding rules
   */
  async getPortForwardings() {
    if (this.connectionMode === 'ssh') {
      const local = await this.sshClient.getRedirects();
      return { local, mode: 'ssh' };
    }

    // RPC mode implementation would go here
    const local = await this.rpcClient.uci('get', ['firewall']);
    return { local: [], mode: 'rpc' };
  }

  /**
   * Add a port forwarding rule
   */
  async addPortForwarding(config) {
    if (this.connectionMode === 'ssh') {
      return this.sshClient.addRedirect(config);
    }

    // RPC mode implementation
    throw new Error('JSON-RPC mode not yet implemented for adding forwardings');
  }

  /**
   * Delete a port forwarding rule
   */
  async deletePortForwarding(id) {
    if (this.connectionMode === 'ssh') {
      return this.sshClient.deleteRedirect(id);
    }

    throw new Error('JSON-RPC mode not yet implemented for deleting forwardings');
  }
}

/**
 * Factory function to create client from DB config
 */
async function createClientFromDbConfig(dbConfig) {
  const client = new OpenWrtClient({
    url: dbConfig.router_url,
    username: dbConfig.username,
    password: dbConfig.password ? decryptPassword(dbConfig.password) : null,
    connectionMode: 'auto',
    timeout: 15000
  });

  await client.initialize();
  return client;
}

module.exports = {
  OpenWrtClient,
  SshUciClient,
  OpenWrtRpcClient,
  createClientFromDbConfig,
  parseRouterUrl,
  generateUciName,
  isValidIpAddress,
  isValidPort
};