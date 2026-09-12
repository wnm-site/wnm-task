const mongoose = require('mongoose');

// Ensure Mongoose documents expose `id` (string) in JSON responses,
// not just `_id`, so the frontend can use `doc.id` consistently.
mongoose.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
  },
});

const connectDB = async () => {
  // Reuse the existing connection on warm serverless instances.
  // This is important on Vercel, where functions are re-invoked
  // and `mongoose.connect()` should only run once per warm instance.
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // Do NOT call process.exit() here — it kills the whole serverless
  // function. Throw instead so the caller can return a clean 503.
  if (!process.env.MONGODB_URI) {
    console.error(' MongoDB Error: MONGODB_URI not set. Add it in Vercel → Project → Settings → Environment Variables.');
    throw new Error('MONGODB_URI is not configured');
  }

  const options = {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    retryWrites: true,
    retryReads: true,
  };

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, options);
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      return mongoose.connection;
    } catch (error) {
      attempts++;
      console.error(` MongoDB Error (attempt ${attempts}/${maxAttempts}): ${error.message}`);
      if (attempts >= maxAttempts) {
        console.error('\nFailed to connect to MongoDB Atlas after 3 attempts.');
        console.error('Vercel functions run from random IPs — make sure Network Access is open:');
        console.error('1. Go to https://cloud.mongodb.com/');
        console.error('2. Navigate to Network Access → IP Access List');
        console.error('3. Add 0.0.0.0/0 (Allow access from anywhere)\n');
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
};

module.exports = connectDB;