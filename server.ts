import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp } from './server/app';
import { loadConfig } from './server/config';
import { createSqliteStore } from './server/db/sqliteStore';
import { createLogger } from './server/logger';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel });

  if (config.nodeEnv === 'production' && config.nasaApiKey === 'DEMO_KEY') {
    logger.warn(
      'NASA_API_KEY is DEMO_KEY in production; DEMO_KEY is heavily rate limited and most NASA calls will fall back.',
      { nodeEnv: config.nodeEnv }
    );
  }
  if (config.databaseUrl) {
    logger.warn(
      'DATABASE_URL is set but the Postgres store is a P2 item and is not implemented; using the SQLite store.',
      { dataDir: config.dataDir }
    );
  }

  const store = createSqliteStore({ dataDir: config.dataDir });
  await store.init();

  const app = createApp({ store, config, logger });

  if (config.nodeEnv === 'production') {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info('Silica Station server listening', {
      port: config.port,
      nodeEnv: config.nodeEnv,
      dataDir: config.dataDir,
    });
  });

  const runRetention = async () => {
    const cutoff = new Date(
      Date.now() - config.retentionDays * 24 * 60 * 60 * 1000
    ).toISOString();
    try {
      const removed = await store.deleteRunsOlderThan(cutoff);
      if (removed > 0) {
        logger.info('retention sweep removed expired runs', { removed });
      }
    } catch {
      logger.error('retention sweep failed');
    }
  };
  void runRetention();
  const retentionTimer = setInterval(() => void runRetention(), 24 * 60 * 60 * 1000);
  retentionTimer.unref();

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(retentionTimer);
    logger.info('shutting down', { signal });

    const forceExit = setTimeout(() => {
      logger.error('forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.close(() => {
      void store
        .close()
        .catch(() => undefined)
        .finally(() => {
          clearTimeout(forceExit);
          process.exit(0);
        });
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch(error => {
  const message = error instanceof Error ? error.message : 'unknown error';
  process.stderr.write(
    `${JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: 'startup failed', error: message })}\n`
  );
  process.exit(1);
});
