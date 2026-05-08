import jwt from 'jsonwebtoken'
import asyncHandler from 'express-async-handler'
import User from '../models/User.js'

export const protect = asyncHandler(async (req, res, next) => {
  let token

  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1]
  }

  if (!token) {
    res.status(401)
    throw new Error('Not authenticated. Please log in.')
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.id).select('-password')

    if (!user) {
      res.status(401)
      throw new Error('User not found')
    }

    if (user.isBlocked) {
      res.status(403)
      throw new Error('Your account has been blocked')
    }

    req.user = user
    next()
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      res.status(401)
      throw new Error('Invalid token')
    }
    if (err.name === 'TokenExpiredError') {
      res.status(401)
      throw new Error('Token expired. Please log in again.')
    }
    throw err
  }
})

export const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    res.status(403)
    throw new Error('Admin access required')
  }
  next()
}
