// index.js (রুটে)
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const nodemailer = require('nodemailer');
const fs = require('fs').promises;

dotenv.config();
const app = express();

const isVercel = !!process.env.VERCEL;

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB Error:', err));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  dest: isVercel ? '/tmp' : 'uploads/',
  limits: { fileSize: 75 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Only video files allowed!'), false);
  },
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

const contactSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  subject: String,
  videoUrl: String,
  message: String,
  createdAt: { type: Date, default: Date.now },
});
const Contact = mongoose.model('Contact', contactSchema);

app.get('/', (req, res) => {
  res.json({ message: 'API Running', maxVideo: '75MB' });
});

app.post('/api/contact', upload.single('file'), async (req, res) => {
  let tempFilePath = null;
  try {
    const { firstName, lastName, email, subject, message } = req.body;
    let videoUrl = null;

    if (req.file) {
      tempFilePath = req.file.path;
      const result = await cloudinary.uploader.upload(tempFilePath, {
        resource_type: 'video',
        folder: 'contact-videos',
        timeout: 120000,
        chunk_size: 6000000,
      });
      videoUrl = result.secure_url;
    }

    await new Contact({ firstName, lastName, email, subject, videoUrl, message }).save();

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: `New: ${subject}`,
      html: `
        <h2>New Contact</h2>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>
        ${videoUrl ? `<p><strong>Video:</strong> <a href="${videoUrl}">Watch</a></p>` : ''}
      `,
    });

    res.json({ message: 'Success!', videoUrl });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Server error', details: error.message });
  } finally {
    if (tempFilePath && isVercel) {
      try { await fs.unlink(tempFilePath); } catch (err) {}
    }
  }
});

if (!isVercel) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Local: http://localhost:${PORT}`);
  });
}

module.exports = app;