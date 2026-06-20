import express from 'express'
import { protect } from '../middleware/authMiddleware.js'
import { createPendingCheckout, linkCheckoutOrder } from '../controllers/checkoutController.js'

const router = express.Router()

router.use(protect)

router.post('/abandoned', createPendingCheckout)
router.put('/abandoned/:id/link', linkCheckoutOrder)

export default router
