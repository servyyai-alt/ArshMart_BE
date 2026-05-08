import express from 'express'
import { createShipping, trackShipment, checkServiceability } from '../controllers/shippingController.js'
import { protect, adminOnly } from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/create/:orderId', protect, adminOnly, createShipping)
router.get('/track/:awb', protect, trackShipment)
router.post('/serviceability', protect, checkServiceability)

export default router
