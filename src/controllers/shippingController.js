import asyncHandler from 'express-async-handler'
import Order from '../models/Order.js'
import { syncShiprocketOrder, trackOrder, getServiceability, testShiprocketAuth } from '../utils/shiprocketAPI.js'
import { sendWhatsAppTrackingUpdate } from '../utils/whatsappNotifier.js'

// @desc    Create Shiprocket order
// @route   POST /api/shipping/create/:orderId
export const createShipping = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId)
  if (!order) {
    res.status(404)
    throw new Error('Order not found')
  }

  const srData = await syncShiprocketOrder(order)

  if (order.trackingNumber) {
    try {
      await sendWhatsAppTrackingUpdate(order)
    } catch (err) {
      console.error('WhatsApp tracking notification failed after shipping creation:', err.message)
    }
  }

  res.json({ success: true, data: srData })
})

// @desc    Track shipment
// @route   GET /api/shipping/track/:awb
export const trackShipment = asyncHandler(async (req, res) => {
  const data = await trackOrder(req.params.awb)
  res.json({ success: true, data })
})

// @desc    Check serviceability
// @route   POST /api/shipping/serviceability
export const checkServiceability = asyncHandler(async (req, res) => {
  const data = await getServiceability(req.body)
  res.json({ success: true, data })
})

// @desc    Test Shiprocket auth/config
// @route   GET /api/shipping/test-auth
export const testAuth = asyncHandler(async (req, res) => {
  const data = await testShiprocketAuth()
  res.json({ success: true, data })
})
