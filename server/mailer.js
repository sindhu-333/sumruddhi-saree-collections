require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const https = require('https');
const nodemailer = require('nodemailer');

function normalizeSmtpValue(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

function createSmtpTransporter() {
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
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
    requireTLS: true,
    tls: { rejectUnauthorized: false }
  });
}

const smtpTransporter = createSmtpTransporter();

function buildMailApiPayload({ to, subject, text, html }) {
  const from = normalizeSmtpValue(process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@saree.local');
  return JSON.stringify({
    from,
    to,
    subject,
    text,
    html
  });
}

async function sendWithMailApi({ to, subject, text, html }) {
  const provider = normalizeSmtpValue(process.env.MAIL_PROVIDER || 'resend').toLowerCase();
  const apiKey = normalizeSmtpValue(process.env.MAIL_API_KEY || '');
  const apiUrl = normalizeSmtpValue(process.env.MAIL_API_URL || '');

  if (!apiKey || !apiUrl) {
    return { queued: false, fallback: true, reason: 'missing mail api config' };
  }

  return new Promise((resolve) => {
    const parsedUrl = new URL(apiUrl);
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };

    if (provider === 'brevo') {
      headers['api-key'] = apiKey;
    }

    const req = https.request(
      parsedUrl,
      {
        method: 'POST',
        headers,
        timeout: 8000
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({ queued: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, response: data });
        });
      }
    );

    req.on('error', (error) => {
      resolve({ queued: false, error: error.message });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ queued: false, error: 'mail api timeout' });
    });
    req.write(buildMailApiPayload({ to, subject, text, html }));
    req.end();
  });
}

async function sendEmail({ to, subject, text, html }) {
  const from = normalizeSmtpValue(process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@saree.local');

  const apiResult = await sendWithMailApi({ to, subject, text, html });
  if (apiResult.queued) {
    return { queued: true, provider: 'mail-api' };
  }

  if (!smtpTransporter) {
    console.log('[MAIL:FALLBACK]', { to, subject, text, from });
    return { queued: false, fallback: true, error: apiResult.error || apiResult.response || 'mail api unavailable' };
  }

  try {
    await smtpTransporter.sendMail({ from, to, subject, text, html });
    return { queued: true, provider: 'smtp' };
  } catch (error) {
    console.error('[MAIL:SEND_FAIL]', error && error.message);
    return { queued: false, error: error.message };
  }
}

module.exports = { sendEmail };
