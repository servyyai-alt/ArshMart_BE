import asyncHandler from 'express-async-handler'
import Razorpay from 'razorpay'
import crypto from 'crypto'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import Settings from '../models/Settings.js'

let razorpayCache = { keyId: null, keySecret: null, client: null, expiresAt: 0 }

const getRazorpayKeys = async () => {
  if (razorpayCache.client && Date.now() < razorpayCache.expiresAt) {
    return { keyId: razorpayCache.keyId, keySecret: razorpayCache.keySecret, client: razorpayCache.client }
  }

  const doc = await Settings.findOne({ singleton: 'global' }).select('integrations.razorpay').lean()
  const keyId = doc?.integrations?.razorpay?.keyId || process.env.RAZORPAY_KEY_ID
  const keySecret = doc?.integrations?.razorpay?.keySecret || process.env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) {
    return { keyId: keyId || null, keySecret: keySecret || null, client: null }
  }

  const client = new Razorpay({ key_id: keyId, key_secret: keySecret })
  razorpayCache = {
    keyId,
    keySecret,
    client,
    expiresAt: Date.now() + 60 * 1000, // 60s cache to reduce DB hits
  }

  return { keyId, keySecret, client }
}

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

  const { client } = await getRazorpayKeys()
  if (!client) {
    res.status(500)
    throw new Error('Razorpay keys not configured')
  }

  const razorpayOrder = await client.orders.create(options)

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

  const { keySecret } = await getRazorpayKeys()
  if (!keySecret) {
    res.status(500)
    throw new Error('Razorpay keys not configured')
  }

  // Verify signature
  const body = razorpay_order_id + '|' + razorpay_payment_id
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
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

// @desc    Get Razorpay public key (key_id)
// @route   GET /api/payment/key
export const getRazorpayPublicKey = asyncHandler(async (req, res) => {
  const doc = await Settings.findOne({ singleton: 'global' }).select('integrations.razorpay.keyId').lean()
  const keyId = doc?.integrations?.razorpay?.keyId || process.env.RAZORPAY_KEY_ID || ''
  res.json({ success: true, keyId })
})
