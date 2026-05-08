import mongoose from 'mongoose'

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

const uniqueSlug = (name, suffix) => {
  const base = slugify(name)
  const extra = suffix ?? Date.now()
  return base ? `${base}-${extra}` : String(extra)
}

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
}, { timestamps: true })

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Name cannot exceed 200 characters'],
  },
  slug: { type: String, unique: true },
  description: { type: String, required: [true, 'Description is required'] },
  price: { type: Number, required: [true, 'Price is required'], min: 0 },
  originalPrice: { type: Number, min: 0 },
  category: { type: String, required: [true, 'Category is required'] },
  brand: { type: String, trim: true },
  stock: { type: Number, required: true, min: 0, default: 0 },
  images: [{
    url: { type: String, required: true },
    public_id: String,
  }],
  videos: [{
    url: String,
    public_id: String,
  }],
  specifications: [{
    key: String,
    value: String,
  }],
  ratings: { type: Number, default: 0 },
  numReviews: { type: Number, default: 0 },
  reviews: [reviewSchema],
  isFeatured: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  weight: { type: Number }, // in grams
  dimensions: {
    length: Number,
    breadth: Number,
    height: Number,
  },
  sku: { type: String, unique: true, sparse: true },
  tags: [String],
}, { timestamps: true })

// Auto-generate slug
productSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = uniqueSlug(this.name)
  }
  next()
})

productSchema.pre('insertMany', function (next, docs) {
  const now = Date.now()
  for (let i = 0; i < (docs || []).length; i++) {
    const doc = docs[i]
    if (!doc.slug && doc.name) {
      doc.slug = uniqueSlug(doc.name, `${now}-${i}`)
    }
  }
  next()
})

// Calculate average rating
productSchema.methods.calcAverageRating = function () {
  if (this.reviews.length === 0) {
    this.ratings = 0
    this.numReviews = 0
  } else {
    this.ratings = this.reviews.reduce((sum, r) => sum + r.rating, 0) / this.reviews.length
    this.numReviews = this.reviews.length
  }
}

productSchema.index({ name: 'text', description: 'text', tags: 'text' })
productSchema.index({ category: 1 })
productSchema.index({ price: 1 })
productSchema.index({ ratings: -1 })
productSchema.index({ isFeatured: 1 })

const Product = mongoose.model('Product', productSchema)
export default Product
