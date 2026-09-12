require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ── CORS ─────────────────────────────────────────────────────────
// Allow local development + the deployed frontends (Netlify & Vercel).
//   - request origin is reflected only when it's in the allowlist
//   - FRONTEND_URL    : single extra origin (kept for backwards compat)
//   - ALLOWED_ORIGINS : comma-separated list of extra origins
//   - *.netlify.app / *.vercel.app : platform deploy & preview URLs
//     (the server itself runs on Vercel, so *.vercel.app also covers
//      the Vercel-hosted frontend's deploy/preview URLs)
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://task2rewards.netlify.app',
  'https://task2rewards.vercel.app',
];

const envOrigins = [
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.trim()] : []),
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : []),
];

const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

function isAllowedOrigin(origin) {
  // Allow requests with no Origin header (curl, server-to-server, health checks)
  if (!origin) return true;
  return (
    allowedOrigins.includes(origin) ||
    /^https:\/\/[a-zA-Z0-9-]+\.(netlify|vercel)\.app$/.test(origin)
  );
}

// Middleware
app.use(cors({
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Warm up the MongoDB connection on cold start.
// Non-fatal: if it fails we log it and the per-request guard below
// returns a clean 503 instead of crashing the serverless function.
connectDB().catch((err) => {
  console.error('❌ Initial DB connect failed:', err.message);
});

/**
 * Serverless (Vercel) safe database guard.
 * - Reuses the existing connection on warm instances (connectDB is a
 *   no-op when already connected, so the extra await is negligible).
 * - If Mongo is unreachable, returns a clean 503 JSON instead of
 *   letting the function crash (no more process.exit()).
 */
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    res.status(503).json({
      success: false,
      message: 'Database unavailable — please try again later',
    });
  }
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/spin', require('./routes/spin'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/quizzes', require('./routes/quizzes'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/admin', require('./routes/admin'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'RewardHub API is running' });
});

// Error handler
app.use(errorHandler);

// ── Vercel serverless export ──────────────────────────────────────
// Vercel's @vercel/node runtime imports this app and serves it.
// The app MUST be exported, otherwise there is no request handler,
// which causes "FUNCTION_INVOCATION_FAILED" → 500.
module.exports = app;

// Only start a persistent HTTP server when run directly
// (local dev: `node server.js`). Skipped on Vercel.
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('❌ Failed to start server:', err.message);
      process.exit(1);
    });
}