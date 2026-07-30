const fs = require('fs');
const path = 'src/App.jsx';
let content = fs.readFileSync(path, 'utf8');

const startSeo = '              {/* SEO METADATA */}';
const seoIdx = content.indexOf(startSeo);
if (seoIdx !== -1) {
  const beforeSeo = content.substring(0, seoIdx);
  const afterSeoBlock = content.substring(seoIdx);
  
  // Use regex to find the end of the Tags block
  // It looks for Extract Tags, then </button>, then </div>
  const tagsEndRegex = /Extract Tags\s*<\/button>\s*<\/div>/;
  const match = afterSeoBlock.match(tagsEndRegex);
  
  if (match) {
    const endOfTagsBlockFull = match.index + match[0].length;
    const extractedBlock = afterSeoBlock.substring(0, endOfTagsBlockFull) + '\n\n';
    
    // The rest of the file after removing the extracted block
    const restOfFile = afterSeoBlock.substring(endOfTagsBlockFull);
    // Remove leading whitespace/newlines and add back the closing div for the column
    const modifiedAfter = restOfFile.replace(/^\s+/, '\n            </div>\n');
    let newContent = beforeSeo + modifiedAfter;
    
    // Find insertion point in the first column
    const descRegex = /<textarea rows=\{4\} value=\{generalData\.descriptionText\}[^>]*><\/textarea>\s*<\/div>\s*<\/div>|<textarea rows=\{4\} value=\{generalData\.descriptionText\}[^>]*\/>\s*<\/div>\s*<\/div>/;
    
    const descMatch = newContent.match(descRegex);
    if (descMatch) {
      const insertIdx = descMatch.index + descMatch[0].length;
      newContent = newContent.substring(0, insertIdx) + '\n\n' + extractedBlock + newContent.substring(insertIdx);
      content = newContent;
      console.log("Moved SEO and TAGS successfully!");
    } else {
      console.log("Could not find product description block to insert.");
    }
  } else {
    console.log("Could not find the end of tags block.");
  }
} else {
  console.log("Could not find SEO METADATA.");
}

fs.writeFileSync(path, content, 'utf8');
