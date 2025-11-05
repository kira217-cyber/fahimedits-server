const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

dotenv.config();
const app = express();

// ✅ CORS & Body Parser (with 100MB limit)
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// ✅ Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Multer Setup (Vercel /tmp + 75MB limit + video only)
const upload = multer({
  dest: '/tmp',
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

// ✅ Nodemailer Setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ✅ MongoDB Schema
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

// ✅ Default Route
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
      <h1 style="color: green;">✅ Express Server is Running!</h1>
      <p>Use <code>POST /api/contact</code> to submit form.</p>
      <p><strong>Max Video Size:</strong> 75MB</p>
    </div>
  `);
});

// ✅ Contact Form Route
app.post('/api/contact', upload.single('file'), async (req, res) => {
  try {
    const { firstName, lastName, email, subject, message } = req.body;
    let videoUrl = null;

    // Upload video to Cloudinary (with chunking for large files)
    if (req.file) {
      console.log(`Uploading video: ${req.file.originalname} (${req.file.size} bytes)`);

      const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'video',
        folder: 'contact-videos',
        timeout: 120000,        // 2 minutes
        chunk_size: 6000000,    // 6MB chunks
        eager: [
          { width: 300, height: 300, crop: 'pad', audio_codec: 'none' } // thumbnail
        ],
      });

      videoUrl = result.secure_url;
      console.log('Video uploaded:', videoUrl);

      // Delete temp file
      await fs.unlink(req.file.path).catch(() => {});
    }

    // Save to MongoDB
    const newContact = new Contact({
      firstName,
      lastName,
      email,
      subject,
      videoUrl,
      message,
    });
    await newContact.save();

    // Send Email
    const mailOptions = {
      from: `"Contact Form" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `New Submission: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #4E8EFF;">New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${firstName} ${lastName}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>
          ${videoUrl 
            ? `<p><strong>Video:</strong> <a href="${videoUrl}" target="_blank" style="color: #A072FF;">Watch Video</a></p>`
            : ''
          }
          <hr>
          <small>Sent on: ${new Date().toLocaleString()}</small>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ 
      message: 'Form submitted successfully!', 
      videoUrl 
    });

  } catch (error) {
    console.error('❌ Upload Error:', error.message);
    
    // Specific error for file too large
    if (error.message.includes('File too large')) {
      return res.status(400).json({ 
        error: 'Video file too large. Max 75MB allowed.' 
      });
    }

    res.status(500).json({ 
      error: 'Server error', 
      details: error.message 
    });
  }
});

// ✅ Export for Vercel
module.exports = app;