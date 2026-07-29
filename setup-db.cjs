const { Client } = require('pg');

const connectionString = 'postgres://postgres:11fit@202612@db.nfubnpgfwgrlpfhcbjlg.supabase.co:5432/postgres';

const client = new Client({
  connectionString,
});

async function setup() {
  try {
    await client.connect();
    console.log('Connected to Supabase DB successfully!');

    // Create network_users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS network_users (
        phone TEXT PRIMARY KEY,
        first_name TEXT,
        last_name TEXT,
        address1 TEXT,
        address2 TEXT,
        city TEXT,
        province TEXT,
        zip TEXT,
        country TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
      );
    `);
    console.log('Created network_users table');

    // Create network_devices table
    await client.query(`
      CREATE TABLE IF NOT EXISTS network_devices (
        device_id TEXT PRIMARY KEY,
        phone TEXT REFERENCES network_users(phone),
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
      );
    `);
    console.log('Created network_devices table');

    // Also create the otp_analytics table since we updated the code for it earlier
    await client.query(`
      CREATE TABLE IF NOT EXISTS otp_analytics (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
        phone TEXT NOT NULL,
        ip_address TEXT,
        status TEXT NOT NULL,
        store TEXT
      );
    `);
    console.log('Created otp_analytics table');

  } catch (err) {
    console.error('Error executing setup SQL:', err);
  } finally {
    await client.end();
  }
}

setup();
