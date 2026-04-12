const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

// ── Validate required environment variables before anything else ───────────────
const required = ['DATABASE_URL', 'ENCRYPTION_KEY', 'JWT_SECRET', 'AUTH_EMAIL', 'AUTH_PASSWORD_HASH'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and fill in the values.');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const cron = require('node-cron');
const { Server } = require('socket.io');
const pool = require('./db/pool');
const logger = require('./logger');
const { authMiddleware } = require('./middleware/auth');

const authRouter        = require('./routes/auth');
const metricsRouter     = require('./routes/metrics');
const budgetsRouter     = require('./routes/budgets');
const balancesRouter    = require('./routes/balances');
const credentialsRouter = require('./routes/credentials');
const alertsRouter      = require('./routes/alerts');
const syncRouter        = require('./routes/sync');
const { checkAlerts }   = require('./jobs/alertChecker');

const app = express();
const server = http.createServer(app);

// CORS origin: restrict in production via CORS_ORIGIN env var
const corsOrigin = process.env.CORS_ORIGIN || '*';
const io = new Server(server, { cors: { origin: corsOrigin, methods: ['GET', 'POST'] } });

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// CORS
app.use(cors({ origin: corsOrigin }));
app.use(express.json());
app.set('io', io);

// ── Rate limiters ─────────────────────────────────────────────────────────────
// General API: 300 req/min per IP
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Metrics ingest (SDK fire-and-forget): 1 000 req/min per IP
// High limit allows bursts from apps under load; still prevents runaway loops
const metricsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Metrics rate limit exceeded.' },
});

app.use('/api', generalLimiter);
app.use('/api/metrics', metricsLimiter);

// ── Auth middleware (applies to all routes; exceptions are defined inside) ─────
app.use(authMiddleware);

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use('/api/auth', authRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/budgets', budgetsRouter);
app.use('/api/balances', balancesRouter);
app.use('/api/credentials', credentialsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/sync', syncRouter);

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(err.message, err.stack);
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  res.status(500).json({ error: message });
});

// ── Socket.io ─────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  logger.info('Client connected:', socket.id);
  socket.on('disconnect', () => logger.info('Client disconnected:', socket.id));
});

// ── Start server ──────────────────────────────────────────────────────────────
async function startServer() {
  const port = process.env.PORT || 3001;

  try {
    const fs = require('fs');
    const sql = fs.readFileSync(path.join(__dirname, 'db/schema.sql'), 'utf8');
    await pool.query(sql);
    logger.info('✅ Database schema ready');
  } catch (err) {
    logger.error('DB migration failed:', err.message);
  }

  // Cron: check alerts every hour
  cron.schedule('0 * * * *', () => {
    logger.info('Running scheduled alert check...');
    checkAlerts();
  });

  server.listen(port, () => logger.info(`🚀 API server running on port ${port}`));
}

startServer();
