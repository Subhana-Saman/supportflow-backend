import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.log('⚠️  Make sure MONGO_URI is correct and your IP is whitelisted in Atlas');

    // On a local machine it's fine to hard-exit so the dev notices immediately.
    // On Vercel (serverless), process.exit() kills the whole function instance
    // for every request, so we throw instead and let the caller/error handler
    // return a normal 500 response.
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
    process.exit(1);
  }
};

export default connectDB;