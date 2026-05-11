import asyncHandler from 'express-async-handler'
import GalleryImage from '../models/GalleryImage.js'

// @desc    Public gallery images
// @route   GET /api/gallery
export const getGallery = asyncHandler(async (req, res) => {
  const { limit = 30 } = req.query
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100)
  const images = await GalleryImage.find({ isActive: true })
    .sort({ sortOrder: 1, createdAt: -1 })
    .limit(safeLimit)
    .select('public_id url caption sortOrder createdAt')
  res.json({ success: true, images })
})

