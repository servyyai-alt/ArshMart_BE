import asyncHandler from 'express-async-handler'
import AbandonedCheckout from '../models/AbandonedCheckout.js'

// @desc    Create pending abandoned checkout record
// @route   POST /api/checkouts/abandoned
// @access  Private
export const createPendingCheckout = asyncHandler(async (req, res) => {
  const { name, phone, email, products, cartTotal, address } = req.body || {}

  if (!name || !phone || !email || !products || !cartTotal || !address) {
    res.status(400)
    throw new Error('All checkout details are required')
  }

  const checkout = await AbandonedCheckout.create({
    userId: req.user?._id || null,
    name,
    phone,
    email,
    products,
    cartTotal,
    address,
    status: 'pending',
    orderId: null,
    paymentMethod: null,
    checkoutStartedAt: new Date()
  })

  res.status(201).json({
    success: true,
    checkoutId: checkout._id
  })
})

// @desc    Link order to abandoned checkout
// @route   PUT /api/checkouts/abandoned/:id/link
// @access  Private
export const linkCheckoutOrder = asyncHandler(async (req, res) => {
  const { orderId, paymentMethod } = req.body || {}

  if (!orderId || !paymentMethod) {
    res.status(400)
    throw new Error('Order ID and payment method are required')
  }

  const checkout = await AbandonedCheckout.findById(req.params.id)
  if (!checkout) {
    res.status(404)
    throw new Error('Checkout record not found')
  }

  checkout.orderId = orderId
  checkout.paymentMethod = paymentMethod

  // COD checkouts are successfully placed instantly and require no payment verification wait
  if (paymentMethod === 'cod') {
    checkout.status = 'converted'
  }

  await checkout.save()

  res.json({
    success: true,
    message: 'Checkout linked to order successfully',
    checkout
  })
})
