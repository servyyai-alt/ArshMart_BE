import express from 'express'
import { createRazorpayOrder, verifyPayment, getRazorpayPublicKey } from '../controllers/paymentController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

router.get('/key', protect, getRazorpayPublicKey)
router.post('/create-order', protect, createRazorpayOrder)
router.post('/verify', protect, verifyPayment)

export default router
