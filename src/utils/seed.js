import 'dotenv/config'
import mongoose from 'mongoose'
import User from '../models/User.js'
import Product from '../models/Product.js'
import Category from '../models/Category.js'

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/arshmart'

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

const categories = [
  { name: 'Electronics', slug: slugify('Electronics'), description: 'Gadgets, phones, laptops and more', image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400' },
  { name: 'Fashion', slug: slugify('Fashion'), description: 'Clothing, shoes and accessories', image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400' },
  { name: 'Home & Kitchen', slug: slugify('Home & Kitchen'), description: 'Everything for your home', image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400' },
  { name: 'Sports', slug: slugify('Sports'), description: 'Sports and outdoor equipment', image: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400' },
  { name: 'Books', slug: slugify('Books'), description: 'Books across all genres', image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400' },
  { name: 'Beauty', slug: slugify('Beauty'), description: 'Beauty and personal care', image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400' },
]

const sampleProducts = [
  {
    name: 'Wireless Noise Cancelling Headphones',
    description: 'Premium wireless headphones with active noise cancellation, 30-hour battery life, and crystal-clear audio quality.',
    price: 4999,
    originalPrice: 7999,
    category: 'Electronics',
    hsnCode: '8517',
    gstPercentage: 18,
    brand: 'AudioPro',
    stock: 25,
    isFeatured: true,
    images: [{ url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400', public_id: 'sample1' }],
    ratings: 4.5,
    numReviews: 124,
    specifications: [
      { key: 'Battery Life', value: '30 Hours' },
      { key: 'Connectivity', value: 'Bluetooth 5.0' },
      { key: 'Noise Cancellation', value: 'Active' },
    ],
  },
  {
    name: 'Smart Watch Pro Series',
    description: 'Feature-packed smartwatch with health monitoring, GPS, and 7-day battery life.',
    price: 8999,
    originalPrice: 12999,
    category: 'Electronics',
    hsnCode: '8517',
    gstPercentage: 18,
    brand: 'TechWear',
    stock: 15,
    isFeatured: true,
    images: [{ url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400', public_id: 'sample2' }],
    ratings: 4.3,
    numReviews: 89,
  },
  {
    name: 'Premium Cotton T-Shirt',
    description: 'Soft 100% organic cotton t-shirt available in multiple colors. Comfortable everyday wear.',
    price: 799,
    originalPrice: 1299,
    category: 'Fashion',
    hsnCode: '6109',
    gstPercentage: 5,
    brand: 'StyleCo',
    stock: 100,
    isFeatured: true,
    images: [{ url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400', public_id: 'sample3' }],
    ratings: 4.1,
    numReviews: 256,
  },
  {
    name: 'Stainless Steel Water Bottle',
    description: 'Double-wall insulated water bottle. Keeps drinks cold for 24 hours and hot for 12 hours.',
    price: 1199,
    originalPrice: 1799,
    category: 'Sports',
    hsnCode: '9506',
    gstPercentage: 12,
    brand: 'HydroFlask',
    stock: 50,
    isFeatured: false,
    images: [{ url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400', public_id: 'sample4' }],
    ratings: 4.7,
    numReviews: 312,
  },
  {
    name: 'Non-Stick Cookware Set',
    description: 'Professional grade 5-piece non-stick cookware set. Dishwasher safe and oven safe up to 400°F.',
    price: 3499,
    originalPrice: 5999,
    category: 'Home & Kitchen',
    hsnCode: '7323',
    gstPercentage: 12,
    brand: 'KitchenPro',
    stock: 20,
    isFeatured: true,
    images: [{ url: 'https://images.unsplash.com/photo-1584990347449-e7e0c28e1c0e?w=400', public_id: 'sample5' }],
    ratings: 4.4,
    numReviews: 178,
  },
  {
    name: 'Yoga Mat Premium',
    description: 'Extra thick 6mm non-slip yoga mat. Eco-friendly TPE material with carrying strap.',
    price: 1499,
    originalPrice: 2499,
    category: 'Sports',
    hsnCode: '9506',
    gstPercentage: 12,
    brand: 'ZenFit',
    stock: 40,
    isFeatured: false,
    images: [{ url: 'https://images.unsplash.com/photo-1601925228604-2f9c00a3fe05?w=400', public_id: 'sample6' }],
    ratings: 4.6,
    numReviews: 445,
  },
  {
    name: 'Bluetooth Party Speaker',
    description: 'Portable Bluetooth speaker with deep bass, RGB lights, and 12-hour playtime. Perfect for any occasion.',
    price: 3299,
    originalPrice: 4999,
    category: 'Electronics',
    hsnCode: '8518',
    gstPercentage: 18,
    brand: 'AudioPro',
    stock: 35,
    isFeatured: true,
    images: [{ url: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400', public_id: 'sample7' }],
    ratings: 4.2,
    numReviews: 210,
  },
  {
    name: 'Running Sneakers Lightweight',
    description: 'Breathable mesh running sneakers with cushioned sole for all-day comfort and performance.',
    category: 'Fashion',
    hsnCode: '6403',
    gstPercentage: 18,
    brand: 'RunFlex',
    stock: 60,
    isFeatured: true,
    images: [{ url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400', public_id: 'sample8' }],
    ratings: 4.4,
    numReviews: 520,
    originalPrice: 2799,
    price: 1999,
  },
  {
    name: 'Insulated Travel Tumbler',
    description: 'Vacuum-insulated 350ml tumbler keeping drinks hot for 8 hours and iced cold for all day.',
    category: 'Home & Kitchen',
    hsnCode: '7323',
    gstPercentage: 12,
    brand: 'SipWell',
    stock: 75,
    isFeatured: false,
    images: [{ url: 'https://images.unsplash.com/photo-1560017788-06fd1f8c5ff7?w=400', public_id: 'sample9' }],
    ratings: 4.8,
    numReviews: 380,
    originalPrice: 1599,
    price: 1099,
  },
  {
    name: 'Leather Travel Backpack',
    description: 'Premium waterproof travel backpack with anti-theft back pocket and USB charging port.',
    category: 'Fashion',
    hsnCode: '4202',
    gstPercentage: 18,
    brand: 'UrbanStride',
    stock: 45,
    isFeatured: false,
    images: [{ url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400', public_id: 'sample10' }],
    ratings: 4.5,
    numReviews: 190,
    originalPrice: 2999,
    price: 2199,
  },
  {
    name: 'Classic Analog Watch',
    description: 'Timeless analog wristwatch with stainless steel case, water resistance, and premium leather strap.',
    category: 'Fashion',
    hsnCode: '9102',
    gstPercentage: 18,
    brand: 'Chrono&Co',
    stock: 60,
    isFeatured: false,
    images: [{ url: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400', public_id: 'sample11' }],
    ratings: 4.6,
    numReviews: 265,
    originalPrice: 3499,
    price: 2499,
  },
  {
    name: 'Bestseller Fiction Book Set',
    description: 'A curated box set of must-read fiction novels across contemporary and classic genres.',
    category: 'Books',
    hsnCode: '4901',
    gstPercentage: 0,
    brand: 'PageTurner',
    stock: 90,
    isFeatured: true,
    images: [{ url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400', public_id: 'sample12' }],
    ratings: 4.7,
    numReviews: 320,
    originalPrice: 1499,
    price: 999,
  },
  {
    name: 'Self-Care Skincare Set',
    description: 'Complete 5-step natural skincare routine with vitamin E infused formulas for glowing skin.',
    category: 'Beauty',
    hsnCode: '3304',
    gstPercentage: 18,
    brand: 'GlowLab',
    stock: 55,
    isFeatured: true,
    images: [{ url: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400', public_id: 'sample13' }],
    ratings: 4.5,
    numReviews: 430,
    originalPrice: 2199,
    price: 1599,
  },
  {
    name: 'Minimalist Standing Desk Lamp',
    description: 'Dimmable LED desk lamp with adjustable brightness, warm to cool tones and a modern matte finish.',
    category: 'Home & Kitchen',
    hsnCode: '9405',
    gstPercentage: 12,
    brand: 'Lume',
    stock: 85,
    isFeatured: false,
    images: [{ url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400', public_id: 'sample14' }],
    ratings: 4.3,
    numReviews: 150,
    originalPrice: 1799,
    price: 1199,
  },
  {
    name: 'Wireless Earbuds Pro',
    description: 'True wireless earbuds with active noise cancellation, wireless charging case and crystal call quality.',
    category: 'Electronics',
    hsnCode: '8518',
    gstPercentage: 18,
    brand: 'AudioPro',
    stock: 95,
    isFeatured: false,
    images: [{ url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400', public_id: 'sample15' }],
    ratings: 4.4,
    numReviews: 610,
    originalPrice: 3999,
    price: 2799,
  },
  {
    name: 'Smart Fitness Band',
    description: 'Slim fitness band tracking heart rate, sleep, steps and workouts with 10-day battery life.',
    category: 'Electronics',
    hsnCode: '9102',
    gstPercentage: 18,
    brand: 'FitWave',
    stock: 70,
    isFeatured: false,
    images: [{ url: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=400', public_id: 'sample16' }],
    ratings: 4.2,
    numReviews: 275,
    originalPrice: 2499,
    price: 1799,
  },
  {
    name: 'Leather Bifold Wallet',
    description: 'Handcrafted full-grain leather wallet with RFID protection and multiple card slots.',
    category: 'Fashion',
    hsnCode: '4202',
    gstPercentage: 18,
    brand: 'UrbanStride',
    stock: 110,
    isFeatured: false,
    images: [{ url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=400', public_id: 'sample17' }],
    ratings: 4.5,
    numReviews: 335,
    originalPrice: 1299,
    price: 899,
  },
  {
    name: 'Insulated Sports Bottle Duo',
    description: 'Durable stainless steel sports bottles that keep your drink cold for 24 hours. Set of two.',
    category: 'Sports',
    price: 999,
    originalPrice: 1499,
    brand: 'HydroFlask',
    stock: 65,
    isFeatured: false,
    images: [{ url: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=800&q=80', public_id: 'sample18' }],
    ratings: 4.6,
    numReviews: 210,
    hsnCode: '7323',
    gstPercentage: 12,
  },
  {
    name: '6.5 Inch Smartphone',
    description: 'High-performance smartphone with AMOLED display, dual camera and 48 hours of battery life.',
    category: 'Electronics',
    price: 14999,
    originalPrice: 19999,
    brand: 'TechWear',
    stock: 30,
    isFeatured: false,
    images: [{ url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80', public_id: 'sample19' }],
    ratings: 4.5,
    numReviews: 540,
    hsnCode: '8517',
    gstPercentage: 18,
  },
  {
    name: 'Home Gym Combo Set',
    description: 'Complete home workout kit with adjustable dumbbells, resistance bands and floor mat for full-body training.',
    category: 'Sports',
    price: 4299,
    originalPrice: 6499,
    brand: 'FitWave',
    stock: 22,
    isFeatured: false,
    images: [{ url: 'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?auto=format&fit=crop&w=800&q=80', public_id: 'sample20' }],
    ratings: 4.4,
    numReviews: 175,
    hsnCode: '9506',
    gstPercentage: 12,
  },
]

const seed = async () => {
  try {
    await mongoose.connect(MONGO_URI)
    console.log('✅ Connected to MongoDB')

    // Clear existing data
    await Promise.all([
      User.deleteMany(),
      Product.deleteMany(),
      Category.deleteMany(),
    ])
    console.log('🗑️  Cleared existing data')

    // Create admin user
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123'
    const admin = await User.create({
      name: 'Admin',
      email: process.env.ADMIN_EMAIL || 'admin@arshmart.com',
      password: adminPassword,
      phone: '9342032250',
      role: 'admin',
    })
    console.log(`👤 Admin created: ${admin.email}`)

    // Create sample user
    const userPassword = 'User@123'
    await User.create({
      name: 'Test User',
      email: 'user@arshmart.com',
      password: userPassword,
      phone: '9876543210',
      role: 'user',
    })
    console.log('👤 Sample user created: user@arshmart.com')

    // Create categories
    const createdCategories = await Category.insertMany(categories)
    console.log(`📁 ${createdCategories.length} categories created`)

    // Create products
    const now = Date.now()
    const productsWithSlugs = sampleProducts.map((p, i) => ({
      ...p,
      slug: slugify(p.name) ? `${slugify(p.name)}-${now}-${i}` : `${now}-${i}`,
    }))
    const createdProducts = await Product.insertMany(productsWithSlugs)
    console.log(`📦 ${createdProducts.length} products created`)

    console.log('\n🎉 Database seeded successfully!\n')
    console.log('Admin credentials:')
    console.log(`  Email   : ${process.env.ADMIN_EMAIL || 'admin@arshmart.com'}`)
    console.log(`  Password: ${process.env.ADMIN_PASSWORD || 'Admin@123'}`)
    console.log('\nSample user:')
    console.log('  Email   : user@arshmart.com')
    console.log('  Password: User@123')

    process.exit(0)
  } catch (err) {
    console.error('❌ Seed error:', err.message)
    process.exit(1)
  }
}

seed()
