const axios = require('axios');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const storeUrl = envFile.match(/VITE_SHOPIFY_STORE_URL=(.+)/)[1].trim();
const accessToken = envFile.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.+)/)[1].trim();

const GRAPHQL_URL = `https://${storeUrl}/admin/api/2024-04/graphql.json`;

const htmlDescription = `
<div class="espon-desc-wrap">
  <div class="espon-b2b-box">
    <h4>The B2B Factory Advantage</h4>
    <p><span>Wholesale (WSP):</span> ₹220.00</p>
    <p><span>Retail (MRP):</span> ₹440.00</p>
    <p><span>Your Margin:</span> 50% flat profit on every sale.</p>
    <p style="margin-top: 10px; font-size: 0.85rem; color: #64748b;">🎯 <strong>Policy:</strong> Sold exclusively in Sets of 4 (Sizes M, L, XL, XXL).</p>
  </div>
  <div class="b2b-accordion-wrapper">
    <div class="acc-item active">
      <button class="acc-header" onclick="toggleAccordion(this)"><span>Product Details</span><i class="fa-solid fa-minus acc-icon"></i></button>
      <div class="acc-body" style="max-height: 2000px;">
        <div class="acc-body-inner">
          <div class="espon-spec-row">
            <div class="espon-spec-name">Article Code</div>
            <div class="espon-spec-val">ART E0025</div>
          </div>
          <div class="espon-spec-row">
            <div class="espon-spec-name">Material</div>
            <div class="espon-spec-val">Air-Lite NS 15% Lycra</div>
          </div>
          <div class="espon-spec-row">
            <div class="espon-spec-name">Fabric Profile</div>
            <div class="espon-spec-val">Engineered 4-way stretch Air-Lite NS for maximum flexibility, durability, and a lightweight breathable feel.</div>
          </div>
          <div class="espon-spec-row">
            <div class="espon-spec-name">Design Features</div>
            <div class="espon-spec-val">
              <ul>
                <li>Lightweight & Breathable construction for ultimate comfort.</li>
                <li>Elasticated waistband with adjustable inner drawcords.</li>
                <li>Deep, functional side pockets with subtle branding details.</li>
                <li>Clean, tapered athletic fit.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="acc-item">
      <button class="acc-header" onclick="toggleAccordion(this)"><span>Description</span><i class="fa-solid fa-plus acc-icon"></i></button>
      <div class="acc-body">
        <div class="acc-body-inner">
          <p>Designed for peak performance and everyday utility, the <strong>Air-Lite Lightweight Track Pant (E0025)</strong> is an essential addition to any activewear catalog. Crafted from our signature Air-Lite NS fabric with 15% Lycra, this garment offers exceptional breathability and 4-way stretch flexibility. The modern aesthetic and tailored fit make it a premium choice. Priced for wholesale with extreme retail margin potential.</p>
        </div>
      </div>
    </div>
    <div class="acc-item">
      <button class="acc-header" onclick="toggleAccordion(this)"><span>Delivery &amp; Dispatch</span><i class="fa-solid fa-plus acc-icon"></i></button>
      <div class="acc-body">
        <div class="acc-body-inner"><p>Dispatch: 24-48 Hours.<br>Courier: Blue Dart, Delhivery, VRL.</p></div>
      </div>
    </div>
  </div>
</div>
`;

const productData = {
  product: {
    title: 'Air-Lite NS 15% Lycra Track Pant (Art E0025)',
    body_html: htmlDescription,
    vendor: 'Espon Sports',
    product_type: 'Track Pants',
    tags: 'B2B, Track Pant, Air-lite, Lycra, E0025, Wholesale, Lightweight',
    status: 'active',
    options: [
      { name: 'Color' },
      { name: 'Set Size' }
    ],
    variants: [
      { option1: 'Khaki', option2: 'M-XXL (Pack of 4)', price: '880.00', compare_at_price: '1760.00', sku: 'E0025-KHA', grams: 1200, inventory_policy: 'deny', inventory_management: 'shopify', requires_shipping: true, taxable: true },
      { option1: 'Olive Green', option2: 'M-XXL (Pack of 4)', price: '880.00', compare_at_price: '1760.00', sku: 'E0025-OLV', grams: 1200, inventory_policy: 'deny', inventory_management: 'shopify', requires_shipping: true, taxable: true },
      { option1: 'Dark Grey', option2: 'M-XXL (Pack of 4)', price: '880.00', compare_at_price: '1760.00', sku: 'E0025-DGRY', grams: 1200, inventory_policy: 'deny', inventory_management: 'shopify', requires_shipping: true, taxable: true },
      { option1: 'Navy Blue', option2: 'M-XXL (Pack of 4)', price: '880.00', compare_at_price: '1760.00', sku: 'E0025-NVY', grams: 1200, inventory_policy: 'deny', inventory_management: 'shopify', requires_shipping: true, taxable: true },
      { option1: 'Black', option2: 'M-XXL (Pack of 4)', price: '880.00', compare_at_price: '1760.00', sku: 'E0025-BLK', grams: 1200, inventory_policy: 'deny', inventory_management: 'shopify', requires_shipping: true, taxable: true },
      { option1: 'Light Grey', option2: 'M-XXL (Pack of 4)', price: '880.00', compare_at_price: '1760.00', sku: 'E0025-LGRY', grams: 1200, inventory_policy: 'deny', inventory_management: 'shopify', requires_shipping: true, taxable: true }
    ]
  }
};

async function executeGraphQL(query, variables = {}) {
  const response = await axios.post(GRAPHQL_URL, { query, variables }, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    }
  });
  if (response.data.errors) {
    throw new Error(JSON.stringify(response.data.errors));
  }
  return response.data.data;
}

async function createProduct() {
  try {
    console.log('Creating Product E0025 via REST API...');
    const response = await axios.post(`https://${storeUrl}/admin/api/2024-04/products.json`, productData, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });
    
    const newProductId = response.data.product.id;
    console.log('✅ Product created successfully! ID:', newProductId);
    
    console.log('Fetching Primary Location...');
    const locationData = await executeGraphQL(`{ locations(first: 1) { edges { node { id } } } }`);
    const locationId = locationData.locations.edges[0].node.id;
    
    console.log('Fetching Variants for Inventory Update...');
    const pData = await executeGraphQL(`
      query {
        product(id: "gid://shopify/Product/${newProductId}") {
          variants(first: 50) {
            edges { node { inventoryItem { id } } }
          }
        }
      }
    `);

    const variants = pData.product.variants.edges;
    console.log(`Setting inventory to 50 for ${variants.length} variants...`);

    for (const edge of variants) {
      const inventoryItemId = edge.node.inventoryItem.id;
      await executeGraphQL(`
        mutation inventorySetOnHandQuantities($input: InventorySetOnHandQuantitiesInput!) {
          inventorySetOnHandQuantities(input: $input) {
            userErrors { field message }
          }
        }`, {
          input: {
            reason: "correction",
            setQuantities: [{
              inventoryItemId: inventoryItemId,
              locationId: locationId,
              quantity: 50
            }]
          }
        }
      );
    }
    
    console.log('✅ All inventory set successfully!');
  } catch (error) {
    console.error('❌ Error:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
  }
}

createProduct();
