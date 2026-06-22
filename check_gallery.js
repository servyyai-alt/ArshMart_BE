import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = 'mongodb+srv://servyyai_db_user:dV9aZnn1fY879yCS@cluster0.1bgafts.mongodb.net/';

const run = async () => {
  await mongoose.connect(MONGO_URI);
  
  const galleryImageSchema = new mongoose.Schema({}, { strict: false });
  const GalleryImage = mongoose.model('GalleryImage', galleryImageSchema);

  const images = await GalleryImage.find({ isActive: { $ne: false } }).sort({ sortOrder: 1 });
  console.log('ACTIVE_IMAGES:', JSON.stringify(images, null, 2));
  process.exit(0);
};

run().catch(console.error);
