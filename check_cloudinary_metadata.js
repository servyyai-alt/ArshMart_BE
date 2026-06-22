import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MONGO_URI = 'mongodb+srv://servyyai_db_user:dV9aZnn1fY879yCS@cluster0.1bgafts.mongodb.net/';

const run = async () => {
  await mongoose.connect(MONGO_URI);
  
  const galleryImageSchema = new mongoose.Schema({}, { strict: false });
  const GalleryImage = mongoose.model('GalleryImage', galleryImageSchema);

  const images = await GalleryImage.find({ isActive: { $ne: false } }).sort({ sortOrder: 1 });
  
  console.log('Comparing images...');
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    try {
      const result = await cloudinary.api.resource(img.public_id);
      console.log(`[${i}] ID: ${img.public_id} | Format: ${result.format} | Size: ${result.bytes} bytes | ETag: ${result.etag}`);
    } catch (err) {
      console.error(`Error fetching metadata for ${img.public_id}:`, err.message);
    }
  }
  
  process.exit(0);
};

run().catch(console.error);
