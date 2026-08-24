import jwt from 'jsonwebtoken'
import asyncHandler from 'express-async-handler'
import User from '../models/User.js'
import { createHttpError } from '../utils/httpError.js'

export const protect = asyncHandler(async (req, res, next) => {
  let token

  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1]
  }

  if (!token) {
    throw createHttpError(401, 'Not authenticated. Please log in.')
  }

  if (!process.env.JWT_SECRET) {
    throw createHttpError(500, 'JWT secret not configured on the server')
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.id).select('-password')

    if (!user) {
      throw createHttpError(401, 'User not found')
    }

    if (user.isBlocked) {
      throw createHttpError(403, 'Your account has been blocked')
    }

    req.user = user
    next()
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      throw createHttpError(401, 'Invalid token')
    }
    if (err.name === 'TokenExpiredError') {
      throw createHttpError(401, 'Token expired. Please log in again.')
    }
    throw err
  }
})

export const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    throw createHttpError(403, 'Admin access required')
  }
  next()
}
