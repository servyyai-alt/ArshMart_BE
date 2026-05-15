import mongoose from 'mongoose'

const settingsSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'global', unique: true, index: true },

    general: {
      siteName: { type: String, trim: true, default: 'Sandhaikart' },
      siteDescription: { type: String, trim: true, default: '' },
      freeShippingThreshold: { type: Number, default: 0, min: 0 },
    },

    seo: {
      metaTitle: { type: String, trim: true, default: '' },
      metaDescription: { type: String, trim: true, default: '' },
    },

    theme: {
      primaryColor: { type: String, trim: true, default: '#f97316' },
    },

    marketing: {
      marqueeTexts: { type: [String], default: [] }, // scrolling announcements on homepage
      couponCode: { type: String, trim: true, default: '' },
    },

    integrations: {
      razorpay: {
        keyId: { type: String, trim: true, default: '' },
        keySecret: { type: String, trim: true, default: '' },
      },
      shiprocket: {
        email: { type: String, trim: true, lowercase: true, default: '' },
        password: { type: String, default: '' },
        pickupLocation: { type: String, trim: true, default: 'Primary' },
      },
      cloudinary: {
        cloudName: { type: String, trim: true, default: '' },
        apiKey: { type: String, trim: true, default: '' },
        apiSecret: { type: String, trim: true, default: '' },
      },
    },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

const Settings = mongoose.model('Settings', settingsSchema)

export default Settings
