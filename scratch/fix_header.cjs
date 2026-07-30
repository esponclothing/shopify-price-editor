const fs = require('fs');
const path = 'src/App.jsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

const newHeaderLines = `          <div className="flex-1 w-full relative">
            {activeTab === 'products' && (
              <div className="flex items-center gap-3 w-full lg:w-[650px] absolute left-0 top-1/2 -translate-y-1/2">
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
            )}
          </div>`.split('\n');

// Find the index of <div className="flex-1 max-w-md"> which should be around line 404
const targetLineIndex = lines.findIndex((line, idx) => line.includes('<div className="flex-1 max-w-md">') && idx > 390 && idx < 420);

if (targetLineIndex !== -1) {
  // Replace 14 lines starting from targetLineIndex
  lines.splice(targetLineIndex, 14, ...newHeaderLines);
  fs.writeFileSync(path, lines.join('\n'), 'utf8');
  console.log('Header successfully replaced.');
} else {
  console.log('Could not find the target line to replace.');
}
