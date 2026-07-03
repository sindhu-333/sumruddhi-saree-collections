require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('./db');
const { sendEmail } = require('./mailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
// Trust the first proxy (Render provides a single proxy layer). Use numeric
// trust value instead of `true` to avoid permissive proxy settings that
// express-rate-limit warns about.
app.set('trust proxy', 1);
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:3002';
const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'sindhubhat39@gmail.com';

const defaultCorsOrigin = (() => {
  try {
    return new URL(FRONTEND_BASE_URL).origin;
  } catch {
    return 'http://localhost:3000';
  }
})();

const allowedOrigins = String(process.env.CORS_ORIGIN || defaultCorsOrigin)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// For development, also allow local variant ports (3000-3010)
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push(
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://localhost:3005'
  );
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '6mb' }));

// Serve uploaded files
const uploadsRoot = path.join(__dirname, 'uploads');
const returnsUploadsDir = path.join(uploadsRoot, 'returns');
if (!fs.existsSync(returnsUploadsDir)) {
  fs.mkdirSync(returnsUploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsRoot));

// Multer storage for returns uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, returnsUploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safe = String(file.originalname).replace(/\s+/g, '_');
    cb(null, `${unique}-${safe}`);
  }
});
const upload = multer({ storage });

// Ensure returns table exists (lightweight migration)
async function ensureReturnsTable() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS returns (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      customer_name TEXT,
      whatsapp TEXT,
      email TEXT,
      order_number TEXT,
      product_code TEXT,
      purchase_date DATE,
      issue_type TEXT,
      description TEXT,
      video_files JSONB,
      photo_files JSONB,
      preferred_solution TEXT,
      status TEXT DEFAULT 'pending',
      admin_note TEXT,
      approved_at TIMESTAMP,
      refund_details TEXT,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    );`);
  } catch (err) {
    console.error('ensureReturnsTable error', err);
  }
}
ensureReturnsTable();

function buildAuthLimiter(max, windowMs, message) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message }
  });
}

const loginLimiter = buildAuthLimiter(10, 15 * 60 * 1000, 'Too many login attempts. Try again in 15 minutes.');
const signupLimiter = buildAuthLimiter(8, 15 * 60 * 1000, 'Too many signup attempts. Try again in 15 minutes.');
const resetRequestLimiter = buildAuthLimiter(20, 15 * 60 * 1000, 'Too many reset requests. Try again in 15 minutes.');
const resetApplyLimiter = buildAuthLimiter(10, 15 * 60 * 1000, 'Too many password reset attempts. Try again in 15 minutes.');

function createTokenPair() {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

function normalizeUserRow(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role,
    is_verified: user.is_verified,
    country_region: user.country_region,
    address: user.address,
    apartment: user.apartment,
    city: user.city,
    state: user.state,
    pincode: user.pincode,
    phone: user.phone
  };
}

function bookingSelect() {
  return `
    SELECT
      b.id,
      b.user_id,
      b.product_id,
      b.quantity,
      b.unit_price,
      b.total_amount,
      b.customer_name,
      b.customer_email,
      b.customer_phone,
      b.customer_address,
      b.upi_id,
      b.payment_id,
      b.payment_time,
      b.payment_screenshot,
      b.submitted_at,
      b.delivery_eta,
      b.admin_note,
      b.approved_at,
      b.updated_at,
      b.status,
      b.shipment_status,
      p.name AS product_name,
      p.price AS product_price,
      p.images AS product_images
    FROM bookings b
    LEFT JOIN products p ON p.id = b.product_id
  `;
}

function mapBookingRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    productId: row.product_id,
    qty: row.quantity,
    price: Number(row.unit_price || row.product_price || 0),
    totalAmount: Number(row.total_amount || 0),
    name: row.product_name || 'Saree',
    userName: row.customer_name,
    userEmail: row.customer_email,
    userPhone: row.customer_phone,
    customerAddress: row.customer_address,
    upiId: row.upi_id,
    paymentId: row.payment_id,
    paymentTime: row.payment_time,
    screenshot: row.payment_screenshot,
    submittedAt: row.submitted_at,
    deliveryEta: row.delivery_eta,
    adminNote: row.admin_note,
    approvedAt: row.approved_at,
    status: row.status,
    shipmentStatus: row.shipment_status || 'pending',
    productImages: row.product_images
  };
}

function normalizeProductImages(product = {}) {
  const fallbackImage = 'https://images.unsplash.com/photo-1606410156625-6c7ba8c5c0e3?w=600&h=700&fit=crop';
  const resolveImage = (image) => {
    const value = String(image || '').trim();
    if (!value || value.startsWith('/images/')) {
      return fallbackImage;
    }
    return value;
  };

  let images = product.images;
  if (typeof images === 'string') {
    try {
      images = JSON.parse(images);
    } catch {
      images = [images];
    }
  }

  const normalizedImages = Array.isArray(images)
    ? images.map(resolveImage).filter(Boolean)
    : [fallbackImage];

  return {
    ...product,
    images: normalizedImages.length ? normalizedImages : [fallbackImage],
    image: normalizedImages[0] || fallbackImage
  };
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'invalid token' });
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'authentication required' });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'admin access required' });
  }
  return next();
}

function requireBackOffice(req, res, next) {
  if (!req.user || !['admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ error: 'admin or staff access required' });
  }
  return next();
}

app.use(authMiddleware);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/test-email', async (req, res) => {
  const target = req.body?.to || process.env.SMTP_USER || process.env.ADMIN_NOTIFICATION_EMAIL;

  if (!target) {
    return res.status(400).json({ error: 'No target email configured. Pass {"to":"you@example.com"}.' });
  }

  try {
    const result = await sendEmail({
      to: target,
      subject: 'Saree Collections SMTP Test',
      text: 'This is a test email from Saree Collections backend. If you received this, SMTP is working.'
    });

    return res.json({
      ok: true,
      to: target,
      mailResult: result
    });
  } catch (err) {
    console.error('test email error', err);
    return res.status(500).json({ error: 'Email send failed', details: err.message || 'unknown error' });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, description, price, fabric, category, images, details, is_new, stock FROM products ORDER BY id');
    res.json(result.rows.map(normalizeProductImages));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
    res.json(normalizeProductImages(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

// Create new product (admin only)
app.post('/api/products', requireAuth, requireAdmin, async (req, res) => {
  const { name, description, price, fabric, category, images, details, stock, isNew } = req.body;
  
  if (!name || !category || !price) {
    return res.status(400).json({ error: 'Missing required fields: name, category, price' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO products (name, description, price, fabric, category, images, details, is_new, stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, description, price, fabric, category, images, details, is_new, stock`,
      [name, description, price, fabric, category, JSON.stringify(images || []), JSON.stringify(details || []), isNew || false, stock || 0]
    );
    res.status(201).json(normalizeProductImages(result.rows[0]));
  } catch (err) {
    console.error('POST /api/products error:', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Update existing product (admin only)
app.patch('/api/products/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, price, fabric, category, images, details, stock, isNew } = req.body;
  
  if (!name || !category || !price) {
    return res.status(400).json({ error: 'Missing required fields: name, category, price' });
  }

  try {
    const result = await pool.query(
      `UPDATE products SET name=$1, description=$2, price=$3, fabric=$4, category=$5, images=$6, details=$7, is_new=$8, stock=$9, updated_at=now()
       WHERE id=$10
       RETURNING id, name, description, price, fabric, category, images, details, is_new, stock`,
      [name, description, price, fabric, category, JSON.stringify(images || []), JSON.stringify(details || []), isNew || false, stock || 0, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(normalizeProductImages(result.rows[0]));
  } catch (err) {
    console.error('PATCH /api/products/:id error:', err);
    res.status(500).json({ error: 'db error' });
  }
});

// Delete product (admin only)
app.delete('/api/products/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query('DELETE FROM products WHERE id=$1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('DELETE /api/products/:id error:', err);
    res.status(500).json({ error: 'db error' });
  }
});

app.post('/api/auth/signup', signupLimiter, async (req, res) => {
  const {
    email,
    password,
    first_name,
    last_name,
    country_region,
    address,
    apartment,
    city,
    state,
    pincode,
    phone
  } = req.body;

  if (!email || !password || !first_name || !last_name) {
    return res.status(400).json({ error: 'missing required fields' });
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'account already exists' });
    }

    const hash = await bcrypt.hash(password, 12);
    const userResult = await pool.query(
      `INSERT INTO users (
        email, password_hash, first_name, last_name, role, is_verified,
        country_region, address, apartment, city, state, pincode, phone
      )
      VALUES ($1,$2,$3,$4,'user',false,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id, email, first_name, last_name, role, is_verified`,
      [
        normalizedEmail,
        hash,
        String(first_name).trim(),
        String(last_name).trim(),
        country_region || null,
        address || null,
        apartment || null,
        city || null,
        state || null,
        pincode || null,
        phone || null
      ]
    );

    const user = userResult.rows[0];
    const tokenPair = createTokenPair();

    await pool.query(
      'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1,$2, now() + interval \'24 hours\')',
      [user.id, tokenPair.hash]
    );

    const verifyUrl = `${FRONTEND_BASE_URL}/#/verify-email?token=${tokenPair.raw}`;
    // Send verification email asynchronously; do not block signup on SMTP failures.
    sendEmail({
      to: user.email,
      subject: 'Verify your Saree Collections account',
      text: `Welcome to Saree Collections. Verify your email using this link: ${verifyUrl}\nIf link does not open, use token: ${tokenPair.raw}`
    }).catch((err) => console.error('[VERIFY_EMAIL_SEND_FAIL]', err && err.message));

    res.status(201).json({
      message: 'Account created. Please verify your email before login.',
      verificationSent: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

app.post('/api/admin/staff', requireAuth, requireAdmin, async (req, res) => {
  const { email, password, first_name, last_name, phone } = req.body || {};

  if (!email || !password || !first_name || !last_name) {
    return res.status(400).json({ error: 'missing required fields' });
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'account already exists' });
    }

    const hash = await bcrypt.hash(password, 12);
    const userResult = await pool.query(
      `INSERT INTO users (
        email, password_hash, first_name, last_name, role, is_verified, phone
      )
      VALUES ($1,$2,$3,$4,'staff',true,$5)
      RETURNING id, email, first_name, last_name, role, is_verified`,
      [
        normalizedEmail,
        hash,
        String(first_name).trim(),
        String(last_name).trim(),
        phone || null
      ]
    );

    return res.status(201).json({
      message: 'Staff account created',
      staff: normalizeUserRow(userResult.rows[0])
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'db error' });
  }
});

