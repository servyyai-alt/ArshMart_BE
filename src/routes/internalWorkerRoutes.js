import crypto from 'crypto'
import express from 'express'
import { processWhatsAppQueue } from '../utils/whatsappNotifier.js'

const router = express.Router()

const secretsMatch = (received, expected) => {
  const receivedBuffer = Buffer.from(received)
  const expectedBuffer = Buffer.from(expected)
  return receivedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
}

router.post('/whatsapp/process-queue', async (req, res, next) => {
  try {
    const expected = String(process.env.WHATSAPP_QUEUE_CRON_SECRET || '').trim()
    const authorization = String(req.get('authorization') || '')
    const received = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : ''

    if (!expected || !received || !secretsMatch(received, expected)) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const stats = await processWhatsAppQueue({ maxJobs: 1 })
    return res.json({ success: true, ...stats })
  } catch (err) {
    return next(err)
  }
})

export default router
