const express = require('express');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const config = require('./config');
const DroneClient = require('./droneClient');
const VideoRelay = require('./videoRelay');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, maxPayload: 1024 * 1024 });

const drone = new DroneClient();
const video = new VideoRelay();

const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));
app.use(express.json());

app.get('/api/status', (req, res) => {
  res.json({
    droneConnected: drone.connected,
    videoActive: video.isActive(),
    flightState: drone.telemetry.flightState,
  });
});

app.post('/api/takeoff', (req, res) => {
  drone.takeoff();
  res.json({ ok: true });
});

app.post('/api/land', (req, res) => {
  drone.land();
  res.json({ ok: true });
});

app.post('/api/emergency', (req, res) => {
  drone.emergencyStop();
  res.json({ ok: true });
});

app.post('/api/flatTrim', (req, res) => {
  drone.flatTrim();
  res.json({ ok: true });
});

app.post('/api/config', (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) {
    return res.status(400).json({ error: 'key and value required' });
  }
  drone.setConfig(key, String(value));
  res.json({ ok: true });
});

app.get('/api/video.mjpg', (req, res) => {
  if (!video.isActive()) {
    video.start(`tcp://${config.drone.ip}:${config.drone.videoPort}`);
    return setTimeout(() => {
      if (!video.isActive()) {
        return res.status(503).json({ error: 'video stream unavailable' });
      }
      startMjpegStream(req, res);
    }, 2000);
  }
  startMjpegStream(req, res);
});

function startMjpegStream(req, res) {
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=--droneframe',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Access-Control-Allow-Origin': '*',
  });

  const stream = video.getStream();
  if (!stream) {
    res.end();
    return;
  }

  let buffer = Buffer.alloc(0);

  const onData = (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    const boundary = Buffer.from('--droneframe\r\nContent-Type: image/jpeg\r\n\r\n');
    const endBoundary = Buffer.from('\r\n--droneframe\r\n');

    let idx;
    while ((idx = buffer.indexOf(Buffer.from('\xff\xd8'))) !== -1) {
      const endIdx = buffer.indexOf(Buffer.from('\xff\xd9'), idx);
      if (endIdx === -1) break;

      const jpeg = buffer.slice(idx, endIdx + 2);
      if (jpeg.length > 100) {
        res.write(boundary);
        res.write(jpeg);
        res.write(endBoundary);
      }

      buffer = buffer.slice(endIdx + 2);
    }
  };

  stream.on('data', onData);

  req.on('close', () => {
    stream.removeListener('data', onData);
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'status', connected: drone.connected }));

  drone.onStatusChange = (status) => {
    try {
      ws.send(JSON.stringify({ type: 'status', ...status }));
    } catch (_) {}
  };

  const telemetryInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'telemetry',
        data: drone.telemetry,
      }));
    }
  }, config.heartbeat.navdataBroadcastMs);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (_) {
      return;
    }

    switch (msg.type) {
      case 'move':
        drone.move(msg.pitch, msg.roll, msg.yaw, msg.gaz);
        break;
      case 'takeoff':
        drone.takeoff();
        break;
      case 'land':
        drone.land();
        break;
      case 'emergency':
        drone.emergencyStop();
        break;
      case 'hover':
        drone.hover();
        break;
      case 'flatTrim':
        drone.flatTrim();
        break;
      case 'setConfig':
        drone.setConfig(msg.key, msg.value);
        break;
    }
  });

  ws.on('close', () => {
    clearInterval(telemetryInterval);
    drone.hover();
  });

  ws.on('error', () => {
    clearInterval(telemetryInterval);
  });
});

drone.connect();

server.listen(config.server.port, config.server.host, () => {
  console.log(`Drone web app server running on http://${config.server.host}:${config.server.port}`);
  console.log(`Drone IP: ${config.drone.ip}:${config.drone.commandPort}`);
});

process.on('SIGINT', () => {
  drone.disconnectFromDrone();
  video.stop();
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  drone.disconnectFromDrone();
  video.stop();
  server.close(() => process.exit(0));
});
