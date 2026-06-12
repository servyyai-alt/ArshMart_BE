import express from 'express'
import {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
} from '../controllers/authController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/register', register)
router.post('/login', login)
router.post('/forgot-password', forgotPassword)
router.post('/verify-reset-otp', verifyResetOtp)
router.post('/reset-password', resetPassword)
router.get('/me', protect, getMe)
router.put('/profile', protect, updateProfile)
router.put('/password', protect, changePassword)

export default router
