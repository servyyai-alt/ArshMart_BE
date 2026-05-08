import asyncHandler from 'express-async-handler'
import cloudinary from '../config/cloudinary.js'

// @desc    Upload image(s)
// @route   POST /api/upload/image
export const uploadImage = asyncHandler(async (req, res) => {
  if (!req.files?.length && !req.file) {
    res.status(400)
    throw new Error('No file uploaded')
  }

  const files = req.files || [req.file]
  const results = files.map(f => ({
    url: f.path,
    public_id: f.filename,
  }))

  res.json({
    success: true,
    images: results,
    ...(results.length === 1 ? { url: results[0].url, public_id: results[0].public_id } : {}),
  })
})

// @desc    Upload video
// @route   POST /api/upload/video
export const uploadVideo = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400)
    throw new Error('No video file uploaded')
  }

  res.json({
    success: true,
    url: req.file.path,
    public_id: req.file.filename,
  })
})

// @desc    Delete asset
// @route   DELETE /api/upload/delete
export const deleteAsset = asyncHandler(async (req, res) => {
  const { publicId, resourceType = 'image' } = req.body

  if (!publicId) {
    res.status(400)
    throw new Error('Public ID required')
  }

  const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })

  res.json({ success: true, result })
})
