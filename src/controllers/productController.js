import asyncHandler from 'express-async-handler'
import Product from '../models/Product.js'
import Category from '../models/Category.js'

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// @desc    Get all products
// @route   GET /api/products
export const getProducts = asyncHandler(async (req, res) => {
  const {
    keyword, category, minPrice, maxPrice, rating,
    sort = '-createdAt', page = 1, limit = 20, featured,
  } = req.query

  const query = { isActive: true }

  if (keyword) {
    const safe = escapeRegex(String(keyword).trim())
    if (safe) {
      const regex = new RegExp(safe, 'i')
      // Partial match across key fields (supports "yo"/"yog"/"yoga" etc.)
      query.$or = [
        { name: regex },
        { category: regex },
        { description: regex },
        { tags: regex },
      ]
    }
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

// @desc    Suggest products/categories for navbar search (partial match)
// @route   GET /api/products/suggest?query=...
export const suggestSearch = asyncHandler(async (req, res) => {
  const { query } = req.query
  const q = String(query || '').trim()
  if (!q || q.length < 2) {
    return res.json({ success: true, products: [], categories: [] })
  }

  const safe = escapeRegex(q)
  const prefix = `^${safe}`

  const [products, categoryDocs] = await Promise.all([
    Product.aggregate([
      {
        $match: {
          isActive: true,
          $or: [
            { name: { $regex: safe, $options: 'i' } },
            { category: { $regex: safe, $options: 'i' } },
          ],
        },
      },
      {
        $addFields: {
          _score: {
            $add: [
              { $cond: [{ $regexMatch: { input: '$name', regex: prefix, options: 'i' } }, 5, 0] },
              { $cond: [{ $regexMatch: { input: '$category', regex: prefix, options: 'i' } }, 3, 0] },
              { $cond: [{ $regexMatch: { input: '$name', regex: safe, options: 'i' } }, 1, 0] },
              { $cond: [{ $regexMatch: { input: '$category', regex: safe, options: 'i' } }, 1, 0] },
            ],
          },
        },
      },
      { $sort: { _score: -1, createdAt: -1 } },
      { $limit: 8 },
      {
        $project: {
          _score: 0,
          name: 1,
          price: 1,
          images: 1,
          category: 1,
          ratings: 1,
          numReviews: 1,
          stock: 1,
          isActive: 1,
        },
      },
    ]),
    Category.aggregate([
      { $match: { isActive: true, name: { $regex: safe, $options: 'i' } } },
      {
        $addFields: {
          _score: {
            $add: [
              { $cond: [{ $regexMatch: { input: '$name', regex: prefix, options: 'i' } }, 5, 0] },
              { $cond: [{ $regexMatch: { input: '$name', regex: safe, options: 'i' } }, 1, 0] },
            ],
          },
        },
      },
      { $sort: { _score: -1, name: 1 } },
      { $limit: 6 },
      { $project: { _score: 0, name: 1 } },
    ]),
  ])

  const categories = await Promise.all(
    (categoryDocs || []).map(async (c) => {
      const count = await Product.countDocuments({ isActive: true, category: c.name })
      return { category: c.name, count }
    })
  )

  res.json({ success: true, products, categories })
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

// @desc    Get related products
// @route   GET /api/products/:id/related
export const getRelatedProducts = asyncHandler(async (req, res) => {
  const { limit = 8 } = req.query
  const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 24)

  const product = await Product.findById(req.params.id).select('_id category isActive')
  if (!product || !product.isActive) {
    res.status(404)
    throw new Error('Product not found')
  }

  const related = await Product.find({
    _id: { $ne: product._id },
    category: product.category,
    isActive: true,
  })
    .sort('-createdAt')
    .limit(safeLimit)

  res.json({ success: true, products: related })
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
