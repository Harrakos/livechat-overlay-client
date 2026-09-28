const WebSocket = require('ws');
const { EventEmitter } = require('node:events');

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

class WsClient extends EventEmitter {
  constructor({ serverWsUrl, clientToken }) {
    super();
    this.url = `${serverWsUrl}?token=${encodeURIComponent(clientToken)}`;
    this.backoff = INITIAL_BACKOFF_MS;
    this.stopped = false;
  }

  connect() {
    if (this.stopped) return;

    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.on('open', () => {
      this.backoff = INITIAL_BACKOFF_MS;
      this.emit('status', 'connected');
    });

    ws.on('message', (data) => {
      try {
        const event = JSON.parse(data.toString());
        if (event.type === 'meme') {
          this.emit('meme', event);
        }
      } catch (error) {
        console.error('Failed to parse server message:', error);
      }
    });

    ws.on('close', () => {
      this.emit('status', 'disconnected');
      this.scheduleReconnect();
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error.code ?? '(no code)', error.message || '(no message)');
    });

    ws.on('unexpected-response', (_req, res) => {
      console.error('WebSocket rejected at handshake, HTTP status:', res.statusCode);
    });
  }

  scheduleReconnect() {
    if (this.stopped) return;
    setTimeout(() => this.connect(), this.backoff);
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
  }

  stop() {
    this.stopped = true;
    this.ws?.close();
  }
}

module.exports = { WsClient };
