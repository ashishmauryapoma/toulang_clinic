// api/otp-send.js — Send OTP via Twilio Verify
const twilio = require('twilio');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  // Basic phone format check — must start with + and have digits
  if (!/^\+\d{7,15}$/.test(phone.replace(/[\s\-()]/g, ''))) {
    return res.status(400).json({
      error: 'Enter phone number in international format, e.g. +919876543210'
    });
  }

  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({
        to:      phone.replace(/[\s\-()]/g, ''),
        channel: 'sms',   // change to 'whatsapp' if you prefer OTP on WhatsApp
      });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('OTP send error:', err);

    // Give a friendly message for common Twilio errors
    if (err.code === 60200) {
      return res.status(400).json({ error: 'Invalid phone number. Please check and try again.' });
    }
    if (err.code === 60203) {
      return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' });
    }

    return res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
}
