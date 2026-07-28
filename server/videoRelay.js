const { spawn } = require('child_process');
const config = require('./config');

class VideoRelay {
  constructor() {
    this.process = null;
    this.active = false;
  }

  start(streamUrl) {
    if (this.active) return;

    const ffmpegArgs = [
      '-i', streamUrl,
      '-f', 'mjpeg',
      '-q:v', '5',
      '-r', '15',
      '-an',
      '-loglevel', 'quiet',
      'pipe:1',
    ];

    try {
      this.process = spawn('ffmpeg', ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
      this.active = true;

      this.process.on('error', () => {
        this.active = false;
        this.process = null;
      });

      this.process.on('exit', () => {
        this.active = false;
        this.process = null;
      });

      this.process.stderr.on('data', () => {});
    } catch (e) {
      this.active = false;
    }
  }

  getStream() {
    if (!this.process || !this.active) return null;
    return this.process.stdout;
  }

  stop() {
    if (this.process) {
      this.process.kill('SIGKILL');
      this.process = null;
    }
    this.active = false;
  }

  isActive() {
    return this.active;
  }
}

module.exports = VideoRelay;
