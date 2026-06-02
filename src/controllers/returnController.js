import asyncHandler from 'express-async-handler'
import ReturnRequest from '../models/ReturnRequest.js'
import Order from '../models/Order.js'
import User from '../models/User.js'
import { getReturnServiceability, createShiprocketReturnOrder, trackOrder } from '../utils/shiprocketAPI.js'
import { getRazorpayKeys } from '../utils/razorpayClient.js'
import { sendReturnStatusEmails, sendRefundStatusEmails } from '../utils/returnEmail.js'

const RETURN_WINDOW_DAYS = Number(process.env.RETURN_WINDOW_DAYS || 7)

const calcExpiry = (deliveredAt, days) => {
  const d = new Date(deliveredAt)
  d.setDate(d.getDate() + Number(days || 0))
  return d
}

const ensureReturnEligibility = ({ order }) => {
  if (!order) {
    const e = new Error('Order not found')
    e.statusCode = 404
    throw e
  }
  if (order.orderStatus !== 'delivered' || !order.deliveredAt) {
    const e = new Error('Only delivered orders are eligible for return')
    e.statusCode = 400
    throw e
  }

  const expiresAt = calcExpiry(order.deliveredAt, RETURN_WINDOW_DAYS)
  if (Date.now() > expiresAt.getTime()) {
    const e = new Error('Return window expired')
    e.statusCode = 400
    throw e
  }

  if (order.return?.hasReturnRequest) {
    const e = new Error('Return already requested for this order')
    e.statusCode = 400
    throw e
  }

  return { expiresAt }
}

const buildReturnItems = ({ order, requestedItems }) => {
  const orderItems = order.orderItems || []
  const byProductId = new Map(orderItems.map((it) => [String(it.product), it]))

  const items = (requestedItems || []).map((it) => {
    const orderItem = byProductId.get(String(it.productId))
    if (!orderItem) {
      const e = new Error('Invalid product in return items')
      e.statusCode = 400
      throw e
    }
    const qty = Number(it.quantity || 0)
    if (!Number.isFinite(qty) || qty < 1 || qty > Number(orderItem.quantity || 0)) {
      const e = new Error('Invalid return quantity')
      e.statusCode = 400
      throw e
    }
    return {
      product: orderItem.product,
      name: orderItem.name,
      price: Number(orderItem.price || 0),
      quantity: qty,
      reasonCode: String(it.reasonCode || ''),
      reasonText: String(it.reasonText || ''),
      condition: String(it.condition || ''),
    }
  })

  if (!items.length) {
    const e = new Error('Return items are required')
    e.statusCode = 400
    throw e
  }
  return items
}

// ─── Customer APIs ─────────────────────────────────────────

