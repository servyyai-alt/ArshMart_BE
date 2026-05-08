import asyncHandler from 'express-async-handler'
import Product from '../models/Product.js'

// @desc    Get all products
// @route   GET /api/products
export const getProducts = asyncHandler(async (req, res) => {
  const {
    keyword, category, minPrice, maxPrice, rating,
    sort = '-createdAt', page = 1, limit = 12, featured,
  } = req.query

  const query = { isActive: true }

  if (keyword) {
    query.$text = { $search: keyword }
  }
  if (category) query.category = category
  if (featured) query.isFeatured = true
  if (minPrice || maxPrice) {
    query.price = {}
    if (minPrice) query.price.$gte = Number(minPrice)
    if (maxPrice) query.price.$lte = Number(maxPrice)
  }
  if (rating) query.ratings = { $gte: Number(rating) }

  const pageNum = Math.max(1, Number(page))
  const limitNum = Math.min(50, Number(limit))
  const skip = (pageNum - 1) * limitNum

  const [products, totalProducts] = await Promise.all([
    Product.find(query).sort(sort).skip(skip).limit(limitNum),
    Product.countDocuments(query),
  ])

  res.json({
    success: true,
    products,
    totalProducts,
    totalPages: Math.ceil(totalProducts / limitNum),
    currentPage: pageNum,
  })
})

// @desc    Get featured products
// @route   GET /api/products/featured
export const getFeaturedProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ isFeatured: true, isActive: true }).sort('-createdAt').limit(8)
  res.json({ success: true, products })
})

// @desc    Get single product
// @route   GET /api/products/:id
export const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
  if (!product || !product.isActive) {
    res.status(404)
    throw new Error('Product not found')
  }
  res.json({ success: true, product })
})

// @desc    Add product review
// @route   POST /api/products/:id/reviews
export const addReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body
  const product = await Product.findById(req.params.id)

  if (!product) {
    res.status(404)
    throw new Error('Product not found')
  }

  const alreadyReviewed = product.reviews.find(r => r.user.toString() === req.user._id.toString())
  if (alreadyReviewed) {
    res.status(400)
    throw new Error('You have already reviewed this product')
  }

  product.reviews.push({
    user: req.user._id,
    name: req.user.name,
    rating: Number(rating),
    comment,
  })

  product.calcAverageRating()
  await product.save()

  res.status(201).json({ success: true, message: 'Review added' })
})
