import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { createClient } from 'redis';
import RedisStore from 'connect-redis';
import { authRoutes } from './routes/auth.routes';
import { sessionRoutes } from './routes/session.routes';
import { analyzeRoutes } from './routes/analyze.routes';
import { queryRoutes } from './routes/query.routes';

const app = express();
const PORT = process.env.PORT || 4000;

const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redisClient.on('connect', () => console.log('[redis] connected'));
redisClient.on('error', (err) => console.error('[redis] error:', err));
redisClient.connect().catch(console.error);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[http] ${req.method} ${req.path} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRoutes);
app.use('/session', sessionRoutes);
app.use('/analyze', analyzeRoutes);
app.use('/query', queryRoutes);

app.listen(PORT, () => {
  console.log(`[api] server running on http://localhost:${PORT}`);
  console.log(`[api] env: ${process.env.NODE_ENV ?? 'development'}`);
});

export default app;
