const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, 'api');
const files = fs.readdirSync(apiDir).filter(f => f.endsWith('.js'));

for (const file of files) {
  const filePath = path.join(apiDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Match patterns like: if (!supabaseUrl || !supabaseKey) { return res.status(500).json(...); }
  content = content.replace(/if\s*\(\!supabaseUrl\s*\|\|\s*\!supabaseKey\)\s*\{[\s\S]*?res\.status\(500\)\.json\([^)]*\);?\s*\}/g, '');
  content = content.replace(/if\s*\(\!process\.env\.SUPABASE_URL\)\s*\{[\s\S]*?res\.status\(500\)\.json\([^)]*\);?\s*\}/g, '');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Processed ${file}`);
}
