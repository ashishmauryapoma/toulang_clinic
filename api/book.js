// api/book.js — Vercel Serverless Function
// Saves appointment to Google Sheets + notifies admin via Firebase Cloud Messaging (FCM)

const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

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
    // Don't block the response — log and continue to FCM
  }

  // ── 2. Send Firebase Cloud Messaging (FCM) notification to admin ────────
  try {
    const appointmentMessage = {
      notification: {
        title: '🏥 New Appointment — Toulang Clinic',
        body: `👤 ${fname} | 📞 ${fphone} | 📅 ${fdate} | 💆 ${ftreatment || 'Not specified'}`
      },
      data: {
        fname,
        fphone,
        femail,
        fdate,
        ftreatment: ftreatment || 'Not specified',
        fmessage: fmessage || '',
        timestamp
      },
      token: process.env.ADMIN_FCM_TOKEN
    };

    await admin.messaging().send(appointmentMessage);
    console.log('FCM notification sent successfully');
  } catch (fcmErr) {
    console.error('FCM notification error:', fcmErr);
    // Still return success to the user even if FCM fails
  }

  return res.status(200).json({ success: true });
}
