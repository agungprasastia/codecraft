import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createServer } from './index';

describe('HTTP server', () => {
  let baseUrl = '';
  let stop: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    const app = createServer();

    await new Promise<void>((resolve, reject) => {
      const server = app.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;

        stop = async () => {
          await new Promise<void>((closeResolve, closeReject) => {
            server.close((error: Error | undefined) => {
              if (error) {
                closeReject(error);
                return;
              }
              closeResolve();
            });
          });
        };

        resolve();
      });

      server.on('error', (error: Error) => reject(error));
    });
  });

  afterAll(async () => {
    if (stop) {
      await stop();
    }
  });

  it('should return healthy status at /health', async () => {
    const response = await fetch(`${baseUrl}/health`);
    const data = (await response.json()) as { status: string };

    expect(response.status).toBe(200);
    expect(data).toEqual({ status: 'ok' });
  });

  it('should return provider config at /api/config', async () => {
    const response = await fetch(`${baseUrl}/api/config`);
    const data = (await response.json()) as {
      providers: string[];
      defaultProvider: string;
      defaultModel: string;
    };

    expect(response.status).toBe(200);
    expect(Array.isArray(data.providers)).toBe(true);
    expect(data.providers).toEqual(
      expect.arrayContaining(['openai', 'anthropic', 'google', 'ollama'])
    );
    expect(typeof data.defaultProvider).toBe('string');
    expect(typeof data.defaultModel).toBe('string');
  });

  it('should validate missing chat message', async () => {
    const response = await fetch(`${baseUrl}/chat-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'ollama', model: 'llama2' }),
    });

    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(data.error).toContain('message is required');
  });

  it('should validate unknown provider', async () => {
    const response = await fetch(`${baseUrl}/chat-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello', provider: 'unknown-model-hub' }),
    });

    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(data.error).toContain('Unknown provider');
  });
});
