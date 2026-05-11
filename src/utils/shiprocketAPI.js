import axios from 'axios'
import Settings from '../models/Settings.js'
import User from '../models/User.js'

const SHIPROCKET_BASE = 'https://apiv2.shiprocket.in/v1/external'

let tokenCache = { token: null, expiresAt: 0, cacheKey: null }

const getShiprocketConfig = async () => {
  const doc = await Settings.findOne({ singleton: 'global' })
    .select('integrations.shiprocket')
    .lean()

  const email = doc?.integrations?.shiprocket?.email || process.env.SHIPROCKET_EMAIL || ''
  const password = doc?.integrations?.shiprocket?.password || process.env.SHIPROCKET_PASSWORD || ''
  const pickupLocation = doc?.integrations?.shiprocket?.pickupLocation || process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary'

  return { email, password, pickupLocation }
}

const getToken = async () => {
  const { email, password } = await getShiprocketConfig()
  const cacheKey = `${email}::${password ? 'set' : 'unset'}`

  if (!email || !password) {
    const err = new Error('Shiprocket credentials not configured')
    err.statusCode = 500
    throw err
  }

  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    if (tokenCache.cacheKey === cacheKey) return tokenCache.token
  }

  const res = await axios.post(`${SHIPROCKET_BASE}/auth/login`, { email, password })

  tokenCache.token = res.data.token
  tokenCache.expiresAt = Date.now() + 9 * 24 * 60 * 60 * 1000 // 9 days
  tokenCache.cacheKey = cacheKey
  return tokenCache.token
}

const shiprocketClient = async () => {
  const token = await getToken()
  return axios.create({
    baseURL: SHIPROCKET_BASE,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
}

export const createShiprocketOrder = async (order) => {
  const client = await shiprocketClient()
  const { shippingAddress: addr, orderItems } = order

  const { pickupLocation } = await getShiprocketConfig()

  let billingEmail = ''
  if (order.user?.email) billingEmail = order.user.email
  if (!billingEmail && order.user) {
    const userDoc = await User.findById(order.user).select('email').lean()
    billingEmail = userDoc?.email || ''
  }
  if (!billingEmail) billingEmail = process.env.ADMIN_EMAIL || 'support@sandhaikart.com'

  const payload = {
    order_id: order._id.toString(),
    order_date: new Date(order.createdAt).toISOString().split('T')[0],
    pickup_location: pickupLocation,
    billing_customer_name: addr.fullName,
    billing_last_name: '',
    billing_address: addr.addressLine1,
    billing_address_2: addr.addressLine2 || '',
    billing_city: addr.city,
    billing_pincode: addr.pincode,
    billing_state: addr.state,
    billing_country: 'India',
    billing_email: billingEmail,
    billing_phone: addr.phone,
    shipping_is_billing: true,
    order_items: orderItems.map(item => ({
      name: item.name,
      sku: item.product?.toString(),
      units: item.quantity,
      selling_price: item.price,
      discount: 0,
      tax: '',
    })),
    payment_method: order.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
    sub_total: order.itemsPrice,
    length: 10,
    breadth: 10,
    height: 10,
    weight: 0.5,
  }

  try {
    const res = await client.post('/orders/create/adhoc', payload)
    return res.data
  } catch (err) {
    const apiMessage = err.response?.data?.message || err.response?.data?.error || err.message
    const e = new Error(`Shiprocket create order failed: ${apiMessage}`)
    e.statusCode = err.response?.status || 500
    e.details = err.response?.data
    throw e
  }
}

export const trackOrder = async (awbCode) => {
  const client = await shiprocketClient()
  const res = await client.get(`/courier/track/awb/${awbCode}`)
  return res.data
}

export const getServiceability = async ({ pickupPincode, deliveryPincode, weight }) => {
  const client = await shiprocketClient()
  const res = await client.get('/courier/serviceability', {
    params: {
      pickup_postcode: pickupPincode,
      delivery_postcode: deliveryPincode,
      weight,
      cod: 0,
    },
  })
  return res.data
}

export const cancelShiprocketOrder = async (ids) => {
  const client = await shiprocketClient()
  const res = await client.post('/orders/cancel', { ids })
  return res.data
}

export const testShiprocketAuth = async () => {
  const { email, pickupLocation } = await getShiprocketConfig()
  const token = await getToken()
  return { email, pickupLocation, tokenPresent: Boolean(token) }
}
