import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    
    // Dump full order
    const order = await db.collection('orders').findOne({ _id: new mongoose.Types.ObjectId('6a2ff11a59f7f4b3cf09f9f6') });
    console.log(JSON.stringify(order, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

run();
