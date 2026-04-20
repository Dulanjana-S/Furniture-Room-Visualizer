const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const User = require('../models/User');
const { JWT_SECRET } = require('../config');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  // Keep in sync with frontend validation.
  password: z.string().min(6).max(80),
  displayName: z.string().min(2).max(80),
});

router.post('/register', asyncHandler(async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });

  const { email, password, displayName } = parsed.data;
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email: email.toLowerCase(), displayName, passwordHash, role: 'designer' });

  return res.json({ ok: true, userId: user._id });
}));

const LoginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

router.post('/login', asyncHandler(async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { email, password } = parsed.data;
  const normalizedLogin = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedLogin });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { userId: user._id.toString(), email: user.email, displayName: user.displayName, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return res.json({ token, user: { uid: user._id.toString(), email: user.email, displayName: user.displayName, role: user.role } });
}));

router.get('/me', (req, res) => {
  // Optional endpoint if frontend ever needs it; requires auth header.
  return res.status(501).json({ error: 'Not implemented' });
});

module.exports = router;