app.post('/api/auth/verify-email', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'token is required' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const found = await pool.query(
      `SELECT id, user_id FROM email_verification_tokens
       WHERE token_hash = $1
         AND consumed_at IS NULL
         AND expires_at > now()
       ORDER BY id DESC
       LIMIT 1`,
      [tokenHash]
    );

    if (!found.rows.length) {
      return res.status(400).json({ error: 'invalid or expired token' });
    }

    const tokenRow = found.rows[0];

    await pool.query('UPDATE users SET is_verified = true WHERE id = $1', [tokenRow.user_id]);
    await pool.query('UPDATE email_verification_tokens SET consumed_at = now() WHERE id = $1', [tokenRow.id]);

    return res.json({ message: 'Email verified successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'db error' });
  }
});

app.post('/api/auth/resend-verification-email', resetRequestLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const userResult = await pool.query('SELECT id, email, first_name FROM users WHERE email = $1', [normalizedEmail]);

    if (!userResult.rows.length) {
      return res.json({ message: 'If account exists, verification instructions were sent.' });
    }

    const user = userResult.rows[0];
    const tokenPair = createTokenPair();

    await pool.query(
      'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1,$2, now() + interval \'24 hours\')',
      [user.id, tokenPair.hash]
    );

    const verifyUrl = `${FRONTEND_BASE_URL}/#/verify-email?token=${tokenPair.raw}`;
    const mailResult = await sendEmail({
      to: user.email,
      subject: 'Verify your Saree Collections account',
      text: `Welcome to Saree Collections. Verify your email using this link: ${verifyUrl}\nIf link does not open, use token: ${tokenPair.raw}`
    });

    if (!mailResult.queued) {
      console.warn('[VERIFY_EMAIL_RESEND_FALLBACK]', mailResult.error || 'email not queued');
    }

    return res.json({
      message: 'If account exists, verification instructions were sent.',
      queued: mailResult.queued,
      verificationToken: mailResult.queued ? null : tokenPair.raw
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'db error' });
  }
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'missing fields' });

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const result = await pool.query(
      `SELECT id, email, password_hash, first_name, last_name, role, is_verified,
              country_region, address, apartment, city, state, pincode, phone
       FROM users
       WHERE email = $1`,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      // Fallback: allow an admin login using env vars for first-time bootstrap
      const ADMIN_EMAIL = (process.env.ADMIN_NOTIFICATION_EMAIL || '').trim().toLowerCase();
      const ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || '';

      if (ADMIN_EMAIL && ADMIN_DEFAULT_PASSWORD && normalizedEmail === ADMIN_EMAIL && password === ADMIN_DEFAULT_PASSWORD) {
        // create or ensure admin user exists (idempotent using ON CONFLICT)
        const passwordHash = await bcrypt.hash(String(ADMIN_DEFAULT_PASSWORD), 12);
        const insertRes = await pool.query(
          `INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified)
           VALUES ($1,$2,$3,$4,'admin',true)
           ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', is_verified = true
           RETURNING id, email, password_hash, first_name, last_name, role, is_verified`,
          [normalizedEmail, passwordHash, 'Admin', 'User']
        );

        const newUser = insertRes.rows[0];
        const token = jwt.sign({ userId: newUser.id, role: newUser.role, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({ user: normalizeUserRow(newUser), token });
      }

      return res.status(400).json({ error: 'invalid credentials' });
    }
    const user = result.rows[0];

    if (role && user.role !== role) {
      return res.status(400).json({ error: 'role mismatch' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(400).json({ error: 'invalid credentials' });

    if (user.role === 'user' && !user.is_verified) {
      return res.status(403).json({ error: 'email not verified' });
    }

    const token = jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: normalizeUserRow(user), token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

app.post('/api/auth/request-password-reset', resetRequestLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const userResult = await pool.query('SELECT id, email, first_name FROM users WHERE email = $1', [normalizedEmail]);

    if (!userResult.rows.length) {
      return res.json({ message: 'If account exists, reset instructions were sent.' });
    }

    const user = userResult.rows[0];
    const tokenPair = createTokenPair();

    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1,$2, now() + interval \'1 hour\')',
      [user.id, tokenPair.hash]
    );

    const resetUrl = `${FRONTEND_BASE_URL}/#/reset-password?token=${tokenPair.raw}`;
    // Send password reset email asynchronously; do not block the response on SMTP timeouts.
    sendEmail({
      to: user.email,
      subject: 'Password reset request - Saree Collections',
      text: `You requested a password reset. Use this link: ${resetUrl}\nIf link does not open, use token: ${tokenPair.raw}\nThis token expires in 1 hour.`
    }).catch((err) => console.error('[PASSWORD_RESET_EMAIL_FAIL]', err && err.message));

    return res.json({ message: 'If account exists, reset instructions were sent.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'db error' });
  }
});

app.post('/api/auth/reset-password', resetApplyLimiter, async (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password) {
    return res.status(400).json({ error: 'token and new_password are required' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const found = await pool.query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1
         AND consumed_at IS NULL
         AND expires_at > now()
       ORDER BY id DESC
       LIMIT 1`,
      [tokenHash]
    );

    if (!found.rows.length) {
      return res.status(400).json({ error: 'invalid or expired token' });
    }

    const tokenRow = found.rows[0];
    const passwordHash = await bcrypt.hash(String(new_password), 12);

    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, tokenRow.user_id]);
    await pool.query('UPDATE password_reset_tokens SET consumed_at = now() WHERE id = $1', [tokenRow.id]);

    return res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'db error' });
  }
});

app.post('/api/bookings', requireAuth, async (req, res) => {
  console.log('[BOOKINGS_ROUTE] headers:', req.headers && Object.keys(req.headers));
  console.log('[BOOKINGS_ROUTE] body keys:', req.body && Object.keys(req.body));

  const {
    product_id,
    productId,
    quantity,
    unit_price,
    unitPrice,
    total_amount,
    totalAmount,
    customer_name,
    customerName,
    customer_email,
    customerEmail,
    customer_phone,
    customerPhone,
    customer_address,
    customerAddress,
    upi_id,
    upiId,
    payment_id,
    paymentId,
    payment_time,
    paymentTime,
    payment_screenshot,
    paymentScreenshot,
    status
  } = req.body;

  const resolvedProductId = product_id ?? productId;
  if (!resolvedProductId) return res.status(400).json({ error: 'product_id required' });

  try {
    const userId = req.user.userId;
    const qty = Number(quantity || 1);
    const resolvedUnitPrice = unit_price ?? unitPrice ?? null;
    const resolvedTotalAmount = total_amount ?? totalAmount ?? null;
    const resolvedCustomerName = customer_name ?? customerName ?? null;
    const resolvedCustomerEmail = customer_email ?? customerEmail ?? null;
    const resolvedCustomerPhone = customer_phone ?? customerPhone ?? null;
    const resolvedCustomerAddress = customer_address ?? customerAddress ?? null;
    const resolvedUpiId = upi_id ?? upiId ?? null;
    const resolvedPaymentId = payment_id ?? paymentId ?? null;
    const resolvedPaymentTime = payment_time ?? paymentTime ?? null;
    const resolvedPaymentScreenshot = payment_screenshot ?? paymentScreenshot ?? null;

    const insert = await pool.query(
      `INSERT INTO bookings (
        user_id, product_id, quantity, unit_price, total_amount,
        customer_name, customer_email, customer_phone, customer_address,
        upi_id, payment_id, payment_time, payment_screenshot,
        status, submitted_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now(), now())
      RETURNING id`,
      [
        userId,
        resolvedProductId,
        qty,
        resolvedUnitPrice,
        resolvedTotalAmount,
        resolvedCustomerName,
        resolvedCustomerEmail,
        resolvedCustomerPhone,
        resolvedCustomerAddress,
        resolvedUpiId,
        resolvedPaymentId,
        resolvedPaymentTime,
        resolvedPaymentScreenshot,
        status || 'verification_in_process'
      ]
    );

    const bookingId = insert.rows[0].id;
    const row = await pool.query(`${bookingSelect()} WHERE b.id = $1`, [bookingId]);
    const booking = mapBookingRow(row.rows[0]);

    // Send admin notification asynchronously (fire-and-forget) so booking succeeds even if email fails
    sendEmail({
      to: ADMIN_NOTIFICATION_EMAIL,
      subject: `New order received - ${booking.name}`,
      text: [
        'A customer placed a new order.',
        `Order ID: ${booking.id}`,
        `Customer: ${booking.userName || 'N/A'}`,
        `Email: ${booking.userEmail || 'N/A'}`,
        `Phone: ${booking.userPhone || 'N/A'}`,
        `Address: ${booking.customerAddress || 'N/A'}`,
        `Product: ${booking.name}`,
        `Quantity: ${booking.qty}`,
        `Amount: INR ${booking.totalAmount || booking.price * booking.qty}`,
        `Payment ID: ${booking.paymentId || 'N/A'}`,
        `Payment Time: ${booking.paymentTime || 'N/A'}`
      ].join('\n')
    }).catch((err) => {
      console.error('[BOOKING_EMAIL_FAIL]', ADMIN_NOTIFICATION_EMAIL, err.message);
    });

    // Send booking confirmation email to customer
    if (booking.userEmail) {
      sendEmail({
        to: booking.userEmail,
        subject: 'Order Confirmation - Saree Collections',
        text: [
          `Hi ${booking.userName || 'Dear Customer'},`,
          '',
          'Thank you for your order! We have received your booking and it is awaiting admin verification.',
          '',
          '--- Order Details ---',
          `Order ID: ${booking.id}`,
          `Product: ${booking.name}`,
          `Quantity: ${booking.qty}`,
          `Unit Price: INR ${booking.price}`,
          `Total Amount: INR ${booking.totalAmount || booking.price * booking.qty}`,
          `Payment ID: ${booking.paymentId || 'Pending'}`,
          '',
          '--- Delivery Address ---',
          `${booking.customerAddress || 'N/A'}`,
          '',
          'We will notify you once the admin has verified and approved your order. Expected delivery: 4-7 business days.',
          '',
          'If you have any questions, please reply to this email or contact support.',
          '',
          'Best regards,',
          'Saree Collections Team'
        ].join('\n')
      }).catch((err) => {
        console.error('[BOOKING_USER_EMAIL_FAIL]', booking.userEmail, err.message);
      });
    }

    return res.status(201).json(booking);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'db error' });
  }
});

app.get('/api/bookings', requireAuth, async (req, res) => {
  const { userId } = req.query;
  try {
    if (!['admin', 'staff'].includes(req.user.role)) {
      const result = await pool.query(
        `${bookingSelect()} WHERE b.user_id = $1 ORDER BY b.submitted_at DESC`,
        [req.user.userId]
      );
      return res.json(result.rows.map(mapBookingRow));
    }

    if (userId) {
      const result = await pool.query(
        `${bookingSelect()} WHERE b.user_id = $1 ORDER BY b.submitted_at DESC`,
        [userId]
      );
      return res.json(result.rows.map(mapBookingRow));
    }

    const result = await pool.query(`${bookingSelect()} ORDER BY b.submitted_at DESC`);
    return res.json(result.rows.map(mapBookingRow));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'db error' });
  }
});

app.patch('/api/bookings/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { delivery_eta, admin_note } = req.body || {};

  try {
    const updated = await pool.query(
      `UPDATE bookings
       SET status = 'confirmed', delivery_eta = $1, admin_note = $2, approved_at = now(), updated_at = now()
       WHERE id = $3
       RETURNING id`,
      [delivery_eta || '4-7 business days', admin_note || null, id]
    );

    if (!updated.rows.length) {
      return res.status(404).json({ error: 'booking not found' });
    }

    const row = await pool.query(`${bookingSelect()} WHERE b.id = $1`, [id]);
    const booking = mapBookingRow(row.rows[0]);

    if (booking.userEmail) {
      sendEmail({
        to: booking.userEmail,
        subject: 'Your order is confirmed - Saree Collections',
        text: [
          `Hi ${booking.userName || 'Customer'},`,
          '',
          `Your order #${booking.id} has been confirmed by admin.`,
          `Product: ${booking.name}`,
          `Estimated delivery: ${booking.deliveryEta || '4-7 business days'}`,
          booking.adminNote ? `Note from admin: ${booking.adminNote}` : '',
          '',
          'Thank you for shopping with Saree Collections.'
        ].filter(Boolean).join('\n')
      }).catch((err) => {
        console.error('[APPROVE_EMAIL_FAIL]', booking.userEmail, err.message);
      });
    }

    return res.json(booking);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'db error' });
  }
});

