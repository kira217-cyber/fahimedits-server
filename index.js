const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const nodemailer = require('nodemailer');

dotenv.config();
const app = express();

// =============================
// CORS কনফিগারেশন (মূল ফিক্স)
// =============================
const corsOptions = {
  origin: true, // সব অরিজিন থেকে অনুমতি (লোকাল + Vercel)
  // প্রোডাকশনে স্পেসিফিক করুন:
  // origin: ['http://localhost:5173', 'https://your-frontend.vercel.app'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
};

app.use(cors(corsOptions));

// Preflight (OPTIONS) রিকোয়েস্ট হ্যান্ডেল করুন
app.options('*', cors(corsOptions));

// =============================
// Middleware
// =============================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// =============================
// MongoDB কানেকশন
// =============================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// =============================
// Cloudinary কনফিগ
// =============================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// =============================
// Multer: Memory Storage (Vercel-এর জন্য)
// =============================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// =============================
// Nodemailer ট্রান্সপোর্টার
// =============================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// =============================
// MongoDB স্কিমা এবং মডেল
// =============================
const contactSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  subject: String,
  videoUrl: String,
  message: String,
  createdAt: { type: Date, default: Date.now }
});
const Contact = mongoose.model('Contact', contactSchema);

// =============================
// POST: /api/contact (ফর্ম সাবমিট)
// =============================
app.post('/api/contact', upload.single('file'), async (req, res) => {
  try {
    const { firstName, lastName, email, subject, message } = req.body;
    let videoUrl = null;

    // ভিডিও আপলোড (Cloudinary)
    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'video',
            folder: 'contact-videos',
            timeout: 120000 // 2 মিনিট
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });
      videoUrl = result.secure_url;
    }

    // MongoDB-এ সেভ করুন
    const newContact = new Contact({
      firstName,
      lastName,
      email,
      subject,
      videoUrl,
      message
    });
    await newContact.save();

    // ইমেইল পাঠান
    const mailOptions = {
      from: `"Contact Form" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `New Form Submission: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #4E8EFF;">New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${firstName} ${lastName}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Message:</strong><br/>${message.replace(/\n/g, '<br/>')}</p>
          ${videoUrl 
            ? `<p><strong>Video:</strong> <a href="${videoUrl}" target="_blank" style="color: #A072FF;">Watch Video</a></p>` 
            : ''
          }
          <hr/>
          <small style="color: #888;">Submitted on: ${new Date().toLocaleString()}</small>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    // সাকসেস রেসপন্স
    res.status(200).json({
      message: 'Form submitted successfully!',
      videoUrl
    });

  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({
      error: 'Failed to submit form',
      details: error.message
    });
  }
});

// =============================
// GET: / (API টেস্ট)
// =============================
app.get('/', (req, res) => {
  res.json({
    message: 'Contact API is live!',
    endpoint: 'POST /api/contact',
    docs: 'Send form data with file (optional)',
    status: 'OK'
  });
});

// =============================
// Vercel Serverless Export
// =============================
module.exports = app;

// =============================
// লোকাল ডেভেলপমেন্ট (Vercel-এর বাইরে)
// =============================
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`API Endpoint: http://localhost:${PORT}/api/contact`);
    console.log(`Test GET: http://localhost:${PORT}/`);
  });
}