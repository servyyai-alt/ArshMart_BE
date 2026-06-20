import mongoose from 'mongoose'

const checkoutListItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  image: String,
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
}, { _id: false })

const abandonedCheckoutListSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  productsViewed: [checkoutListItemSchema],
  amount: { type: Number, required: true },
  abandonedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  promotionEligible: {
    type: Boolean,
    default: true,
    index: true,
  },
}, { timestamps: true })

const AbandonedCheckoutList = mongoose.model('AbandonedCheckoutList', abandonedCheckoutListSchema)
export default AbandonedCheckoutList