app.patch('/api/bookings/:id/reject', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { admin_note } = req.body || {};

  try {
    const updated = await pool.query(
      `UPDATE bookings
       SET status = 'rejected', admin_note = $1, updated_at = now()
       WHERE id = $2
       RETURNING id`,
      [admin_note || null, id]
    );

    if (!updated.rows.length) {
      return res.status(404).json({ error: 'booking not found' });
    }

    const row = await pool.query(`${bookingSelect()} WHERE b.id = $1`, [id]);
    const booking = mapBookingRow(row.rows[0]);

    if (booking.userEmail) {
      sendEmail({
        to: booking.userEmail,
        subject: 'Order update - Saree Collections',
        text: [
          `Hi ${booking.userName || 'Customer'},`,
          '',
          `Your order #${booking.id} could not be approved at this time.`,
          booking.adminNote ? `Note from admin: ${booking.adminNote}` : '',
          '',
          'Please contact support for assistance.'
        ].filter(Boolean).join('\n')
      }).catch((err) => {
        console.error('[REJECT_EMAIL_FAIL]', booking.userEmail, err.message);
      });
    }

    return res.json(booking);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'db error' });
  }
});

app.patch('/api/bookings/:id/shipment', requireAuth, requireBackOffice, async (req, res) => {
  const { id } = req.params;
  const { shipment_status } = req.body || {};

  if (!shipment_status || !['pending', 'shipped', 'delivered'].includes(shipment_status)) {
    return res.status(400).json({ error: 'invalid shipment status' });
  }

  try {
    const updated = await pool.query(
      `UPDATE bookings
       SET shipment_status = $1, updated_at = now()
       WHERE id = $2
       RETURNING id`,
      [shipment_status, id]
    );

    if (!updated.rows.length) {
      return res.status(404).json({ error: 'booking not found' });
    }

    const row = await pool.query(`${bookingSelect()} WHERE b.id = $1`, [id]);
    const booking = mapBookingRow(row.rows[0]);

    if (booking.userEmail) {
      let subject = '';
      let message = '';

      if (shipment_status === 'shipped') {
        subject = 'Your order has been shipped - Saree Collections';
        message = `Your order #${booking.id} (${booking.name}) has been shipped! You can now track your delivery. Expected delivery: ${booking.deliveryEta || '4-7 business days'}`;
      } else if (shipment_status === 'delivered') {
        subject = 'Your order has been delivered - Please rate - Saree Collections';
        message = `Your order #${booking.id} (${booking.name}) has been delivered! Thank you for your purchase. We would love to hear your feedback - please rate this product to help other customers.`;
      }

      if (subject && message) {
        sendEmail({
          to: booking.userEmail,
          subject,
          text: [
            `Hi ${booking.userName || 'Customer'},`,
            '',
            message,
            '',
            'Thank you for shopping with Saree Collections.'
          ].join('\n')
        }).catch((err) => {
          console.error('[SHIPMENT_EMAIL_FAIL]', booking.userEmail, err.message);
        });
      }
    }

    return res.json(booking);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'db error' });
  }
});

