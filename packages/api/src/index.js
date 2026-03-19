const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const express = require('express');
const cors = require('cors');
const http = require('http');
const cron = require('node-cron');
const { Server } = require('socket.io');
const pool = require('./db/pool');
const metricsRouter = require('./routes/metrics');
const budgetsRouter = require('./routes/budgets');
const balancesRouter = require('./routes/balances');
const credentialsRouter = require('./routes/credentials');
const alertsRouter = require('./routes/alerts');
const syncRouter = require('./routes/sync');
const { checkAlerts } = require('./jobs/alertChecker');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

app.use(cors());
app.use(express.json());
app.set('io', io);

app.use('/api/metrics', metricsRouter);
app.use('/api/budgets', budgetsRouter);
app.use('/api/balances', balancesRouter);
app.use('/api/credentials', credentialsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/sync', syncRouter);
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

async function startServer() {
  const port = process.env.PORT || 3001;
  try {
    const fs = require('fs');
    const sql = fs.readFileSync(path.join(__dirname, 'db/schema.sql'), 'utf8');
    await pool.query(sql);
    console.log('✅ Database ready');
  } catch (err) {
    console.error('DB migration failed:', err.message);
  }

  // Cron: check alerts every hour
  cron.schedule('0 * * * *', () => {
    console.log('Running alert check...');
    checkAlerts();
  });

  server.listen(port, () => console.log(`🚀 API server running on port ${port}`));
}

startServer();
