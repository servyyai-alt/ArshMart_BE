import express from 'express'
import { createOrder, getMyOrders, getOrderById, payOrder } from '../controllers/orderController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/', protect, createOrder)
router.get('/my', protect, getMyOrders)
router.get('/:id', protect, getOrderById)
router.put('/:id/pay', protect, payOrder)

export default router
