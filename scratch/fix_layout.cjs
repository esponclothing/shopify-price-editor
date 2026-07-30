const fs = require('fs');
const path = 'src/App.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Move SEO and SMART TAGS
const seoAndTagsRegex = /(\{\/\* SEO METADATA \*\/\}[\s\S]*?\{\/\* SMART TAGS PARSER \*\/\}[\s\S]*?<\/div>\n\n)/;
const match = content.match(seoAndTagsRegex);

if (match) {
  const seoAndTagsContent = match[0];
  // Remove it from its current position
  content = content.replace(seoAndTagsContent, '');
  
  // Insert it after Product Description block end
  const descriptionEndStr = `                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Product Description</label>
                  <textarea rows={4} value={generalData.descriptionText} onChange={e => setGeneralData({ ...generalData, descriptionText: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-yellow-500/50 outline-none" />
                </div>
              </div>\n\n`;
  
  if (content.includes(descriptionEndStr)) {
    content = content.replace(descriptionEndStr, descriptionEndStr + seoAndTagsContent);
    console.log("Moved SEO and Tags under Product Details!");
  } else {
    console.log("Could not find insertion point for SEO and Tags.");
  }
} else {
  console.log("Could not find SEO and Tags block.");
}


// 2. Replace the search bar header
const searchBarRegex = /\{activeTab === 'products' && \(\s*<div className="relative">\s*<Search className="w-4 h-4 text-slate-400 absolute left-3 top-1\/2 -translate-y-1\/2" \/>\s*<input\s*type="text"\s*placeholder="Search products\.\.\."\s*value=\{search\}\s*onChange=\{\(e\) => setSearch\(e\.target\.value\)\}\s*className="[^"]*"\s*\/>\s*<\/div>\s*\)/;

const newHeader = `{activeTab === 'products' && (
              <div className="flex items-center gap-3 w-full lg:w-[600px]">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all placeholder:text-slate-500 shadow-inner"
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

if (searchBarRegex.test(content)) {
  content = content.replace(searchBarRegex, newHeader);
  console.log("Replaced search bar with dropdowns!");
} else {
  console.log("Could not find the exact search bar UI block to replace.");
}

fs.writeFileSync(path, content, 'utf8');
