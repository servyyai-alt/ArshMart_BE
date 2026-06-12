import axios from 'axios'

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

  if (!baseURL || !apiKey) {
    console.warn('WhatsApp notification skipped: WHATSAPP_SERVICE_BASE_URL or WHATSAPP_INTERNAL_API_KEY is missing')
    return null
  }

  return { baseURL, apiKey }
}

const buildPayload = (order) => {
  const orderId = order?._id?.toString()
  const customerPhone = normalizeIndianPhone(order?.shippingAddress?.phone)
  const frontendUrl = String(process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '')

  return {
    orderId,
    orderNumber: getOrderNumber(order),
    customerName: order?.shippingAddress?.fullName || '',
    customerPhone,
    totalAmount: Number(order?.totalPrice || 0),
    paymentStatus: getPaymentStatus(order),
    trackingNumber: order?.trackingNumber || '',
    courierName: order?.courierName || '',
    orderUrl: frontendUrl && orderId ? `${frontendUrl}/orders/${orderId}` : '',
  }
}

const saveNotificationError = async (order, err) => {
  if (!order?.save) return
  try {
    order.notification = {
      ...(order.notification || {}),
      whatsappLastError: err?.response?.data?.message || err?.message || 'WhatsApp notification failed',
    }
    await order.save()
  } catch (saveErr) {
    console.error('Failed to save WhatsApp notification error:', saveErr.message)
  }
}

const postToWhatsAppService = async (path, payload) => {
  const config = getConfig()
  if (!config) return { skipped: true, reason: 'missing_config' }

  if (!payload.customerPhone) {
    console.warn(`WhatsApp notification skipped for order ${payload.orderId}: invalid customer phone`)
    return { skipped: true, reason: 'invalid_phone' }
  }

  const { data } = await axios.post(`${config.baseURL}${path}`, payload, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  })

  return data
}

export const sendWhatsAppOrderConfirmation = async (order) => {
  if (!order?._id) return { skipped: true, reason: 'missing_order' }
  if (order.notification?.whatsappOrderConfirmationSentAt) {
    return { skipped: true, reason: 'already_sent' }
  }

  const payload = buildPayload(order)
  if (!payload.orderId || !payload.orderNumber) return { skipped: true, reason: 'missing_order_id' }

  try {
    const result = await postToWhatsAppService('/internal/order-confirmation', payload)
    if (!result?.skipped && order.save) {
      order.notification = {
        ...(order.notification || {}),
        whatsappOrderConfirmationSentAt: new Date(),
        whatsappLastError: '',
      }
      await order.save()
    }
    return result
  } catch (err) {
    console.error('WhatsApp order confirmation failed:', err.response?.data || err.message)
    await saveNotificationError(order, err)
    throw err
  }
}

export const sendWhatsAppTrackingUpdate = async (order) => {
  if (!order?._id) return { skipped: true, reason: 'missing_order' }
  const trackingNumber = String(order.trackingNumber || '').trim()
  if (!trackingNumber) return { skipped: true, reason: 'missing_tracking_number' }
  if (
    order.notification?.whatsappTrackingUpdateSentAt
    && order.notification?.whatsappTrackingNumber === trackingNumber
  ) {
    return { skipped: true, reason: 'already_sent' }
  }

  const payload = buildPayload(order)
  if (!payload.orderId || !payload.orderNumber) return { skipped: true, reason: 'missing_order_id' }

  try {
    const result = await postToWhatsAppService('/internal/tracking-update', payload)
    if (!result?.skipped && order.save) {
      order.notification = {
        ...(order.notification || {}),
        whatsappTrackingUpdateSentAt: new Date(),
        whatsappTrackingNumber: trackingNumber,
        whatsappLastError: '',
      }
      await order.save()
    }
    return result
  } catch (err) {
    console.error('WhatsApp tracking update failed:', err.response?.data || err.message)
    await saveNotificationError(order, err)
    throw err
  }
}