// @desc    Create return request
// @route   POST /api/returns
export const createReturnRequest = asyncHandler(async (req, res) => {
  const { orderId, items, reason, notes } = req.body || {}

  const order = await Order.findById(orderId).populate('user', 'name email phone')
  // ownership check
  if (!order || String(order.user?._id || order.user) !== String(req.user._id)) {
    res.status(404)
    throw new Error('Order not found')
  }

  const { expiresAt } = ensureReturnEligibility({ order })
  const returnItems = buildReturnItems({ order, requestedItems: items })

  const pickupAddressSnapshot = { ...(order.shippingAddress?.toObject?.() || order.shippingAddress || {}) }

  const rr = await ReturnRequest.create({
    user: req.user._id,
    order: order._id,
    items: returnItems,
    reason: String(reason || '').trim(),
    notes: String(notes || '').trim(),
    status: 'requested',
    eligibility: {
      isEligible: true,
      returnWindowDays: RETURN_WINDOW_DAYS,
      deliveredAt: order.deliveredAt,
      expiresAt,
    },
    pickupAddressSnapshot,
    audit: [{ by: req.user._id, action: 'requested', meta: { reason: String(reason || '') } }],
  })

  // Shiprocket: serviceability + create return (best-effort but will fail request if not serviceable)
  if (!process.env.RETURN_WAREHOUSE_PINCODE) {
    res.status(500)
    throw new Error('Return warehouse pincode not configured (RETURN_WAREHOUSE_PINCODE)')
  }
  const serviceability = await getReturnServiceability({
    pickupPincode: order.shippingAddress?.pincode,
    deliveryPincode: process.env.RETURN_WAREHOUSE_PINCODE,
    weight: 0.5,
  })

  rr.shiprocket = { ...(rr.shiprocket || {}), serviceability }

  // Create return order
  let sr = null
  try {
    sr = await createShiprocketReturnOrder({ order, returnRequest: rr, items: returnItems })
  } catch (err) {
    // Surface Shiprocket details to speed up configuration fixes.
    const details = err.details ? ` Details: ${JSON.stringify(err.details)}` : ''
    res.status(err.statusCode || 500)
    throw new Error(`${err.message}${details}`)
  }
  const returnOrderId = sr?.order_id || sr?.return_order_id || sr?.orderId || sr?.data?.order_id
  const shipmentId = sr?.shipment_id || sr?.data?.shipment_id
  const awb = sr?.awb_code || sr?.awb || sr?.data?.awb_code
  const courierName = sr?.courier_name || sr?.courier || sr?.data?.courier_name

  rr.shiprocket = {
    ...(rr.shiprocket || {}),
    createResponse: sr,
    returnOrderId,
    shipmentId,
    awb,
    courierName,
    pickupScheduledAt: new Date(),
  }

  if (returnOrderId || shipmentId || awb) {
    rr.status = 'pickup_scheduled'
    rr.audit.push({ by: req.user._id, action: 'pickup_scheduled', meta: { returnOrderId, shipmentId, awb } })
  } else {
    rr.audit.push({ by: req.user._id, action: 'shiprocket_return_created', meta: { note: 'No identifiers returned', sr } })
  }
  await rr.save()

  // Update order summary
  order.return = {
    hasReturnRequest: true,
    returnRequestId: rr._id,
    returnStatus: rr.status,
    returnInitiatedAt: rr.createdAt,
  }
  order.orderStatus = 'return_requested'
  await order.save()

  // Notifications best-effort
  try {
    const user = order.user?._id ? order.user : await User.findById(order.user).select('name email phone').lean()
    await sendReturnStatusEmails({ returnRequest: rr, order, user })
  } catch (err) {
    console.error('Return email send failed:', err.message)
  }

  res.status(201).json({ success: true, returnRequest: rr })
})

// @desc    Get my return requests
// @route   GET /api/returns/my
export const getMyReturns = asyncHandler(async (req, res) => {
  const returns = await ReturnRequest.find({ user: req.user._id }).sort('-createdAt')
  res.json({ success: true, returns })
})

// @desc    Get return request by ID
// @route   GET /api/returns/:id
export const getReturnById = asyncHandler(async (req, res) => {
  const rr = await ReturnRequest.findById(req.params.id).populate('order').populate('user', 'name email')
  if (!rr) {
    res.status(404)
    throw new Error('Return request not found')
  }
  const isOwner = String(rr.user?._id || rr.user) === String(req.user._id)
  if (!isOwner && req.user.role !== 'admin') {
    res.status(403)
    throw new Error('Not authorized')
  }
  res.json({ success: true, returnRequest: rr })
})

// @desc    Track return AWB
// @route   GET /api/returns/:id/track
export const trackMyReturn = asyncHandler(async (req, res) => {
  const rr = await ReturnRequest.findById(req.params.id).populate('order')
  if (!rr) {
    res.status(404)
    throw new Error('Return request not found')
  }
  const isOwner = String(rr.user) === String(req.user._id)
  if (!isOwner && req.user.role !== 'admin') {
    res.status(403)
    throw new Error('Not authorized')
  }
  if (!rr.shiprocket?.awb) {
    res.status(400)
    throw new Error('AWB not available yet')
  }
  const tracking = await trackOrder(rr.shiprocket.awb)
  res.json({ success: true, tracking })
})

// ─── Admin APIs ────────────────────────────────────────────

