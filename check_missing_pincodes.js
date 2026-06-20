import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = 'mongodb+srv://servyyai_db_user:dV9aZnn1fY879yCS@cluster0.1bgafts.mongodb.net/';

const run = async () => {
  await mongoose.connect(MONGO_URI);
  
  const orderSchema = new mongoose.Schema({}, { strict: false });
  const Order = mongoose.model('Order', orderSchema);

  const missingPincodes = await Order.find({
    $or: [
      { 'shippingAddress.pincode': { $exists: false } },
      { 'shippingAddress.pincode': '' },
      { 'shippingAddress.pincode': null }
    ]
  }, { _id: 1, 'shippingAddress.pincode': 1, orderStatus: 1 });

  console.log('Orders missing pincode:', missingPincodes);
  process.exit(0);
};

run().catch(console.error);
