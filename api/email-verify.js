const nodemailer = require('nodemailer');

// Store OTP codes temporarily in memory
// (resets on each cold start — fine for short-lived OTPs)
const otpStore = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, email, code } = req.body;

  // ── SEND OTP ──────────────────────────────────
  if (action === 'send') {
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required.' });
    }

    // Generate 6-digit code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore.set(email.toLowerCase(), { otp, expiry, attempts: 0 });

    // Send email
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD
        }
      });

      await transporter.sendMail({
        from: `"Toulang Clinic" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'Your Appointment Verification Code — Toulang Clinic',
        html: `<div style="font-family:'DM Sans',Arial,sans-serif;max-width:480px;margin:0 auto;padding:40px 32px;background:#F7F7F5;border-radius:16px"><h2 style="font-family:Georgia,serif;color:#5D7158;font-size:1.8rem;margin-bottom:8px">Toulang Clinic</h2><p style="color:#6b7280;font-size:.9rem;margin-bottom:32px">Destination for Relief & Wellness</p><p style="color:#222;font-size:1rem;margin-bottom:16px">Hello! Your appointment verification code is:</p><div style="background:#5D7158;color:white;font-size:2.4rem;font-weight:700;letter-spacing:.3em;text-align:center;padding:24px;border-radius:12px;margin-bottom:24px">${otp}</div><p style="color:#6b7280;font-size:.85rem;line-height:1.7">This code expires in <strong>10 minutes</strong>.<br>If you did not request this, please ignore this email.</p><hr style="border:none;border-top:1px solid #E8ECE6;margin:24px 0"><p style="color:#6b7280;font-size:.78rem">Toulang Physiotherapy & Chiropractic Clinic<br>12 Wellness Avenue, Suite 3A, Kuala Lumpur</p></div>`
      });

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Email send error:', err);
      return res.status(500).json({
        error: 'Failed to send email. Please try again.'
      });
    }
  }

  // ── VERIFY OTP ────────────────────────────────
  if (action === 'verify') {
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required.' });
    }

    const record = otpStore.get(email.toLowerCase());

    if (!record) {
      return res.status(400).json({
        error: 'No code found. Please request a new one.'
      });
    }

    if (Date.now() > record.expiry) {
      otpStore.delete(email.toLowerCase());
      return res.status(400).json({
        error: 'Code expired. Please request a new one.'
      });
    }

    record.attempts++;
    if (record.attempts > 5) {
      otpStore.delete(email.toLowerCase());
      return res.status(400).json({
        error: 'Too many attempts. Please request a new code.'
      });
    }

    if (record.otp !== code.trim()) {
      return res.status(400).json({
        error: `Incorrect code. ${5 - record.attempts} attempts remaining.`
      });
    }

    // Success — remove from store
    otpStore.delete(email.toLowerCase());
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Invalid action.' });
}
