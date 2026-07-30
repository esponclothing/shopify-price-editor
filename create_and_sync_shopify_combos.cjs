const { Client } = require('pg');
const axios = require('axios');

const CONNECTION_STRING = 'postgres://postgres:11fit@202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres';
const SHOPIFY_STORE_URL = 'i2tu0d-jc.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = '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';

async function createAndSyncCombos() {
  const client = new Client({
    connectionString: CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to Supabase Postgres...');
    await client.connect();

    console.log('Creating shopify_combos table if not exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS shopify_combos (
        id BIGSERIAL PRIMARY KEY,
        product_id BIGINT NOT NULL,
        product_title TEXT,
        product_handle TEXT,
        combo_count INT NOT NULL,
        combo_price NUMERIC(10, 2) NOT NULL,
        discount_code TEXT,
        price_rule_id BIGINT,
        price_rule_title TEXT UNIQUE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_shopify_combos_product_id ON shopify_combos(product_id);
      CREATE INDEX IF NOT EXISTS idx_shopify_combos_active ON shopify_combos(is_active);
    `);

    console.log('Table shopify_combos ready. Fetching Shopify price rules...');
    const res = await axios.get(
      `https://${SHOPIFY_STORE_URL}/admin/api/2024-04/price_rules.json`,
      { headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN } }
    );
    const rules = (res.data?.price_rules || []).filter(r => r.title.startsWith('COMBO_PR_'));

    console.log(`Found ${rules.length} COMBO_PR_ price rules in Shopify.`);

    for (const r of rules) {
      const prodId = r.entitled_product_ids?.[0];
      const count = r.prerequisite_quantity_range?.greater_than_or_equal_to || 1;
      let prodTitle = `Product #${prodId}`;
      let prodHandle = '';
      let comboPrice = 0;

      if (prodId) {
        try {
          const prodRes = await axios.get(
            `https://${SHOPIFY_STORE_URL}/admin/api/2024-04/products/${prodId}.json`,
            { headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN } }
          );
          const p = prodRes.data?.product;
          if (p) {
            prodTitle = p.title;
            prodHandle = p.handle;
            const singlePrice = parseFloat(p.variants?.[0]?.price || '499');
            const discountVal = Math.abs(parseFloat(r.value || '0'));
            comboPrice = Math.max(1, (singlePrice * count) - discountVal);
          }
        } catch (e) {
          console.warn(`Could not fetch product ${prodId} details:`, e.message);
        }
      }

      const discountCode = `11FIT-COMBO-${prodId}-${count}`;

      await client.query(
        `INSERT INTO shopify_combos (
          product_id, product_title, product_handle, combo_count, combo_price, discount_code, price_rule_id, price_rule_title, is_active, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW())
        ON CONFLICT (price_rule_title) DO UPDATE SET
          product_id = EXCLUDED.product_id,
          product_title = EXCLUDED.product_title,
          product_handle = EXCLUDED.product_handle,
          combo_count = EXCLUDED.combo_count,
          combo_price = EXCLUDED.combo_price,
          discount_code = EXCLUDED.discount_code,
          price_rule_id = EXCLUDED.price_rule_id,
          is_active = true,
          updated_at = NOW();`,
        [prodId, prodTitle, prodHandle, count, comboPrice, discountCode, r.id, r.title]
      );
      console.log(`Synced combo: ${prodTitle} (${count} for ₹${comboPrice}) -> Code: ${discountCode}`);
    }

    // Print all rows in table
    const check = await client.query(`SELECT * FROM shopify_combos ORDER BY created_at DESC`);
    console.log('\nCurrent rows in shopify_combos DB table:');
    console.table(check.rows.map(r => ({
      ID: r.id,
      Product: r.product_title,
      Count: r.combo_count,
      Price: r.combo_price,
      Code: r.discount_code
    })));

  } catch (err) {
    console.error('Error creating/syncing shopify_combos table:', err.message);
  } finally {
    await client.end();
  }
}

createAndSyncCombos();
