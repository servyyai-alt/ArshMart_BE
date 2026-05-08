import asyncHandler from 'express-async-handler'
import User from '../models/User.js'
import Product from '../models/Product.js'
import Category from '../models/Category.js'
import Order from '../models/Order.js'
import { createShiprocketOrder } from '../utils/shiprocketAPI.js'

// ─── Products ─────────────────────────────────────────────
export const adminGetProducts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, keyword, category } = req.query
  const query = {}
  if (keyword) query.$text = { $search: keyword }
  if (category) query.category = category

  const skip = (Number(page) - 1) * Number(limit)
  const [products, total] = await Promise.all([
    Product.find(query).sort('-createdAt').skip(skip).limit(Number(limit)),
    Product.countDocuments(query),
  ])
  res.json({ success: true, products, total })
})

export const adminCreateProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(req.body)
  res.status(201).json({ success: true, product })
})

export const adminUpdateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
  if (!product) { res.status(404); throw new Error('Product not found') }
  res.json({ success: true, product })
})

export const adminDeleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true })
  if (!product) { res.status(404); throw new Error('Product not found') }
  res.json({ success: true, message: 'Product deleted' })
})

// ─── Categories ───────────────────────────────────────────
export const adminCreateCategory = asyncHandler(async (req, res) => {
  const category = await Category.create(req.body)
  res.status(201).json({ success: true, category })
})

export const adminUpdateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true })
  if (!category) { res.status(404); throw new Error('Category not found') }
  res.json({ success: true, category })
})

export const adminDeleteCategory = asyncHandler(async (req, res) => {
  await Category.findByIdAndDelete(req.params.id)
  res.json({ success: true, message: 'Category deleted' })
})

// ─── Orders ───────────────────────────────────────────────
export const adminGetOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 15, status, search } = req.query
  const query = {}
  if (status) query.orderStatus = status
  if (search) query.$or = [{ 'shippingAddress.fullName': { $regex: search, $options: 'i' } }]

  const skip = (Number(page) - 1) * Number(limit)
  const [orders, total] = await Promise.all([
    Order.find(query).populate('user', 'name email').sort('-createdAt').skip(skip).limit(Number(limit)),
    Order.countDocuments(query),
  ])
  res.json({ success: true, orders, total })
})

export const adminUpdateOrder = asyncHandler(async (req, res) => {
  const { status, trackingNumber, courierName } = req.body
  const order = await Order.findById(req.params.id)
  if (!order) { res.status(404); throw new Error('Order not found') }

  if (status) order.orderStatus = status
  if (trackingNumber) order.trackingNumber = trackingNumber
  if (courierName) order.courierName = courierName

  // If shipped and no Shiprocket order yet, create one
  if (status === 'shipped' && !order.shiprocketOrderId) {
    try {
      const srData = await createShiprocketOrder(order)
      order.shiprocketOrderId = srData.order_id
      if (srData.awb_code) order.trackingNumber = srData.awb_code
    } catch (err) {
      console.error('Shiprocket error:', err.message)
    }
  }

  const updated = await order.save()
  res.json({ success: true, order: updated })
})

// ─── Users ────────────────────────────────────────────────
export const adminGetUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort('-createdAt')
  res.json({ success: true, users })
})

export const adminUpdateUser = asyncHandler(async (req, res) => {
  const { role, isBlocked } = req.body
  const user = await User.findByIdAndUpdate(req.params.id, { role, isBlocked }, { new: true })
  if (!user) { res.status(404); throw new Error('User not found') }
  res.json({ success: true, user })
})

// ─── Analytics ────────────────────────────────────────────
export const adminGetAnalytics = asyncHandler(async (req, res) => {
  const now = new Date()
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const [
    totalOrders, totalUsers, totalProducts,
    thisMonthOrders, lastMonthOrders,
    ordersByStatus, revenueAgg,
  ] = await Promise.all([
    Order.countDocuments(),
    User.countDocuments({ role: 'user' }),
    Product.countDocuments({ isActive: true }),
    Order.countDocuments({ createdAt: { $gte: thisMonth } }),
    Order.countDocuments({ createdAt: { $gte: lastMonth, $lt: thisMonth } }),
    Order.aggregate([{ $group: { _id: '$orderStatus', count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } },
    ]),
  ])

  const totalRevenue = revenueAgg[0]?.total || 0
  const ordersChange = lastMonthOrders > 0
    ? Math.round(((thisMonthOrders - lastMonthOrders) / lastMonthOrders) * 100)
    : 100

  const ordersByStatusMap = {}
  ordersByStatus.forEach(({ _id, count }) => { ordersByStatusMap[_id] = count })

  res.json({
    success: true,
    totalOrders,
    totalUsers,
    totalProducts,
    totalRevenue,
    ordersChange,
    ordersByStatus: ordersByStatusMap,
  })
})

// ─── Gallery ──────────────────────────────────────────────
// Simple in-memory/DB gallery store
let galleryImages = []

export const adminGetGallery = asyncHandler(async (req, res) => {
  res.json({ success: true, images: galleryImages })
})

export const adminAddGallery = asyncHandler(async (req, res) => {
  const { images } = req.body
  galleryImages = [...galleryImages, ...images]
  res.json({ success: true, images: galleryImages })
})

export const adminDeleteGallery = asyncHandler(async (req, res) => {
  const { publicId } = req.params
  galleryImages = galleryImages.filter(i => i.public_id !== publicId)
  res.json({ success: true, message: 'Deleted' })
})
