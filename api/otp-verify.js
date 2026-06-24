// api/otp-verify.js — Verify OTP via Twilio Verify
const twilio = require('twilio');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone and OTP code are required.' });
  }

  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const check = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({
        to:   phone.replace(/[\s\-()]/g, ''),
        code: code.trim(),
      });

    if (check.status === 'approved') {
      return res.status(200).json({ success: true });
    } else {
      return res.status(400).json({ error: 'Incorrect OTP. Please try again.' });
    }
  } catch (err) {
    console.error('OTP verify error:', err);

    if (err.code === 60202) {
      return res.status(400).json({ error: 'Maximum attempts reached. Please request a new OTP.' });
    }
    if (err.code === 20404) {
      return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
    }

    return res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
}
