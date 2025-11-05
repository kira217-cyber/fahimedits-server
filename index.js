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

// CORS & Body Parser (with 100MB limit)
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB Error:', err));

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer Setup (75MB limit + video only)
const upload = multer({
  dest: 'uploads/', // লোকালে 'uploads' ফোল্ডার
  limits: {
    fileSize: 75 * 1024 * 1024, // 75 MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed!'), false);
    }
  },
});

// Nodemailer Setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// MongoDB Schema
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

// Default Route
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
      <h1 style="color: green;">Express Server Running Locally!</h1>
      <p>POST to <code>/api/contact</code> to test</p>
      <p><strong>Max Video:</strong> 75MB</p>
    </div>
  `);
});

// Contact Form Route
app.post('/api/contact', upload.single('file'), async (req, res) => {
  try {
    const { firstName, lastName, email, subject, message } = req.body;
    let videoUrl = null;

    if (req.file) {
      console.log(`Uploading: ${req.file.originalname} (${req.file.size} bytes)`);

      const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'video',
        folder: 'contact-videos',
        timeout: 120000,
        chunk_size: 6000000,
      });

      videoUrl = result.secure_url;
      console.log('Uploaded:', videoUrl);

      // Delete local file
      await fs.unlink(req.file.path).catch(() => {});
    }

    // Save to DB
    const newContact = new Contact({
      firstName, lastName, email, subject, videoUrl, message
    });
    await newContact.save();

    // Send Email
    const mailOptions = {
      from: `"Contact Form" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `New: ${subject}`,
      html: `
        <h2>New Submission</h2>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>
        ${videoUrl ? `<p><strong>Video:</strong> <a href="${videoUrl}">Watch</a></p>` : ''}
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: 'Success!', videoUrl });

  } catch (error) {
    console.error('Error:', error.message);

    if (error.message.includes('File too large')) {
      return res.status(400).json({ error: 'Max 75MB allowed.' });
    }

    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// LOCAL SERVER START (শুধু লোকালে)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Test: http://localhost:${PORT}/api/contact (POST)`);
});

// Export for Vercel (শুধু Vercel-এ কাজ করবে)
module.exports = app;