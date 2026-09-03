const { execSync } = require('child_process');
const path = require('path');

const envs = {
  SUPABASE_URL: 'https://nfubnpgfwgrlpfhcbjlg.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mdWJucGdmd2dybHBmaGNiamxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2OTE5NTMsImV4cCI6MjEwMDI2Nzk1M30.MPdzBAtkh39IgOR9ANzFGBt5SoJbZNcEChEU0nowePk',
  SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mdWJucGdmd2dybHBmaGNiamxnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDY5MTk1MywiZXhwIjoyMTAwMjY3OTUzfQ.P7y0bWzRkH0x18O3sA_2H8hJc_764PjOaW903v4H_48'
};

console.log('Pushing environment variables to checkout-app on Vercel...');

// We must execute this from the checkout-app directory so Vercel uses the right project
const checkoutDir = path.join(__dirname, '..', 'checkout-app');

for (const [key, value] of Object.entries(envs)) {
  try {
    console.log(`Adding ${key} to checkout-app...`);
    try {
      execSync(`npx vercel env rm ${key} production -y`, { cwd: checkoutDir, stdio: 'ignore' });
    } catch (e) {}
    
    const typeFlag = key.includes('KEY') ? '--type secret' : '--type config';
    // Add new value
    execSync(`npx vercel env add ${key} production ${typeFlag}`, {
      cwd: checkoutDir,
      input: value,
      stdio: ['pipe', 'inherit', 'inherit']
    });
    console.log(`✅ Successfully added ${key}`);
  } catch (err) {
    console.error(`❌ Failed to add ${key}:`, err.message);
  }
}

console.log('\nNow redeploying checkout-app to apply all environment variables...');
try {
  execSync('npx vercel --prod --yes', { cwd: checkoutDir, stdio: 'inherit' });
  console.log('🎉 Vercel deployment complete for checkout-app!');
} catch (err) {
  console.error('Error redeploying checkout-app:', err.message);
}
