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
app.use(cors());
app.use(express.json());

// ✅ MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// ✅ Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Multer setup (Vercel-compatible /tmp directory)
const upload = multer({ dest: '/tmp' });

// ✅ Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,  // Gmail address
    pass: process.env.EMAIL_PASS,  // App password
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
});
const Contact = mongoose.model('Contact', contactSchema);

// ✅ Default route (for checking server status)
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
      <h1>✅ Express Server is Running Successfully!</h1>
      <p>Use <code>POST /api/contact</code> to send form data.</p>
    </div>
  `);
});

// ✅ Contact form route
app.post('/api/contact', upload.single('file'), async (req, res) => {
  try {
    const { firstName, lastName, email, subject, message } = req.body;
    let videoUrl = null;

    // Upload to Cloudinary if file exists
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'video',
        folder: 'videos',
      });
      videoUrl = result.secure_url;
      await fs.unlink(req.file.path);
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

    // Send email
    const mailOptions = {
      from: `"Website Contact" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `New Contact Form Submission: ${subject}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong><br/> ${message}</p>
        ${videoUrl ? `<p><strong>Video:</strong> <a href="${videoUrl}" target="_blank">Watch Video</a></p>` : ''}
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Form submitted successfully!', videoUrl });
  } catch (error) {
    console.error('❌ Error submitting form:', error);
    res.status(500).json({ error: 'Error submitting form', details: error.message });
  }
});

// ✅ Export app (important for Vercel)
module.exports = app;
