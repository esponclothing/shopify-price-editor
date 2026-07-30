const fs = require('fs');

const appPath = 'src/App.jsx';
let content = fs.readFileSync(appPath, 'utf8');

// Find the boundaries
const idxGeneralEnd = content.indexOf('              {/* PRICE & INITIAL INVENTORY');
const idxPriceEnd = content.indexOf('              {/* VARIANTS & INVENTORY LIST');
const idxVariantsEnd = content.indexOf('              {/* SEO METADATA */}');
const idxSeoEnd = content.indexOf('              {/* SMART TAGS PARSER */}');
const idxTagsEnd = content.indexOf('            </div>', idxSeoEnd + 50);

if (idxGeneralEnd === -1 || idxPriceEnd === -1 || idxVariantsEnd === -1 || idxSeoEnd === -1 || idxTagsEnd === -1) {
    console.error("Could not find all sections", { idxGeneralEnd, idxPriceEnd, idxVariantsEnd, idxSeoEnd, idxTagsEnd });
    process.exit(1);
}

// Find the exact end of the tags section block
const stringToFind = '              </div>\n\n            </div>';
let endBoundary = content.indexOf(stringToFind, idxSeoEnd);
if (endBoundary === -1) {
    endBoundary = content.indexOf('              </div>\r\n\r\n            </div>', idxSeoEnd);
}

if (endBoundary === -1) {
    console.error("Could not find end boundary");
    process.exit(1);
}

const priceSection = content.substring(idxGeneralEnd, idxPriceEnd);
const variantsSection = content.substring(idxPriceEnd, idxVariantsEnd);
const seoSection = content.substring(idxVariantsEnd, idxSeoEnd);
const tagsSection = content.substring(idxSeoEnd, endBoundary);

const newOrder = seoSection + tagsSection + priceSection + variantsSection;

const before = content.substring(0, idxGeneralEnd);
const after = content.substring(endBoundary);

const newContent = before + newOrder + after;

fs.writeFileSync(appPath, newContent, 'utf8');
console.log("Successfully reordered the sections!");
