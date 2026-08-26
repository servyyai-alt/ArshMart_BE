import asyncHandler from 'express-async-handler'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import User from '../models/User.js'
import { sendOrderEmails } from '../utils/email.js'
import { sendOrderCancelledEmails } from '../utils/email.js'
import Settings from '../models/Settings.js'
import { sendWhatsAppOrderConfirmation, sendWhatsAppTrackingUpdate } from '../utils/whatsappNotifier.js'
import { getRazorpayKeys } from '../utils/razorpayClient.js'
import { normalizeProductDimensions } from '../utils/productDimensions.js'

const normalizeCode = (code) => String(code || '').trim().toUpperCase()
const FALLBACK_COUPON = 'WELCOME10'

// @desc    Create order
// @route   POST /api/orders
export const createOrder = asyncHandler(async (req, res) => {
  const { orderItems, shippingAddress, paymentMethod, itemsPrice, shippingPrice, couponCode } = req.body

  if (!orderItems?.length) {
    res.status(400)
    throw new Error('No order items')
  }

  // Fetch all products in one query instead of one DB call per item.
  const productIds = [...new Set(orderItems.map((item) => String(item.product)))]
  const products = await Product.find({ _id: { $in: productIds } })
    .select('_id name stock hsnCode dimensions weight')
    .lean()

  const productMap = new Map(products.map((product) => [String(product._id), product]))

  for (const item of orderItems) {
    const product = productMap.get(String(item.product))
    if (!product) {
      res.status(404)
      throw new Error(`Product not found: ${item.name}`)
    }
    if (product.stock < item.quantity) {
      res.status(400)
      throw new Error(`Insufficient stock for: ${product.name}`)
    }
  }

  const orderItemsWithHsn = orderItems.map((item) => {
    const product = productMap.get(String(item.product))
    return {
      ...item,
      hsnCode: product?.hsnCode || '',
      dimensions: normalizeProductDimensions(product || {}) || null,
    }
  })

  const safeItemsPrice = Number(itemsPrice) || 0
  const safeShippingPrice = Number(shippingPrice) || 0
  const baseTotal = Math.max(0, safeItemsPrice + safeShippingPrice)

  let coupon = undefined
  let computedTotalPrice = baseTotal

  const normalizedCoupon = normalizeCode(couponCode)
  if (normalizedCoupon) {
    const settings = await Settings.findOne({ singleton: 'global' }).select('marketing.couponCode').lean()
    const active = normalizeCode(settings?.marketing?.couponCode)
    const isValid = normalizedCoupon === FALLBACK_COUPON || (active && normalizedCoupon === active)
    if (!isValid) {
      res.status(400)
      throw new Error('Invalid coupon code')
    }

    const user = await User.findById(req.user._id).select('usedCoupons').lean()
    const used = Array.isArray(user?.usedCoupons) ? user.usedCoupons.map(normalizeCode) : []
    if (used.includes(normalizedCoupon)) {
      res.status(400)
      throw new Error('Coupon already used')
    }

    const percent = 10
    const discountAmount = Math.round((baseTotal * percent) / 100)
    computedTotalPrice = Math.max(0, baseTotal - discountAmount)
    coupon = { code: normalizedCoupon, percent, discountAmount }
  }

  const order = await Order.create({
    user: req.user._id,
    orderItems: orderItemsWithHsn,
    shippingAddress,
    paymentMethod,
    itemsPrice: safeItemsPrice,
    shippingPrice: safeShippingPrice,
    totalPrice: computedTotalPrice,
    coupon,
  })

  if (coupon?.code) {
    try {
      await User.findByIdAndUpdate(req.user._id, { $addToSet: { usedCoupons: coupon.code } })
    } catch (err) {
      console.error('Failed to mark coupon as used:', err.message)
    }
  }

  // Run notification work after the order exists; the queue helper now drains
  // immediately when possible so we do not depend on a background tick.
  if (paymentMethod === 'cod') {
    setImmediate(async () => {
      try {
        const user = await User.findById(req.user._id).select('name email phone').lean()
        await sendOrderEmails({ order, user })
        order.notification = {
          ...(order.notification || {}),
          userEmailSentAt: new Date(),
          adminEmailSentAt: new Date(),
        }
        await order.save()
      } catch (err) {
        console.error('COD order email send failed:', err.message)
       }

    })

    try {
      await sendWhatsAppOrderConfirmation(order)
      if (order.trackingNumber) await sendWhatsAppTrackingUpdate(order)
    } catch (err) {
      console.error('Unable to queue WhatsApp notification after COD order creation:', err.message)
    }
  }

  res.status(201).json({ success: true, order })
})

