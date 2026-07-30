import fs from 'fs';

let content = fs.readFileSync('src/components/AutomatedCampaignsDashboard.jsx', 'utf-8');

// Chunk 1: Imports
content = content.replace(
  "import { Megaphone, CheckSquare, AlertCircle, Trash2, Tag, Search, Plus, Image as ImageIcon, Edit2, Sparkles, Rocket } from 'lucide-react';",
  "import { Megaphone, CheckSquare, AlertCircle, Trash2, Tag, Search, Plus, Image as ImageIcon, Edit2, Sparkles, Rocket, Settings, Palette, Calendar } from 'lucide-react';"
);

// Chunk 2: State variables
content = content.replace(
  "  const [searchTerm, setSearchTerm] = useState('');\n  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState('');\n  const [success, setSuccess] = useState('');\n  \n  const [activeCampaigns, setActiveCampaigns] = useState([]);",
  `  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const [activeTab, setActiveTab] = useState('campaigns');
  const [uiBgColor, setUiBgColor] = useState('#ffdf00');
  const [uiTextColor, setUiTextColor] = useState('#1a202c');
  const [uiAccentColor, setUiAccentColor] = useState('#d9480f');

  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [activeCampaigns, setActiveCampaigns] = useState([]);`
);

// Chunk 3: useEffect and fetchThemeSettings
content = content.replace(
  "  useEffect(() => {\n    fetchActiveCampaigns();\n  }, []);",
  `  useEffect(() => {
    fetchActiveCampaigns();
    fetchThemeSettings();
  }, []);

  const fetchThemeSettings = async () => {
    try {
      const query = \`query { shop { id metafield(namespace: "custom", key: "campaign_ui") { value } } }\`;
      const res = await axios.post('/api/shopify/graphql.json', { query });
      if (res.data?.data?.shop) {
         window.shopifyShopId = res.data.data.shop.id;
         if (res.data.data.shop.metafield?.value) {
            const ui = JSON.parse(res.data.data.shop.metafield.value);
            if (ui.bg_color) setUiBgColor(ui.bg_color);
            if (ui.text_color) setUiTextColor(ui.text_color);
            if (ui.accent_color) setUiAccentColor(ui.accent_color);
         }
      }
    } catch(err) { console.error(err); }
  };

  const handleSaveThemeSettings = async () => {
    setLoading(true);
    try {
      const val = JSON.stringify({ bg_color: uiBgColor, text_color: uiTextColor, accent_color: uiAccentColor });
      const query = \`mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { userErrors { message } } }\`;
      await axios.post('/api/shopify/graphql.json', { query, variables: { metafields: [{ ownerId: window.shopifyShopId, namespace: "custom", key: "campaign_ui", type: "json", value: val }] } });
      setSuccess('Theme Settings saved!');
      setTimeout(() => setSuccess(''), 3000);
    } catch(e) {
      setError('Failed to save theme settings');
    } finally { setLoading(false); }
  };`
);

// Chunk 4: active campaigns query
content = content.replace(
  "                  ... on DiscountAutomaticBasic {\n                    title\n                    status\n                    summary\n                  }",
  `                  ... on DiscountAutomaticBasic {
                    title
                    status
                    summary
                    startsAt
                    endsAt
                  }`
);

// Chunk 5: handleCreateCampaign startsAt
content = content.replace(
  `      const variables = {
        ...(editingCampaignId && { id: editingCampaignId }),
        automaticBasicDiscount: {
          title: uniqueCampaignTitle,
          startsAt: new Date().toISOString(),
          customerGets,
          ...(minimumRequirement && { minimumRequirement })
        }
      };`,
  `      const startsAtVal = startsAt ? new Date(startsAt).toISOString() : new Date().toISOString();
      const endsAtVal = endsAt ? new Date(endsAt).toISOString() : null;

      const variables = {
        ...(editingCampaignId && { id: editingCampaignId }),
        automaticBasicDiscount: {
          title: uniqueCampaignTitle,
          startsAt: startsAtVal,
          ...(endsAtVal && { endsAt: endsAtVal }),
          customerGets,
          ...(minimumRequirement && { minimumRequirement })
        }
      };`
);

