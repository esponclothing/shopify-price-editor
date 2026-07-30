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
    <p><span>Wholesale (WSP):</span> ₹1060.00</p>
    <p><span>Retail (MRP):</span> ₹2120.00</p>
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
            <div class="espon-spec-val">ART N867</div>
          </div>
          <div class="espon-spec-row">
            <div class="espon-spec-name">Material</div>
            <div class="espon-spec-val">Imported NS 15% Lycra</div>
          </div>
          <div class="espon-spec-row">
            <div class="espon-spec-name">Fabric Profile</div>
            <div class="espon-spec-val">Imported NS Lycra blend designed for peak flexibility, durability, and a smooth premium feel.</div>
          </div>
          <div class="espon-spec-row">
            <div class="espon-spec-name">Design Features</div>
            <div class="espon-spec-val">
              <ul>
                <li>Sleek athletic fit with paneled knee articulation.</li>
                <li>Diagonal contrast piping for a modern sporty look.</li>
                <li>Elasticated waistband and premium finish.</li>
                <li>Designed for active lifestyle and gym wear.</li>
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
          <p>The <strong>Imported NS 15% Lycra Track Pant (N867)</strong> sets a new standard for athletic wear. Featuring a specialized imported NS fabric blend with 15% Lycra, these track pants offer unparalleled stretch and comfort. The dynamic paneled design with contrast piping ensures your customers look sharp whether training or relaxing. Priced for wholesale with extreme retail margin potential.</p>
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

async function createProductN867() {
  try {
    console.log('Fetching Location ID...');
    const locationData = await executeGraphQL(`{ locations(first: 1) { edges { node { id } } } }`);
    const locationId = locationData.locations.edges[0].node.id;

    console.log('Creating Product...');
    
    // 1. Create the product
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
        title: "Imported NS 15% Lycra Track Pant (Art N 867)",
        descriptionHtml: descriptionHTML,
        vendor: "Espon Sports",
        productType: "Track Pants",
        tags: ["B2B", "Track Pant", "NS", "Lycra", "N867", "Wholesale"],
        status: "ACTIVE"
      }
    });

    if (productRes.productCreate.userErrors.length > 0) {
      console.error("Product Create Errors:", productRes.productCreate.userErrors);
      return;
    }

    const productId = productRes.productCreate.product.id;
    console.log('Product created with ID:', productId);

    // 2. Create Options
    console.log("Creating Product Options...");
    const colors = ['Blue', 'Black', 'Dark Grey', 'Olive Green'];
    const updateOptionsMutation = `
      mutation productOptionsCreate($productId: ID!, $options: [OptionCreateInput!]!) {
        productOptionsCreate(productId: $productId, options: $options) {
          userErrors { message }
        }
      }
    `;
    const updateRes = await executeGraphQL(updateOptionsMutation, {
      productId: productId,
      options: [
        { name: "Color", values: colors.map(c => ({name: c})) },
        { name: "Set Size", values: [{name: "M-XXL (Pack of 4)"}] }
      ]
    });

    if (updateRes.productOptionsCreate.userErrors.length > 0) {
      console.error("Options Create Errors:", updateRes.productOptionsCreate.userErrors);
      return;
    }

    // Wait a few seconds to let Shopify generate the default first variant ("Blue")
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. Create the remaining variants (Black, Dark Grey, Olive Green)
    console.log("Creating Remaining Variants in bulk...");
    const remainingColors = ['Black', 'Dark Grey', 'Olive Green'];
    const variantsInput = remainingColors.map(color => {
      return {
        optionValues: [
          { optionName: "Color", name: color },
          { optionName: "Set Size", name: "M-XXL (Pack of 4)" }
        ],
        price: 1060.00,
        compareAtPrice: 2120.00,
        inventoryPolicy: "DENY",
        inventoryItem: {
          sku: `N867-${color.toUpperCase().substring(0,3)}`,
          tracked: true
        }
      };
    });

    const bulkCreateMutation = `
      mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkCreate(productId: $productId, variants: $variants) {
          productVariants { id inventoryItem { id } title }
          userErrors { message }
        }
      }
    `;
    const createRes = await executeGraphQL(bulkCreateMutation, {
      productId: productId,
      variants: variantsInput
    });

    if (createRes.productVariantsBulkCreate.userErrors.length > 0) {
      console.error("Variant Bulk Create Errors:", createRes.productVariantsBulkCreate.userErrors);
      return;
    }

    console.log(`Successfully created remaining variants!`);

    // 4. Fetch all 4 variants to update the auto-generated one (Blue) and set inventory for all
    console.log("Fetching all variants to finalize setup...");
    const getVariantsQuery = `
      query getVariants($id: ID!) {
        product(id: $id) {
          variants(first: 10) {
            edges { node { id title inventoryItem { id } } }
          }
        }
      }
    `;
    const varData = await executeGraphQL(getVariantsQuery, { id: productId });
    const allVariants = varData.product.variants.edges.map(e => e.node);

    // Update the auto-generated first variant (Blue)
    const firstVariant = allVariants.find(v => v.title.includes('Blue'));
    if (firstVariant) {
      console.log("Updating auto-generated Blue variant price...");
      const priceUpdate = `
        mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            userErrors { message }
          }
        }
      `;
      await executeGraphQL(priceUpdate, {
        productId: productId,
        variants: [{
          id: firstVariant.id,
          price: 1060.00,
          compareAtPrice: 2120.00,
          inventoryPolicy: "DENY"
        }]
      });
    }

    // 5. Set Inventory Quantity
    console.log("Setting inventory quantities for all variants...");
    const quantities = [];
    for (const v of allVariants) {
      const color = v.title.split(' / ')[0];
      const stockAmount = ['Black', 'Blue', 'Dark Grey'].includes(color) ? 50 : 0;
      
      quantities.push({
        inventoryItemId: v.inventoryItem.id,
        locationId: locationId,
        quantity: stockAmount
      });
    }

    const invMutation = `
      mutation inventorySetOnHandQuantities($input: InventorySetOnHandQuantitiesInput!) {
        inventorySetOnHandQuantities(input: $input) {
          userErrors { message }
        }
      }
    `;
    const invRes = await executeGraphQL(invMutation, {
      input: { reason: "correction", setQuantities: quantities }
    });

    if (invRes.inventorySetOnHandQuantities.userErrors.length > 0) {
       console.error("Inventory Set Errors:", invRes.inventorySetOnHandQuantities.userErrors);
    } else {
       console.log("Inventory quantities updated.");
       console.log("Product N867 successfully created and configured!");
    }

  } catch (error) {
    console.error('An error occurred:', error.message);
  }
}

createProductN867();