// @desc    Get my orders
// @route   GET /api/orders/my
export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort('-createdAt')
  res.json({ success: true, orders })
})

// @desc    Get order by ID
// @route   GET /api/orders/:id
export const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email')

  if (!order) {
    res.status(404)
    throw new Error('Order not found')
  }

  // Check ownership or admin
  if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    res.status(403)
    throw new Error('Not authorized to view this order')
  }

  res.json({ success: true, order })
})

// @desc    Update order to paid
// @route   PUT /api/orders/:id/pay
export const payOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
  if (!order) {
    res.status(404)
    throw new Error('Order not found')
  }

  order.isPaid = true
  order.paidAt = new Date()
  order.orderStatus = 'processing'
  order.paymentResult = {
    razorpayOrderId: req.body.razorpay_order_id,
    razorpayPaymentId: req.body.razorpay_payment_id,
    razorpaySignature: req.body.razorpay_signature,
    status: 'paid',
    paidAt: new Date(),
  }

  // Reduce stock
  for (const item of order.orderItems) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } })
  }

  const updatedOrder = await order.save()

  // Send emails best-effort if not sent
  if (!updatedOrder.notification?.userEmailSentAt || !updatedOrder.notification?.adminEmailSentAt) {
    try {
      const user = await User.findById(updatedOrder.user).select('name email phone').lean()
      await sendOrderEmails({ order: updatedOrder, user })
      updatedOrder.notification = {
        ...(updatedOrder.notification || {}),
        userEmailSentAt: updatedOrder.notification?.userEmailSentAt || new Date(),
        adminEmailSentAt: updatedOrder.notification?.adminEmailSentAt || new Date(),
      }
      await updatedOrder.save()
    } catch (err) {
      console.error('Order email send failed after payOrder:', err.message)
    }
  }

  try {
    await sendWhatsAppOrderConfirmation(updatedOrder)
    if (updatedOrder.trackingNumber) {
      await sendWhatsAppTrackingUpdate(updatedOrder)
    }
  } catch (err) {
    console.error('WhatsApp notification failed after payOrder:', err.message)
  }

  res.json({ success: true, order: updatedOrder })
})

// @desc    Cancel my order
// @route   PUT /api/orders/:id/cancel
const isValidUpiId = (upiId) => /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/.test(upiId)