// Chunk 6: handleCreateCampaign reset
content = content.replace(
  `      setDiscountValue('');
      setMinQuantity('');
      setSelectedProductIds([]);`,
  `      setDiscountValue('');
      setMinQuantity('');
      setStartsAt('');
      setEndsAt('');
      setSelectedProductIds([]);`
);

// Chunk 7: handleEditCampaign
content = content.replace(
  `      const query = \`query { discountNode(id: "\${campaign.id}") { discount { ... on DiscountAutomaticBasic { customerGets { items { ... on DiscountProducts { products(first: 250) { edges { node { id } } } } } } minimumRequirement { ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity } } } } } }\`;
      const res = await axios.post('/api/shopify/graphql.json', { query });
      const data = res.data.data.discountNode.discount;
      const parts = campaign.title.split('_');
      setCampaignName(parts[3] || '');
      setDiscountType(parts[1]);
      setDiscountValue(parts[2]);
      setMinQuantity(data.minimumRequirement?.greaterThanOrEqualToQuantity || '');`,
  `      const query = \`query { discountNode(id: "\${campaign.id}") { discount { ... on DiscountAutomaticBasic { startsAt endsAt customerGets { items { ... on DiscountProducts { products(first: 250) { edges { node { id } } } } } } minimumRequirement { ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity } } } } } }\`;
      const res = await axios.post('/api/shopify/graphql.json', { query });
      const data = res.data.data.discountNode.discount;
      const parts = campaign.title.split('_');
      setCampaignName(parts[3] || '');
      setDiscountType(parts[1]);
      setDiscountValue(parts[2]);
      setMinQuantity(data.minimumRequirement?.greaterThanOrEqualToQuantity || '');
      setStartsAt(data.startsAt ? data.startsAt.split('T')[0] : '');
      setEndsAt(data.endsAt ? data.endsAt.split('T')[0] : '');`
);

// Chunk 8: cancel edit
content = content.replace(
  `                setDiscountValue('');
                setMinQuantity('');
                setSelectedProductIds([]);`,
  `                setDiscountValue('');
                setMinQuantity('');
                setStartsAt('');
                setEndsAt('');
                setSelectedProductIds([]);`
);

