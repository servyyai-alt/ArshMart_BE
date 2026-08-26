import mongoose from 'mongoose'

const settingsSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'global', unique: true, index: true },

    general: {
      siteName: { type: String, trim: true, default: 'Arsh Mart' },
      siteDescription: { type: String, trim: true, default: '' },
      freeShippingThreshold: { type: Number, default: 499, min: 0 },
      shippingCharge: { type: Number, default: 49, min: 0 },
      freeShippingEnabled: { type: Boolean, default: true },
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

    homepage: {
      heroVideo: {
        url: { type: String, trim: true, default: '' },
        publicId: { type: String, trim: true, default: '' },
      },
      heroImage: {
        url: { type: String, trim: true, default: '' },
        publicId: { type: String, trim: true, default: '' },
      },
      heroImages: {
        type: [
          {
            url: { type: String, trim: true, default: '' },
            publicId: { type: String, trim: true, default: '' },
          },
        ],
        default: [],
      },
      heroCards: {
        type: [
          {
            kind: { type: String, enum: ['image', 'video'], default: 'image' },
            url: { type: String, trim: true, default: '' },
            publicId: { type: String, trim: true, default: '' },
            title: { type: String, trim: true, default: '' },
          },
        ],
        default: [],
      },
      latestArrivals: {
        title: { type: String, trim: true, default: 'Latest Arrivals' },
        description: { type: String, trim: true, default: 'Explore our newest collection' },
      },
      latestArrivalBanners: {
        type: [
          {
            title: { type: String, trim: true, default: '' },
            description: { type: String, trim: true, default: '' },
            image: {
              url: { type: String, trim: true, default: '' },
              publicId: { type: String, trim: true, default: '' },
            },
            to: { type: String, trim: true, default: '/products' },
          },
        ],
        default: [],
      },
      offerBanner: {
        badge: { type: String, trim: true, default: 'Deal of the day' },
        title: { type: String, trim: true, default: 'Up to 50% off' },
        subtitle: { type: String, trim: true, default: 'today only' },
        description: { type: String, trim: true, default: 'Handpicked favourites at unbeatable prices. Grab yours before the deal ends.' },
        price: { type: Number, min: 0, default: null },
        originalPrice: { type: Number, min: 0, default: null },
        ctaLabel: { type: String, trim: true, default: 'Grab the deal' },
        ctaLink: { type: String, trim: true, default: '/products?sort=discount' },
        image: {
          url: { type: String, trim: true, default: '' },
          publicId: { type: String, trim: true, default: '' },
        },
      },
    },

    integrations: {
      razorpay: {
        keyId: { type: String, trim: true, default: '' },
        keySecret: { type: String, trim: true, default: '' },
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
