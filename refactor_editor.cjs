const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory() && !file.includes('node_modules')) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.js') || file.endsWith('.cjs')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(__dirname);
let modifiedFiles = 0;

for (const file of files) {
  if (file === __filename) continue; // skip this script

  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Replace ${SUPABASE_URL} or ${supabaseUrl} with empty string in template literals
  content = content.replace(/\$\{SUPABASE_URL\}\//g, '/');
  content = content.replace(/\$\{supabaseUrl\}\//g, '/');
  
  // Remove process.env.SUPABASE_URL assignments
  content = content.replace(/const\s+SUPABASE_URL\s*=\s*(?:process\.env\.SUPABASE_URL[^;]*|'[^']+');\r?\n/g, '');
  content = content.replace(/const\s+supabaseUrl\s*=\s*process\.env\.SUPABASE_URL;\r?\n/g, '');
  
  // Remove SUPABASE_KEY / SUPABASE_ANON_KEY assignments
  content = content.replace(/const\s+SUPABASE_KEY\s*=\s*(?:process\.env\.SUPABASE_ANON_KEY|'[^']+');\r?\n/g, '');
  content = content.replace(/const\s+supabaseKey\s*=\s*process\.env\.SUPABASE_ANON_KEY;\r?\n/g, '');
  
  // Remove supabaseHeaders
  content = content.replace(/const\s+supabaseHeaders\s*=\s*\{[^}]+\};\r?\n/g, 'const supabaseHeaders = {};\n');
  content = content.replace(/,\s*\{\s*'apikey':\s*supabaseKey,\s*'Authorization':\s*`Bearer\s+\$\{supabaseKey\}`\s*\}/g, '');
  content = content.replace(/\{\s*'apikey':\s*supabaseKey,\s*'Authorization':\s*`Bearer\s+\$\{supabaseKey\}`\s*\}/g, '{}');
  
  // Replace import/require from supabaseFetch -> dbFetch
  content = content.replace(/supabaseFetch\.js/g, 'dbFetch.js');
  content = content.replace(/supabaseFetch/g, 'dbFetch');
  
  // Replace axiosWrapper -> dbWrapper
  content = content.replace(/axiosWrapper\.js/g, 'dbWrapper.js');

  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    modifiedFiles++;
    console.log(`Modified ${file}`);
  }
}

console.log(`Refactored ${modifiedFiles} files.`);
