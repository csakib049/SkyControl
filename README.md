# Wi-Fi Drone Control Web App

Control a Parrot-style Wi-Fi drone (AR.Drone / Bebop-class) directly from your browser. No cloud, no internet — everything runs locally on your laptop.

## Architecture

```
[Browser UI] <--WebSocket/HTTP--> [Node.js Local Server] <--UDP/TCP--> [Drone Wi-Fi AP]
```

## Prerequisites

- Node.js 18+
- npm
- ffmpeg (optional, for video stream relay)
- A Parrot-compatible Wi-Fi drone

## Setup

1. Connect your laptop to the drone's Wi-Fi access point.
2. Clone or copy this project, then install dependencies:

```bash
cd drone-webapp
npm install
```

3. Start the server:

```bash
npm start
```

4. Open your browser to `http://localhost:3000`

## Drone Connection Details

### Default Configuration (AR.Drone 2.0)

| Setting       | Default         |
|---------------|-----------------|
| Drone IP      | `192.168.1.1`   |
| Command Port  | `5556` (UDP)    |
| Navdata Port  | `5554` (UDP)    |
| Video Port    | `5555` (TCP)    |

These defaults are set in `server/config.js`. If your drone model differs, edit that file before starting the server.

### Known Model Variations

- **AR.Drone 2.0**: Uses the defaults above. AT* command protocol over UDP.
- **Parrot Bebop 2**: Uses port `54321` for commands (JSON-based instead of AT*). You'll need to modify `droneClient.js` to use the Bebop's JSON SkyController protocol.
- **Parrot Anafi**: Uses a different protocol over port `44444`. Not directly compatible with this client.

Check your drone's documentation to verify the command protocol and port before adjusting config.

## Controls

### Joysticks (Mouse/Touch)

- **Left joystick**: Y-axis = altitude (gaz), X-axis = yaw (rotation)
- **Right joystick**: Y-axis = pitch (forward/back), X-axis = roll (left/right)
- Release snaps to center = hover

### Keyboard

| Key | Action       |
|-----|-------------|
| W/S | Pitch (forward/back) |
| A/D | Roll (left/right) |
| Q/E | Yaw (rotate) |
| R/F | Gaz (altitude up/down) |
| Space | Takeoff / Land toggle |

### Safety

- The **ARM toggle** must be enabled before takeoff is allowed — this prevents accidental launch.
- The **EMERGENCY STOP** button is always visible at the bottom of the screen and bypasses all safeguards. It cuts motors immediately.
- If the WebSocket connection drops while airborne, a prominent warning overlay appears.

## API Endpoints

| Method | Path              | Description            |
|--------|-------------------|------------------------|
| GET    | `/api/status`     | Drone & server status  |
| POST   | `/api/takeoff`    | Takeoff                |
| POST   | `/api/land`       | Land                   |
| POST   | `/api/emergency`  | Emergency motor cut    |
| POST   | `/api/flatTrim`   | Calibrate / flat trim  |
| POST   | `/api/config`     | Set drone config       |
| GET    | `/api/video.mjpg` | MJPEG video stream     |

## Project Structure

```
drone-webapp/
  server/
    index.js         # Express + WebSocket server bootstrap
    droneClient.js    # UDP command + navdata handling, heartbeat loop
    videoRelay.js     # ffmpeg spawn + MJPEG HTTP relay
    config.js         # Drone IP/ports, tunable constants
  public/
    index.html        # SPA markup
    app.js            # Frontend logic, WebSocket client, joysticks
    style.css         # Full application styles
  package.json
  README.md
```

## Safety Notes

- The drone's own firmware has failsafes that will auto-land if commands stop arriving. The heartbeat loop in `droneClient.js` ensures commands are sent every 30ms to prevent this during normal operation.
- On connection loss, the server stops sending commands, which triggers the drone's built-in failsafe landing.
- The emergency stop sends the kill command immediately over UDP, outside of the normal command queue.
