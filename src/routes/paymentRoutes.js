import express from 'express'
import { createRazorpayOrder, verifyPayment, getRazorpayPublicKey } from '../controllers/paymentController.js'

const router = express.Router()

router.get('/key', getRazorpayPublicKey)
router.post('/create-order', createRazorpayOrder)
router.post('/verify', verifyPayment)

export default router
