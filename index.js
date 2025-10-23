const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs').promises;

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB কানেকশন
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Cloudinary কনফিগারেশন
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer সেটআপ (লোকাল স্টোরেজে ফাইল সেভ)
const upload = multer({ dest: 'uploads/' });

// MongoDB স্কিমা এবং মডেল
const contactSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  subject: String,
  videoUrl: String,
  message: String
});
const Contact = mongoose.model('Contact', contactSchema);

// POST রুট
app.post('/api/contact', upload.single('file'), async (req, res) => {
  try {
    const { firstName, lastName, email, subject, message } = req.body;
    let videoUrl = null;

    // যদি ফাইল থাকে, তাহলে Cloudinary-তে আপলোড করুন
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'video',
        folder: 'videos'
      });
      videoUrl = result.secure_url;
      // লোকাল ফাইল মুছুন
      await fs.unlink(req.file.path);
    }

    const newContact = new Contact({
      firstName, lastName, email, subject, videoUrl, message
    });
    await newContact.save();
    res.status(200).json({ message: 'Form submitted successfully!', videoUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error submitting form' });
  }
});

const PORT = process.env.PORT || 5004;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));