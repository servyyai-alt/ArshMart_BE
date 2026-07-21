import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { fileURLToPath } from 'url'

import connectDB from './config/db.js'
import { notFound, errorHandler } from './middleware/errorMiddleware.js'

import webhookRoutes from './routes/webhookRoutes.js'
import authRoutes from './routes/authRoutes.js'
import productRoutes from './routes/productRoutes.js'
import categoryRoutes from './routes/categoryRoutes.js'
import orderRoutes from './routes/orderRoutes.js'
import paymentRoutes from './routes/paymentRoutes.js'
import shippingRoutes from './routes/shippingRoutes.js'
import uploadRoutes from './routes/uploadRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import settingsRoutes from './routes/settingsRoutes.js'
import galleryRoutes from './routes/galleryRoutes.js'
import userRoutes from './routes/userRoutes.js'
import returnRoutes from './routes/returnRoutes.js'
import couponRoutes from './routes/couponRoutes.js'
import checkoutRoutes from './routes/checkoutRoutes.js'
import internalWorkerRoutes from './routes/internalWorkerRoutes.js'
import { startAbandonedCheckoutCron } from './utils/abandonedCheckoutCron.js'
import { verifySmtpConnection } from './utils/email.js'
import { startWhatsAppNotificationWorker } from './utils/whatsappNotifier.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const isVercel = Boolean(process.env.VERCEL)

connectDB()

if (process.env.NODE_ENV !== 'test' && !isVercel) {
  startAbandonedCheckoutCron()
  startWhatsAppNotificationWorker()
  verifySmtpConnection()
}

const app = express()

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}))

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:5174',
    'https://sandhaikart.com',
    'https://www.sandhaikart.com',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, message: 'Too many requests, please try again later.' },
})

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, message: 'Too many requests.' },
})

app.use('/api/webhooks/razorpay', express.raw({ type: 'application/json' }))
app.use('/api/webhooks/shiprocket', express.json())
app.use('/api/webhooks', webhookRoutes)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
}

app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/products', apiLimiter, productRoutes)
app.use('/api/categories', apiLimiter, categoryRoutes)
app.use('/api/orders', apiLimiter, orderRoutes)
app.use('/api/payment', apiLimiter, paymentRoutes)
app.use('/api/shipping', apiLimiter, shippingRoutes)
app.use('/api/upload', apiLimiter, uploadRoutes)
app.use('/api/admin', apiLimiter, adminRoutes)
app.use('/api/settings', apiLimiter, settingsRoutes)
app.use('/api/gallery', apiLimiter, galleryRoutes)
app.use('/api/users', apiLimiter, userRoutes)
app.use('/api/returns', apiLimiter, returnRoutes)
app.use('/api/coupons', apiLimiter, couponRoutes)
app.use('/api/checkouts', apiLimiter, checkoutRoutes)
app.use('/api/internal', internalWorkerRoutes)

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Sandhaikart Backend API',
    docs: '/api/health',
  })
})

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Sandhaikart API is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
})

if (process.env.NODE_ENV === 'production' && !isVercel) {
  const frontendPath = path.join(__dirname, '../../frontend/dist')
  app.use(express.static(frontendPath))

  app.get('/sitemap.xml', (req, res) => {
    res.sendFile(path.join(frontendPath, 'sitemap.xml'))
  })

  app.get('/robots.txt', (req, res) => {
    res.sendFile(path.join(frontendPath, 'robots.txt'))
  })

  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'))
  })
}

app.use(notFound)
app.use(errorHandler)

if (!isVercel) {
  const PORT = process.env.PORT || 5000

  app.listen(PORT, () => {
    console.log(`
  ========================================
  Sandhaikart API Server

  Port    : ${PORT}
  Mode    : ${(process.env.NODE_ENV || 'development').padEnd(12)}
  Health  : /api/health
  ========================================
    `)
  })
}

export default app
