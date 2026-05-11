import express from 'express'
import { protect } from '../middleware/authMiddleware.js'
import { getWishlist, addToWishlist, removeFromWishlist } from '../controllers/userController.js'

const router = express.Router()

router.get('/wishlist', protect, getWishlist)
router.post('/wishlist', protect, addToWishlist)
router.delete('/wishlist/:productId', protect, removeFromWishlist)

export default router

