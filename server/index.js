import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initDatabase, forceSave } from './db.js';
import ordersRouter from './routes/orders.js';
import tablesRouter from './routes/tables.js';
import menuRouter from './routes/menu.js';
import devicesRouter from './routes/devices.js';
import signingRouter from './routes/signing.js';
import { loadSigningFiles } from './qzSigning.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// ─── Socket.IO Setup ──────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  }
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log(`  🔌 Device Connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`  🔌 Device Disconnected: ${socket.id}`);
  });
});

// ─── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: '*', // Allow captain app from any origin
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));

// Request logging (lightweight, colored)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const color = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`  ${color}${req.method}\x1b[0m ${req.originalUrl} [${clientIp}] → ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// ─── Routes ─────────────────────────────────────────────────
app.use('/api/orders', ordersRouter);
app.use('/api/tables', tablesRouter);
app.use('/api/menu', menuRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/signing', signingRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString() 
  });
});

// 404 fallback for API routes
app.use('/api/{*path}', (req, res) => {
  res.status(404).json({ 
    error: 'NOT_FOUND', 
    message: `Route ${req.method} ${req.originalUrl} not found` 
  });
});

// ─── Graceful Shutdown ──────────────────────────────────────
function shutdown(signal) {
  console.log(`\n  ⚡ ${signal} received — saving database...`);
  forceSave();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ─── Bootstrap ──────────────────────────────────────────────
async function start() {
  await initDatabase();
  loadSigningFiles();

  httpServer.listen(PORT, () => {
    console.log('');
    console.log('  ┌──────────────────────────────────────────────┐');
    console.log(`  │  🔥 TYDE POS API Server (Socket.IO Ready)     │`);
    console.log(`  │  → http://localhost:${PORT}                    │`);
    console.log(`  │  → Orders API: http://localhost:${PORT}/api/orders │`);
    console.log(`  │  → Tables API: http://localhost:${PORT}/api/tables │`);
    console.log(`  │  → Menu API:   http://localhost:${PORT}/api/menu   │`);
    console.log('  │  → Health:     /api/health                    │');
    console.log('  └──────────────────────────────────────────────┘');
    console.log('');
  });
}

start().catch(err => {
  console.error('  ❌ Failed to start server:', err);
  process.exit(1);
});
