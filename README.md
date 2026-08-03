# Wi-Fi Drone Control Web App

Control a Parrot-style Wi-Fi drone (AR.Drone / Bebop-class) straight from your web browser. Everything runs on your laptop — no internet, no cloud, no accounts.

## What you need

- Node.js 18 or newer (download from nodejs.org)
- npm (comes with Node.js)
- ffmpeg (only if you want the live video feed)
- A Parrot-style Wi-Fi drone

---

## Step 1: Run the project (first time only)

Open a terminal (PowerShell) inside the project folder and install the dependencies:

```bash
cd D:\SkyControl
npm install
```

You only do this once.

---

## Step 2: Start the server (every time you use it)

```bash
npm start
```

You should see:

```
Drone web app server running on http://0.0.0.0:3000
```

Keep this terminal window open. Now open your browser and go to:

```
http://localhost:3000
```

---

## Step 3: Connect your drone

1. **Turn on your drone.** It starts its own Wi-Fi network (for example, AR.Drone 2.0 shows up as `ardrone2_xxx`).
2. **Connect your laptop to the drone's Wi-Fi** — just like connecting to any normal Wi-Fi network. This is a local connection, no internet needed.
3. **Back in the browser**, you'll see a welcome screen. Check the top-right shows **"Server online"** (green dot).
4. Click the big **CONNECT TO DRONE** button. The control screen opens.

---

## Step 4: How to fly

1. Switch on the **ARM** toggle (top-right). Takeoff won't work without it.
2. Press **TAKEOFF** (green button).
3. Fly with the joysticks or keyboard (see below).
4. Press **LAND** to come down, or the big red **EMERGENCY STOP** to cut the motors instantly.

---

## Controls

### Joysticks (mouse or touch)

- **Left joystick**: up/down = altitude (gaz), left/right = rotate (yaw)
- **Right joystick**: up/down = forward/back (pitch), left/right = strafe (roll)
- Let go of a joystick and it snaps back to center = hover

### Keyboard

| Key    | Action                |
|--------|------------------------|
| W / S  | Forward / backward    |
| A / D  | Left / right          |
| Q / E  | Rotate left / right   |
| R / F  | Fly up / down         |
| Space  | Takeoff / land toggle |

---

## Connection details (if your drone doesn't connect)

The app assumes an **AR.Drone 2.0** with these default settings:

| Setting      | Default       |
|--------------|---------------|
| Drone IP     | `192.168.1.1` |
| Command port | `5556` (UDP)  |
| Telemetry    | `5554` (UDP)  |
| Video        | `5555` (TCP)  |

If your drone uses different values, open `server/config.js` and change them:

```js
drone: {
  ip: '192.168.1.1',   // <-- change to your drone's IP
  commandPort: 5556,
  navdataPort: 5554,
  videoPort: 5555,
}
```

Then restart the server (press `Ctrl+C`, run `npm start` again).

### Other Parrot models

- **AR.Drone 2.0** — works out of the box with the defaults above.
- **Parrot Bebop 2** — uses a different protocol on port `54321`. You'd need to modify `server/droneClient.js`.
- **Parrot Anafi** — uses a different protocol on port `44444`. Not compatible with this client.

Check your drone's manual for its exact command port/protocol before changing the config.

---

## Project structure

```
D:\SkyControl\
  server\
    index.js         # Express + WebSocket server
    droneClient.js   # UDP commands + telemetry + heartbeat
    videoRelay.js    # ffmpeg video relay
    config.js        # Drone IP / ports / settings
  public\
    index.html       # The web page
    app.js           # Browser logic + controls
    style.css        # Styling
  package.json
  README.md
```

---

## Safety notes

- The **ARM** switch must be on before takeoff — prevents accidental launch.
- The **EMERGENCY STOP** button is always at the bottom of the screen and works instantly, no matter what.
- If the connection drops while the drone is in the air, a big red warning appears. The drone's own failsafe lands it automatically when it stops receiving commands.
- If you press **← BACK** to the welcome screen while airborne, the app asks you first so the controls don't get hidden accidentally.
