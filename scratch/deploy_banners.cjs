const axios = require('axios');
const fs = require('fs');
const path = require('path');

const shop = 'i2tu0d-jc.myshopify.com';
const token = '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';
const themeId = '197172887633'; // Live Theme ID

async function deploySnippet() {
  try {
    const bannerPath = path.join('C:', 'Users', 'HP', 'Desktop', '11fit theme', 'snippets', 'campaign-banner.liquid');
    const carouselPath = path.join('C:', 'Users', 'HP', 'Desktop', '11fit theme', 'snippets', 'campaign-product-carousel.liquid');
    
    const bannerContent = fs.readFileSync(bannerPath, 'utf8');
    const carouselContent = fs.readFileSync(carouselPath, 'utf8');

    console.log(`Deploying to Theme ID: ${themeId}`);

    await axios.put(
      `https://${shop}/admin/api/2024-01/themes/${themeId}/assets.json`,
      { asset: { key: 'snippets/campaign-banner.liquid', value: bannerContent } },
      { headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' } }
    );
    console.log('Deployed campaign-banner snippet');

    await axios.put(
      `https://${shop}/admin/api/2024-01/themes/${themeId}/assets.json`,
      { asset: { key: 'snippets/campaign-product-carousel.liquid', value: carouselContent } },
      { headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' } }
    );
    console.log('Deployed campaign-product-carousel snippet');

  } catch (err) {
    console.error('Failed to deploy snippet asset:', err.response ? err.response.data : err.message);
  }
}

deploySnippet();
