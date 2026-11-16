import dns from 'node:dns';
import cors from 'cors';

dns.setDefaultResultOrder('ipv4first');
import express from 'express';
import { serverConfig } from './config.ts';
import aiRoutes from './routes/ai.ts';
import authRoutes from './routes/auth.ts';
import newsRoutes from './routes/news.ts';

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        serverConfig.allowedOrigins.includes(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
      ) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by Paper & Ink API CORS policy.'));
    },
    credentials: true,
  }),
);

// Generous limit solely for bounded base64 OCR / PDF page image payloads; strict per-endpoint caps enforced in routes.
app.use(express.json({ limit: '16mb' }));

app.get('/', (_req, res) => {
  res.status(200).type('text/plain').send('paper-and-ink-api is running');
});

app.get('/api/health', (_req, res) => {
  res.status(200).type('text/plain').send('paper-and-ink-api is running');
});

app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/news', newsRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = typeof (err as { status?: number })?.status === 'number' ? (err as { status: number }).status : 500;
  const message = status === 413 ? 'Payload exceeds maximum allowed size.' : 'Internal server error.';
  res.status(status).json({ error: message });
});

app.listen(serverConfig.port, () => {
  console.log(`[Paper & Ink API] Listening on http://localhost:${serverConfig.port}`);
});
