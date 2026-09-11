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
  if (!process.env.MONGODB_URI) {
    console.error(' MongoDB Error: MONGODB_URI not set in .env');
    process.exit(1);
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
      return;
    } catch (error) {
      attempts++;
      console.error(` MongoDB Error (attempt ${attempts}/${maxAttempts}): ${error.message}`);
      if (attempts >= maxAttempts) {
        console.error('\nFailed to connect to MongoDB Atlas after 3 attempts.');
        console.error('Make sure your IP is whitelisted in MongoDB Atlas:');
        console.error('1. Go to https://cloud.mongodb.com/');
        console.error('2. Navigate to Network Access → IP Access List');
        console.error('3. Add your current IP or 0.0.0.0/0 for development\n');
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
};

module.exports = connectDB;