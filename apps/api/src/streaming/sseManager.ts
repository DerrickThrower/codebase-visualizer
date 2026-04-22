import type { Response } from 'express';
import type { SSEEvent } from '@codebase-viz/shared-types';

class SSEManager {
  private connections = new Map<string, Response>();

  register(sessionId: string, res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    this.connections.set(sessionId, res);

    res.on('close', () => {
      this.connections.delete(sessionId);
      console.log(`[sse] client disconnected for session=${sessionId}`);
    });
  }

  send(sessionId: string, event: SSEEvent): void {
    const res = this.connections.get(sessionId);
    if (!res) return;

    res.write(`event: ${event.event}\n`);
    res.write(`data: ${JSON.stringify(event.data)}\n\n`);
  }

  close(sessionId: string): void {
    const res = this.connections.get(sessionId);
    if (res) {
      res.end();
      this.connections.delete(sessionId);
    }
  }

  isConnected(sessionId: string): boolean {
    return this.connections.has(sessionId);
  }
}

export const sseManager = new SSEManager();
