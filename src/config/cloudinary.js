import { v2 as cloudinary } from 'cloudinary'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import multer from 'multer'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export const createStorage = (folder = 'sandhaikart', resourceType = 'image') => {
  return new CloudinaryStorage({
    cloudinary,
    params: {
      folder: `sandhaikart/${folder}`,
      resource_type: resourceType,
      allowed_formats: resourceType === 'video'
        ? ['mp4', 'webm', 'mov']
        : ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      transformation: resourceType === 'image'
        ? [{ quality: 'auto', fetch_format: 'auto' }]
        : undefined,
    },
  })
}

export const upload = multer({
  storage: createStorage('products'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
})

export const videoUpload = multer({
  storage: createStorage('products', 'video'),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
})

export default cloudinary
