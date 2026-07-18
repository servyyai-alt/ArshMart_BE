import axios from 'axios'
import Order from '../models/Order.js'
import WhatsAppNotification from '../models/WhatsAppNotification.js'

const POLL_INTERVAL_MS = 5000
const LOCK_DURATION_MS = 2 * 60 * 1000
const REQUEST_TIMEOUT_MS = 30 * 1000
const MAX_ATTEMPTS = 12
let workerTimer = null
let workerRunning = false

const normalizeIndianPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '')
  if (/^\d{10}$/.test(digits)) return `91${digits}`
  if (/^91\d{10}$/.test(digits)) return digits
  return ''
}

const getOrderNumber = (order) => order?._id?.toString()?.slice(-8)?.toUpperCase() || ''

const getPaymentStatus = (order) => {
  if (order?.isPaid) return 'Paid'
  if (order?.paymentMethod === 'cod') return 'COD'
  return 'Pending'
}

const getConfig = () => {
  const baseURL = String(process.env.WHATSAPP_SERVICE_BASE_URL || '').trim().replace(/\/+$/, '')
  const apiKey = String(process.env.WHATSAPP_INTERNAL_API_KEY || '').trim()
  return baseURL && apiKey ? { baseURL, apiKey } : null
}

const buildPayload = (order) => {
  const orderId = order?._id?.toString()
  const frontendUrl = String(process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '')
  return {
    orderId,
    orderNumber: getOrderNumber(order),
    customerName: order?.shippingAddress?.fullName || '',
    customerPhone: normalizeIndianPhone(order?.shippingAddress?.phone),
    totalAmount: Number(order?.totalPrice || 0),
    paymentStatus: getPaymentStatus(order),
    trackingNumber: order?.trackingNumber || '',
    courierName: order?.courierName || '',
    orderUrl: frontendUrl && orderId ? `${frontendUrl}/orders/${orderId}` : '',
  }
}

const errorMessage = (err) => {
  const apiDetail = err?.response?.data?.detail || err?.response?.data?.message
  return String(apiDetail || err?.message || 'WhatsApp notification failed').slice(0, 1000)
}

const postToWhatsAppService = async (path, payload) => {
  const config = getConfig()
  if (!config) throw new Error('WHATSAPP_SERVICE_BASE_URL or WHATSAPP_INTERNAL_API_KEY is missing')
  if (!payload.customerPhone) throw new Error('Customer phone is not a valid Indian WhatsApp number')

  const { data } = await axios.post(`${config.baseURL}${path}`, payload, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: REQUEST_TIMEOUT_MS,
  })
  return data
}

const enqueue = async (order, type) => {
  if (!order?._id) return { skipped: true, reason: 'missing_order' }
  const trackingNumber = String(order.trackingNumber || '').trim()
  if (type === 'tracking_update' && !trackingNumber) {
    return { skipped: true, reason: 'missing_tracking_number' }
  }

  const alreadySent = type === 'order_confirmation'
    ? order.notification?.whatsappOrderConfirmationSentAt
    : order.notification?.whatsappTrackingUpdateSentAt
      && order.notification?.whatsappTrackingNumber === trackingNumber
  if (alreadySent) return { skipped: true, reason: 'already_sent' }

  const suffix = type === 'tracking_update' ? `:${trackingNumber}` : ''
  const deduplicationKey = `${type}:${order._id}${suffix}`
  const job = await WhatsAppNotification.findOneAndUpdate(
    { deduplicationKey },
    {
      $setOnInsert: {
        order: order._id,
        type,
        deduplicationKey,
        status: 'pending',
        nextAttemptAt: new Date(),
      },
    },
    { upsert: true, new: true },
  )

  void processWhatsAppQueue()
  return { queued: true, jobId: job._id }
}

export const sendWhatsAppOrderConfirmation = (order) => enqueue(order, 'order_confirmation')
export const sendWhatsAppTrackingUpdate = (order) => enqueue(order, 'tracking_update')

const claimNextJob = () => {
  const now = new Date()
  return WhatsAppNotification.findOneAndUpdate(
    {
      status: { $in: ['pending', 'processing'] },
      nextAttemptAt: { $lte: now },
      $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
    },
    {
      $set: { status: 'processing', lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) },
      $inc: { attempts: 1 },
    },
    { new: true, sort: { nextAttemptAt: 1, createdAt: 1 } },
  )
}

const markOrderSent = async (order, job) => {
  const notification = { ...(order.notification?.toObject?.() || order.notification || {}), whatsappLastError: '' }
  if (job.type === 'order_confirmation') notification.whatsappOrderConfirmationSentAt = new Date()
  else {
    notification.whatsappTrackingUpdateSentAt = new Date()
    notification.whatsappTrackingNumber = String(order.trackingNumber || '').trim()
  }
  order.notification = notification
  await order.save()
}

const processJob = async (job) => {
  try {
    const order = await Order.findById(job.order)
    if (!order) throw new Error('Order no longer exists')

    const payload = buildPayload(order)
    const path = job.type === 'order_confirmation'
      ? '/internal/order-confirmation'
      : '/internal/tracking-update'
    await postToWhatsAppService(path, payload)
    await markOrderSent(order, job)
    await WhatsAppNotification.updateOne(
      { _id: job._id },
      { $set: { status: 'sent', sentAt: new Date(), lockedUntil: null, lastError: '' } },
    )
  } catch (err) {
    const terminal = job.attempts >= MAX_ATTEMPTS
    const delay = Math.min(60 * 60 * 1000, 5000 * (2 ** Math.max(0, job.attempts - 1)))
    const message = errorMessage(err)
    await WhatsAppNotification.updateOne(
      { _id: job._id },
      {
        $set: {
          status: terminal ? 'failed' : 'pending',
          nextAttemptAt: new Date(Date.now() + delay),
          lockedUntil: null,
          lastError: message,
        },
      },
    )
    await Order.updateOne(
      { _id: job.order },
      { $set: { 'notification.whatsappLastError': message } },
    )
    console.error(`WhatsApp ${job.type} attempt ${job.attempts} failed:`, message)
  }
}

export const processWhatsAppQueue = async () => {
  if (workerRunning) return
  workerRunning = true
  try {
    for (let count = 0; count < 20; count += 1) {
      const job = await claimNextJob()
      if (!job) break
      await processJob(job)
    }
  } catch (err) {
    console.error('WhatsApp queue worker failed:', errorMessage(err))
  } finally {
    workerRunning = false
  }
}

export const startWhatsAppNotificationWorker = () => {
  if (workerTimer) return
  void processWhatsAppQueue()
  workerTimer = setInterval(() => void processWhatsAppQueue(), POLL_INTERVAL_MS)
  workerTimer.unref?.()
  console.log('WhatsApp notification worker started')
}
