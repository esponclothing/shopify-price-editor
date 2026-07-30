const axios = require('axios');
const fs = require('fs');
const path = require('path');

const shop = 'i2tu0d-jc.myshopify.com';
const token = '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';
const themeId = '197172887633'; // Live Theme ID

async function deploySnippet() {
  try {
    const liquidPath = path.join('C:', 'Users', 'HP', 'Desktop', '11fit theme', 'snippets', 'campaign-banner.liquid');
    const liquidContent = fs.readFileSync(liquidPath, 'utf8');

    console.log(`Deploying to Theme ID: ${themeId}`);
    console.log(`Local file length: ${liquidContent.length}`);

    const res = await axios.put(
      `https://${shop}/admin/api/2024-01/themes/${themeId}/assets.json`,
      {
        asset: {
          key: 'snippets/campaign-banner.liquid',
          value: liquidContent
        }
      },
      {
        headers: {
          'X-Shopify-Access-Token': token,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Successfully deployed the campaign-banner snippet asset to Shopify theme!');
    console.log(`Remote File Key: ${res.data.asset.key}`);
    console.log(`Remote File Size: ${res.data.asset.size}`);

  } catch (err) {
    console.error('Failed to deploy snippet asset:', err.response ? err.response.data : err.message);
  }
}

deploySnippet();
