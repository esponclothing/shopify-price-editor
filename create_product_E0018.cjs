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
    <p><span>Wholesale (WSP):</span> ₹998.00</p>
    <p><span>Retail (MRP):</span> ₹1996.00</p>
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
            <div class="espon-spec-val">ART E0018</div>
          </div>
          <div class="espon-spec-row">
            <div class="espon-spec-name">Material</div>
            <div class="espon-spec-val">Premium NS 15% Fabric</div>
          </div>
          <div class="espon-spec-row">
            <div class="espon-spec-name">Fabric Profile</div>
            <div class="espon-spec-val">Lightweight premium fabric engineered for everyday comfort and durability.</div>
          </div>
          <div class="espon-spec-row">
            <div class="espon-spec-name">Design Features</div>
            <div class="espon-spec-val">
              <ul>
                <li>4-pocket utility design for maximum storage.</li>
                <li>Elasticated waistband for a snug and flexible fit.</li>
                <li>"NEVER MIND" bold branding detail on select variants.</li>
                <li>Everyday active lifestyle aesthetic.</li>
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
          <p>Designed for peak performance and everyday utility, the <strong>NS 15% 4 Pocket Joggers (E0018)</strong> are an essential addition to any activewear catalog. Crafted from our signature lightweight premium NS fabric, this garment offers exceptional breathability and comfort. The 4-pocket design provides immense streetwear edge while keeping the fit sharp and tailored. Priced for wholesale with extreme retail margin potential.</p>
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

async function createProductE0018() {
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
        title: "NS 15% 4 Pocket Joggers (Art E0018)",
        descriptionHtml: descriptionHTML,
        vendor: "Espon Sports",
        productType: "Joggers",
        tags: ["B2B", "Joggers", "NS", "4 Pocket", "E0018", "Wholesale"],
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
    const colors = ['Black', 'Blue', 'Dark Grey', 'Khaki', 'Grey', 'Light Grey'];
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

    // Wait a few seconds to let Shopify generate the default first variant before we delete it or bulk add
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. Delete the auto-generated variant(s) if we want a clean slate for bulk create
    const getVariantsQuery = `
      query getVariants($id: ID!) {
        product(id: $id) {
          variants(first: 10) {
            edges { node { id title } }
          }
        }
      }
    `;
    const varData = await executeGraphQL(getVariantsQuery, { id: productId });
    for (const vEdge of varData.product.variants.edges) {
       console.log('Deleting auto-generated variant:', vEdge.node.title);
       await executeGraphQL(`
         mutation productVariantDelete($id: ID!) {
           productVariantDelete(id: $id) { userErrors { message } }
         }
       `, { id: vEdge.node.id });
    }

    // 4. Create all 6 variants properly in bulk
    console.log("Creating Variants in bulk...");
    const variantsInput = colors.map(color => {
      return {
        optionValues: [
          { optionName: "Color", name: color },
          { optionName: "Set Size", name: "M-XXL (Pack of 4)" }
        ],
        price: 998.00,
        compareAtPrice: 1996.00,
        inventoryPolicy: "DENY",
        inventoryItem: {
          sku: `E0018-${color.toUpperCase().substring(0,3)}`,
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

    const createdVariants = createRes.productVariantsBulkCreate.productVariants;
    console.log(`Successfully created ${createdVariants.length} variants!`);

    // 5. Set Inventory Quantity
    console.log("Setting inventory quantities...");
    const quantities = [];
    for (const v of createdVariants) {
      const color = v.title.split(' / ')[0];
      const stockAmount = ['Black', 'Blue', 'Dark Grey', 'Khaki'].includes(color) ? 50 : 0;
      
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
       console.log("Product E0018 successfully created and configured!");
    }

  } catch (error) {
    console.error('An error occurred:', error.message);
  }
}

createProductE0018();
