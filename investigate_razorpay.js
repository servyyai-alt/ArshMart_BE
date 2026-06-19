import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = 'mongodb+srv://servyyai_db_user:dV9aZnn1fY879yCS@cluster0.1bgafts.mongodb.net/';

const run = async () => {
  await mongoose.connect(MONGO_URI);
  
  const orderSchema = new mongoose.Schema({}, { strict: false });
  const Order = mongoose.model('Order', orderSchema);

  const razorpayOrders = await Order.find({ paymentMethod: 'razorpay' }, {
    _id: 1,
    totalPrice: 1,
    orderStatus: 1,
    isPaid: 1,
    paymentResult: 1,
    createdAt: 1
  }).sort({ createdAt: -1 });

  console.log(JSON.stringify(razorpayOrders, null, 2));
  process.exit(0);
};

run().catch(console.error);
