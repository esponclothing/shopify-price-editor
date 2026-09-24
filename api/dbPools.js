import pg from 'pg';
const { Pool } = pg;

// Shared, resource-efficient connection pools with low concurrency and quick idle cleanup
export const poolEditor = new Pool({
  connectionString: process.env.RAILWAY_DATABASE_URL || 'postgresql://postgres:gEeINngvmFomRYZljhTrKNkKrrjlcrfQ@altaria.proxy.rlwy.net:33107/railway',
  ssl: { rejectUnauthorized: false },
  max: 3, // Max 3 active connections
  min: 0,
  idleTimeoutMillis: 15000, // Close idle sockets after 15s to save RAM & DB CPU
  connectionTimeoutMillis: 5000
});

export const poolCheckout = new Pool({
  connectionString: process.env.CHECKOUT_DATABASE_URL || 'postgresql://postgres:zXuyDwmBoMwdHnUqoFMUIkkKILuEcaas@reseau.proxy.rlwy.net:12168/railway',
  ssl: { rejectUnauthorized: false },
  max: 3,
  min: 0,
  idleTimeoutMillis: 15000,
  connectionTimeoutMillis: 5000
});

// Graceful pool cleanup on server shutdown
export async function closePools() {
  try {
    await Promise.all([poolEditor.end(), poolCheckout.end()]);
  } catch (_) {}
}
