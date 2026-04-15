import express from 'express';
import type { Request, Response } from 'express';
import { createServerRouter } from './routes';

function parsePort(argv: string[]): number {
  const portFlagIndex = argv.findIndex((arg) => arg === '--port');
  if (portFlagIndex === -1) {
    return Number.parseInt(process.env.CODECRAFT_SERVER_PORT ?? '3000', 10);
  }

  const providedPort = argv[portFlagIndex + 1];
  const parsedPort = Number.parseInt(providedPort ?? '', 10);
  return Number.isFinite(parsedPort) ? parsedPort : 3000;
}

export function createServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Primary API namespace for desktop/web clients
  app.use('/api', createServerRouter());

  // Compatibility routes (QA scenarios may call /health and /chat directly)
  app.use('/', createServerRouter());

  // Compatibility with Phase 5 QA scenario: /health on root
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  return app;
}

export async function startServer(port = parsePort(process.argv)): Promise<void> {
  const app = createServer();

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => {
      resolve();
    });

    server.on('error', (error: unknown) => {
      reject(error);
    });
  });
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  startServer()
    .then(() => {
      const port = parsePort(process.argv);
      process.stdout.write(`Codecraft server listening on http://127.0.0.1:${port}\n`);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Failed to start server: ${message}\n`);
      process.exit(1);
    });
}
