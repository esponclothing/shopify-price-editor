const axios = require('axios');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const storeUrl = envFile.match(/VITE_SHOPIFY_STORE_URL=(.+)/)[1].trim();
const accessToken = envFile.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.+)/)[1].trim();

const productData = {
  product: {
    title: 'Air-Lite NS 15% Lycra Cargo Track Pant (Art E0024)',
    body_html: '<h2>Premium Air-Lite NS 15% Lycra Cargo Track Pants</h2><ul><li><strong>Article No:</strong> E0024</li><li><strong>Fabric:</strong> Air-Lite NS 15% Lycra (Stretchable & Breathable)</li><li><strong>Style:</strong> Cargo pockets, modern tapered fit</li><li><strong>Sizes Included in Pack:</strong> M, L, XL, XXL</li><li><strong>MRP:</strong> ₹499 per piece</li></ul><p>Maximize your retail margins with Espon Sports factory-direct activewear. Sold exclusively in B2B ratio packs of 4.</p>',
    vendor: 'Espon Sports',
    product_type: 'Track Pants',
    tags: 'B2B, Cargo, Track Pant, Air-lite, Lycra, E0024, Wholesale',
    status: 'active',
    options: [
      { name: 'Color' },
      { name: 'Set Size' }
    ],
    variants: [
      { option1: 'Black', option2: 'M-XXL (Pack of 4)', price: '998', compare_at_price: '1996', sku: 'E0024-BLK', grams: 1200, inventory_policy: 'deny', inventory_management: 'shopify', requires_shipping: true, taxable: true },
      { option1: 'Khaki', option2: 'M-XXL (Pack of 4)', price: '998', compare_at_price: '1996', sku: 'E0024-KHA', grams: 1200, inventory_policy: 'deny', inventory_management: 'shopify', requires_shipping: true, taxable: true },
      { option1: 'Light Grey', option2: 'M-XXL (Pack of 4)', price: '998', compare_at_price: '1996', sku: 'E0024-LGRY', grams: 1200, inventory_policy: 'deny', inventory_management: 'shopify', requires_shipping: true, taxable: true },
      { option1: 'Olive Green', option2: 'M-XXL (Pack of 4)', price: '998', compare_at_price: '1996', sku: 'E0024-OLV', grams: 1200, inventory_policy: 'deny', inventory_management: 'shopify', requires_shipping: true, taxable: true },
      { option1: 'Navy Blue', option2: 'M-XXL (Pack of 4)', price: '998', compare_at_price: '1996', sku: 'E0024-NVY', grams: 1200, inventory_policy: 'deny', inventory_management: 'shopify', requires_shipping: true, taxable: true },
      { option1: 'Dark Grey', option2: 'M-XXL (Pack of 4)', price: '998', compare_at_price: '1996', sku: 'E0024-DGRY', grams: 1200, inventory_policy: 'deny', inventory_management: 'shopify', requires_shipping: true, taxable: true }
    ]
  }
};

async function createProduct() {
  try {
    console.log('Pushing product to Shopify...');
    const response = await axios.post(`https://${storeUrl}/admin/api/2024-04/products.json`, productData, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });
    console.log('Product created successfully!');
    console.log('Product ID:', response.data.product.id);
  } catch (error) {
    console.error('Error creating product:', error.response ? error.response.data : error.message);
  }
}

createProduct();
