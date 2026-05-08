import asyncHandler from 'express-async-handler'
import Category from '../models/Category.js'
import Product from '../models/Product.js'

// @desc    Get all categories with product counts
// @route   GET /api/categories
export const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true }).sort('name')

  // Attach product counts
  const categoriesWithCount = await Promise.all(
    categories.map(async (cat) => {
      const count = await Product.countDocuments({ category: cat.name, isActive: true })
      return { ...cat.toObject(), productCount: count }
    })
  )

  res.json({ success: true, categories: categoriesWithCount })
})

// @desc    Get single category
// @route   GET /api/categories/:id
export const getCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id)
  if (!category) {
    res.status(404)
    throw new Error('Category not found')
  }
  res.json({ success: true, category })
})
