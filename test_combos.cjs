const axios = require('./node_modules/axios/dist/node/axios.cjs');

const SUPABASE_URL = 'https://xkiukbebnntjzfilyfmh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhraXVrYmVibm50anpmaWx5Zm1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIyMjExOCwiZXhwIjoyMTAwNzk4MTE4fQ.bqc4x9ok4pgmcffKPpj-BOUELvAli5weCJtwuL4X7Rc';
const SHOPIFY_STORE_URL = 'i2tu0d-jc.myshopify.com';
// Get from .env or hardcode for test
const SHOPIFY_ACCESS_TOKEN = process.env.VITE_SHOPIFY_ACCESS_TOKEN || '';

async function test() {
  console.log('\n=== STEP 1: Supabase Combos ===');
  const dbRes = await axios.get(
    `${SUPABASE_URL}/rest/v1/shopify_combos?is_active=eq.true&order=updated_at.desc`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const dbCombos = dbRes.data || [];
  console.log(`Found ${dbCombos.length} active combos:`);
  dbCombos.forEach(c => {
    console.log(`  - "${c.product_title}" | product_id: ${c.product_id} | Pack of ${c.combo_count} @ ₹${c.combo_price}`);
  });

  console.log('\n=== STEP 2: Shopify GraphQL Products + Metafields ===');
  if (!SHOPIFY_ACCESS_TOKEN) {
    console.log('No Shopify token available for local test. Skipping GraphQL.');
  } else {
    const query = `
      query { products(first: 20, query: "status:active") { edges { node {
        id title handle
        metafields(identifiers: [{key: "combo_config", namespace: "custom"}]) { value }
      }}}}
    `;
    const gRes = await axios.post(
      `https://${SHOPIFY_STORE_URL}/admin/api/2024-10/graphql.json`,
      { query },
      { headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN, 'Content-Type': 'application/json' } }
    );
    const edges = gRes.data?.data?.products?.edges || [];
    console.log(`Shopify returned ${edges.length} products`);
    edges.forEach(e => {
      const rawId = String(e.node.id).replace(/\D/g, '');
      const meta = e.node.metafields?.[0]?.value;
      const dbMatch = dbCombos.find(c => String(c.product_id) === rawId);
      if (meta || dbMatch) {
        console.log(`  ✅ "${e.node.title}" (id: ${rawId})`);
        console.log(`     Metafield: ${meta ? meta.substring(0, 100) : 'NONE'}`);
        console.log(`     DB Match: ${dbMatch ? `YES ₹${dbMatch.combo_price}` : 'NO'}`);
      }
    });
  }

  console.log('\n=== STEP 3: Simulate AI message "which combos" ===');
  console.log('isComboSearch test for "which combos you have":', /combo|trio|pack|offer|deal|discount/i.test('which combos you have'));
  console.log('isComboSearch test for "now have any active combos":', /combo|trio|pack|offer|deal|discount/i.test('now have any active combos'));
}

test().catch(console.error);
