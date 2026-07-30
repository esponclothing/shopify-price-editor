const axios = require('axios');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const storeUrl = envFile.match(/VITE_SHOPIFY_STORE_URL=(.+)/)[1].trim();
const accessToken = envFile.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.+)/)[1].trim();

const GRAPHQL_URL = `https://${storeUrl}/admin/api/2024-04/graphql.json`;

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

async function restoreEsponSportsDescriptions() {
  try {
    console.log('Fetching all products from EsponSports...');
    let hasNextPage = true;
    let cursor = null;
    let products = [];

    // Fetch all products
    while (hasNextPage) {
      const query = `
        query getProducts($cursor: String) {
          products(first: 50, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                id
                title
                tags
                variants(first: 1) {
                  edges {
                    node {
                      price
                      compareAtPrice
                    }
                  }
                }
              }
            }
          }
        }
      `;
      const data = await executeGraphQL(query, { cursor });
      products.push(...data.products.edges.map(e => e.node));
      hasNextPage = data.products.pageInfo.hasNextPage;
      cursor = data.products.pageInfo.endCursor;
    }

    console.log(`Found ${products.length} products on EsponSports. Restoring HTML format...`);

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const variant = p.variants.edges[0]?.node;
      const wsp = variant?.price || '249.50';
      const mrp = variant?.compareAtPrice || (parseFloat(wsp) * 2).toFixed(2);
      
      // Extract Article code if present (e.g., "(Art E0024)" or "(E009)")
      let articleCode = "N/A";
      const match = p.title.match(/\(?((?:Art\s*)?[a-zA-Z0-9-]+)\)?$/i);
      if (match) {
        articleCode = match[1].toUpperCase();
      }

      // Determine Category / Material loosely from title
      let material = "Premium Blend";
      if (p.title.toLowerCase().includes('lycra')) material = "Lycra Blend";
      if (p.title.toLowerCase().includes('ns')) material = "NS Air-Lite";
      if (p.title.toLowerCase().includes('terry')) material = "Terry Fabric";

      const amazingDescriptionHTML = `
<div class="espon-desc-wrap">
  <div class="espon-b2b-box">
    <h4>The B2B Factory Advantage</h4>
    <p><span>Wholesale (WSP):</span> ₹${wsp}</p>
    <p><span>Retail (MRP):</span> ₹${mrp}</p>
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
            <div class="espon-spec-val">${articleCode}</div>
          </div>
          <div class="espon-spec-row">
            <div class="espon-spec-name">Material</div>
            <div class="espon-spec-val">${material}</div>
          </div>
          <div class="espon-spec-row">
            <div class="espon-spec-name">Fabric Profile</div>
            <div class="espon-spec-val">Engineered for maximum flexibility, durability, and breathability.</div>
          </div>
          <div class="espon-spec-row">
            <div class="espon-spec-name">Design Features</div>
            <div class="espon-spec-val">
              <ul>
                <li>Deep, functional side pockets for secure storage.</li>
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
          <p>Designed for peak performance and everyday utility, the <strong>${p.title}</strong> is an essential addition to any activewear catalog. This garment offers exceptional breathability and 4-way stretch flexibility. Priced for wholesale with extreme retail margin potential.</p>
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

      await executeGraphQL(`
        mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) { product { id } userErrors { message } }
        }`, {
          input: {
            id: p.id,
            descriptionHtml: amazingDescriptionHTML
          }
        }
      );
      
      console.log(`Formatted & Restored [${i+1}/${products.length}]: ${p.title}`);
      
      // small delay to prevent rate limits
      await new Promise(res => setTimeout(res, 300));
    }
    
    console.log('✅ Success! All esponsports descriptions restored to custom HTML code format.');
  } catch (error) {
    console.error('❌ Error:', error.response ? error.response.data : error.message);
  }
}

restoreEsponSportsDescriptions();
