const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const nodemailer = require('nodemailer');

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer: Memory Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Schema
const contactSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  subject: String,
  videoUrl: String,
  message: String
});
const Contact = mongoose.model('Contact', contactSchema);

// POST Route
app.post('/api/contact', upload.single('file'), async (req, res) => {
  try {
    const { firstName, lastName, email, subject, message } = req.body;
    let videoUrl = null;

    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { resource_type: 'video', folder: 'videos' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });
      videoUrl = result.secure_url;
    }

    const newContact = new Contact({ firstName, lastName, email, subject, videoUrl, message });
    await newContact.save();

    const mailOptions = {
      from: `"Contact Form" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `New Submission: ${subject}`,
      html: `
        <h2>New Contact</h2>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong><br/>${message}</p>
        ${videoUrl ? `<p><strong>Video:</strong> <a href="${videoUrl}">Watch</a></p>` : ''}
      `,
    };
    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Success!', videoUrl });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// GET Route
app.get('/', (req, res) => {
  res.json({ message: 'API is live! Use POST /api/contact' });
});

// Vercel-এর জন্য
module.exports = app;

// লোকালে চালানোর জন্য
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Test: http://localhost:${PORT}/api/contact`);
  });
}