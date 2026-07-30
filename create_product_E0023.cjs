const axios = require('axios');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const storeUrl = envFile.match(/VITE_SHOPIFY_STORE_URL=(.+)/)[1].trim();
const accessToken = envFile.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.+)/)[1].trim();

const GRAPHQL_URL = `https://${storeUrl}/admin/api/2024-04/graphql.json`;

const descriptionHTML = `
<div class="espon-desc-wrap">
  <div class="espon-b2b-box">
    <h4>The B2B Factory Advantage</h4>
    <p><span>Wholesale (WSP):</span> ₹798.00</p>
    <p><span>Retail (MRP):</span> ₹1596.00</p>
    <p><span>Your Margin:</span> 50% flat profit on every sale.</p>
    <p style="margin-top: 10px; font-size: 0.85rem; color: #64748b;">dYZ_ <strong>Policy:</strong> Sold exclusively in Sets of 4 (Sizes M, L, XL, XXL).</p>
  </div>
  <div class="b2b-accordion-wrapper">
    <div class="acc-item active">
      <button class="acc-header" onclick="toggleAccordion(this)"><span>Product Details</span><i class="fa-solid fa-minus acc-icon"></i></button>
      <div class="acc-body" style="max-height: 2000px;">
        <div class="acc-body-inner">
          <div class="espon-spec-row">
            <div class="espon-spec-name">Article Code</div>
            <div class="espon-spec-val">ART E0023</div>
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
                <li>Side zipper pockets for secure storage.</li>
                <li>Elasticated waistband with adjustable drawcords.</li>
                <li>Moisture-wicking properties for high performance.</li>
                <li>Triple-striped side detail for a sporty look.</li>
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
          <p>Designed for peak performance and everyday utility, the <strong>Air-Lite NS Shorts (E0023)</strong> is an essential addition to any activewear catalog. Crafted from our signature Air-Lite NS fabric with 15% Lycra, this garment offers exceptional breathability and 4-way stretch flexibility. The triple-striped design provides a sporty edge while keeping the fit sharp and tailored. Priced for wholesale with extreme retail margin potential.</p>
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

async function createProductE0023() {
  try {
    console.log('Fetching Location ID...');
    const locationData = await executeGraphQL(`{ locations(first: 1) { edges { node { id } } } }`);
    const locationId = locationData.locations.edges[0].node.id;

    console.log('Creating Product...');
    
    const colors = ['Black', 'Navy', 'Beige', 'Dark Grey', 'Olive Green', 'Light Grey'];
    
    // Create the product
    const productMutation = `
      mutation productCreate($input: ProductInput!) {
        productCreate(input: $input) {
          product { id }
          userErrors { message }
        }
      }
    `;
    const productRes = await executeGraphQL(productMutation, {
      input: {
        title: "Air-Lite NS 15% Lycra Shorts (Art E0023)",
        descriptionHtml: descriptionHTML,
        vendor: "Espon Sports",
        productType: "Shorts",
        tags: ["B2B", "Shorts", "Air-lite", "Lycra", "E0023", "Wholesale"],
        status: "ACTIVE"
      }
    });

    if (productRes.productCreate.userErrors.length > 0) {
      console.error(productRes.productCreate.userErrors);
      return;
    }

    const productId = productRes.productCreate.product.id;
    console.log('Product created with ID:', productId);

    // Create Options
    console.log('Creating Options...');
    const optionsMutation = `
      mutation productOptionsCreate($productId: ID!, $options: [OptionCreateInput!]!) {
        productOptionsCreate(productId: $productId, options: $options) {
          product { id }
          userErrors { message }
        }
      }
    `;
    await executeGraphQL(optionsMutation, {
      productId: productId,
      options: [
        { name: "Color", values: colors.map(name => ({ name })) },
        { name: "Set Size", values: [{ name: "M-XXL (Pack of 4)" }] }
      ]
    });

    // We must wait a second for options to propagate properly in Shopify before adding variants
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Fetching created variants to update them...');
    // Shopify automatically creates variants for all combinations of options. We need to fetch them and update their price/inventory.
    const getVariantsQuery = `
      query getVariants($id: ID!) {
        product(id: $id) {
          variants(first: 100) {
            edges {
              node {
                id
                title
                inventoryItem { id }
                selectedOptions { name value }
              }
            }
          }
        }
      }
    `;
    const getVariantsRes = await executeGraphQL(getVariantsQuery, { id: productId });
    const variants = getVariantsRes.product.variants.edges.map(e => e.node);

    console.log(`Found ${variants.length} auto-generated variants.`);

    // Prepare Bulk Update Input
    const variantsUpdateInput = variants.map(v => {
      return {
        id: v.id,
        price: 798.00,
        compareAtPrice: 1596.00,
        inventoryPolicy: "DENY"
      };
    });

    console.log('Updating Variants Price, SKU, and Options...');
    const bulkUpdateMutation = `
      mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          userErrors { message }
        }
      }
    `;
    const bulkUpdateRes = await executeGraphQL(bulkUpdateMutation, {
      productId: productId,
      variants: variantsUpdateInput
    });
    if (bulkUpdateRes.productVariantsBulkUpdate.userErrors.length > 0) {
      console.error(bulkUpdateRes.productVariantsBulkUpdate.userErrors);
      return;
    }

    console.log('Setting Inventory Quantities...');
    const quantities = [];
    for (const v of variants) {
      const colorOpt = v.selectedOptions.find(o => o.name === 'Color').value;
      const qty = (colorOpt === 'Black' || colorOpt === 'Navy') ? 10 : 0;
      
      quantities.push({
        inventoryItemId: v.inventoryItem.id,
        locationId: locationId,
        quantity: qty
      });
    }

    // Set quantities in batches if needed, but we only have 6 variants, so one call is fine.
    const inventoryMutation = `
      mutation inventorySetOnHandQuantities($input: InventorySetOnHandQuantitiesInput!) {
        inventorySetOnHandQuantities(input: $input) {
          userErrors { message }
        }
      }
    `;
    const invRes = await executeGraphQL(inventoryMutation, {
      input: {
        reason: "correction",
        setQuantities: quantities
      }
    });

    if (invRes.inventorySetOnHandQuantities.userErrors.length > 0) {
      console.error(invRes.inventorySetOnHandQuantities.userErrors);
    } else {
      console.log('Inventory successfully updated!');
    }

    console.log('Product E0023 successfully created and configured!');

  } catch (error) {
    console.error('An error occurred:', error.message);
  }
}

createProductE0023();
