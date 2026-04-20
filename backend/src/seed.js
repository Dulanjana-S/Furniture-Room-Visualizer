const bcrypt = require('bcryptjs');
const User = require('./models/User');
const { SEED_DEMO_USER, DEMO_EMAIL, DEMO_PASSWORD, DEMO_DISPLAY_NAME } = require('./config');

async function seedDemoUser() {
  if (!SEED_DEMO_USER) return;

  const existing = await User.findOne({ email: DEMO_EMAIL.toLowerCase() });
  if (existing) {
    console.log('[seed] Demo user exists:', DEMO_EMAIL);
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await User.create({ email: DEMO_EMAIL.toLowerCase(), displayName: DEMO_DISPLAY_NAME, passwordHash, role: 'designer' });
  console.log('[seed] Demo user created:', DEMO_EMAIL, '/', DEMO_PASSWORD);
}

module.exports = { seedDemoUser };
