# SkyControl - Wi-Fi Drone Control Web App

Control a Parrot AR.Drone 2.0 (or compatible Wi-Fi drone) directly from your web browser.
Everything runs locally on your laptop - no internet, no cloud, no accounts required.

## What You'll Need

| Requirement | Notes |
|---|---|
| **Node.js 18+** | Download from [nodejs.org](https://nodejs.org). Comes with npm. |
| **npm** | Automatically installed with Node.js. |
| **ffmpeg** (optional) | Only needed for the live video feed. Not required to control the drone. |
| **A Parrot-style drone** | AR.Drone 2.0 works out of the box. Connect your laptop to the drone's Wi-Fi. |

---

## Step 1: Download or Clone the Project

If you have the project folder already (e.g., `C:\sakib\SkyControl`), skip to Step 2.

To clone from a repository:

```bash
git clone <repo-url>
cd SkyControl
```

Or download the ZIP and extract it to a folder, e.g., `C:\sakib\SkyControl`.

---

## Step 2: Install Dependencies

Open **PowerShell** and navigate to the project folder:

```powershell
cd C:\sakib\SkyControl
```

Install the required packages (express and ws):

```powershell
npm install
```

This installs dependencies into the `node_modules` folder. You only need to do this once.

---

## Step 3: Start the Server

From the project folder, run:

```powershell
npm start
```

You should see this in the terminal:

```
Drone web app server running on http://0.0.0.0:3000
Drone IP: 192.168.1.1:5556
```

Leave this terminal window open. The server is now running.

---

## Step 4: Open in Browser

Open any browser (Chrome, Edge, Firefox) and go to:

```
http://localhost:3000
```

You will see the SkyControl welcome screen with a radar animation and a **CONNECT TO DRONE** button.

---

## Step 5: Connect to Your Drone

1. **Power on your drone.** It creates its own Wi-Fi network (e.g., `ardrone2_xxx`).
2. **On your laptop, connect to the drone's Wi-Fi** - just like connecting to any normal Wi-Fi network. No internet is needed.
3. **Back in the browser**, check the top-right corner shows **"Server online"** (green dot).
4. Click the big **CONNECT TO DRONE** button. The control panel opens with the joystick controls.

---

## Step 6: Fly the Drone

1. **Toggle ARM ON** in the top-right of the control panel. The label will turn green and say `ARMED`.
2. Press **TAKEOFF** (green button). The drone will leave the ground.
3. Control it using:
   - **Joysticks** (mouse/touch) - see layout below.
   - **Keyboard** - see table below.
4. Press **LAND** to land gently, or hit **EMERGENCY STOP** to cut motors instantly.

---

## Controls Guide

### Joysticks (mouse or touch)

| Joystick | Action |
|---|---|
| **Left** | Up/Down = altitude (gaz), Left/Right = rotate (yaw) |
| **Right** | Up/Down = forward/backward (pitch), Left/Right = strafe (roll) |
| Release | Knob snaps back to center = hover in place |

### Keyboard

| Key | Action |
|---|---|
| W / S | Forward / backward |
| A / D | Strafe left / right (roll) |
| Q / E | Rotate left / right (yaw) |
| R / F | Ascend / descend (gaz) |
| Space | Takeoff / land toggle |
| **E-STOP** | Always at bottom - works instantly, no arm check needed |

---

## Optional: Configure Drone Settings

If your drone uses different IPs or ports, edit `server/config.js`:

```javascript
module.exports = {
  drone: {
    ip: '192.168.1.1',        // Drone IP address
    commandPort: 5556,         // UDP command port
    navdataPort: 5554,         // UDP telemetry port
    videoPort: 5555,           // TCP video port
  },
  server: {
    port: 3000,                // Web server port
    host: '0.0.0.0',           // Listen address
  },
  // ... other settings
};
```

After editing, restart the server (`Ctrl+C`, then `npm start` again).

---

## Stopping the Server

- Press **Ctrl+C** in the terminal window, then type `y` and press Enter to confirm.
- The server will shut down safely, telling the drone to hover and land.

---

## Troubleshooting

### "Server online" shows offline / CONNECT button doesn't work

- Make sure `npm start` is running in the terminal.
- Verify you can reach `http://localhost:3000` directly - if the page doesn't load, the server isn't running.
- Try clicking the **RECONNECT** button in the control panel.

### Drone won't take off

- Make sure the **ARM** toggle is ON (top-right). TAKEOFF is disabled without arming.
- Verify your laptop is connected to the drone's Wi-Fi, not your regular network.
- Check the drone IP in `server/config.js` matches your drone's address (default `192.168.1.1`).

### Live video feed shows "No Video"

- You need **ffmpeg** installed and on your system PATH.
- Install ffmpeg: https://ffmpeg.org/download.html
- Restart the server after installing ffmpeg.

### Joystick or keyboard controls feel unresponsive

- Move the sliders/joysticks to center (hover) position. If a joystick is slightly off-center, the drone may drift.
- Keyboard controls only work once the WebSocket connection is active (green "Connected" dot in the top-left).

---

## Project Structure

```
SkyControl/
  server/
    index.js          # Express + WebSocket server
    droneClient.js    # UDP drone commands + telemetry parsing
    videoRelay.js     # ffmpeg-based video relay (MJPEG)
    config.js         # Drone IP, ports, protocol settings
  public/
    index.html        # Web page (hero screen + control panel)
    app.js            # Browser logic (controls, joysticks, telemetry)
    style.css         # Styling (dark tech theme)
  package.json        # Project config + dependencies
  README.md           # This file
```

---

## Safety Notes

- The **ARM** toggle must be ON before takeoff - prevents accidental launch.
- The **EMERGENCY STOP** button at the bottom always works, even if not armed.
- If the connection drops while flying, a red warning appears and the drone's own failsafe lands it automatically.
- The **BACK** button asks for confirmation if the drone is airborne, so you don't lose the controls accidentally.
