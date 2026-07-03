require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const nodemailer = require('nodemailer');

function normalizeSmtpValue(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

function createTransporter() {
  const host = normalizeSmtpValue(process.env.SMTP_HOST);
  const user = normalizeSmtpValue(process.env.SMTP_USER);
  const pass = normalizeSmtpValue(process.env.SMTP_PASS);

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: { user, pass },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
    requireTLS: true,
    tls: { rejectUnauthorized: false }
  });
}

const transporter = createTransporter();

async function sendEmail({ to, subject, text, html }) {
  const from = normalizeSmtpValue(process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@saree.local');

  if (!transporter) {
    console.log('[MAIL:FALLBACK]', { to, subject, text });
    return { queued: false, fallback: true };
  }

  try {
    await transporter.sendMail({ from, to, subject, text, html });
    return { queued: true };
  } catch (error) {
    console.error('[MAIL:SEND_FAIL]', error && error.message);
    return { queued: false, error: error.message };
  }
}

module.exports = { sendEmail };
