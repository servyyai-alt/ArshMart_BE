import asyncHandler from 'express-async-handler'
import crypto from 'crypto'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import { createShiprocketOrder } from '../utils/shiprocketAPI.js'
import User from '../models/User.js'
import { sendOrderEmails } from '../utils/email.js'
import { getRazorpayKeys } from '../utils/razorpayClient.js'

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

  let shiprocket = null
  let shiprocketError = null
  if (!order.shiprocketOrderId) {
    try {
      const srData = await createShiprocketOrder(order)
      order.shiprocketOrderId = srData.order_id
      order.shiprocketShipmentId = srData.shipment_id
      if (srData.awb_code) {
        order.trackingNumber = srData.awb_code
        order.courierName = srData.courier_name
      }
      await order.save()
      shiprocket = {
        order_id: srData.order_id,
        shipment_id: srData.shipment_id,
        awb_code: srData.awb_code,
        courier_name: srData.courier_name,
      }
    } catch (err) {
      shiprocketError = err.message
      // Keep payment successful even if shipping setup fails.
      console.error('Shiprocket create order failed after payment:', err.message)
    }
  }

  // Send emails (best-effort; do not fail payment success if email fails)
  if (!order.notification?.userEmailSentAt || !order.notification?.adminEmailSentAt) {
    try {
      const user = await User.findById(order.user).select('name email phone').lean()
      await sendOrderEmails({ order, user })
      order.notification = {
        ...(order.notification || {}),
        userEmailSentAt: order.notification?.userEmailSentAt || new Date(),
        adminEmailSentAt: order.notification?.adminEmailSentAt || new Date(),
      }
      await order.save()
    } catch (err) {
      console.error('Order email send failed:', err.message)
    }
  }

  res.json({ success: true, message: 'Payment verified successfully', order, shiprocket, shiprocketError })
})

// @desc    Get Razorpay public key (key_id)
// @route   GET /api/payment/key
export const getRazorpayPublicKey = asyncHandler(async (req, res) => {
  const { keyId } = await getRazorpayKeys()
  res.json({ success: true, keyId })
})
