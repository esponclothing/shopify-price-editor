const { Client } = require('pg');

const connectionString = 'postgres://postgres:11fit@202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres';

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function setup() {
  try {
    await client.connect();
    console.log('Connected to Supabase DB successfully!');

    await client.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_executions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
        phone TEXT,
        user_message TEXT,
        ai_reply TEXT,
        status TEXT NOT NULL,
        tools_called TEXT,
        error_message TEXT,
        duration_ms INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_whatsapp_executions_created_at ON whatsapp_executions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_executions_phone ON whatsapp_executions(phone);
    `);
    console.log('Created whatsapp_executions table successfully!');

  } catch (err) {
    console.error('Error executing setup SQL:', err);
  } finally {
    await client.end();
  }
}

setup();
