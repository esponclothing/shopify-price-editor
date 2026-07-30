const fs = require('fs');
const path = 'src/App.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add sortKey and reverse to queries
content = content.replace(/products\(first: 20\)/g, 'products(first: 50, sortKey: CREATED_AT, reverse: true)');

// Add status and createdAt to the first query (around line 3020)
content = content.replace(
  /                  title\n                  vendor/g,
  "                  title\n                  status\n                  createdAt\n                  vendor"
);

// 2. Add state variables for filtering and sorting
const searchState = "const [search, setSearch] = useState('');";
const additionalStates = `const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCollection, setFilterCollection] = useState('');
  const [sortOption, setSortOption] = useState('newest');`;
content = content.replace(searchState, additionalStates);

// 3. Update filteredProducts logic
const oldFilteredProducts = "const filteredProducts = products.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));";
const newFilteredProducts = `const filteredProducts = products.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus ? p.status === filterStatus : true;
    const matchesCollection = filterCollection ? p.collections?.edges?.some(e => e.node.id === filterCollection) : true;
    return matchesSearch && matchesStatus && matchesCollection;
  }).sort((a, b) => {
    if (sortOption === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortOption === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
    
    const getPrice = (p) => {
      const prices = p.variants?.edges?.map(e => parseFloat(e.node.price)).filter(val => !isNaN(val));
      return prices && prices.length > 0 ? Math.min(...prices) : 0;
    };
    
    if (sortOption === 'price_low_high') return getPrice(a) - getPrice(b);
    if (sortOption === 'price_high_low') return getPrice(b) - getPrice(a);
    if (sortOption === 'alpha_a_z') return a.title.localeCompare(b.title);
    if (sortOption === 'alpha_z_a') return b.title.localeCompare(a.title);
    return 0;
  });`;
content = content.replace(oldFilteredProducts, newFilteredProducts);

// 4. Update the products tab header UI
const oldHeaderUI = `{activeTab === 'products' && (
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all placeholder:text-slate-500 shadow-inner"
                  />
                </div>
              )}`;

const newHeaderUI = `{activeTab === 'products' && (
                <div className="flex flex-col md:flex-row gap-3 w-full max-w-3xl">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all shadow-inner"
                    />
                  </div>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 w-32">
                    <option value="">All Status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="DRAFT">Draft</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                  <select value={filterCollection} onChange={e => setFilterCollection(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 w-36">
                    <option value="">All Categories</option>
                    {collections && collections.map(col => (
                      <option key={col.id} value={col.id}>{col.title}</option>
                    ))}
                  </select>
                  <select value={sortOption} onChange={e => setSortOption(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 w-36">
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="price_low_high">Price: Low to High</option>
                    <option value="price_high_low">Price: High to Low</option>
                    <option value="alpha_a_z">Name: A-Z</option>
                    <option value="alpha_z_a">Name: Z-A</option>
                  </select>
                </div>
              )}`;

content = content.replace(oldHeaderUI, newHeaderUI);

fs.writeFileSync(path, content, 'utf8');
console.log("App.jsx updated with filtering and sorting successfully.");
