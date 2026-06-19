import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = 'mongodb+srv://servyyai_db_user:dV9aZnn1fY879yCS@cluster0.1bgafts.mongodb.net/';

const run = async () => {
  await mongoose.connect(MONGO_URI);
  
  const orderSchema = new mongoose.Schema({}, { strict: false });
  const Order = mongoose.model('Order', orderSchema);

  const razorpayAgg = await Order.aggregate([
    {
      $match: {
        paymentMethod: 'razorpay',
        orderStatus: {
          $in: ['processing', 'shipped', 'delivered'],
          $nin: [
            'cancelled',
            'return_requested',
            'returned',
            'refund_pending',
            'refund_processed',
            'refund_failed'
          ]
        }
      }
    },
    { $group: { _id: null, total: { $sum: '$totalPrice' } } }
  ]);

  const totalAgg = await Order.aggregate([
    {
      $match: {
        $or: [
          {
            paymentMethod: 'razorpay',
            orderStatus: {
              $in: ['processing', 'shipped', 'delivered'],
              $nin: [
                'cancelled',
                'return_requested',
                'returned',
                'refund_pending',
                'refund_processed',
                'refund_failed'
              ]
            }
          },
          {
            paymentMethod: 'cod',
            orderStatus: 'delivered'
          }
        ]
      }
    },
    { $group: { _id: null, total: { $sum: '$totalPrice' } } }
  ]);

  console.log('FINAL_RAZORPAY_REVENUE:', razorpayAgg[0]?.total || 0);
  console.log('FINAL_TOTAL_REVENUE:', totalAgg[0]?.total || 0);
  process.exit(0);
};

run().catch(console.error);