// @desc    List return requests
// @route   GET /api/admin/returns
export const adminListReturns = asyncHandler(async (req, res) => {
  const { page = 1, limit = 15, status, search } = req.query
  const query = {}
  if (status) query.status = status
  if (search) query.$or = [
    { reason: { $regex: search, $options: 'i' } },
  ]

  const skip = (Number(page) - 1) * Number(limit)
  const [returns, total] = await Promise.all([
    ReturnRequest.find(query).populate('user', 'name email').populate('order').sort('-createdAt').skip(skip).limit(Number(limit)),
    ReturnRequest.countDocuments(query),
  ])
  res.json({ success: true, returns, total })
})

// @desc    Update return status
// @route   PUT /api/admin/returns/:id/status
export const adminUpdateReturnStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body || {}
  const rr = await ReturnRequest.findById(req.params.id).populate('order').populate('user', 'name email phone')
  if (!rr) { res.status(404); throw new Error('Return request not found') }

  rr.status = status
  rr.audit.push({ by: req.user._id, action: 'status_update', meta: { status, note } })
  await rr.save()

  const order = await Order.findById(rr.order?._id || rr.order)
  if (order) {
    order.return = {
      ...(order.return || {}),
      hasReturnRequest: true,
      returnRequestId: rr._id,
      returnStatus: rr.status,
    }
    if (status === 'picked_up' || status === 'received') order.orderStatus = 'returned'
    await order.save()
  }

  // Notify
  try {
    const user = rr.user
    await sendReturnStatusEmails({ returnRequest: rr, order: rr.order, user })
  } catch (err) {
    console.error('Return email send failed:', err.message)
  }

  res.json({ success: true, returnRequest: rr })
})

// @desc    Trigger refund for a return request (full/partial)
// @route   POST /api/admin/returns/:id/refund
export const adminRefundReturn = asyncHandler(async (req, res) => {
  const { amount, speed = 'optimum' } = req.body || {}
  const rr = await ReturnRequest.findById(req.params.id).populate('order').populate('user', 'name email phone')
  if (!rr) { res.status(404); throw new Error('Return request not found') }

  const order = await Order.findById(rr.order?._id || rr.order)
  if (!order) { res.status(404); throw new Error('Order not found') }

  const paymentId = order.paymentResult?.razorpayPaymentId
  if (!paymentId) {
    res.status(400)
    throw new Error('Razorpay payment id not found for this order')
  }

  const refundAmount = Math.round(Number(amount))
  if (!refundAmount || refundAmount < 1) {
    res.status(400)
    throw new Error('Valid refund amount (in paise) is required')
  }

  const { client } = await getRazorpayKeys()
  if (!client) {
    res.status(500)
    throw new Error('Razorpay keys not configured')
  }

  rr.status = 'refund_initiated'
  rr.audit.push({ by: req.user._id, action: 'refund_initiated', meta: { amount: refundAmount, speed } })
  await rr.save()

  const refund = await client.payments.refund(paymentId, { amount: refundAmount, speed })

  rr.refund = {
    ...(rr.refund || {}),
    paymentId,
    refundId: refund.id,
    amount: refund.amount,
    currency: refund.currency || 'INR',
    speed,
    status: refund.status === 'processed' ? 'processed' : 'pending',
  }
  rr.status = rr.refund.status === 'processed' ? 'refund_processed' : 'refund_pending'
  rr.audit.push({ by: req.user._id, action: 'refund_created', meta: { refundId: refund.id, status: refund.status } })
  await rr.save()

  order.refund = {
    refundId: refund.id,
    refundStatus: rr.refund.status,
    refundAmount: refund.amount,
    refundProcessedAt: rr.refund.status === 'processed' ? new Date() : undefined,
  }
  order.orderStatus = rr.refund.status === 'processed' ? 'refund_processed' : 'refund_pending'
  await order.save()

  // Notify
  try {
    await sendRefundStatusEmails({ returnRequest: rr, order, user: rr.user })
  } catch (err) {
    console.error('Refund email send failed:', err.message)
  }

  res.json({ success: true, returnRequest: rr, refund })
})
