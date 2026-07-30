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
    // Remove leading whitespace/newlines but preserve the closing div
    const modifiedAfter = restOfFile.replace(/^\s+/, '\n            </div>\n');
    let newContent = beforeSeo + modifiedAfter;
    
    // Find the textarea line
    const textareaLine = 'className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-yellow-500/50 outline-none" />';
    const textareaIdx = newContent.indexOf(textareaLine);
    
    if (textareaIdx !== -1) {
      const blockEndIdx = newContent.indexOf('</div>\n              </div>', textareaIdx);
      if (blockEndIdx !== -1) {
        const insertIdx = blockEndIdx + '</div>\n              </div>'.length;
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