// Chunk 9: UI wrapper
content = content.replace(
  `      <div>
        <h2 className="text-xl font-black text-white tracking-wide flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-yellow-500" /> Automated Campaigns
        </h2>
      </div>

      {success && <div className="p-4 bg-green-900/20 border border-green-800 rounded-2xl text-green-400 text-sm">{success}</div>}
      {error && <div className="p-4 bg-red-900/20 border border-red-800 rounded-2xl text-red-400 text-sm">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">`,
  `      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-xl font-black text-white tracking-wide flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-yellow-500" /> Automated Campaigns
        </h2>
        <div className="flex p-1 bg-slate-800/50 rounded-xl border border-slate-700 w-fit">
          <button onClick={() => setActiveTab('campaigns')} className={\`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 \${activeTab === 'campaigns' ? 'bg-[#1E293B] text-white shadow' : 'text-slate-400 hover:text-slate-200'}\`}>
            <Rocket className="w-4 h-4" /> Campaigns
          </button>
          <button onClick={() => setActiveTab('theme')} className={\`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 \${activeTab === 'theme' ? 'bg-[#1E293B] text-white shadow' : 'text-slate-400 hover:text-slate-200'}\`}>
            <Palette className="w-4 h-4" /> Theme UI
          </button>
        </div>
      </div>

      {success && <div className="p-4 bg-green-900/20 border border-green-800 rounded-2xl text-green-400 text-sm">{success}</div>}
      {error && <div className="p-4 bg-red-900/20 border border-red-800 rounded-2xl text-red-400 text-sm">{error}</div>}

      {activeTab === 'theme' && (
        <div className="p-6 rounded-2xl border border-slate-700 bg-[#1E293B] shadow-xl max-w-2xl">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><Palette className="w-5 h-5 text-yellow-500" /> Banner Theme Colors</h3>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Background Color</label>
                <div className="flex gap-3">
                  <input type="color" value={uiBgColor} onChange={e => setUiBgColor(e.target.value)} className="w-10 h-10 rounded border-none bg-transparent cursor-pointer" />
                  <input type="text" value={uiBgColor} onChange={e => setUiBgColor(e.target.value)} className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 text-sm text-white focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Text Color</label>
                <div className="flex gap-3">
                  <input type="color" value={uiTextColor} onChange={e => setUiTextColor(e.target.value)} className="w-10 h-10 rounded border-none bg-transparent cursor-pointer" />
                  <input type="text" value={uiTextColor} onChange={e => setUiTextColor(e.target.value)} className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 text-sm text-white focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Accent / Icon Color</label>
                <div className="flex gap-3">
                  <input type="color" value={uiAccentColor} onChange={e => setUiAccentColor(e.target.value)} className="w-10 h-10 rounded border-none bg-transparent cursor-pointer" />
                  <input type="text" value={uiAccentColor} onChange={e => setUiAccentColor(e.target.value)} className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 text-sm text-white focus:outline-none" />
                </div>
              </div>
            </div>
            
            <div className="p-4 rounded-xl border" style={{ backgroundColor: uiBgColor, borderColor: uiAccentColor }}>
              <div className="flex justify-between items-center">
                <span style={{ color: uiTextColor, fontWeight: 'bold' }}>PREVIEW BANNER</span>
                <span style={{ color: uiAccentColor, fontWeight: 'bold' }}>20% OFF</span>
              </div>
            </div>

            <button onClick={handleSaveThemeSettings} disabled={loading} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all flex justify-center items-center gap-2">
              {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Settings className="w-4 h-4" />}
              {loading ? 'Saving...' : 'Save Live Theme'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'campaigns' && (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">`
);

// Chunk 10: Date UI
content = content.replace(
  `            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Minimum Quantity Required (Optional)</label>
              <input
                type="number"
                value={minQuantity}
                onChange={e => setMinQuantity(e.target.value)}
                placeholder="e.g. 3 (Buy 3 to get discount)"
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
              />
            </div>`,
  `            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Minimum Quantity Required (Optional)</label>
              <input
                type="number"
                value={minQuantity}
                onChange={e => setMinQuantity(e.target.value)}
                placeholder="e.g. 3 (Buy 3 to get discount)"
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 flex justify-between"><span>Start Date</span> <span className="text-slate-500 font-normal">Optional</span></label>
                <input
                  type="date"
                  value={startsAt}
                  onChange={e => setStartsAt(e.target.value)}
                  className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 flex justify-between"><span>End Date</span> <span className="text-slate-500 font-normal">Optional</span></label>
                <input
                  type="date"
                  value={endsAt}
                  onChange={e => setEndsAt(e.target.value)}
                  className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                />
              </div>
            </div>`
);

// Chunk 11: End tab
content = content.replace(
  `      </div>
    </div>
  );`,
  `      </div>
      )}
    </div>
  );`
);

// Chunk 12: List dates
content = content.replace(
  `                <div>
                  <h4 className="text-sm font-bold text-white">{camp.title.replace('CAMP_', '').split('_')[2]}</h4>
                  <p className="text-[10px] text-emerald-400">{camp.summary}</p>
                </div>`,
  `                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">{camp.title.replace('CAMP_', '').split('_')[2]}</h4>
                    {camp.discount?.endsAt && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold border border-amber-500/30 flex items-center gap-1"><Calendar className="w-3 h-3" /> Ends {camp.discount.endsAt.split('T')[0]}</span>}
                  </div>
                  <p className="text-[10px] text-emerald-400 mt-1">{camp.summary}</p>
                </div>`
);

fs.writeFileSync('src/components/AutomatedCampaignsDashboard.jsx', content);
console.log("Done updating Dashboard!");
