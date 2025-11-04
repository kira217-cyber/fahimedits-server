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

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ dest: '/tmp' }); // ✅ use /tmp for Vercel compatibility

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const contactSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  subject: String,
  videoUrl: String,
  message: String
});
const Contact = mongoose.model('Contact', contactSchema);

app.post('/api/contact', upload.single('file'), async (req, res) => {
  try {
    const { firstName, lastName, email, subject, message } = req.body;
    let videoUrl = null;

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'video',
        folder: 'videos'
      });
      videoUrl = result.secure_url;
      await fs.unlink(req.file.path);
    }

    const newContact = new Contact({ firstName, lastName, email, subject, videoUrl, message });
    await newContact.save();

    const mailOptions = {
      from: `"Website Contact" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `New Contact Form: ${subject}`,
      html: `
        <h2>New Contact Form</h2>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong><br/> ${message}</p>
        ${videoUrl ? `<p><strong>Video:</strong> <a href="${videoUrl}" target="_blank">Watch</a></p>` : ''}
      `,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Form submitted successfully!', videoUrl });
  } catch (error) {
    console.error('❌ Error submitting form:', error);
    res.status(500).json({ error: 'Error submitting form', details: error.message });
  }
});

// ✅ Export app instead of listening to a port
module.exports = app;
