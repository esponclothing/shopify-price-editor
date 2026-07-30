const fs = require('fs');
const path = 'src/App.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Extract SEO and Tags blocks
const startSeo = '              {/* SEO METADATA */}';
const endTags = '              </div>\n\n            </div>';

const seoIdx = content.indexOf(startSeo);
if (seoIdx !== -1) {
  // Find the end of the Tags div
  // Actually, we can just split the file
  const beforeSeo = content.substring(0, seoIdx);
  const afterSeoBlock = content.substring(seoIdx);
  
  // Find the end of the SMART TAGS block. It ends with a button Extract Tags, then </div>.
  const extractTagsStr = 'Extract Tags\n                </button>\n              </div>';
  const endTagsIdxInAfter = afterSeoBlock.indexOf(extractTagsStr);
  
  if (endTagsIdxInAfter !== -1) {
    const endOfTagsBlockFull = endTagsIdxInAfter + extractTagsStr.length;
    const extractedBlock = afterSeoBlock.substring(0, endOfTagsBlockFull) + '\n\n';
    
    // Remove the extracted block from its original place
    const modifiedAfter = afterSeoBlock.substring(endOfTagsBlockFull).replace(/^\s+/, '\n            </div>\n');
    let newContent = beforeSeo + modifiedAfter;
    
    // 2. Find insertion point in the first column
    // We want to insert it after the Product Description </div>
    const descStr = `                  <textarea rows={4} value={generalData.descriptionText} onChange={e => setGeneralData({ ...generalData, descriptionText: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-yellow-500/50 outline-none" />\n                </div>\n              </div>`;
    
    if (newContent.includes(descStr)) {
      newContent = newContent.replace(descStr, descStr + '\n\n' + extractedBlock);
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

// 3. Fix the Top Header Bar search UI
const oldSearchBarStart = "{activeTab === 'products' && (";
const searchBarStartIdx = content.indexOf(oldSearchBarStart);
if (searchBarStartIdx !== -1) {
  // find the closing parenthesis of this block
  const searchBarEndStr = "              )}";
  const searchBarEndIdx = content.indexOf(searchBarEndStr, searchBarStartIdx);
  
  if (searchBarEndIdx !== -1) {
    const fullOldSearchBar = content.substring(searchBarStartIdx, searchBarEndIdx + searchBarEndStr.length);
    
    // We only replace if the old search bar doesn't already have 'filterStatus'
    if (!fullOldSearchBar.includes("filterStatus")) {
      const newHeader = `{activeTab === 'products' && (
              <div className="flex items-center gap-3 w-[600px] absolute left-[300px]">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all placeholder:text-slate-500 shadow-inner"
                  />
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 shrink-0">
                  <option value="">Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
                <select value={filterCollection} onChange={e => setFilterCollection(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 shrink-0 max-w-[140px]">
                  <option value="">Categories</option>
                  {collections && collections.map(col => (
                    <option key={col.id} value={col.id}>{col.title}</option>
                  ))}
                </select>
                <select value={sortOption} onChange={e => setSortOption(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 shrink-0">
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="price_low_high">Price: Low-High</option>
                  <option value="price_high_low">Price: High-Low</option>
                  <option value="alpha_a_z">Name: A-Z</option>
                  <option value="alpha_z_a">Name: Z-A</option>
                </select>
              </div>
            )}`;
            
      content = content.replace(fullOldSearchBar, newHeader);
      console.log("Replaced top search bar successfully!");
    } else {
      console.log("Top search bar already updated.");
    }
  } else {
    console.log("Could not find the end of search bar block.");
  }
} else {
  console.log("Could not find old search bar start.");
}

fs.writeFileSync(path, content, 'utf8');
