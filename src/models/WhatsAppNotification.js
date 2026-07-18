import mongoose from 'mongoose'

const whatsAppNotificationSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['order_confirmation', 'tracking_update'],
    required: true,
  },
  deduplicationKey: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ['pending', 'processing', 'sent', 'failed'],
    default: 'pending',
    index: true,
  },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now, index: true },
  lockedUntil: { type: Date, default: null },
  lastError: { type: String, default: '' },
  sentAt: Date,
}, { timestamps: true })

whatsAppNotificationSchema.index({ status: 1, nextAttemptAt: 1, lockedUntil: 1 })

const WhatsAppNotification = mongoose.model('WhatsAppNotification', whatsAppNotificationSchema)
export default WhatsAppNotification
