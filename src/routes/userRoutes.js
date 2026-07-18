import express from 'express'
import { protect } from '../middleware/authMiddleware.js'
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '../controllers/userController.js'

const router = express.Router()

router.get('/wishlist', protect, getWishlist)
router.post('/wishlist', protect, addToWishlist)
router.delete('/wishlist/:productId', protect, removeFromWishlist)
router.get('/addresses', protect, getAddresses)
router.post('/addresses', protect, addAddress)
router.put('/addresses/:addressId', protect, updateAddress)
router.delete('/addresses/:addressId', protect, deleteAddress)
router.put('/addresses/:addressId/default', protect, setDefaultAddress)

export default router

