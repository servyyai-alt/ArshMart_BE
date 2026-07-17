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
    hsnCode: { type: String, trim: true },
    dimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
      dimensionUnit: { type: String, default: 'cm' },
      weight: { type: Number, min: 0 },
      weightUnit: { type: String, default: 'kg' },
    },
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
  totalPrice: { type: Number, required: true },
  coupon: {
    code: { type: String, trim: true, default: '' },
    percent: { type: Number, default: 0, min: 0, max: 100 },
    discountAmount: { type: Number, default: 0, min: 0 },
  },
  isPaid: { type: Boolean, default: false },
  paidAt: Date,
  orderStatus: {
    type: String,
    enum: [
      'pending',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'return_requested',
      'returned',
      'refund_pending',
      'refund_processed',
      'refund_failed',
    ],
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
  cancelNotes: String,
  // Return/refund summary (mirrors ReturnRequest for quick reads)
  return: {
    hasReturnRequest: { type: Boolean, default: false, index: true },
    returnRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReturnRequest' },
    returnStatus: String,
    returnInitiatedAt: Date,
    returnedAt: Date,
  },
  refund: {
    refundId: String,
    refundStatus: String,
    refundAmount: Number, // in paise
    refundProcessedAt: Date,
    manualRefundDetails: {
      method: { type: String, enum: ['upi', 'bank'] },
      upiId: String,
      accountName: String,
      bankName: String,
      accountNumber: String,
      ifscCode: String,
    },
  },
  notification: {
    userEmailSentAt: Date,
    adminEmailSentAt: Date,
    cancelUserEmailSentAt: Date,
    cancelAdminEmailSentAt: Date,
    returnUserEmailSentAt: Date,
    returnAdminEmailSentAt: Date,
    whatsappOrderConfirmationSentAt: Date,
    whatsappTrackingUpdateSentAt: Date,
    whatsappTrackingNumber: String,
    whatsappLastError: String,
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
