require('dotenv').config();
const nodemailer = require('nodemailer');

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: { user, pass }
  });
}

const transporter = createTransporter();

async function sendEmail({ to, subject, text, html }) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@saree.local';

  if (!transporter) {
    console.log('[MAIL:FALLBACK]', { to, subject, text });
    return { queued: false, fallback: true };
  }

  await transporter.sendMail({ from, to, subject, text, html });
  return { queued: true };
}

module.exports = { sendEmail };
