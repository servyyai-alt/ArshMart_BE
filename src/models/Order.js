import mongoose from 'mongoose'

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  orderItems: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    image: String,
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
  }],
  shippingAddress: {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India' },
  },
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'cod'],
    default: 'razorpay',
  },
  paymentResult: {
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    status: String,
    paidAt: Date,
  },
  itemsPrice: { type: Number, required: true },
  shippingPrice: { type: Number, required: true, default: 0 },
  taxPrice: { type: Number, required: true, default: 0 },
  totalPrice: { type: Number, required: true },
  isPaid: { type: Boolean, default: false },
  paidAt: Date,
  orderStatus: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending',
  },
  // Shiprocket fields
  shiprocketOrderId: String,
  shiprocketShipmentId: String,
  trackingNumber: String,
  courierName: String,
  estimatedDelivery: Date,
  statusHistory: [{
    status: String,
    message: String,
    timestamp: { type: Date, default: Date.now },
  }],
  deliveredAt: Date,
  cancelReason: String,
  notification: {
    userEmailSentAt: Date,
    adminEmailSentAt: Date,
  },
}, { timestamps: true })

// Add to status history on status change
orderSchema.pre('save', function (next) {
  if (this.isModified('orderStatus')) {
    this.statusHistory.push({ status: this.orderStatus, message: `Order ${this.orderStatus}` })
    if (this.orderStatus === 'delivered') this.deliveredAt = new Date()
  }
  next()
})

orderSchema.index({ user: 1 })
orderSchema.index({ orderStatus: 1 })
orderSchema.index({ createdAt: -1 })

const Order = mongoose.model('Order', orderSchema)
export default Order
