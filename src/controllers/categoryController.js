import asyncHandler from 'express-async-handler'
import Category from '../models/Category.js'
import Product from '../models/Product.js'
import { createHttpError } from '../utils/httpError.js'

// @desc    Get all categories with product counts
// @route   GET /api/categories
export const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true }).sort('name')

  // Attach product counts
  const categoriesWithCount = await Promise.all(
    categories.map(async (cat) => {
      const count = await Product.countDocuments({ category: cat.name, isActive: true })
      const obj = cat.toObject()
      // Back-compat: if legacy image exists but media is empty, expose it.
      if ((!obj.media?.url) && obj.image) {
        obj.media = { kind: 'image', url: obj.image, publicId: obj.imagePublicId || '' }
      }
      return { ...obj, productCount: count }
    })
  )

  res.json({ success: true, categories: categoriesWithCount })
})

// @desc    Get single category
// @route   GET /api/categories/:id
export const getCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id)
  if (!category) {
    throw createHttpError(404, 'Category not found')
  }
  res.json({ success: true, category })
})
