import mongoose from 'mongoose'

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
  },
  slug: { type: String, unique: true },
  description: String,
  image: String,
  imagePublicId: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

categorySchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = slugify(this.name)
  }
  next()
})

categorySchema.pre('insertMany', function (next, docs) {
  for (const doc of docs || []) {
    if (!doc.slug && doc.name) {
      doc.slug = slugify(doc.name)
    }
  }
  next()
})

// Virtual for product count
categorySchema.virtual('productCount', {
  ref: 'Product',
  localField: 'name',
  foreignField: 'category',
  count: true,
})

categorySchema.set('toJSON', { virtuals: true })
categorySchema.set('toObject', { virtuals: true })

const Category = mongoose.model('Category', categorySchema)
export default Category
