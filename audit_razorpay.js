import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './src/models/Order.js';

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const razorpayOrders = await Order.find({ paymentMethod: 'razorpay' }).select('_id paymentMethod orderStatus isPaid totalPrice paidAt paymentResult').lean();
    console.log("Found", razorpayOrders.length, "razorpay orders");
    console.log(JSON.stringify(razorpayOrders, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

run();
