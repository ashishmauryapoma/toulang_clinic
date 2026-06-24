// api/book.js — Vercel Serverless Function
// Saves appointment to Google Sheets + notifies admin via WhatsApp (Twilio)

const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const twilio = require('twilio');

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fname, femail, fphone, fdate, ftreatment, fmessage } = req.body;

  // Basic server-side validation
  if (!fname || !femail || !fphone || !fdate) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const timestamp = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' });

  // ── 1. Save to Google Sheets ─────────────────────────────────────────────
  try {
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    // Use first sheet, or create "Appointments" sheet if it doesn't exist
    let sheet = doc.sheetsByTitle['Appointments'];
    if (!sheet) {
      sheet = await doc.addSheet({
        title: 'Appointments',
        headerValues: ['Timestamp', 'Full Name', 'Email', 'Phone', 'Preferred Date', 'Treatment', 'Message'],
      });
    }

    await sheet.addRow({
      Timestamp:        timestamp,
      'Full Name':      fname,
      Email:            femail,
      Phone:            fphone,
      'Preferred Date': fdate,
      Treatment:        ftreatment || 'Not specified',
      Message:          fmessage   || '',
    });
  } catch (sheetErr) {
    console.error('Google Sheets error:', sheetErr);
    // Don't block the response — log and continue to WhatsApp
  }

  // ── 2. WhatsApp notification via Twilio ──────────────────────────────────
  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const waMessage =
      `🏥 *New Appointment Request — Toulang Clinic*\n\n` +
      `👤 *Name:* ${fname}\n` +
      `📞 *Phone:* ${fphone}\n` +
      `📧 *Email:* ${femail}\n` +
      `📅 *Preferred Date:* ${fdate}\n` +
      `💆 *Treatment:* ${ftreatment || 'Not specified'}\n` +
      `💬 *Message:* ${fmessage || '—'}\n\n` +
      `🕐 Submitted: ${timestamp}`;

    await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,  // e.g. whatsapp:+14155238886
      to:   `whatsapp:${process.env.ADMIN_WHATSAPP_NUMBER}`, // e.g. whatsapp:+601234567890
      body: waMessage,
    });
  } catch (waErr) {
    console.error('WhatsApp error:', waErr);
    // Still return success to the user even if WhatsApp fails
  }

  return res.status(200).json({ success: true });
}
