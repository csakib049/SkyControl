const dgram = require('dgram');
const config = require('./config');

class DroneClient {
  constructor() {
    this.cmdSocket = null;
    this.navdataSocket = null;
    this.seq = 1;
    this.connected = false;

    this.state = {
      pitch: 0,
      roll: 0,
      yaw: 0,
      gaz: 0,
      hoverMode: true,
    };

    this.telemetry = {
      battery: 0,
      altitude: 0,
      flightState: 'landed',
      pitch: 0,
      roll: 0,
      yaw: 0,
      vx: 0,
      vy: 0,
      vz: 0,
    };

    this.heartbeatTimer = null;
    this.navdataBroadcastTimer = null;
    this.onTelemetry = null;
    this.onStatusChange = null;

    this.emergencyFlag = false;
  }

  connect() {
    this.cmdSocket = dgram.createSocket('udp4');
    this.navdataSocket = dgram.createSocket('udp4');

    this.navdataSocket.on('message', (msg) => {
      this.parseNavdata(msg);
    });

    this.navdataSocket.on('error', (err) => {
      this.setConnected(false);
    });

    this.cmdSocket.on('error', (err) => {
      this.setConnected(false);
    });

    try {
      this.navdataSocket.bind(config.drone.navdataPort, '0.0.0.0', () => {
        this.navdataSocket.setBroadcast(true);
      });
    } catch (e) {
      return;
    }

    this.startHeartbeat();
    this.startNavdataBroadcast();
    this.setConnected(true);
  }

  disconnect() {
    this.stopHeartbeat();
    this.stopNavdataBroadcast();
    if (this.cmdSocket) {
      this.cmdSocket.close();
      this.cmdSocket = null;
    }
    if (this.navdataSocket) {
      this.navdataSocket.close();
      this.navdataSocket = null;
    }
    this.setConnected(false);
  }

  setConnected(val) {
    if (this.connected !== val) {
      this.connected = val;
      if (this.onStatusChange) {
        this.onStatusChange({ connected: val });
      }
    }
  }

  sendAT(command) {
    if (!this.cmdSocket) return;
    const msg = Buffer.from(`AT*${command}=${this.seq}\r`);
    this.seq++;
    this.cmdSocket.send(msg, 0, msg.length, config.drone.commandPort, config.drone.ip, (err) => {
      if (err) this.setConnected(false);
    });
  }

  sendATWithValues(command, values) {
    if (!this.cmdSocket) return;
    const msg = Buffer.from(`AT*${command}=${this.seq},${values.join(',')}\r`);
    this.seq++;
    this.cmdSocket.send(msg, 0, msg.length, config.drone.commandPort, config.drone.ip, (err) => {
      if (err) this.setConnected(false);
    });
  }

  sendREF(value) {
    this.sendATWithValues('REF', [value]);
  }

