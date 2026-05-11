import mongoose from 'mongoose'

const galleryImageSchema = new mongoose.Schema(
  {
    public_id: { type: String, required: true, unique: true, index: true },
    url: { type: String, required: true },
    caption: { type: String, default: '' },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0, index: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

const GalleryImage = mongoose.model('GalleryImage', galleryImageSchema)

export default GalleryImage

