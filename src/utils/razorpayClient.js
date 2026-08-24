import Razorpay from 'razorpay'
import Settings from '../models/Settings.js'

let razorpayCache = { keyId: null, keySecret: null, client: null, expiresAt: 0 }

export const getRazorpayKeys = async () => {
  if (razorpayCache.client && Date.now() < razorpayCache.expiresAt) {
    return { keyId: razorpayCache.keyId, keySecret: razorpayCache.keySecret, client: razorpayCache.client }
  }

  const doc = await Settings.findOne({ singleton: 'global' }).select('integrations.razorpay').lean()
  const keyId = doc?.integrations?.razorpay?.keyId || process.env.RAZORPAY_KEY_ID
  const keySecret = doc?.integrations?.razorpay?.keySecret || process.env.RAZORPAY_KEY_SECRET

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
