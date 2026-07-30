const axios = require('axios');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const storeUrl = envFile.match(/VITE_SHOPIFY_STORE_URL=(.+)/)[1].trim();
const accessToken = envFile.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.+)/)[1].trim();

const PRODUCT_ID = '10399182618756';
const GRAPHQL_URL = `https://${storeUrl}/admin/api/2024-04/graphql.json`;

const amazingDescriptionHTML = `
<div class="espon-desc-wrap">
  <div class="espon-b2b-box">
    <h4>The B2B Factory Advantage</h4>
    <p><span>Wholesale (WSP):</span> ₹249.50</p>
    <p><span>Retail (MRP):</span> ₹499.00</p>
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
            <div class="espon-spec-val">ART E0024</div>
          </div>
          <div class="espon-spec-row">
            <div class="espon-spec-name">Material</div>
            <div class="espon-spec-val">Air-Lite NS 15% Lycra</div>
          </div>
          <div class="espon-spec-row">
            <div class="espon-spec-name">Fabric Profile</div>
            <div class="espon-spec-val">Engineered 4-way stretch Air-Lite NS for maximum flexibility, durability, and breathability.</div>
          </div>
          <div class="espon-spec-row">
            <div class="espon-spec-name">Design Features</div>
            <div class="espon-spec-val">
              <ul>
                <li>Deep, functional cargo side pockets for secure storage and a streetwear aesthetic.</li>
                <li>Elasticated waistband with adjustable drawcords.</li>
                <li>Tapered modern fit for an elevated athletic silhouette.</li>
                <li>Moisture-wicking properties for high performance.</li>
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
          <p>Designed for peak performance and everyday utility, the <strong>Air-Lite Cargo Track Pant (E0024)</strong> is an essential addition to any activewear catalog. Crafted from our signature Air-Lite NS fabric with 15% Lycra, this garment offers exceptional breathability and 4-way stretch flexibility. The modern cargo pockets provide a streetwear edge while keeping the fit sharp and tailored. Priced for wholesale with extreme retail margin potential.</p>
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

async function updateProductAndInventory() {
  try {
    console.log('Fetching Product details and Primary Location...');
    
    // 1. Get Location ID
    const locationData = await executeGraphQL(`{ locations(first: 1) { edges { node { id } } } }`);
    const locationId = locationData.locations.edges[0].node.id;
    
    // 2. Update Description
    console.log('Updating Description...');
    await executeGraphQL(`
      mutation productUpdate($input: ProductInput!) {
        productUpdate(input: $input) { product { id } userErrors { message } }
      }`, {
        input: {
          id: `gid://shopify/Product/${PRODUCT_ID}`,
          descriptionHtml: amazingDescriptionHTML
        }
      }
    );

    // 3. Get Variants and their Inventory Item IDs
    console.log('Fetching Variants for Price & Inventory Update...');
    const productData = await executeGraphQL(`
      query {
        product(id: "gid://shopify/Product/${PRODUCT_ID}") {
          variants(first: 50) {
            edges { node { id inventoryItem { id } } }
          }
        }
      }
    `);

    const variants = productData.product.variants.edges;
    console.log(`Found ${variants.length} variants. Setting price and inventory...`);

    // 4. Update Price and Inventory for each variant
    for (const edge of variants) {
      const variantId = edge.node.id;
      const inventoryItemId = edge.node.inventoryItem.id;
      
      // Update Price (Set of 4) using REST API
      const variantIdNum = variantId.split('/').pop();
      await axios.put(`https://${storeUrl}/admin/api/2024-04/variants/${variantIdNum}.json`, {
        variant: {
          id: variantIdNum,
          price: "998.00",
          compare_at_price: "1996.00"
        }
      }, {
        headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' }
      });

      // Update Inventory (50 pcs)
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
    
    console.log('✅ Success! Description updated, prices set to ₹249.50, and all variants set to 50 pcs.');
  } catch (error) {
    console.error('❌ Error:', error.response ? error.response.data : error.message);
    if (error.response && error.response.status === 401) {
      console.log('\n--- IMPORTANT ---');
      console.log('The API Token in your .env file is INVALID for the live esponsports store.');
      console.log('Please open the .env file and paste the correct Live Store Access Token, then run this script again!');
    }
  }
}

updateProductAndInventory();
