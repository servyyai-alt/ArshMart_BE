import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    
    // Raw query to bypass Mongoose schema
    const orders = await db.collection('orders').find({ paymentMethod: /razorpay/i }).toArray();
    console.log("Total Razorpay Orders:", orders.length);
    
    for (const order of orders) {
      console.log(`\nOrder ID: ${order._id}`);
      console.log(`paymentMethod: ${order.paymentMethod}`);
      console.log(`orderStatus: ${order.orderStatus}`);
      console.log(`isPaid: ${order.isPaid}`);
      console.log(`paidAt: ${order.paidAt}`);
      if (order.paymentResult) {
        console.log(`paymentResult:`, JSON.stringify(order.paymentResult));
      } else {
        console.log(`paymentResult: undefined`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

run();
