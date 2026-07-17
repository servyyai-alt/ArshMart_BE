const DIMENSION_UNIT_OPTIONS = [
  { label: 'Millimetres (mm)', value: 'mm' },
  { label: 'Centimetres (cm)', value: 'cm' },
  { label: 'Metres (m)', value: 'm' },
  { label: 'Inches (in)', value: 'in' },
  { label: 'Feet (ft)', value: 'ft' },
]

const WEIGHT_UNIT_OPTIONS = [
  { label: 'Grams (g)', value: 'g' },
  { label: 'Kilograms (kg)', value: 'kg' },
]

const VALID_DIMENSION_UNITS = new Set(DIMENSION_UNIT_OPTIONS.map(option => option.value))
const VALID_WEIGHT_UNITS = new Set(WEIGHT_UNIT_OPTIONS.map(option => option.value))

const DIMENSION_TO_MM = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
}

const WEIGHT_TO_G = {
  g: 1,
  kg: 1000,
}

const NUMBER_FORMATTER = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
})

const toNumberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export const convertDimensionValue = (value, fromUnit, toUnit) => {
  const number = toNumberOrNull(value)
  if (number === null) return 0
  const from = DIMENSION_TO_MM[fromUnit] || DIMENSION_TO_MM.cm
  const to = DIMENSION_TO_MM[toUnit] || DIMENSION_TO_MM.cm
  return (number * from) / to
}

export const convertWeightValue = (value, fromUnit, toUnit) => {
  const number = toNumberOrNull(value)
  if (number === null) return 0
  const from = WEIGHT_TO_G[fromUnit] || WEIGHT_TO_G.kg
  const to = WEIGHT_TO_G[toUnit] || WEIGHT_TO_G.kg
  return (number * from) / to
}

export const normalizeProductDimensions = (product = {}) => {
  const source = product?.dimensions || {}
  const legacyWeight = toNumberOrNull(product?.weight)
  const length = toNumberOrNull(source.length)
  const width = toNumberOrNull(source.width ?? source.breadth)
  const height = toNumberOrNull(source.height)
  const weight = toNumberOrNull(source.weight ?? legacyWeight)

  const hasAny = [length, width, height, weight].some(value => value !== null)
  if (!hasAny) return null

  return {
    length,
    width,
    height,
    dimensionUnit: VALID_DIMENSION_UNITS.has(source.dimensionUnit) ? source.dimensionUnit : 'cm',
    weight,
    weightUnit: VALID_WEIGHT_UNITS.has(source.weightUnit)
      ? source.weightUnit
      : (source.weight != null ? 'kg' : legacyWeight != null ? 'g' : 'kg'),
  }
}

export const formatProductDimensionsSummary = (product = {}) => {
  const dimensions = normalizeProductDimensions(product)
  if (!dimensions) {
    return {
      hasDimensions: false,
      hasWeight: false,
      dimensionsText: 'Dimensions Not Available',
      weightText: 'Weight Not Available',
    }
  }

  const hasDimensions = [dimensions.length, dimensions.width, dimensions.height].every(value => value !== null && value !== undefined)
  const hasWeight = dimensions.weight !== null && dimensions.weight !== undefined

  return {
    hasDimensions,
    hasWeight,
    dimensionsText: hasDimensions
      ? `${NUMBER_FORMATTER.format(dimensions.length)} x ${NUMBER_FORMATTER.format(dimensions.width)} x ${NUMBER_FORMATTER.format(dimensions.height)} ${dimensions.dimensionUnit}`
      : 'Dimensions Not Available',
    weightText: hasWeight
      ? `${NUMBER_FORMATTER.format(dimensions.weight)} ${dimensions.weightUnit}`
      : 'Weight Not Available',
  }
}

export const normalizeProductDimensionsInput = (body = {}) => {
  const source = body?.dimensions && typeof body.dimensions === 'object' ? body.dimensions : body
  const dimensionUnit = VALID_DIMENSION_UNITS.has(source.dimensionUnit) ? source.dimensionUnit : 'cm'
  const weightUnit = VALID_WEIGHT_UNITS.has(source.weightUnit)
    ? source.weightUnit
    : (source.weight != null || body.weight != null ? 'g' : 'kg')

  const parseField = (value, fieldName) => {
    if (value === '' || value === null || value === undefined) return null
    const number = Number(value)
    if (!Number.isFinite(number)) {
      throw new Error(`${fieldName} must be a valid non-negative number`)
    }
    if (number < 0) {
      throw new Error(`${fieldName} cannot be negative`)
    }
    if (number > 99999) {
      throw new Error(`${fieldName} cannot exceed 99999`)
    }
    return number
  }

  const length = parseField(source.length, 'Length')
  const width = parseField(source.width ?? source.breadth, 'Width')
  const height = parseField(source.height, 'Height')
  const weight = parseField(source.weight ?? body.weight, 'Weight')

  const hasAny = [length, width, height, weight].some(value => value !== null)
  if (!hasAny) return null

  return {
    length,
    width,
    breadth: width,
    height,
    dimensionUnit,
    weight,
    weightUnit,
  }
}

export const deriveParcelMetrics = (items = []) => {
  const normalized = (items || []).map(item => ({
    quantity: Number(item?.quantity || 1),
    dimensions: normalizeProductDimensions(item || {}),
  }))

  const lengthValues = []
  const widthValues = []
  const heightValues = []
  let totalWeight = 0

  for (const item of normalized) {
    const { dimensions, quantity } = item
    if (!dimensions) continue

    if (dimensions.length !== null && dimensions.length !== undefined) {
      lengthValues.push(convertDimensionValue(dimensions.length, dimensions.dimensionUnit || 'cm', 'cm'))
    }
    if (dimensions.width !== null && dimensions.width !== undefined) {
      widthValues.push(convertDimensionValue(dimensions.width, dimensions.dimensionUnit || 'cm', 'cm'))
    }
    if (dimensions.height !== null && dimensions.height !== undefined) {
      heightValues.push(convertDimensionValue(dimensions.height, dimensions.dimensionUnit || 'cm', 'cm'))
    }
    if (dimensions.weight !== null && dimensions.weight !== undefined) {
      totalWeight += convertWeightValue(dimensions.weight, dimensions.weightUnit || 'kg', 'kg') * quantity
    }
  }

  const length = lengthValues.length ? Math.max(...lengthValues) : 10
  const breadth = widthValues.length ? Math.max(...widthValues) : 10
  const height = heightValues.length ? Math.max(...heightValues) : 10
  const weight = totalWeight > 0 ? Number(totalWeight.toFixed(2)) : 0.5

  return {
    length: Number(length.toFixed(2)),
    breadth: Number(breadth.toFixed(2)),
    height: Number(height.toFixed(2)),
    weight,
  }
}

export const calculateOrderWeight = (items = []) => deriveParcelMetrics(items).weight

export {
  DIMENSION_UNIT_OPTIONS,
  WEIGHT_UNIT_OPTIONS,
}
