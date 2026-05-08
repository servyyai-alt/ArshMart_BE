import axios from 'axios'

const SHIPROCKET_BASE = 'https://apiv2.shiprocket.in/v1/external'

let tokenCache = { token: null, expiresAt: 0 }

const getToken = async () => {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token
  }

  const res = await axios.post(`${SHIPROCKET_BASE}/auth/login`, {
    email: process.env.SHIPROCKET_EMAIL,
    password: process.env.SHIPROCKET_PASSWORD,
  })

  tokenCache.token = res.data.token
  tokenCache.expiresAt = Date.now() + 9 * 24 * 60 * 60 * 1000 // 9 days
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

  const payload = {
    order_id: order._id.toString(),
    order_date: new Date(order.createdAt).toISOString().split('T')[0],
    pickup_location: 'Primary',
    billing_customer_name: addr.fullName,
    billing_last_name: '',
    billing_address: addr.addressLine1,
    billing_address_2: addr.addressLine2 || '',
    billing_city: addr.city,
    billing_pincode: addr.pincode,
    billing_state: addr.state,
    billing_country: 'India',
    billing_email: '',
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

  const res = await client.post('/orders/create/adhoc', payload)
  return res.data
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
