import asyncHandler from 'express-async-handler'
import Settings from '../models/Settings.js'
import User from '../models/User.js'

const getActiveCouponCode = async () => {
  const doc = await Settings.findOne({ singleton: 'global' }).select('marketing.couponCode').lean()
  const code = String(doc?.marketing?.couponCode || '').trim()
  return code
}

const normalizeCode = (code) => String(code || '').trim().toUpperCase()
const FALLBACK_COUPON = 'WELCOME10'

// @desc    Validate coupon for current user (one-time)
// @route   POST /api/coupons/apply
export const applyCoupon = asyncHandler(async (req, res) => {
  const rawCode = req.body?.code
  const code = normalizeCode(rawCode)
  if (!code) {
    res.status(400)
    throw new Error('Coupon code is required')
  }

  const active = normalizeCode(await getActiveCouponCode())
  const isValid = code === FALLBACK_COUPON || (active && code === active)
  if (!isValid) {
    res.status(400)
    throw new Error('Invalid coupon code')
  }

  const user = await User.findById(req.user?._id).select('usedCoupons').lean()
  const used = Array.isArray(user?.usedCoupons) ? user.usedCoupons.map(normalizeCode) : []
  if (used.includes(code)) {
    res.status(400)
    throw new Error('Coupon already used')
  }

  try {
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { usedCoupons: code } })
  } catch (err) {
    console.error('Failed to mark coupon as used on apply:', err.message)
  }

  // Fixed discount: 10% (requirement)
  res.json({ success: true, coupon: { code, percent: 10 } })
})
