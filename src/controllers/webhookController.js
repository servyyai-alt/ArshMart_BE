import crypto from 'crypto'
import asyncHandler from 'express-async-handler'
import ReturnRequest from '../models/ReturnRequest.js'
import Order from '../models/Order.js'
import { sendRefundStatusEmails } from '../utils/returnEmail.js'

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

