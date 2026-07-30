const fs = require('fs');
const path = 'src/App.jsx';
let content = fs.readFileSync(path, 'utf8');

const startSeo = '              {/* SEO METADATA */}';
const seoIdx = content.indexOf(startSeo);
if (seoIdx !== -1) {
  const beforeSeo = content.substring(0, seoIdx);
  const afterSeoBlock = content.substring(seoIdx);
  
  const tagsEndRegex = /Extract Tags\s*<\/button>\s*<\/div>/;
  const match = afterSeoBlock.match(tagsEndRegex);
  
  if (match) {
    const endOfTagsBlockFull = match.index + match[0].length;
    const extractedBlock = afterSeoBlock.substring(0, endOfTagsBlockFull) + '\n\n';
    
    const restOfFile = afterSeoBlock.substring(endOfTagsBlockFull);
    const modifiedAfter = restOfFile.replace(/^\s+/, '\n            </div>\n');
    let newContent = beforeSeo + modifiedAfter;
    
    const textareaLine = '<textarea rows={4} value={generalData.descriptionText}';
    const textareaIdx = newContent.indexOf(textareaLine);
    
    if (textareaIdx !== -1) {
      let currentIdx = textareaIdx;
      // We need to pass 3 closing divs
      for (let i = 0; i < 3; i++) {
        currentIdx = newContent.indexOf('</div>', currentIdx + 1);
      }
      
      if (currentIdx !== -1) {
        const insertIdx = currentIdx + '</div>'.length;
        newContent = newContent.substring(0, insertIdx) + '\n\n' + extractedBlock + newContent.substring(insertIdx);
        content = newContent;
        console.log("Moved SEO and TAGS successfully!");
      } else {
        console.log("Could not find end of product description div.");
      }
    } else {
      console.log("Could not find textarea line.");
    }
  } else {
    console.log("Could not find the end of tags block.");
  }
} else {
  console.log("Could not find SEO METADATA.");
}

fs.writeFileSync(path, content, 'utf8');
