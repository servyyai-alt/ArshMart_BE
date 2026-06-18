import express from 'express'
import { razorpayWebhook, shiprocketWebhook } from '../controllers/webhookController.js'

const router = express.Router()

router.post('/razorpay', razorpayWebhook)
router.post('/shiprocket', shiprocketWebhook)

export default router

