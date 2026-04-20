const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true, maxlength: 80 },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'designer' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
