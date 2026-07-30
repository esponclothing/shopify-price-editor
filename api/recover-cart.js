import pg from 'pg';
const { Client } = pg;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const sessionId = req.query.id;

  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'Session ID is required.' });
  }

  const dbUrl = process.env.SUPABASE_NFU_DB_URL || 'postgres://postgres.nfubnpgfwgrlpfhcbjlg:11fit@202612@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres';

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  try {
    await client.connect();

    const queryRes = await client.query(
      'SELECT cart_details FROM checkout_sessions WHERE id = $1 LIMIT 1',
      [sessionId]
    );

    await client.end();

    if (queryRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Cart session not found.' });
    }

    const cartDetails = queryRes.rows[0].cart_details;

    if (!cartDetails || !cartDetails.items) {
      return res.status(404).json({ success: false, error: 'Cart items not found in session.' });
    }

    // Return the items array so the frontend can easily map over it and add to cart
    return res.status(200).json({
      success: true,
      items: cartDetails.items
    });

  } catch (error) {
    try { await client.end(); } catch (_) {}
    console.error('Recover Cart API Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to recover cart.' });
  }
}