app.post('/api/ratings', requireAuth, async (req, res) => {
  const { booking_id, product_id, rating, review } = req.body;
  if (!booking_id || !product_id || !rating) return res.status(400).json({ error: 'missing fields' });
  try {
    const result = await pool.query(
      'INSERT INTO ratings (booking_id, product_id, user_id, rating, review) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [booking_id, product_id, req.user.userId, rating, review || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

app.get('/api/ratings', async (req, res) => {
  const { productId } = req.query;
  try {
    if (productId) {
      const result = await pool.query('SELECT * FROM ratings WHERE product_id = $1 ORDER BY created_at DESC', [productId]);
      return res.json(result.rows);
    }
    const result = await pool.query('SELECT * FROM ratings ORDER BY created_at DESC');
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'db error' });
  }
});

// Submit a return/exchange request (accepts file uploads)
app.post('/api/returns', upload.fields([{ name: 'videos', maxCount: 5 }, { name: 'photos', maxCount: 5 }]), async (req, res) => {
  try {
    const body = req.body || {};
    const files = req.files || {};

    const customer_name = body.customerName || body.customer_name || null;
    const whatsapp = body.whatsappNumber || body.whatsapp || null;
    const email = body.emailAddress || body.email || null;
    const order_number = body.orderNumber || body.order_number || null;
    const product_code = body.productCode || body.product_code || null;
    const purchase_date = body.purchaseDate || body.purchase_date || null;
    const issue_type = body.issueType || body.issue_type || null;
    const description = body.problemDescription || body.description || null;
    const preferred_solution = body.preferredSolution || body.preferred_solution || null;

    const videoFiles = (files.videos || []).map((f) => ({ filename: f.filename, path: `/uploads/returns/${f.filename}`, mimetype: f.mimetype, size: f.size }));
    const photoFiles = (files.photos || []).map((f) => ({ filename: f.filename, path: `/uploads/returns/${f.filename}`, mimetype: f.mimetype, size: f.size }));

    const insert = await pool.query(
      `INSERT INTO returns (
        user_id, customer_name, whatsapp, email, order_number, product_code,
        purchase_date, issue_type, description, video_files, photo_files, preferred_solution, status, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending', now(), now()) RETURNING id`,
      [req.user ? req.user.userId : null, customer_name, whatsapp, email, order_number, product_code, purchase_date || null, issue_type, description, JSON.stringify(videoFiles), JSON.stringify(photoFiles), preferred_solution]
    );

    const id = insert.rows[0].id;

    // notify admin
    const filesList = [...videoFiles, ...photoFiles].map((f) => `${FRONTEND_BASE_URL.replace(/\/$/, '')}${f.path}`).join('\n') || 'No files uploaded';
    sendEmail({
      to: ADMIN_NOTIFICATION_EMAIL,
      subject: `New Return/Exchange Request - Order ${order_number || 'N/A'}`,
      text: [
        'A customer submitted a return/exchange request.',
        `Request ID: ${id}`,
        `Customer: ${customer_name || 'N/A'}`,
        `WhatsApp: ${whatsapp || 'N/A'}`,
        `Email: ${email || 'N/A'}`,
        `Order Number: ${order_number || 'N/A'}`,
        `Product Code: ${product_code || 'N/A'}`,
        `Issue: ${issue_type || 'N/A'}`,
        `Description: ${description || 'N/A'}`,
        '',
        'Uploaded files (accessible from backend):',
        filesList
      ].join('\n')
    }).catch((err) => console.error('[RETURN_EMAIL_FAIL]', err && err.message));

    return res.status(201).json({ id, message: 'Return request submitted' });
  } catch (err) {
    console.error('returns submit error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Get return requests (admin sees all; users see their own if authenticated)
app.get('/api/returns', authMiddleware, async (req, res) => {
  try {
    if (req.user && req.user.role === 'admin') {
      const result = await pool.query('SELECT * FROM returns ORDER BY created_at DESC');
      return res.json(result.rows);
    }
    if (!req.user) return res.status(401).json({ error: 'authentication required' });
    const result = await pool.query('SELECT * FROM returns WHERE user_id = $1 ORDER BY created_at DESC', [req.user.userId]);
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'db error' });
  }
});

// Approve a return request (admin)
app.patch('/api/returns/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { refund_details, admin_note, delivery_update } = req.body || {};
  try {
    const existing = await pool.query('SELECT id, status FROM returns WHERE id = $1', [id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'not found' });
    if (existing.rows[0].status !== 'pending') {
      return res.status(409).json({ error: `request already ${existing.rows[0].status}` });
    }

    const updated = await pool.query(
      `UPDATE returns
       SET status = 'approved', admin_note = $1, approved_at = now(), refund_details = $2, updated_at = now()
       WHERE id = $3 AND status = 'pending'
       RETURNING *`,
      [admin_note || null, refund_details || delivery_update || null, id]
    );
    if (!updated.rows.length) return res.status(409).json({ error: 'request already processed' });
    const row = updated.rows[0];

    if (row.email) {
      sendEmail({
        to: row.email,
        subject: 'Return Request Approved - Saree Collections',
        text: [
          `Hi ${row.customer_name || 'Customer'},`,
          '',
          `Your return/exchange request (ID: ${row.id}) has been approved.`,
          refund_details ? `Refund details: ${refund_details}` : (delivery_update ? `Delivery update: ${delivery_update}` : ''),
          admin_note ? `Note from admin: ${admin_note}` : '',
          '',
          'If you have further questions, please reply to this email.'
        ].filter(Boolean).join('\n')
      }).catch((err) => console.error('[RETURN_APPROVE_EMAIL_FAIL]', err && err.message));
    }

    return res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'db error' });
  }
});

// Reject a return request (admin)
app.patch('/api/returns/:id/reject', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { admin_note } = req.body || {};
  try {
    const existing = await pool.query('SELECT id, status FROM returns WHERE id = $1', [id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'not found' });
    if (existing.rows[0].status !== 'pending') {
      return res.status(409).json({ error: `request already ${existing.rows[0].status}` });
    }

    const updated = await pool.query(
      `UPDATE returns
       SET status = 'rejected', admin_note = $1, updated_at = now()
       WHERE id = $2 AND status = 'pending'
       RETURNING *`,
      [admin_note || null, id]
    );
    if (!updated.rows.length) return res.status(409).json({ error: 'request already processed' });
    const row = updated.rows[0];

    if (row.email) {
      sendEmail({
        to: row.email,
        subject: 'Return Request Update - Saree Collections',
        text: [
          `Hi ${row.customer_name || 'Customer'},`,
          '',
          `Your return/exchange request (ID: ${row.id}) could not be approved.`,
          admin_note ? `Note from admin: ${admin_note}` : '',
          '',
          'Please contact support for assistance.'
        ].filter(Boolean).join('\n')
      }).catch((err) => console.error('[RETURN_REJECT_EMAIL_FAIL]', err && err.message));
    }

    return res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'db error' });
  }
});

const PORT = process.env.PORT || 4000;

// Test database connection
(async () => {
  try {
    const result = await pool.query('SELECT 1');
    console.log('✓ Database connection successful');
  } catch (err) {
    console.error('✗ Database connection failed:', err.message);
    console.error('Check that PostgreSQL is running and .env is configured correctly');
    console.error('Expected host:', process.env.PGHOST || 'localhost');
    console.error('Expected port:', process.env.PGPORT || 5432);
    console.error('Expected database:', process.env.PGDATABASE || 'saree_collections');
  }
})();

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
