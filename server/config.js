const config = {
  drone: {
    ip: '192.168.1.1',
    commandPort: 5556,
    navdataPort: 5554,
    videoPort: 5555,
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  heartbeat: {
    intervalMs: 30,
    navdataBroadcastMs: 100,
  },
  protocol: {
    defaultCommandBase: 290717696,
    emergencyBit: 256,
    takeoffBit: 512,
  },
};

module.exports = config;
