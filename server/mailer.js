require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const nodemailer = require('nodemailer');

function normalizeSmtpValue(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

function createTransporters() {
  const host = normalizeSmtpValue(process.env.SMTP_HOST);
  const user = normalizeSmtpValue(process.env.SMTP_USER);
  const pass = normalizeSmtpValue(process.env.SMTP_PASS);

  if (!host || !user || !pass) {
    return [];
  }

  const explicitPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : null;
  const explicitSecure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';

  const configs = [];
  if (explicitPort) {
    configs.push({
      host,
      port: explicitPort,
      secure: explicitSecure,
      auth: { user, pass },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
      requireTLS: true,
      tls: { rejectUnauthorized: false }
    });
  } else {
    configs.push({
      host,
      port: 465,
      secure: true,
      auth: { user, pass },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
      requireTLS: true,
      tls: { rejectUnauthorized: false }
    });
    configs.push({
      host,
      port: 587,
      secure: false,
      auth: { user, pass },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
      requireTLS: true,
      tls: { rejectUnauthorized: false }
    });
  }

  return configs.map((config) => nodemailer.createTransport(config));
}

const transporters = createTransporters();

async function sendEmail({ to, subject, text, html }) {
  const from = normalizeSmtpValue(process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@saree.local');

  if (!transporters.length) {
    console.log('[MAIL:FALLBACK]', { to, subject, text });
    return { queued: false, fallback: true };
  }

  let lastError = null;
  for (const transporter of transporters) {
    try {
      await transporter.sendMail({ from, to, subject, text, html });
      return { queued: true };
    } catch (error) {
      lastError = error;
      console.error('[MAIL:SEND_FAIL]', error && error.message);
    }
  }

  return { queued: false, error: lastError && lastError.message ? lastError.message : 'mail send failed' };
}

module.exports = { sendEmail };
