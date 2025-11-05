// ✅ Dependencies
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");

dotenv.config();

const app = express();

// ✅ Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
  })
);
app.use(express.json());

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Error:", err));

// ✅ Nodemailer Setup (Gmail)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Google App Password
  },
});

// ✅ MongoDB Schema
const contactSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  subject: String,
  message: String,
});
const Contact = mongoose.model("Contact", contactSchema);

// ✅ Default Route
app.get("/", (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
      <h1>Express Server Running!</h1>
      <p>Use <code>POST /api/contact</code> to submit form.</p>
      <p>Local: http://localhost:3000</p>
      <p>Vercel: https://your-project.vercel.app</p>
    </div>
  `);
});

// ✅ Contact Form Route
app.post("/api/contact", async (req, res) => {
  try {
    const { firstName, lastName, email, subject, message } = req.body;

    // Save to MongoDB
    const newContact = new Contact({
      firstName,
      lastName,
      email,
      subject,
      message,
    });
    await newContact.save();

    // Send Email
    const mailOptions = {
      from: `"Contact Form" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `New Message: ${subject}`,
      html: `
        <h2>New message arrived!</h2>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong><br/>${message.replace(/\n/g, "<br/>")}</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Message Send Successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Message Send Error!" });
  }
});

// ✅ Vercel Export (মূল জিনিস)
module.exports = app;

// ✅ শুধু লোকালে চালানোর জন্য (Vercel-এ কাজ করবে না)
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Local Server Running on http://localhost:${PORT}`);
  });
}
