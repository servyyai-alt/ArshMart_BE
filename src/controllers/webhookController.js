import crypto from 'crypto'
import asyncHandler from 'express-async-handler'
import ReturnRequest from '../models/ReturnRequest.js'
import Order from '../models/Order.js'
import { sendRefundStatusEmails } from '../utils/returnEmail.js'
import { sendWhatsAppTrackingUpdate } from '../utils/whatsappNotifier.js'

const verifyRazorpayWebhook = ({ rawBody, signature }) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || ''
  if (!secret) {
    const e = new Error('Razorpay webhook secret not configured')
    e.statusCode = 500
    throw e
  }
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  return expected === signature
}

// @desc    Razorpay webhooks (refund status updates)
// @route   POST /api/webhooks/razorpay
export const razorpayWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers['x-razorpay-signature']
  const raw = req.body // Buffer (express.raw)
  const rawBody = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw || '')

  if (!verifyRazorpayWebhook({ rawBody, signature: sig })) {
    res.status(400)
    throw new Error('Invalid webhook signature')
  }

  const payload = JSON.parse(rawBody || '{}')
  const refundEntity = payload?.payload?.refund?.entity
  const refundId = refundEntity?.id
  const refundStatus = refundEntity?.status // created | processed | failed
  const refundAmount = refundEntity?.amount

  if (!refundId) {
    return res.json({ success: true })
  }

  const rr = await ReturnRequest.findOne({ 'refund.refundId': refundId }).populate('order').populate('user', 'name email phone')
  if (!rr) {
    return res.json({ success: true })
  }

  const mapped = refundStatus === 'processed' ? 'processed' : refundStatus === 'failed' ? 'failed' : 'pending'
  rr.refund = {
    ...(rr.refund || {}),
    status: mapped,
    amount: rr.refund?.amount ?? refundAmount,
    error: refundStatus === 'failed' ? (refundEntity?.error_description || 'Refund failed') : rr.refund?.error,
  }
  rr.status = mapped === 'processed' ? 'refund_processed' : mapped === 'failed' ? 'refund_failed' : 'refund_pending'
  rr.audit.push({ action: 'razorpay_webhook', meta: { refundId, refundStatus } })
  await rr.save()

  const orderId = rr.order?._id || rr.order
  const order = await Order.findById(orderId)
  if (order) {
    order.refund = {
      ...(order.refund || {}),
      refundId,
      refundStatus: mapped,
      refundAmount: rr.refund?.amount,
      refundProcessedAt: mapped === 'processed' ? new Date() : order.refund?.refundProcessedAt,
    }
    order.orderStatus = mapped === 'processed' ? 'refund_processed' : mapped === 'failed' ? 'refund_failed' : 'refund_pending'
    await order.save()
  }

  // Notify best-effort
  try {
    await sendRefundStatusEmails({ returnRequest: rr, order: rr.order, user: rr.user })
  } catch (err) {
    console.error('Refund email send failed:', err.message)
  }

  res.json({ success: true })
})

// @desc    Shiprocket webhooks (AWB & tracking status updates)
// @route   POST /api/webhooks/shiprocket
export const shiprocketWebhook = asyncHandler(async (req, res) => {
  // Shiprocket webhook sends payload as JSON body
  const payload = req.body

  // 1. Signature validation
  // Webhook settings in Shiprocket allow adding custom headers (e.g., x-api-key).
  const secret = process.env.SHIPROCKET_WEBHOOK_SECRET
  if (secret) {
    const headerToken = req.headers['x-api-key'] || req.headers['x-shiprocket-signature']
    if (headerToken !== secret) {
      console.warn('Invalid Shiprocket webhook token')
      return res.status(401).json({ success: false, message: 'Invalid signature' })
    }
  }

  const {
    order_id,
    shipment_id,
    awb,
    courier_name,
    current_status,
    shipment_status,
  } = payload || {}

  if (!shipment_id && !order_id) {
    return res.status(400).json({ success: false, message: 'Missing identifiers' })
  }

  // 2. Identify the order
  const order = await Order.findOne({
    $or: [
      { shiprocketShipmentId: String(shipment_id) },
      { shiprocketOrderId: String(order_id) },
    ],
  })

  if (!order) {
    // If it's a return order, we can also check ReturnRequest, but the requirement specifically asks for Order sync.
    // We safely return 200 so Shiprocket stops retrying.
    return res.status(200).json({ success: true, message: 'Order not found' })
  }

  let updated = false
  const isFirstTimeAwb = !order.trackingNumber && Boolean(awb)

  // 3. Save trackingNumber and courierName
  if (awb && !order.trackingNumber) {
    order.trackingNumber = String(awb).trim()
    updated = true
  }

  if (courier_name && order.courierName !== String(courier_name).trim()) {
    order.courierName = String(courier_name).trim()
    updated = true
  }

  // 4. Save shipment status and maintain history
  const statusString = String(current_status || shipment_status || '').trim()
  if (statusString) {
    // Check if we already logged this status recently to avoid spam
    const lastHistory = order.statusHistory[order.statusHistory.length - 1]
    if (lastHistory?.status !== statusString) {
      order.statusHistory.push({
        status: statusString,
        message: `Shiprocket update: ${statusString}`,
        timestamp: new Date(),
      })
      updated = true
    }

    // Update main orderStatus if appropriate
    const statusLower = statusString.toLowerCase()
    if (statusLower.includes('delivered')) {
      if (order.orderStatus !== 'delivered') {
        order.orderStatus = 'delivered'
        updated = true
      }
    } else if (
      statusLower.includes('shipped') ||
      statusLower.includes('in transit') ||
      statusLower.includes('out for delivery') ||
      statusLower.includes('picked up')
    ) {
      if (!['shipped', 'delivered', 'cancelled', 'returned'].includes(order.orderStatus)) {
        order.orderStatus = 'shipped'
        updated = true
      }
    }
  }

  if (updated) {
    await order.save()
    console.log(`Synchronized Shiprocket webhook for order ${order._id}`)
  }

  // 5. Trigger WhatsApp tracking update ONLY ONCE (when AWB is first assigned)
  if (isFirstTimeAwb && order.trackingNumber) {
    try {
      await sendWhatsAppTrackingUpdate(order)
    } catch (err) {
      console.error('WhatsApp tracking webhook trigger failed:', err.message)
    }
  }

  res.status(200).json({ success: true })
})

