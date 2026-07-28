let ws = null;
let wsReconnectTimer = null;
let connected = false;
let armed = false;
let isFlying = false;

const moveState = { pitch: 0, roll: 0, yaw: 0, gaz: 0 };
const keyboardState = { w: false, a: false, s: false, d: false, q: false, e: false, r: false, f: false };
let joystickPollInterval = null;

const wsReconnectDelay = 2000;

function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${location.host}`;

  ws = new WebSocket(url);

  ws.onopen = () => {
    connected = true;
    updateConnectionUI();
    startVideo();
    startJoystickPolling();
  };

  ws.onclose = () => {
    connected = false;
    updateConnectionUI();
    stopJoystickPolling();
    scheduleReconnect();
    if (isFlying) {
      showConnectionWarning();
    }
  };

  ws.onerror = () => {
    ws.close();
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleMessage(msg);
    } catch (_) {}
  };
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'status':
      updateConnectionUI(msg.connected);
      break;
    case 'telemetry':
      if (msg.data) updateTelemetry(msg.data);
      break;
  }
}

function scheduleReconnect() {
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
  wsReconnectTimer = setTimeout(connect, wsReconnectDelay);
}

function sendToServer(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function startVideo() {
  const img = document.getElementById('video-feed');
  const ts = Date.now();
  img.src = `/api/video.mjpg?_t=${ts}`;
  document.getElementById('overlay-video-status').textContent = 'Video';
}

function updateConnectionUI(forceConnected) {
  const dot = document.getElementById('status-backend');
  const label = document.getElementById('status-label');
  const isConn = forceConnected !== undefined ? forceConnected : connected;

  dot.className = 'status-dot ' + (isConn ? 'connected' : 'disconnected');
  label.textContent = isConn ? 'Connected' : 'Disconnected';
}

function updateTelemetry(data) {
  const batteryEl = document.getElementById('telem-battery');
  batteryEl.textContent = data.battery + '%';
  batteryEl.className = 'telem-value';
  if (data.battery < 20) batteryEl.classList.add('low');
  else if (data.battery < 50) batteryEl.classList.add('warning');

  document.getElementById('telem-state').textContent = data.flightState || '--';
  document.getElementById('telem-altitude').textContent = (data.altitude || 0) + ' cm';
  document.getElementById('telem-pitch').textContent = (data.pitch || 0).toFixed(1) + '°';
  document.getElementById('telem-roll').textContent = (data.roll || 0).toFixed(1) + '°';
  document.getElementById('telem-yaw').textContent = (data.yaw || 0).toFixed(1) + '°';
  const speed = Math.sqrt((data.vx || 0) ** 2 + (data.vy || 0) ** 2 + (data.vz || 0) ** 2);
  document.getElementById('telem-speed').textContent = speed.toFixed(1) + ' m/s';

  const prevFlying = isFlying;
  isFlying = data.flightState === 'flying' || data.flightState === 'hovering';
  if (isFlying !== prevFlying) updateControlsEnabled();
}

function updateControlsEnabled() {
  const flying = isFlying;
  const canControl = armed && flying;
  document.querySelectorAll('.action-btn').forEach((btn) => {
    btn.disabled = !connected;
  });
  document.querySelectorAll('.joystick').forEach((j) => {
    j.style.opacity = canControl ? '1' : '0.4';
  });
}

function showConnectionWarning() {
  const warn = document.getElementById('connection-warning');
  warn.classList.remove('hidden');
}

function hideConnectionWarning() {
  document.getElementById('connection-warning').classList.add('hidden');
}

/* Joystick handling */
function setupJoystick(elementId, knobId, onMove) {
  const el = document.getElementById(elementId);
  const knob = document.getElementById(knobId);
  let dragging = false;
  let rect = el.getBoundingClientRect();
  const radius = el.offsetWidth / 2;
  const knobRadius = knob.offsetWidth / 2;
  const maxDist = radius - knobRadius;

  function updateKnob(x, y) {
    const dx = x - rect.left - radius;
    const dy = y - rect.top - radius;
    const dist = Math.sqrt(dx * dx + dy * dy);
    let ndx = dx;
    let ndy = dy;
    if (dist > maxDist) {
      ndx = (dx / dist) * maxDist;
      ndy = (dy / dist) * maxDist;
    }
    knob.style.transform = `translate(${ndx}px, ${ndy}px)`;

    const nx = ndx / maxDist;
    const ny = ndy / maxDist;

    if (onMove) onMove(nx, ny);
  }

  function resetKnob() {
    knob.style.transform = 'translate(0px, 0px)';
    if (onMove) onMove(0, 0);
  }

  function onPointerDown(e) {
    dragging = true;
    el.setPointerCapture(e.pointerId);
    rect = el.getBoundingClientRect();
    updateKnob(e.clientX, e.clientY);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    rect = el.getBoundingClientRect();
    updateKnob(e.clientX, e.clientY);
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    el.releasePointerCapture(e.pointerId);
    resetKnob();
  }

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);

  return { reset: resetKnob };
}

function startJoystickPolling() {
  if (joystickPollInterval) return;
  joystickPollInterval = setInterval(() => {
    const combined = { ...moveState };

    if (keyboardState.w) combined.pitch = -1;
    else if (keyboardState.s) combined.pitch = 1;
    else if (!joystickRightActive) combined.pitch = 0;

    if (keyboardState.a) combined.roll = -1;
    else if (keyboardState.d) combined.roll = 1;
    else if (!joystickRightActive) combined.roll = 0;

    if (keyboardState.q) combined.yaw = -1;
    else if (keyboardState.e) combined.yaw = 1;
    else if (!joystickLeftActive) combined.yaw = 0;

    if (keyboardState.r) combined.gaz = -1;
    else if (keyboardState.f) combined.gaz = 1;
    else if (!joystickLeftActive) combined.gaz = 0;

    sendToServer({ type: 'move', ...combined });
  }, 50);
}

function stopJoystickPolling() {
  if (joystickPollInterval) {
    clearInterval(joystickPollInterval);
    joystickPollInterval = null;
  }
}

let joystickLeftActive = false;
let joystickRightActive = false;

document.addEventListener('DOMContentLoaded', () => {
  /* Setup joysticks */
  setupJoystick('joystick-left', 'knob-left', (x, y) => {
    moveState.yaw = x;
    moveState.gaz = -y;
    joystickLeftActive = x !== 0 || y !== 0;
  });

  setupJoystick('joystick-right', 'knob-right', (x, y) => {
    moveState.roll = x;
    moveState.pitch = -y;
    joystickRightActive = x !== 0 || y !== 0;
  });

  /* Keyboard controls */
  document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === ' ' && e.target === document.body) {
      e.preventDefault();
      handleTakeoffLand();
      return;
    }

    if (key in keyboardState) {
      keyboardState[key] = true;
    }
  });

  document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key in keyboardState) {
      keyboardState[key] = false;
    }
  });

  /* Arm checkbox */
  document.getElementById('arm-checkbox').addEventListener('change', (e) => {
    armed = e.target.checked;
    document.getElementById('arm-label').textContent = armed ? 'ARMED' : 'ARM';
    document.getElementById('arm-label').style.color = armed ? '#4caf50' : '#ff9800';
    updateControlsEnabled();
  });

  /* Action buttons */
  document.getElementById('btn-takeoff').addEventListener('click', handleTakeoffLand);
  document.getElementById('btn-land').addEventListener('click', () => {
    sendToServer({ type: 'land' });
  });
  document.getElementById('btn-hover').addEventListener('click', () => {
    sendToServer({ type: 'hover' });
  });
  document.getElementById('btn-flattrim').addEventListener('click', () => {
    sendToServer({ type: 'flatTrim' });
  });

  /* Emergency - immediate, no arm check */
  document.getElementById('btn-emergency').addEventListener('click', () => {
    sendToServer({ type: 'emergency' });
    sendRestEmergency();
  });

  /* Reconnect */
  document.getElementById('btn-reconnect').addEventListener('click', () => {
    if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
    if (ws) ws.close();
    hideConnectionWarning();
    connect();
  });

  connect();
});

function handleTakeoffLand() {
  if (!armed) return;
  if (isFlying) {
    sendToServer({ type: 'land' });
  } else {
    sendToServer({ type: 'takeoff' });
  }
}

function sendRestEmergency() {
  fetch('/api/emergency', { method: 'POST' }).catch(() => {});
}
