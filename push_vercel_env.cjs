const { execSync } = require('child_process');

const envs = {
  SUPABASE_URL: 'https://xkiukbebnntjzfilyfmh.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhraXVrYmVibm50anpmaWx5Zm1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMjIxMTgsImV4cCI6MjEwMDc5ODExOH0.ZY1RADk9yfq_X_vH7SbkubOSi1MUcLy2iWkLPBHGVNs',
  SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhraXVrYmVibm50anpmaWx5Zm1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIyMjExOCwiZXhwIjoyMTAwNzk4MTE4fQ.bqc4x9ok4pgmcffKPpj-BOUELvAli5weCJtwuL4X7Rc',
  SUPABASE_DB_PASSWORD: '11fit@202612',
  WHATSAPP_PHONE_NUMBER_ID: '1189183190949431',
  WHATSAPP_VERIFY_TOKEN: '11fit_webhook_2026',
  WHATSAPP_TOKEN: 'EAAM99yhroGsBR1rm4kaPOHQRtcuoMjZAdpcz2F4K1AXjYYfvtGLwttdBMO2fdaUI4lzB0fG0iaZAabFdgP9aA4GCXtw0t4zLmwZBg0ShVCJBZBYZBVYnmGkb2f9XZAXcD9evV1hoAcF9DGfSYtTCfTzzcC9iZCmWZBTiyMZC4ZBnmvOVqPfE1ZCJE3Lc3ZBs3egltQZDZD',
  VITE_GROQ_API_KEY: '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',
  VITE_SHOPIFY_STORE_URL: 'i2tu0d-jc.myshopify.com',
  VITE_SHOPIFY_ACCESS_TOKEN: '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',
  SHOPIFY_ACCESS_TOKEN: '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',
  ADMIN_SECRET: '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'
};

console.log('Pushing environment variables to Vercel production...');

for (const [key, value] of Object.entries(envs)) {
  try {
    console.log(`Adding ${key}...`);
    // Remove existing if any, ignore error if doesn't exist
    try {
      execSync(`npx vercel env rm ${key} production -y`, { stdio: 'ignore' });
    } catch (e) {}
    const typeFlag = key.startsWith('VITE_') ? '--type config' : '';
    // Add new value via stdin
    execSync(`npx vercel env add ${key} production ${typeFlag}`, {
      input: value,
      stdio: ['pipe', 'inherit', 'inherit']
    });
    console.log(`✅ Successfully added ${key}`);
  } catch (err) {
    console.error(`❌ Failed to add ${key}:`, err.message);
  }
}

console.log('\nNow redeploying Vercel production to apply all environment variables...');
try {
  execSync('npx vercel --prod --yes', { stdio: 'inherit' });
  console.log('🎉 Vercel deployment complete!');
} catch (err) {
  console.error('Error redeploying:', err.message);
}
