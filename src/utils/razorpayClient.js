import Razorpay from 'razorpay'
import Settings from '../models/Settings.js'

let razorpayCache = { keyId: null, keySecret: null, client: null, expiresAt: 0 }

export const getRazorpayKeys = async () => {
  if (razorpayCache.client && Date.now() < razorpayCache.expiresAt) {
    return { keyId: razorpayCache.keyId, keySecret: razorpayCache.keySecret, client: razorpayCache.client }
  }

  const envKeyId = process.env.RAZORPAY_KEY_ID?.trim()
  const envKeySecret = process.env.RAZORPAY_KEY_SECRET?.trim()

  let keyId = envKeyId
  let keySecret = envKeySecret

  // Fallback to database settings only if environment variables are not configured
  if (!keyId || !keySecret) {
    const doc = await Settings.findOne({ singleton: 'global' }).select('integrations.razorpay').lean()
    keyId = keyId || doc?.integrations?.razorpay?.keyId?.trim()
    keySecret = keySecret || doc?.integrations?.razorpay?.keySecret?.trim()
  }

  if (!keyId || !keySecret) {
    return { keyId: keyId || null, keySecret: keySecret || null, client: null }
  }

  const client = new Razorpay({ key_id: keyId, key_secret: keySecret })
  razorpayCache = {
    keyId,
    keySecret,
    client,
    expiresAt: Date.now() + 60 * 1000, // 60s cache to reduce DB hits
  }

  return { keyId, keySecret, client }
}
