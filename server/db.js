require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

// Build secure SSL options for production when DATABASE_URL is used.
const buildSslOptions = () => {
  // In production we want to verify the server certificate by default.
  const ssl = { rejectUnauthorized: process.env.NODE_ENV === 'production' };

  // Optional: provide a CA root certificate if the provider requires it.
  const caPath = process.env.PG_SSL_ROOT_CERT_PATH || process.env.PGSSLROOTCERT;
  if (caPath) {
    try {
      ssl.ca = fs.readFileSync(caPath, 'utf8');
    } catch (err) {
      console.warn('[DB] Failed to read PG SSL root cert at', caPath, err && err.message);
    }
  }

  return ssl;
};

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: buildSslOptions()
    }
  : {
      host: process.env.PGHOST || 'localhost',
      port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      database: process.env.PGDATABASE || 'saree_collections',
      ssl: process.env.NODE_ENV === 'production' ? buildSslOptions() : undefined
    };

const pool = new Pool(poolConfig);

module.exports = pool;
