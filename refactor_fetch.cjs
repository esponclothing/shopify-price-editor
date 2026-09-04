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

const files = walk(path.join(__dirname, 'api'));
let modifiedFiles = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Replace fetch(`/rest/v1/ with dbFetch(`/rest/v1/
  content = content.replace(/fetch\(\s*`\/rest\/v1\//g, 'dbFetch(`/rest/v1/');
  
  if (content !== originalContent) {
    if (!content.includes('import { dbFetch }')) {
      content = `import { dbFetch } from './dbFetch.js';\n` + content;
    }
    fs.writeFileSync(file, content);
    modifiedFiles++;
    console.log(`Modified ${file}`);
  }
}

console.log(`Refactored fetch to dbFetch in ${modifiedFiles} files.`);
