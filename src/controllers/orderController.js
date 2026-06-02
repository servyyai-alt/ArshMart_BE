import asyncHandler from 'express-async-handler'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import { createShiprocketOrder } from '../utils/shiprocketAPI.js'
import { cancelShiprocketOrder } from '../utils/shiprocketAPI.js'
import User from '../models/User.js'
import { sendOrderEmails } from '../utils/email.js'
import { sendOrderCancelledEmails } from '../utils/email.js'
import Settings from '../models/Settings.js'

const normalizeCode = (code) => String(code || '').trim().toUpperCase()

// @desc    Create order
// @route   POST /api/orders
export const createOrder = asyncHandler(async (req, res) => {
  const { orderItems, shippingAddress, paymentMethod, itemsPrice, shippingPrice, taxPrice, couponCode } = req.body

  if (!orderItems?.length) {
    res.status(400)
    throw new Error('No order items')
  }

  // Verify stock and prices
  for (const item of orderItems) {
    const product = await Product.findById(item.product)
    if (!product) {
      res.status(404)
      throw new Error(`Product not found: ${item.name}`)
    }
    if (product.stock < item.quantity) {
      res.status(400)
      throw new Error(`Insufficient stock for: ${product.name}`)
    }
  }

  const safeItemsPrice = Number(itemsPrice) || 0
  const safeShippingPrice = Number(shippingPrice) || 0
  const safeTaxPrice = Number(taxPrice) || 0
  const baseTotal = Math.max(0, safeItemsPrice + safeShippingPrice + safeTaxPrice)

  let coupon = undefined
  let computedTotalPrice = baseTotal

  const normalizedCoupon = normalizeCode(couponCode)
  if (normalizedCoupon) {
    const settings = await Settings.findOne({ singleton: 'global' }).select('marketing.couponCode').lean()
    const active = normalizeCode(settings?.marketing?.couponCode)
    if (!active) {
      res.status(400)
      throw new Error('No active coupon configured')
    }
    if (normalizedCoupon !== active) {
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
    orderItems,
    shippingAddress,
    paymentMethod,
    itemsPrice: safeItemsPrice,
    shippingPrice: safeShippingPrice,
    taxPrice: safeTaxPrice,
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

  // COD orders: consider order placed immediately -> send emails best-effort.
  if (paymentMethod === 'cod') {
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
  // Auto-create Shiprocket order after successful payment (best-effort).
  if (!updatedOrder.shiprocketOrderId) {
    try {
      const srData = await createShiprocketOrder(updatedOrder)
      updatedOrder.shiprocketOrderId = srData.order_id
      updatedOrder.shiprocketShipmentId = srData.shipment_id
      if (srData.awb_code) {
        updatedOrder.trackingNumber = srData.awb_code
        updatedOrder.courierName = srData.courier_name
      }
      await updatedOrder.save()
    } catch (err) {
      console.error('Shiprocket create order failed after payOrder:', err.message)
    }
  }

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
  res.json({ success: true, order: updatedOrder })
})

// @desc    Cancel my order
// @route   PUT /api/orders/:id/cancel
export const cancelOrder = asyncHandler(async (req, res) => {
  const { reason } = req.body || {}
  const cancelReason = String(reason || '').trim()
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

  // Best-effort Shiprocket cancellation (if an order id exists)
  if (order.shiprocketOrderId) {
    try {
      await cancelShiprocketOrder([order.shiprocketOrderId])
    } catch (err) {
      console.error('Shiprocket cancel failed:', err.message)
    }
  }

  order.orderStatus = 'cancelled'
  order.cancelReason = cancelReason
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

  res.json({ success: true, order: updated })
})
