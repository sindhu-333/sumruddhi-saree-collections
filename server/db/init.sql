-- Database schema for Saree Collections

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  country_region TEXT,
  address TEXT,
  apartment TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  phone TEXT,
  role TEXT DEFAULT 'user',
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2),
  fabric TEXT,
  category TEXT,
  images JSONB,
  details JSONB,
  is_new BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(10,2),
  total_amount NUMERIC(10,2),
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  upi_id TEXT,
  payment_id TEXT,
  payment_time TEXT,
  payment_screenshot TEXT,
  submitted_at TIMESTAMP DEFAULT now(),
  delivery_eta TEXT,
  admin_note TEXT,
  approved_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT now(),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ratings (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS country_region TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS apartment TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pincode TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS upi_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_time TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_screenshot TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP DEFAULT now();
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS delivery_eta TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();

ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS shipment_status TEXT DEFAULT 'pending';
