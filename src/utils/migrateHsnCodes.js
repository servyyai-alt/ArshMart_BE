import 'dotenv/config'
import mongoose from 'mongoose'
import Product from '../models/Product.js'

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/arshmart'

const categoryHsnMapping = {
  'Electronics': '8517',
  'Fashion': '6109',
  'Home & Kitchen': '7323',
  'Sports': '9506',
  'Books': '4901',
  'Beauty': '3304',
  'Groceries': '2106',
  'Toys': '9503',
  'Automotive': '8708',
  'Health': '3004',
  'Jewellery': '7113',
  'Furniture': '9403',
  'Office': '4820',
  'Music': '8523',
  'Pet Supplies': '2309',
  'Tools': '8205',
  'Baby Products': '9619',
  'Luggage': '4202',
  'Footwear': '6403',
}

const categoryGstMapping = {
  'Electronics': 18,
  'Fashion': 5,
  'Home & Kitchen': 12,
  'Sports': 12,
  'Books': 0,
  'Beauty': 18,
  'Groceries': 0,
  'Toys': 12,
  'Automotive': 18,
  'Health': 12,
  'Jewellery': 3,
  'Furniture': 18,
  'Office': 12,
  'Music': 18,
  'Pet Supplies': 5,
  'Tools': 18,
  'Baby Products': 5,
  'Luggage': 18,
  'Footwear': 5,
}

const findProductsMissingField = async (field) => {
  return Product.find({
    $or: [
      { [field]: { $exists: false } },
      { [field]: null },
      ...(field === 'hsnCode' ? [{ [field]: '' }] : []),
    ],
  })
}

const migrate = async () => {
  try {
    await mongoose.connect(MONGO_URI)
    console.log('Connected to MongoDB')

    // Migrate HSN Codes
    const productsWithoutHsn = await findProductsMissingField('hsnCode')
    console.log(`Found ${productsWithoutHsn.length} products without HSN Code`)

    let hsnUpdated = 0
    for (const product of productsWithoutHsn) {
      const category = product.category || ''
      const hsnCode = categoryHsnMapping[category] || '9999'
      product.hsnCode = hsnCode
      await product.save()
      console.log(`  HSN ✓ ${product.name} (${category}) → ${hsnCode}`)
      hsnUpdated++
    }

    // Migrate GST Percentage
    const productsWithoutGst = await findProductsMissingField('gstPercentage')
    console.log(`\nFound ${productsWithoutGst.length} products without GST Percentage`)

    let gstUpdated = 0
    for (const product of productsWithoutGst) {
      const category = product.category || ''
      const gstPct = categoryGstMapping[category]
      if (gstPct !== undefined) {
        product.gstPercentage = gstPct
        await product.save()
        console.log(`  GST ✓ ${product.name} (${category}) → ${gstPct}%`)
      } else {
        product.gstPercentage = 18
        await product.save()
        console.log(`  GST ? ${product.name} (${category}) → no mapping, set 18% (default)`)
      }
      gstUpdated++
    }

    console.log(`\nMigration complete:`)
    console.log(`  HSN Codes: ${hsnUpdated} updated`)
    console.log(`  GST %:     ${gstUpdated} updated`)
    process.exit(0)
  } catch (err) {
    console.error('Migration error:', err.message)
    process.exit(1)
  }
}

migrate()