export const cancelOrder = asyncHandler(async (req, res) => {
  const { reason, notes, manualRefundDetails } = req.body || {}
  const cancelReason = String(reason || '').trim()
  const cancelNotes = String(notes || '').trim()
  if (!cancelReason) {
    res.status(400)
    throw new Error('Cancellation reason is required')
  }

  const order = await Order.findById(req.params.id)
  if (!order) {
    res.status(404)
    throw new Error('Order not found')
  }

  // Check ownership or admin
  if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    res.status(403)
    throw new Error('Not authorized to cancel this order')
  }

  let sanitizedRefundDetails = undefined

  if (order.paymentMethod === 'cod') {
    sanitizedRefundDetails = undefined
  } else {
    if (!manualRefundDetails) {
      res.status(400)
      throw new Error('Refund details are required for online payment orders')
    }
    const method = String(manualRefundDetails.method || 'upi').trim().toLowerCase()
    if (method === 'upi') {
      const upiId = String(manualRefundDetails.upiId || '').trim()
      if (!upiId) {
        res.status(400)
        throw new Error('UPI ID is required for UPI refund method')
      }
      if (!isValidUpiId(upiId)) {
        res.status(400)
        throw new Error('Invalid UPI ID format. Example: name@oksbi')
      }
      sanitizedRefundDetails = {
        method: 'upi',
        upiId,
      }
    } else if (method === 'bank') {
      const accountName = String(manualRefundDetails.accountName || '').trim()
      const bankName = String(manualRefundDetails.bankName || '').trim()
      const accountNumber = String(manualRefundDetails.accountNumber || '').trim()
      const ifscCode = String(manualRefundDetails.ifscCode || '').trim()

      if (!accountName || !bankName || !accountNumber || !ifscCode) {
        res.status(400)
        throw new Error('All bank account details (Account Name, Bank Name, Account Number, and IFSC Code) are required')
      }
      sanitizedRefundDetails = {
        method: 'bank',
        accountName,
        bankName,
        accountNumber,
        ifscCode,
      }
    } else {
      res.status(400)
      throw new Error('Please specify a valid refund method (upi or bank)')
    }
  }

  if (sanitizedRefundDetails) {
    order.set('refund.manualRefundDetails', sanitizedRefundDetails)
  }

  if (order.orderStatus === 'cancelled') {
    res.status(400)
    throw new Error('Order is already cancelled')
  }
  if (order.orderStatus === 'delivered') {
    res.status(400)
    throw new Error('Delivered orders cannot be cancelled')
  }
  if (order.orderStatus === 'shipped') {
    res.status(400)
    throw new Error('Shipped orders cannot be cancelled')
  }

  let refund = null

  // Initiate Razorpay refund for prepaid orders.
  if (order.paymentMethod === 'razorpay' && order.isPaid) {
    const paymentId = order.paymentResult?.razorpayPaymentId
    if (paymentId) {
      try {
        const { client } = await getRazorpayKeys()
        if (!client) {
          throw new Error('Razorpay keys not configured')
        }

        refund = await client.payments.refund(paymentId, {
          amount: Math.round(Number(order.totalPrice) * 100),
          speed: 'optimum',
        })

        order.set('refund.refundId', refund.id)
        order.set('refund.refundStatus', refund.status === 'processed' ? 'processed' : 'pending')
        order.set('refund.refundAmount', refund.amount)
        order.set('refund.refundProcessedAt', refund.status === 'processed' ? new Date() : undefined)
        order.orderStatus = refund.status === 'processed' ? 'refund_processed' : 'refund_pending'
      } catch (err) {
        console.error('Razorpay refund failed during cancellation:', err.message)
        order.set('refund.refundStatus', 'failed')
        order.orderStatus = 'refund_failed'
      }
    } else {
      order.orderStatus = 'cancelled'
    }
  } else {
    order.orderStatus = 'cancelled'
  }

  order.cancelReason = cancelReason
  if (cancelNotes) {
    order.cancelNotes = cancelNotes
  }
  const updated = await order.save()

  // Send cancellation emails best-effort (user + admin)
  if (!updated.notification?.cancelUserEmailSentAt || !updated.notification?.cancelAdminEmailSentAt) {
    try {
      const user = await User.findById(updated.user).select('name email phone').lean()
      await sendOrderCancelledEmails({ order: updated, user, reason: cancelReason })
      updated.notification = {
        ...(updated.notification || {}),
        cancelUserEmailSentAt: updated.notification?.cancelUserEmailSentAt || new Date(),
        cancelAdminEmailSentAt: updated.notification?.cancelAdminEmailSentAt || new Date(),
      }
      await updated.save()
    } catch (err) {
      console.error('Order cancellation email send failed:', err.message)
    }
  }

  res.json({ success: true, order: updated, refund })
})
