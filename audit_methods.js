import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    
    const methods = await db.collection('orders').distinct('paymentMethod');
    console.log("Distinct payment methods:", methods);
    
    // Let's also find ANY order that is paid
    const paidOrders = await db.collection('orders').find({ isPaid: true }).toArray();
    console.log("Total isPaid=true orders:", paidOrders.length);
    
    // Find ANY order with a paymentResult
    const withResult = await db.collection('orders').find({ paymentResult: { $exists: true } }).toArray();
    console.log("Total orders with paymentResult:", withResult.length);
    
    for (const p of paidOrders) {
      console.log(`Paid order: ${p._id}, Method: ${p.paymentMethod}, isPaid: ${p.isPaid}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

run();
