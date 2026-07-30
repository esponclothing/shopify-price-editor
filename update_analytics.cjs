const fs = require('fs');

let content = fs.readFileSync('src/components/AutomatedCampaignsDashboard.jsx', 'utf-8');

// 1. Imports
content = content.replace(
  "import { Megaphone, CheckSquare, AlertCircle, Trash2, Tag, Search, Plus, Image as ImageIcon, Edit2, Sparkles, Rocket, Settings, Palette, Calendar } from 'lucide-react';",
  "import { Megaphone, CheckSquare, AlertCircle, Trash2, Tag, Search, Plus, Image as ImageIcon, Edit2, Sparkles, Rocket, Settings, Palette, Calendar, History, BarChart3, Users, IndianRupee } from 'lucide-react';"
);

// 2. State
content = content.replace(
  "  const [activeCampaigns, setActiveCampaigns] = useState([]);",
  `  const [activeCampaigns, setActiveCampaigns] = useState([]);
  const [expiredCampaigns, setExpiredCampaigns] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);`
);

// 3. fetchActiveCampaigns
content = content.replace(
  `          discountNodes(first: 50, query: "status:ACTIVE OR status:SCHEDULED") {`,
  `          discountNodes(first: 100, query: "status:ACTIVE OR status:SCHEDULED OR status:EXPIRED") {`
);

content = content.replace(
  `      setActiveCampaigns(campaigns);`,
  `      setActiveCampaigns(campaigns.filter(c => c.status === 'ACTIVE' || c.status === 'SCHEDULED'));
      setExpiredCampaigns(campaigns.filter(c => c.status === 'EXPIRED'));`
);

// 4. Analytics Function
const fetchThemeSettingsLocation = `  const fetchThemeSettings = async () => {`;
content = content.replace(fetchThemeSettingsLocation, `
  const handleViewAnalytics = async (camp) => {
    setLoadingAnalytics(camp.id);
    setAnalyticsData(null);
    try {
      let allOrders = [];
      let hasNextPage = true;
      let cursor = null;
      let queryStr = \`query($cursor: String) { orders(first: 100, after: $cursor, query: "created_at:>=\${camp.discount.startsAt}") { pageInfo { hasNextPage endCursor } edges { node { id name createdAt totalPriceSet { presentmentMoney { amount } } customer { firstName lastName email } discountApplications(first: 10) { edges { node { ... on AutomaticDiscountApplication { title } } } } } } } }\`;
      
      while (hasNextPage) {
        const res = await axios.post('/api/shopify/graphql.json', { query: queryStr, variables: { cursor } });
        const data = res.data?.data?.orders;
        if (!data) break;
        allOrders = [...allOrders, ...data.edges.map(e => e.node)];
        hasNextPage = data.pageInfo.hasNextPage;
        cursor = data.pageInfo.endCursor;
        if (allOrders.length >= 500) break;
      }

      const campOrders = allOrders.filter(o => {
        const hasMatch = o.discountApplications?.edges.some(e => e.node?.title === camp.title);
        if (camp.discount.endsAt) {
           return hasMatch && new Date(o.createdAt) <= new Date(camp.discount.endsAt);
        }
        return hasMatch;
      });

      const totalValue = campOrders.reduce((sum, o) => sum + parseFloat(o.totalPriceSet?.presentmentMoney?.amount || 0), 0);
      const customers = campOrders.map(o => o.customer).filter(c => c);
      
      const uniqueCustomers = [];
      const seen = new Set();
      for (const c of customers) {
         const key = c.email || (c.firstName + ' ' + c.lastName);
         if (!seen.has(key)) { seen.add(key); uniqueCustomers.push(c); }
      }

      setAnalyticsData({
        campaign: camp,
        totalOrders: campOrders.length,
        totalValue: totalValue.toFixed(2),
        customers: uniqueCustomers
      });
    } catch(err) {
      console.error(err);
      setError("Failed to fetch analytics");
    } finally {
      setLoadingAnalytics(false);
    }
  };

${fetchThemeSettingsLocation}`);


// 5. Tab Buttons
content = content.replace(
  `          <button onClick={() => setActiveTab('theme')} className={\`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 \${activeTab === 'theme' ? 'bg-[#1E293B] text-white shadow' : 'text-slate-400 hover:text-slate-200'}\`}>
            <Palette className="w-4 h-4" /> Theme UI
          </button>
        </div>`,
  `          <button onClick={() => setActiveTab('theme')} className={\`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 \${activeTab === 'theme' ? 'bg-[#1E293B] text-white shadow' : 'text-slate-400 hover:text-slate-200'}\`}>
            <Palette className="w-4 h-4" /> Theme UI
          </button>
          <button onClick={() => setActiveTab('history')} className={\`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 \${activeTab === 'history' ? 'bg-[#1E293B] text-white shadow' : 'text-slate-400 hover:text-slate-200'}\`}>
            <History className="w-4 h-4" /> History
          </button>
        </div>`
);


// 6. History Tab UI
const historyTabUI = `
      {activeTab === 'history' && (
        <div className="space-y-6 max-w-4xl">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><History className="w-5 h-5 text-yellow-500" /> Campaign History & Analytics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="bg-[#1E293B] border border-slate-800 rounded-2xl p-6">
              <h4 className="text-base font-bold text-white mb-4">Expired Campaigns</h4>
              {expiredCampaigns.length === 0 ? (
                 <p className="text-sm text-slate-400">No expired campaigns found.</p>
              ) : (
                <div className="space-y-3">
                  {expiredCampaigns.map(camp => (
                    <div key={camp.id} className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{camp.title.replace('CAMP_', '').split('_')[2] || 'Campaign'}</h4>
                          <span className="px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400 text-[9px] font-bold border border-slate-500/30">Expired</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">{camp.summary}</p>
                      </div>
                      <button onClick={() => handleViewAnalytics(camp)} className="px-3 py-1.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-bold hover:bg-indigo-500/30 transition-colors flex items-center gap-1">
                        {loadingAnalytics === camp.id ? <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div> : <BarChart3 className="w-3 h-3" />}
                        Analytics
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {analyticsData && (
              <div className="bg-[#1E293B] border border-slate-700 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-orange-500"></div>
                <h4 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-yellow-500" /> Results: {analyticsData.campaign.title.replace('CAMP_', '').split('_')[2]}</h4>
                
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                      <Tag className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-semibold mb-1">Total Orders</p>
                      <p className="text-2xl font-black text-white">{analyticsData.totalOrders}</p>
                    </div>
                  </div>
                  <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                      <IndianRupee className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-semibold mb-1">Total Value</p>
                      <p className="text-2xl font-black text-white">₹{analyticsData.totalValue}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-6">
                  <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-slate-400" /> Customer List</h4>
                  {analyticsData.customers.length === 0 ? (
                    <p className="text-sm text-slate-500">No customers found for this campaign.</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-slate-700 pr-2">
                      {analyticsData.customers.map((c, i) => (
                        <div key={i} className="bg-[#0F172A] border border-slate-800 rounded-lg p-3">
                          <p className="text-sm font-bold text-slate-200">{c.firstName} {c.lastName}</p>
                          <p className="text-xs text-slate-500">{c.email || 'No email provided'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
`;

content = content.replace(
  `      {activeTab === 'campaigns' && (`,
  historyTabUI + `\n      {activeTab === 'campaigns' && (`
);

fs.writeFileSync('src/components/AutomatedCampaignsDashboard.jsx', content);
console.log("Done updating Dashboard for Analytics!");
