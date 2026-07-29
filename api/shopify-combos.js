export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase credentials missing' });
  }

  try {
    if (req.method === 'GET') {
      const dbRes = await fetch(
        `${supabaseUrl}/rest/v1/shopify_combos?is_active=eq.true&order=updated_at.desc`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const data = await dbRes.json();
      return res.status(200).json({ combos: data || [] });
    }

    if (req.method === 'POST') {
      const {
        product_id,
        product_title,
        product_handle,
        combo_count,
        combo_price,
        discount_code,
        price_rule_id,
        price_rule_title,
        is_active = true
      } = req.body;

      if (!product_id || !combo_count || !combo_price) {
        return res.status(400).json({ error: 'product_id, combo_count, and combo_price are required' });
      }

      const upsertRes = await fetch(
        `${supabaseUrl}/rest/v1/shopify_combos`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=representation'
          },
          body: JSON.stringify({
            product_id,
            product_title,
            product_handle,
            combo_count,
            combo_price,
            discount_code,
            price_rule_id,
            price_rule_title,
            is_active,
            updated_at: new Date().toISOString()
          })
        }
      );

      const saved = await upsertRes.json();
      return res.status(200).json({ success: true, combo: saved });
    }

    if (req.method === 'DELETE') {
      const { id, price_rule_id } = req.query;
      let filter = id ? `id=eq.${id}` : (price_rule_id ? `price_rule_id=eq.${price_rule_id}` : null);
      if (!filter) {
        return res.status(400).json({ error: 'id or price_rule_id required' });
      }

      const delRes = await fetch(
        `${supabaseUrl}/rest/v1/shopify_combos?${filter}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        }
      );
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('shopify_combos API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
