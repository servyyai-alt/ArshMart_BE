import asyncHandler from 'express-async-handler'
import User from '../models/User.js'

// @desc    Get my wishlist (populated)
// @route   GET /api/users/wishlist
export const getWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate({
    path: 'wishlist',
    select: 'name price originalPrice images category ratings numReviews stock isActive',
  })
  res.json({ success: true, wishlist: user?.wishlist || [] })
})

// @desc    Add product to wishlist
// @route   POST /api/users/wishlist
export const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body
  if (!productId) {
    res.status(400)
    throw new Error('productId is required')
  }
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $addToSet: { wishlist: productId } },
    { new: true }
  ).select('wishlist')
  res.json({ success: true, wishlist: user.wishlist })
})

// @desc    Remove product from wishlist
// @route   DELETE /api/users/wishlist/:productId
export const removeFromWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { wishlist: productId } },
    { new: true }
  ).select('wishlist')
  res.json({ success: true, wishlist: user.wishlist })
})

