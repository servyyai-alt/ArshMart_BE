import express from 'express'
import { getProducts, getFeaturedProducts, getProduct, addReview, getRelatedProducts } from '../controllers/productController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

router.get('/', getProducts)
router.get('/featured', getFeaturedProducts)
router.get('/:id/related', getRelatedProducts)
router.get('/:id', getProduct)
router.post('/:id/reviews', protect, addReview)

export default router
