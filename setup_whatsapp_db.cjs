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
      CREATE TABLE IF NOT EXISTS whatsapp_chat_memory (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        phone TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_memory_phone ON whatsapp_chat_memory(phone);
    `);
    console.log('Created whatsapp_chat_memory table successfully!');

  } catch (err) {
    console.error('Error executing setup SQL:', err);
  } finally {
    await client.end();
  }
}

setup();
