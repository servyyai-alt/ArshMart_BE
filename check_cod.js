import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = 'mongodb+srv://servyyai_db_user:dV9aZnn1fY879yCS@cluster0.1bgafts.mongodb.net/';

const run = async () => {
  await mongoose.connect(MONGO_URI);
  
  const orderSchema = new mongoose.Schema({}, { strict: false });
  const Order = mongoose.model('Order', orderSchema);

  const allAgg = await Order.aggregate([
    {
      $match: {
        paymentMethod: 'cod'
      }
    },
    {
      $group: {
        _id: '$orderStatus',
        count: { $sum: 1 }
      }
    }
  ]);

  console.log('ALL_COD:', allAgg);
  process.exit(0);
};

run().catch(console.error);
