const EMAIL_REGEX = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/
const PHONE_REGEX = /^[6-9]\d{9}$/
const PINCODE_REGEX = /^[1-9]\d{5}$/

export const normalizeEmail = (value = '') => String(value).trim().toLowerCase()

export const normalizePhone = (value = '') => {
  const digits = String(value).replace(/\D/g, '')

  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2)
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1)
  }

  return digits
}

export const isValidEmail = (value = '') => EMAIL_REGEX.test(normalizeEmail(value))

export const isValidPhone = (value = '') => PHONE_REGEX.test(normalizePhone(value))

export const isValidPincode = (value = '') => PINCODE_REGEX.test(String(value).trim())

export const detectIdentifierType = (value = '') => {
  const raw = String(value).trim()
  if (!raw) return null

  if (raw.includes('@')) {
    return { type: 'email', value: normalizeEmail(raw) }
  }

  return { type: 'phone', value: normalizePhone(raw) }
}

export const formatAddress = (address = {}) => ({
  _id: address._id?.toString?.() || address._id,
  fullName: address.fullName || '',
  phone: address.phone || '',
  addressLine1: address.addressLine1 || '',
  addressLine2: address.addressLine2 || '',
  city: address.city || '',
  state: address.state || '',
  pincode: address.pincode || '',
  country: address.country || 'India',
  isDefault: Boolean(address.isDefault),
})

export const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  avatar: user.avatar,
  addresses: Array.isArray(user.addresses) ? user.addresses.map(formatAddress) : [],
  wishlist: user.wishlist || [],
  createdAt: user.createdAt,
})

export const buildAddressPayload = (address = {}) => ({
  fullName: String(address.fullName || '').trim(),
  phone: normalizePhone(address.phone),
  addressLine1: String(address.addressLine1 || '').trim(),
  addressLine2: String(address.addressLine2 || '').trim(),
  city: String(address.city || '').trim(),
  state: String(address.state || '').trim(),
  pincode: String(address.pincode || '').trim(),
  country: String(address.country || 'India').trim() || 'India',
  isDefault: Boolean(address.isDefault),
})
