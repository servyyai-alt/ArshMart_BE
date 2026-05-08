import asyncHandler from 'express-async-handler'
import Razorpay from 'razorpay'
import crypto from 'crypto'
import Order from '../models/Order.js'
import Product from '../models/Product.js'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

// @desc    Create Razorpay order
// @route   POST /api/payment/create-order
export const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { amount, orderId, currency = 'INR' } = req.body

  if (!amount || amount < 1) {
    res.status(400)
    throw new Error('Valid amount is required')
  }

  const options = {
    amount: Math.round(amount), // in paise
    currency,
    receipt: orderId?.toString() || `receipt_${Date.now()}`,
    notes: {
      orderId: orderId?.toString(),
      userId: req.user._id.toString(),
    },
  }

  const razorpayOrder = await razorpay.orders.create(options)

  res.json({
    success: true,
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
  })
})

// @desc    Verify Razorpay payment
// @route   POST /api/payment/verify
export const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body

  // Verify signature
  const body = razorpay_order_id + '|' + razorpay_payment_id
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex')

  if (expectedSignature !== razorpay_signature) {
    res.status(400)
    throw new Error('Payment verification failed')
  }

  // Update order
  const order = await Order.findById(orderId)
  if (!order) {
    res.status(404)
    throw new Error('Order not found')
  }

  order.isPaid = true
  order.paidAt = new Date()
  order.orderStatus = 'processing'
  order.paymentResult = {
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
    status: 'paid',
    paidAt: new Date(),
  }

  // Reduce stock
  for (const item of order.orderItems) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } })
  }

  await order.save()

  res.json({ success: true, message: 'Payment verified successfully', order })
})
