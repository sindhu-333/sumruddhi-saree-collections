require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const https = require('https');
const nodemailer = require('nodemailer');

function normalizeSmtpCredential(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

function normalizeMailValue(value) {
  return String(value || '').trim();
}

function normalizeProviderList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function createSmtpTransporter() {
  const host = normalizeSmtpCredential(process.env.SMTP_HOST);
  const user = normalizeSmtpCredential(process.env.SMTP_USER);
  const pass = normalizeSmtpCredential(process.env.SMTP_PASS);

  if (!host || !user || !pass) {
    return null;
  }

  const smtpTimeout = Number(process.env.SMTP_TIMEOUT_MS || 20000);

  return nodemailer.createTransport({
    host,
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: { user, pass },
    connectionTimeout: smtpTimeout,
    greetingTimeout: smtpTimeout,
    socketTimeout: smtpTimeout,
    requireTLS: true,
    tls: { rejectUnauthorized: false }
  });
}

const smtpTransporter = createSmtpTransporter();
const smtpFallbackEnabled = String(process.env.MAIL_FALLBACK_TO_SMTP || 'false').toLowerCase() === 'true';

function getProviderOrder() {
  const configuredProviders = normalizeProviderList(process.env.MAIL_PROVIDER || process.env.MAIL_PROVIDERS || 'resend');
  const orderedProviders = [];

  configuredProviders.forEach((provider) => {
    if (provider === 'resend' || provider === 'brevo' || provider === 'smtp') {
      if (!orderedProviders.includes(provider)) {
        orderedProviders.push(provider);
      }
    }
  });

  if (smtpFallbackEnabled && !orderedProviders.includes('smtp')) {
    orderedProviders.push('smtp');
  }

  return orderedProviders.filter((provider, index, list) => list.indexOf(provider) === index);
}

function getMailApiConfig(provider) {
  const providerName = String(provider || '').toLowerCase();
  const configuredFrom = normalizeMailValue(process.env.MAIL_FROM || process.env.SMTP_USER || '');
  const fallbackFrom = 'sindhubhat0904@gmail.com';
  const from = configuredFrom || fallbackFrom;

  if (providerName === 'brevo') {
    const apiKey = normalizeSmtpCredential(process.env.BREVO_API_KEY || process.env.MAIL_API_KEY || '');
    const apiUrl = normalizeMailValue(process.env.BREVO_API_URL || 'https://api.brevo.com/v3/smtp/email');
    return {
      apiKey,
      apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      payload: ({ to, subject, text, html }) => JSON.stringify({
        sender: { name: 'Saree Collections', email: from },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html || text
      })
    };
  }

  const apiKey = normalizeSmtpCredential(process.env.MAIL_API_KEY || '');
  const apiUrl = normalizeMailValue(process.env.MAIL_API_URL || 'https://api.resend.com/emails');
  return {
    apiKey,
    apiUrl,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    payload: ({ to, subject, text, html }) => JSON.stringify({
      from,
      to,
      subject,
      text,
      html
    })
  };
}

async function sendWithMailApi(provider, { to, subject, text, html }) {
  const apiTimeout = Number(process.env.MAIL_API_TIMEOUT_MS || 20000);
  const config = getMailApiConfig(provider);

  if (!config?.apiKey || !config?.apiUrl) {
    return { queued: false, fallback: true, reason: `missing ${provider} config` };
  }

  if (provider === 'brevo' && !config.apiKey.startsWith('xkeysib-')) {
    return { queued: false, fallback: true, reason: `invalid ${provider} api key format` };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(config.apiUrl);
  } catch (err) {
    return { queued: false, fallback: true, reason: `invalid ${provider} api url` };
  }

  return new Promise((resolve) => {
    const req = https.request(
      parsedUrl,
      {
        method: 'POST',
        headers: config.headers,
        timeout: apiTimeout
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
      resolve({ queued: false, error: `${provider} mail api request error: ${error.message}` });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ queued: false, error: `${provider} mail api timeout` });
    });

    req.write(config.payload({ to, subject, text, html }));
    req.end();
  });
}

async function sendWithSmtp(from, { to, subject, text, html }) {
  if (!smtpTransporter) {
    return { queued: false, error: 'smtp transporter not configured' };
  }

  try {
    await smtpTransporter.sendMail({ from, to, subject, text, html });
    return { queued: true, provider: 'smtp' };
  } catch (error) {
    return { queued: false, error: error.message || 'smtp delivery failed' };
  }
}

async function sendEmail({ to, subject, text, html }) {
  const from = normalizeMailValue(process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@saree.local');
  const providers = getProviderOrder();
  let lastError = 'mail delivery unavailable';

  for (const provider of providers) {
    if (provider === 'smtp') {
      if (!smtpFallbackEnabled || !smtpTransporter) {
        lastError = 'smtp fallback disabled or not configured';
        continue;
      }

      const smtpResult = await sendWithSmtp(from, { to, subject, text, html });
      if (smtpResult.queued) {
        return { queued: true, provider: 'smtp' };
      }
      lastError = smtpResult.error || 'smtp delivery failed';
      console.error('[MAIL:SEND_FAIL]', lastError);
      continue;
    }

    const apiResult = await sendWithMailApi(provider, { to, subject, text, html });
    if (apiResult.queued) {
      return { queued: true, provider };
    }

    lastError = apiResult.error || apiResult.response || apiResult.reason || `${provider} failed`;
    console.warn(`[MAIL:${provider.toUpperCase()}_FAIL]`, lastError);
  }

  return { queued: false, error: lastError };
}

module.exports = { sendEmail };
