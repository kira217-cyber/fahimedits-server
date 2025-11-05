// ✅ Dependencies
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const cloudinary = require("cloudinary").v2;
const nodemailer = require("nodemailer");

dotenv.config();

const app = express();
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}));
app.use(express.json());

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// ✅ Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Nodemailer Setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // App password (Google App Password)
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
const Contact = mongoose.model("Contact", contactSchema);

// ✅ Default Route
app.get("/", (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
      <h1>🚀 Express Server Running on Vercel!</h1>
      <p>Environment: <strong>${process.env.NODE_ENV}</strong></p>
      <p>Use <code>POST /api/contact</code> to submit form.</p>
      <p>Use <code>GET /api/signature</code> for Cloudinary upload signature.</p>
    </div>
  `);
});


// ✅ 1️⃣ Cloudinary Signature Route (for client-side large file upload)
app.get("/api/signature", (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder: "videos" },
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      timestamp,
      signature,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
    });
  } catch (error) {
    console.error("❌ Signature Error:", error);
    res.status(500).json({ error: "Failed to generate signature" });
  }
});


// ✅ 2️⃣ Contact Form Route (receive form data only)
app.post("/api/contact", async (req, res) => {
  try {
    const { firstName, lastName, email, subject, message, videoUrl } = req.body;

    // ⬆️ Save to MongoDB
    const newContact = new Contact({
      firstName,
      lastName,
      email,
      subject,
      videoUrl,
      message,
    });
    await newContact.save();

    // ⬆️ Send Email Notification
    const mailOptions = {
      from: `"Website Contact" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `New Contact: ${subject}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong><br/> ${message}</p>
        ${videoUrl ? `<p><strong>Video:</strong> <a href="${videoUrl}" target="_blank">Watch</a></p>` : ""}
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Form submitted successfully!", videoUrl });
  } catch (error) {
    console.error("❌ Error submitting form:", error);
    res.status(500).json({ error: "Error submitting form", details: error.message });
  }
});


// ✅ Export for Vercel
module.exports = app;
