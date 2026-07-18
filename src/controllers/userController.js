import asyncHandler from 'express-async-handler'
import User from '../models/User.js'
import {
  buildAddressPayload,
  formatAddress,
  isValidPhone,
  isValidPincode,
  sanitizeUser,
} from '../utils/userHelpers.js'

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

// @desc    Get saved addresses
// @route   GET /api/users/addresses
export const getAddresses = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('addresses')
  res.json({
    success: true,
    addresses: (user?.addresses || []).map(formatAddress),
  })
})

// @desc    Add a saved address
// @route   POST /api/users/addresses
export const addAddress = asyncHandler(async (req, res) => {
  const payload = buildAddressPayload(req.body || {})

  if (!payload.fullName || !payload.phone || !payload.addressLine1 || !payload.city || !payload.state || !payload.pincode) {
    res.status(400)
    throw new Error('Please provide all required address fields')
  }

  if (!isValidPhone(payload.phone)) {
    res.status(400)
    throw new Error('Please provide a valid 10-digit Indian mobile number')
  }

  if (!isValidPincode(payload.pincode)) {
    res.status(400)
    throw new Error('Please provide a valid 6-digit pincode')
  }

  const user = await User.findById(req.user._id)
  if (!user) {
    res.status(404)
    throw new Error('User not found')
  }

  if (!Array.isArray(user.addresses)) {
    user.addresses = []
  }

  const shouldBeDefault = payload.isDefault || user.addresses.length === 0
  if (shouldBeDefault) {
    user.addresses.forEach((address) => {
      address.isDefault = false
    })
  }

  user.addresses.push({
    ...payload,
    isDefault: shouldBeDefault,
  })

  await user.save()
  res.status(201).json({ success: true, user: sanitizeUser(user) })
})

// @desc    Update a saved address
// @route   PUT /api/users/addresses/:addressId
export const updateAddress = asyncHandler(async (req, res) => {
  const { addressId } = req.params
  const payload = buildAddressPayload(req.body || {})

  if (!payload.fullName || !payload.phone || !payload.addressLine1 || !payload.city || !payload.state || !payload.pincode) {
    res.status(400)
    throw new Error('Please provide all required address fields')
  }

  if (!isValidPhone(payload.phone)) {
    res.status(400)
    throw new Error('Please provide a valid 10-digit Indian mobile number')
  }

  if (!isValidPincode(payload.pincode)) {
    res.status(400)
    throw new Error('Please provide a valid 6-digit pincode')
  }

  const user = await User.findById(req.user._id)
  const address = user?.addresses?.id(addressId)

  if (!user || !address) {
    res.status(404)
    throw new Error('Address not found')
  }

  address.fullName = payload.fullName
  address.phone = payload.phone
  address.addressLine1 = payload.addressLine1
  address.addressLine2 = payload.addressLine2
  address.city = payload.city
  address.state = payload.state
  address.pincode = payload.pincode
  address.country = payload.country

  if (payload.isDefault) {
    user.addresses.forEach((item) => {
      item.isDefault = item._id.toString() === address._id.toString()
    })
  } else if (user.addresses.filter((item) => item.isDefault).length === 0) {
    address.isDefault = true
  }

  await user.save()
  res.json({ success: true, user: sanitizeUser(user) })
})

// @desc    Delete a saved address
// @route   DELETE /api/users/addresses/:addressId
export const deleteAddress = asyncHandler(async (req, res) => {
  const { addressId } = req.params
  const user = await User.findById(req.user._id)
  const address = user?.addresses?.id(addressId)

  if (!user || !address) {
    res.status(404)
    throw new Error('Address not found')
  }

  const wasDefault = Boolean(address.isDefault)
  await address.deleteOne()

  if (wasDefault && user.addresses.length > 0) {
    user.addresses.forEach((item, index) => {
      item.isDefault = index === 0
    })
  }

  await user.save()
  res.json({ success: true, user: sanitizeUser(user) })
})

// @desc    Mark a saved address as default
// @route   PUT /api/users/addresses/:addressId/default
export const setDefaultAddress = asyncHandler(async (req, res) => {
  const { addressId } = req.params
  const user = await User.findById(req.user._id)
  const address = user?.addresses?.id(addressId)

  if (!user || !address) {
    res.status(404)
    throw new Error('Address not found')
  }

  user.addresses.forEach((item) => {
    item.isDefault = item._id.toString() === address._id.toString()
  })

  await user.save()
  res.json({ success: true, user: sanitizeUser(user) })
})

