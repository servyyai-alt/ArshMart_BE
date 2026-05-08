import asyncHandler from 'express-async-handler'
import Order from '../models/Order.js'
import Product from '../models/Product.js'

// @desc    Create order
// @route   POST /api/orders
export const createOrder = asyncHandler(async (req, res) => {
  const { orderItems, shippingAddress, paymentMethod, itemsPrice, shippingPrice, taxPrice, totalPrice } = req.body

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

  const order = await Order.create({
    user: req.user._id,
    orderItems,
    shippingAddress,
    paymentMethod,
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice,
  })

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
  res.json({ success: true, order: updatedOrder })
})
