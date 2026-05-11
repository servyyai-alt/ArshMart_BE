import express from 'express'
import {
  adminGetProducts, adminCreateProduct, adminUpdateProduct, adminDeleteProduct,
  adminCreateCategory, adminUpdateCategory, adminDeleteCategory,
  adminGetOrders, adminUpdateOrder,
  adminGetUsers, adminUpdateUser,
  adminGetAnalytics,
  adminGetGallery, adminAddGallery, adminDeleteGallery,
} from '../controllers/adminController.js'
import { adminGetSettings, adminUpdateSettings } from '../controllers/settingsController.js'
import { protect, adminOnly } from '../middleware/authMiddleware.js'

const router = express.Router()

// All admin routes require authentication + admin role
router.use(protect, adminOnly)

// Products
router.route('/products').get(adminGetProducts).post(adminCreateProduct)
router.route('/products/:id').put(adminUpdateProduct).delete(adminDeleteProduct)

// Categories
router.route('/categories').post(adminCreateCategory)
router.route('/categories/:id').put(adminUpdateCategory).delete(adminDeleteCategory)

// Orders
router.route('/orders').get(adminGetOrders)
router.route('/orders/:id').put(adminUpdateOrder)

// Users
router.route('/users').get(adminGetUsers)
router.route('/users/:id').put(adminUpdateUser)

// Analytics
router.get('/analytics', adminGetAnalytics)

// Gallery
router.route('/gallery').get(adminGetGallery).post(adminAddGallery)
router.delete('/gallery/:publicId', adminDeleteGallery)

// Settings
router.route('/settings').get(adminGetSettings).put(adminUpdateSettings)

export default router
