import express from 'express'
import { uploadImage, uploadVideo, deleteAsset } from '../controllers/uploadController.js'
import { protect, adminOnly } from '../middleware/authMiddleware.js'
import { upload, videoUpload } from '../config/cloudinary.js'

const router = express.Router()

router.post('/image', protect, upload.array('file', 10), uploadImage)
router.post('/video', protect, adminOnly, videoUpload.single('file'), uploadVideo)
router.delete('/delete', protect, adminOnly, deleteAsset)

export default router
