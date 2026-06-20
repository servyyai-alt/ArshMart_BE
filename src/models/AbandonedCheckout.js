import mongoose from 'mongoose'

const checkoutItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  image: String,
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
}, { _id: false })

const abandonedCheckoutSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  products: [checkoutItemSchema],
  cartTotal: { type: Number, required: true },
  address: {
    fullName: String,
    phone: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    pincode: String,
    country: String,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null,
    index: true,
  },
  paymentMethod: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['pending', 'converted', 'abandoned'],
    default: 'pending',
    index: true,
  },
  checkoutStartedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, { timestamps: true })

const AbandonedCheckout = mongoose.model('AbandonedCheckout', abandonedCheckoutSchema)
export default AbandonedCheckout