  sendPCMD(mode, roll, pitch, gaz, yaw) {
    const r = Math.round(roll * 1000);
    const p = Math.round(pitch * 1000);
    const g = Math.round(gaz * 1000);
    const y = Math.round(yaw * 1000);
    this.sendATWithValues('PCMD', [mode, r, p, g, y]);
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (!this.cmdSocket) return;
      if (this.emergencyFlag) return;

      if (this.state.hoverMode) {
        this.sendPCMD(0, 0, 0, 0, 0);
      } else {
        this.sendPCMD(1, this.state.roll, this.state.pitch, this.state.gaz, this.state.yaw);
      }
    }, config.heartbeat.intervalMs);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  startNavdataBroadcast() {
    this.navdataBroadcastTimer = setInterval(() => {
      if (this.onTelemetry) {
        this.onTelemetry({ ...this.telemetry });
      }
    }, config.heartbeat.navdataBroadcastMs);
  }

  stopNavdataBroadcast() {
    if (this.navdataBroadcastTimer) {
      clearInterval(this.navdataBroadcastTimer);
      this.navdataBroadcastTimer = null;
    }
  }

  parseNavdata(buf) {
    if (buf.length < 16) return;
    const magic = buf.readUInt32LE(0);
    if (magic !== 0x55667788) return;

    const state = buf.readUInt32LE(4);
    let offset = 16;

    while (offset + 4 <= buf.length) {
      const tag = buf.readUInt16LE(offset);
      const size = buf.readUInt16LE(offset + 2);
      if (size < 4 || offset + size > buf.length) break;

      switch (tag) {
        case 0: {
          this.parseDemoOption(buf, offset);
          break;
        }
        case 5: {
          this.parseEulerAngles(buf, offset);
          break;
        }
        case 10: {
          this.parseAltitude(buf, offset);
          break;
        }
      }
      offset += size;
    }

    this.telemetry.flightState = this.decodeFlightState(state);
  }

  decodeFlightState(state) {
    if (state & (1 << 8)) return 'emergency';
    if (state & (1 << 9)) return 'flying';
    if (state & (1 << 1)) return 'hovering';
    return 'landed';
  }

  parseDemoOption(buf, offset) {
    const size = buf.readUInt16LE(offset + 2);
    if (size < 36) return;

    this.telemetry.battery = Math.round(buf.readUInt32LE(offset + 8));
    this.telemetry.pitch = buf.readFloatLE(offset + 16);
    this.telemetry.roll = buf.readFloatLE(offset + 20);
    this.telemetry.yaw = buf.readFloatLE(offset + 24);
    this.telemetry.altitude = buf.readInt32LE(offset + 28);
    this.telemetry.vx = buf.readFloatLE(offset + 32);
    this.telemetry.vy = buf.readFloatLE(offset + 36);
    this.telemetry.vz = buf.readFloatLE(offset + 40);
  }

  parseEulerAngles(buf, offset) {
    const size = buf.readUInt16LE(offset + 2);
    if (size < 16) return;

    this.telemetry.pitch = buf.readFloatLE(offset + 4);
    this.telemetry.roll = buf.readFloatLE(offset + 8);
    this.telemetry.yaw = buf.readFloatLE(offset + 12);
  }

  parseAltitude(buf, offset) {
    const size = buf.readUInt16LE(offset + 2);
    if (size < 16) return;

    this.telemetry.altitude = buf.readInt32LE(offset + 4);
  }

  takeoff() {
    this.state.hoverMode = false;
    this.sendREF(config.protocol.defaultCommandBase | config.protocol.takeoffBit);
  }

  land() {
    this.state.hoverMode = true;
    this.state.pitch = 0;
    this.state.roll = 0;
    this.state.yaw = 0;
    this.state.gaz = 0;
    this.sendREF(config.protocol.defaultCommandBase & ~config.protocol.takeoffBit);
  }

  emergencyStop() {
    this.emergencyFlag = true;
    this.sendREF(config.protocol.defaultCommandBase | config.protocol.emergencyBit);
    this.sendAT('COMWDG');
    setTimeout(() => {
      this.emergencyFlag = false;
    }, 500);
  }

  hover() {
    this.state.hoverMode = true;
    this.state.pitch = 0;
    this.state.roll = 0;
    this.state.yaw = 0;
    this.state.gaz = 0;
  }

  move(pitch, roll, yaw, gaz) {
    this.state.hoverMode = false;
    this.state.pitch = Math.max(-1, Math.min(1, pitch));
    this.state.roll = Math.max(-1, Math.min(1, roll));
    this.state.yaw = Math.max(-1, Math.min(1, yaw));
    this.state.gaz = Math.max(-1, Math.min(1, gaz));
  }

  flatTrim() {
    this.sendAT('FTRIM');
  }

  setConfig(key, value) {
    this.sendATWithValues('CONFIG', [`"${key}"`, `"${value}"`]);
  }

  setMaxAltitude(meters) {
    this.setConfig('control:altitude_max', String(meters * 1000));
  }

  setMaxTilt(degrees) {
    this.setConfig('control:euler_angle_max', String(degrees / 180 * Math.PI * 1000));
  }

  setMaxSpeed(speed) {
    this.setConfig('control:speed_max', String(speed));
  }

  disconnectFromDrone() {
    this.hover();
    this.land();
    this.disconnect();
  }
}

module.exports = DroneClient;
