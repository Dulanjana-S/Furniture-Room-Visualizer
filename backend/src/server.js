const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { PORT, CORS_ORIGINS } = require('./config');
const { connectDB } = require('./db');
const { seedDemoUser } = require('./seed');

const authRoutes = require('./routes/auth');
const designsRoutes = require('./routes/designs');

async function main() {
  await connectDB();
  await seedDemoUser();

  const app = express();
  app.use(helmet());
  app.use(morgan('dev'));
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
      if (isLocalhost) return callback(null, true);
      if (CORS_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
  }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api/designs', designsRoutes);

  app.use((err, req, res, next) => {
    console.error('[error]', err);
    res.status(500).json({ error: 'Server error' });
  });

  app.listen(PORT, () => console.log(`[api] http://localhost:${PORT}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
