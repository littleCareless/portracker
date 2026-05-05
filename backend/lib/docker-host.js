'use strict';

const fs = require('fs');
const os = require('os');

function isDockerDesktopEnvironment() {
  try {
    if (process.env.DOCKER_DESKTOP === 'true') {
      return true;
    }

    if (fs.existsSync('/proc/version')) {
      const version = fs.readFileSync('/proc/version', 'utf8');
      if (version.includes('linuxkit') || version.includes('docker-desktop')) {
        return true;
      }
    }

    if (fs.existsSync('/proc/net/route')) {
      const routes = fs.readFileSync('/proc/net/route', 'utf8');
      const gatewayLines = routes.split('\n').filter(line => {
        const fields = line.split('\t');
        return fields[1] === '00000000';
      });

      for (const line of gatewayLines) {
        const fields = line.split('\t');
        const gatewayHex = fields[2];
        const gateway = [
          parseInt(gatewayHex.substr(6, 2), 16),
          parseInt(gatewayHex.substr(4, 2), 16),
          parseInt(gatewayHex.substr(2, 2), 16),
          parseInt(gatewayHex.substr(0, 2), 16)
        ].join('.');

        if (gateway.startsWith('192.168.65.') || gateway.startsWith('172.19.') || gateway.startsWith('172.20.')) {
          return true;
        }
      }
    }

    return false;
  } catch (_err) {
    return false;
  }
}

function getDockerHostIP() {
  const platform = os.platform();

  if (platform === 'darwin' || platform === 'win32') {
    return 'host.docker.internal';
  }

  if (isDockerDesktopEnvironment()) {
    return 'host.docker.internal';
  }

  try {
    if (fs.existsSync('/proc/net/route')) {
      const routes = fs.readFileSync('/proc/net/route', 'utf8');
      const lines = routes.split('\n');
      for (const line of lines) {
        const fields = line.split('\t');
        if (fields[1] === '00000000' && fields[7] === '00000000') {
          const gatewayHex = fields[2];
          const gateway = [
            parseInt(gatewayHex.substr(6, 2), 16),
            parseInt(gatewayHex.substr(4, 2), 16),
            parseInt(gatewayHex.substr(2, 2), 16),
            parseInt(gatewayHex.substr(0, 2), 16)
          ].join('.');
          return gateway;
        }
      }
    }
  } catch (_err) {
    void _err;
  }

  return '172.17.0.1';
}

module.exports = {
  getDockerHostIP,
  isDockerDesktopEnvironment,
};
