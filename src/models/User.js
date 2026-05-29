import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false,
  },
  phone: { type: String, trim: true },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  avatar: {
    url: String,
    public_id: String,
  },
  isBlocked: { type: Boolean, default: false },
  addresses: [{
    fullName: String,
    phone: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' },
    isDefault: { type: Boolean, default: false },
  }],
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  usedCoupons: { type: [String], default: [] },
}, { timestamps: true })

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

// Compare passwords
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password)
}

// Generate JWT
userSchema.methods.getJWT = function () {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  )
}

const User = mongoose.model('User', userSchema)
export default User
