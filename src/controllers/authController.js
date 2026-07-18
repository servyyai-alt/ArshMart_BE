import asyncHandler from 'express-async-handler'
import User from '../models/User.js'
import { sendMail } from '../utils/sendMail.js'
import {
  detectIdentifierType,
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
  sanitizeUser,
} from '../utils/userHelpers.js'

// @desc    Register user
// @route   POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body
  const normalizedEmail = normalizeEmail(email)
  const normalizedPhone = normalizePhone(phone)

  if (!name || !normalizedEmail || !password || !normalizedPhone) {
    res.status(400)
    throw new Error('Please provide name, email, phone, and password')
  }

  if (!isValidEmail(normalizedEmail)) {
    res.status(400)
    throw new Error('Please provide a valid email address')
  }

  if (!isValidPhone(normalizedPhone)) {
    res.status(400)
    throw new Error('Please provide a valid 10-digit Indian mobile number')
  }

  const existingUser = await User.findOne({
    $or: [{ email: normalizedEmail }, { phone: normalizedPhone }],
  })
  if (existingUser) {
    if (existingUser.email === normalizedEmail) {
      res.status(409)
      throw new Error('Email already registered')
    }
    res.status(409)
    throw new Error('Phone number already registered')
  }

  const user = await User.create({ name, email: normalizedEmail, password, phone: normalizedPhone })
  const token = user.getJWT()

  res.status(201).json({
    success: true,
    token,
    user: sanitizeUser(user),
  })
})

// @desc    Login user
// @route   POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body

  if (!identifier || !password) {
    res.status(400)
    throw new Error('Please provide email/mobile and password')
  }

  const detectedIdentifier = detectIdentifierType(identifier)
  if (!detectedIdentifier?.value) {
    res.status(400)
    throw new Error('Please provide a valid email address or mobile number')
  }

  const user = await User.findOne(
    detectedIdentifier.type === 'email'
      ? { email: detectedIdentifier.value }
      : { phone: detectedIdentifier.value }
  ).select('+password')

  if (!user) {
    res.status(401)
    throw new Error('Invalid email/mobile or password')
  }

  if (user.isBlocked) {
    res.status(403)
    throw new Error('Your account has been blocked. Contact support.')
  }

  const isMatch = await user.comparePassword(password)
  if (!isMatch) {
    res.status(401)
    throw new Error('Invalid email/mobile or password')
  }

  const token = user.getJWT()
  res.json({ success: true, token, user: sanitizeUser(user) })
})

// @desc    Get current user
// @route   GET /api/auth/me
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
  res.json({ success: true, user: sanitizeUser(user) })
})

// @desc    Update profile
// @route   PUT /api/auth/profile
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, email, phone } = req.body
  const user = await User.findById(req.user._id)
  if (!user) {
    res.status(404)
    throw new Error('User not found')
  }

  if (typeof name === 'string' && name.trim()) {
    user.name = name.trim()
  }

  if (typeof email === 'string' && email.trim()) {
    const normalizedEmail = normalizeEmail(email)
    if (!isValidEmail(normalizedEmail)) {
      res.status(400)
      throw new Error('Please provide a valid email address')
    }

    const existingEmailUser = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: user._id },
    })
    if (existingEmailUser) {
      res.status(409)
      throw new Error('Email already registered')
    }

    user.email = normalizedEmail
  }

  if (typeof phone === 'string' && phone.trim()) {
    const normalizedPhone = normalizePhone(phone)
    if (!isValidPhone(normalizedPhone)) {
      res.status(400)
      throw new Error('Please provide a valid 10-digit Indian mobile number')
    }

    const existingPhoneUser = await User.findOne({
      phone: normalizedPhone,
      _id: { $ne: user._id },
    })
    if (existingPhoneUser) {
      res.status(409)
      throw new Error('Phone number already registered')
    }

    user.phone = normalizedPhone
  }

  await user.save()
  res.json({ success: true, user: sanitizeUser(user) })
})

// @desc    Change password
// @route   PUT /api/auth/password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body
  const user = await User.findById(req.user._id).select('+password')

  const isMatch = await user.comparePassword(currentPassword)
  if (!isMatch) {
    res.status(400)
    throw new Error('Current password is incorrect')
  }

  user.password = newPassword
  await user.save()

  res.json({ success: true, message: 'Password changed successfully' })
})

// @desc    Send OTP for password reset
// @route   POST /api/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body
  const normalizedEmail = normalizeEmail(email)

  if (!normalizedEmail) {
    res.status(400)
    throw new Error('Please provide your email')
  }

  const user = await User.findOne({ email: normalizedEmail })
  if (!user) {
    res.status(404)
    throw new Error('No account found with that email')
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000))
  user.resetPasswordOtp = otp
  user.resetPasswordOtpExpire = new Date(Date.now() + 10 * 60 * 1000)
  await user.save({ validateBeforeSave: false })

  await sendMail({
    to: user.email,
    subject: 'Your password reset OTP',
    text: `Your OTP for password reset is ${otp}. It expires in 10 minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2 style="margin:0 0 12px;">Password reset OTP</h2>
        <p>Your one-time password is:</p>
        <div style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0;">${otp}</div>
        <p>This OTP expires in 10 minutes.</p>
      </div>
    `,
  })

  res.json({ success: true, message: 'OTP sent to your email' })
})

// @desc    Verify OTP and reset password
// @route   POST /api/auth/reset-password
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body
  const normalizedEmail = normalizeEmail(email)

  if (!normalizedEmail || !otp || !newPassword) {
    res.status(400)
    throw new Error('Please provide email, OTP, and new password')
  }

  const user = await User.findOne({ email: normalizedEmail }).select('+password')
  if (!user || !user.resetPasswordOtp || !user.resetPasswordOtpExpire) {
    res.status(400)
    throw new Error('Invalid or expired OTP')
  }

  if (user.resetPasswordOtp !== String(otp)) {
    res.status(400)
    throw new Error('Invalid OTP')
  }

  if (user.resetPasswordOtpExpire < new Date()) {
    res.status(400)
    throw new Error('OTP has expired')
  }

  user.password = newPassword
  user.resetPasswordOtp = undefined
  user.resetPasswordOtpExpire = undefined
  await user.save()

  res.json({ success: true, message: 'Password updated successfully' })
})

// @desc    Verify OTP only
// @route   POST /api/auth/verify-reset-otp
export const verifyResetOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body
  const normalizedEmail = normalizeEmail(email)

  if (!normalizedEmail || !otp) {
    res.status(400)
    throw new Error('Please provide email and OTP')
  }

  const user = await User.findOne({ email: normalizedEmail })
  if (!user || !user.resetPasswordOtp || !user.resetPasswordOtpExpire) {
    res.status(400)
    throw new Error('Invalid or expired OTP')
  }

  if (user.resetPasswordOtp !== String(otp)) {
    res.status(400)
    throw new Error('Invalid OTP')
  }

  if (user.resetPasswordOtpExpire < new Date()) {
    res.status(400)
    throw new Error('OTP has expired')
  }

  res.json({ success: true, message: 'OTP verified' })
})
