require('dotenv').config();

module.exports = {
  // Default to 4100 to avoid collisions with other local dev servers.
  PORT: process.env.PORT || 4100,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/ui3_mern',
  JWT_SECRET: process.env.JWT_SECRET || 'dev_secret_change_me',
  CORS_ORIGINS: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  SEED_DEMO_USER: (process.env.SEED_DEMO_USER || 'true') === 'true',
  DEMO_EMAIL: process.env.DEMO_EMAIL || 'designer@furniture.com',
  DEMO_PASSWORD: process.env.DEMO_PASSWORD || 'designer',
  DEMO_DISPLAY_NAME: process.env.DEMO_DISPLAY_NAME || 'Designer',
};
