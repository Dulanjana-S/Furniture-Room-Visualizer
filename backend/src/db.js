const mongoose = require('mongoose');
const { MONGO_URI } = require('./config');

async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(MONGO_URI);
  console.log('[db] Connected:', MONGO_URI);
}

module.exports = { connectDB };
