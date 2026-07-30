const fs = require('fs');
const axios = require('axios');
const env = fs.readFileSync('.env', 'utf8');
const token = env.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.*)/)[1].trim();
let shopUrl = env.match(/VITE_SHOPIFY_STORE_URL=(.*)/)[1].trim();
if (!shopUrl.startsWith('http')) shopUrl = 'https://' + shopUrl;

const targetProducts = [
  {
    handle: "savage-tiger-tee",
    id: "15873126760529",
    price: "799.00",
    compareAtPrice: "1099.00"
  },
  {
    handle: "king-of-jungle-lion-cut-tee",
    id: "15873119092817",
    price: "699.00",
    compareAtPrice: "1099.00"
  },
  {
    handle: "stay-real-unisex-crew-neck-t-shirt",
    id: "15873118470225",
    price: "699.00",
    compareAtPrice: "1099.00"
  },
  {
    handle: "musafir-travel-tee",
    id: "15873117618257",
    price: "699.00",
    compareAtPrice: "1099.00"
  },
  {
    handle: "push-you-limit-tee",
    id: "15873117519953",
    price: "799.00",
    compareAtPrice: "1119.00"
  }
];

const sizes = ["S", "M", "L", "XL", "2XL"];
const colors = ["Gray", "White", "Red", "Purple", "Navy Blue", "Black", "Green", "Yellow", "Beige", "Orange", "Blue", "Maroon", "Sky Blue"];

const delay = ms => new Promise(res => setTimeout(res, ms));

const updateProduct = async (p) => {
  console.log(`Starting update for ${p.handle}...`);
  
  // 1. Generate 65 variants
  const variants = [];
  for (const size of sizes) {
    for (const color of colors) {
      variants.push({
        option1: size,
        option2: color,
        price: p.price,
        compare_at_price: p.compareAtPrice,
        inventory_management: "shopify",
        inventory_policy: "continue"
      });
    }
  }

  const payload = {
    product: {
      id: parseInt(p.id),
      options: [
        { name: "Size", values: sizes },
        { name: "Color", values: colors }
      ],
      variants: variants
    }
  };

  try {
    const res = await axios.put(`${shopUrl}/admin/api/2024-04/products/${p.id}.json`, payload, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      }
    });
    console.log(`Successfully updated options & variants for ${p.handle}! Created ${res.data.product.variants.length} variants.`);
    
    // 2. Set inventory to 100 for each variant to ensure they are available
    console.log(`Setting inventory for ${p.handle} variants...`);
    const newVariants = res.data.product.variants;
    
    // We can use the inventory bulk adjustment or loop. 
    // To prevent rate limit issues, let's use the bulk set inventory levels in batches.
    const inventoryAdjustments = newVariants.map(v => ({
      inventory_item_id: v.inventory_item_id,
      available_adjustment: 100
    }));

    // Find location ID first
    const locationsRes = await axios.get(`${shopUrl}/admin/api/2024-04/locations.json`, {
      headers: { 'X-Shopify-Access-Token': token }
    });
    const locationId = locationsRes.data.locations[0].id;

    for (const v of newVariants) {
      await axios.post(`${shopUrl}/admin/api/2024-04/inventory_levels/set.json`, {
        location_id: locationId,
        inventory_item_id: v.inventory_item_id,
        available: 100
      }, {
        headers: { 'X-Shopify-Access-Token': token }
      });
      await delay(100); // small delay to respect API limits
    }
    console.log(`Inventory set to 100 for all variants of ${p.handle}!`);

  } catch (err) {
    console.error(`Error updating ${p.handle}:`, err.response?.data ? JSON.stringify(err.response.data) : err.message);
  }
};

const run = async () => {
  for (const p of targetProducts) {
    await updateProduct(p);
    await delay(1000); // 1s delay between products
  }
  console.log("All products sync completed successfully!");
};

run();
