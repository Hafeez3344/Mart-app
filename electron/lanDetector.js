const os = require('os');

/**
 * Returns an array of IPv4 addresses for the local machine on LAN/Wi-Fi
 */
function getLocalNetworkAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const interfaceName in interfaces) {
    const networkInterface = interfaces[interfaceName];
    for (const address of networkInterface) {
      // Only include non-internal (not 127.0.0.1) IPv4 addresses
      if (address.family === 'IPv4' && !address.internal) {
        addresses.push({
          interface: interfaceName,
          ip: address.address,
          netmask: address.netmask
        });
      }
    }
  }

  return addresses;
}

/**
 * Returns the primary preferred LAN IP (e.g. 192.168.x.x or 10.x.x.x)
 */
function getPrimaryLanIp() {
  const addresses = getLocalNetworkAddresses();
  if (addresses.length === 0) return 'localhost';

  // Prefer standard LAN subnets 192.168.* > 10.* > 172.16-31.*
  const preferred = addresses.find(a => a.ip.startsWith('192.168.') || a.ip.startsWith('10.'));
  return preferred ? preferred.ip : addresses[0].ip;
}

module.exports = {
  getLocalNetworkAddresses,
  getPrimaryLanIp
};

