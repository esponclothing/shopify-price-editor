import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Activity, Users, Send, CheckCircle2, Eye, MousePointerClick, XCircle, AlertCircle, RefreshCw, Smartphone, Hash, Link as LinkIcon, Edit3, Download } from 'lucide-react';

export default function WhatsAppBroadcastsManager() {
  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'history'
  const [templates, setTemplates] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // New Broadcast Form State
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [variablesMapping, setVariablesMapping] = useState({}); // e.g. { "1": "customer_name" }
  const [headerMediaUrl, setHeaderMediaUrl] = useState('');
  const [segment, setSegment] = useState('last_30_days');
  const [testPhone, setTestPhone] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [segmentConfig, setSegmentConfig] = useState({ minSpend: '', location: '', productKeywords: '' });
  
  const [estimate, setEstimate] = useState({ count: 0, cost: 0, loading: false, previewCustomers: [] });

  // History State
  const [selectedBroadcast, setSelectedBroadcast] = useState(null);
  const [broadcastLogs, setBroadcastLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('all'); // 'all', 'sent', 'delivered', 'read', 'clicked', 'failed'
  const [retrying, setRetrying] = useState(false);
  const [broadcastRoi, setBroadcastRoi] = useState({});

  useEffect(() => {
    fetchTemplates();
    fetchBroadcasts();
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      calculateEstimate();
      // Initialize variables mapping based on regex search for {{1}}, {{2}} in template components
      const newMapping = {};
      const maxVars = getMaxVariables(selectedTemplate);
      for (let i = 1; i <= maxVars; i++) {
        newMapping[i] = 'customer_name'; // default
      }
      // Do NOT auto-fill with Meta's scontent.whatsapp.net URLs - they expire and cause 131053 errors.
      // The backend will fetch a fresh copy from Meta API and upload it as a stable Media ID.
      setHeaderMediaUrl('');

    }
  }, [selectedTemplate, segment]);

  const getMaxVariables = (template) => {
    let max = 0;
    if (!template?.components) return max;
    template.components.forEach(comp => {
      const text = comp.text || '';
      const matches = text.match(/\{\{(\d+)\}\}/g);
      if (matches) {
        matches.forEach(m => {
          const num = parseInt(m.replace(/\D/g, ''));
          if (num > max) max = num;
        });
      }
    });
    return max;
  };

  const fetchTemplates = async () => {
    try {
      const res = await axios.get('/api/whatsapp-templates');
      if (res.data?.templates) {
        setTemplates(res.data.templates.filter(t => t.status === 'APPROVED'));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBroadcasts = async () => {
    setRefreshing(true);
    try {
      const res = await axios.get('/api/whatsapp-broadcast');
      if (res.data?.success) {
        setBroadcasts(res.data.broadcasts || []);
      }
    } catch (e) {
      console.error(e);
    }
    setRefreshing(false);
  };

  const fetchBroadcastDetails = async (id) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/whatsapp-broadcast?id=${id}`);
      if (res.data?.success) {
        setSelectedBroadcast(res.data.broadcast);
        setBroadcastLogs(res.data.logs || []);
        setLogFilter('all');
        
        // Fetch ROI
        setBroadcastRoi(prev => ({ ...prev, [id]: { loading: true } }));
        axios.post('/api/whatsapp-broadcast', { action: 'roi_stats', broadcast_id: id }).then(roiRes => {
           if (roiRes.data?.success) {
             setBroadcastRoi(prev => ({ ...prev, [id]: { revenue: roiRes.data.attributedRevenue, orders: roiRes.data.attributedOrders, loading: false } }));
           }
        }).catch(() => {
           setBroadcastRoi(prev => ({ ...prev, [id]: { loading: false } }));
        });
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleDownloadCSV = () => {
    if (!broadcastLogs.length) return;
    const header = ['Phone Number', 'Status', 'Last Updated', 'Error'];
    const rows = broadcastLogs.map(log => [
      log.phone,
      log.status,
      new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(log.updated_at)),
      (log.error_message || '').replace(/,/g, '') // strip commas to prevent breaking csv
    ]);
    const csvContent = [header, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Broadcast_${selectedBroadcast?.name?.replace(/ /g, '_')}_Logs.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRetryFailed = async () => {
    if (!selectedBroadcast || retrying) return;
    setRetrying(true);
    try {
      const res = await axios.post('/api/whatsapp-broadcast', {
        action: 'retry_failed',
        broadcast_id: selectedBroadcast.id
      });
      if (res.data?.success) {
        alert(res.data.message);
        fetchBroadcastDetails(selectedBroadcast.id);
      } else {
        alert('Failed to retry: ' + (res.data?.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
    setRetrying(false);
  };

  const calculateEstimate = async () => {
    if (!selectedTemplate) return;
    setEstimate({ ...estimate, loading: true });
    try {
      const res = await axios.post('/api/whatsapp-broadcast', {
        action: 'estimate',
        segment,
        segment_config: segmentConfig,
        template_name: selectedTemplate.name,
        category: selectedTemplate.category
      });
      if (res.data?.success) {
        setEstimate({ count: res.data.count, cost: res.data.estimatedCost, previewCustomers: res.data.previewCustomers || [], loading: false });
      }
    } catch (e) {
      setEstimate({ ...estimate, loading: false });
    }
  };

  const handleTestSend = async () => {
    if (!selectedTemplate) return alert('Select a template first.');
    if (!testPhone) return alert('Enter a test phone number.');
    if (testPhone.length < 10) return alert('Enter a valid 10-digit number.');

    setLoading(true);
    try {
      const res = await axios.post('/api/whatsapp-broadcast', {
        action: 'test',
        template_name: selectedTemplate.name,
        template_components: selectedTemplate.components,
        variables_mapping: variablesMapping,
        header_media_url: headerMediaUrl,
        test_phone: testPhone
      });
      if (res.data?.success) {
        alert('Test message sent successfully!');
      } else {
        alert('Failed to send test: ' + res.data?.error);
      }
    } catch (e) {
      alert('Error: ' + (e.response?.data?.error || e.message));
    }
    setLoading(false);
  };

  const handleStartBroadcast = async () => {
    if (!selectedTemplate) return alert('Select a template first.');
    if (estimate.count === 0) return alert('No customers in this segment.');
    
    if (!confirm(`Are you sure you want to broadcast to ${estimate.count} customers? Estimated cost is ₹${estimate.cost}.`)) return;

    setLoading(true);
    try {
      const res = await axios.post('/api/whatsapp-broadcast', {
        action: 'start',
        segment,
        segment_config: segmentConfig,
        template_name: selectedTemplate.name,
        template_components: selectedTemplate.components,
        category: selectedTemplate.category,
        header_media_url: headerMediaUrl,
        variables_mapping: variablesMapping,
        scheduled_at: scheduledAt || null
      });
      if (res.data?.success) {
        alert('Broadcast started successfully!');
        setActiveTab('history');
        fetchBroadcasts();
      } else {
        alert('Failed to start: ' + res.data?.error);
      }
    } catch (e) {
      alert('Error: ' + (e.response?.data?.error || e.message));
    }
    setLoading(false);
  };

  return (
    <div className="bg-[#0B0F19] text-slate-900 dark:text-white flex flex-col h-full rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl">
      <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1E293B]">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Send className="w-6 h-6 text-emerald-400" /> WhatsApp Broadcast Engine
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Send bulk template messages and track live analytics</p>
        </div>
        <div className="flex bg-slate-50 dark:bg-slate-900 rounded-lg p-1 border border-slate-300 dark:border-slate-700">
          <button 
            onClick={() => { setActiveTab('new'); setSelectedBroadcast(null); }}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === 'new' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-white'}`}
          >
            Create Broadcast
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === 'history' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-white'}`}
          >
            Live Analytics
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {activeTab === 'new' && (
          <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
            <div className="flex-1 space-y-6">
              <div className="bg-[#1E293B] rounded-xl p-6 border border-slate-300 dark:border-slate-700">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span className="bg-emerald-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span> 
                  Select Approved Template
                </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[300px] overflow-y-auto pr-2">
                {templates.map(t => (
                  <div 
                    key={t.name}
                    onClick={() => setSelectedTemplate(t)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedTemplate?.name === t.name ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-500'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-sm truncate">{t.name}</h4>
                      <span className="text-[10px] px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full">{t.category}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3">
                      {t.components?.find(c => c.type === 'BODY')?.text || 'No text body'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {selectedTemplate && (
              <div className="bg-[#1E293B] rounded-xl p-6 border border-slate-300 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-4">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span className="bg-emerald-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span> 
                  Map Template Variables & Media
                </h3>
                
                {selectedTemplate?.components?.some(c => c.type === 'HEADER' && (c.format === 'IMAGE' || c.format === 'VIDEO' || c.format === 'DOCUMENT')) && (
                  <div className="mb-6 space-y-2">
                    <label className="text-sm font-semibold text-emerald-400">Header Media URL (Required)</label>
                    <input 
                      type="text" 
                      placeholder="https://your-website.com/image.jpg"
                      value={headerMediaUrl}
                      onChange={(e) => setHeaderMediaUrl(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm focus:border-emerald-500 outline-none"
                    />
                    <p className="text-xs text-slate-600 dark:text-slate-400">Provide a direct public link to the image or video that matches this template's category.</p>
                  </div>
                )}

                {getMaxVariables(selectedTemplate) === 0 ? (
                  <p className="text-slate-600 dark:text-slate-400 text-sm">This template does not require any dynamic text variables.</p>
                ) : (
                  <div className="space-y-4">
                    {Array.from({ length: getMaxVariables(selectedTemplate) }).map((_, i) => (
                      <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="font-mono bg-white dark:bg-slate-800 px-3 py-2 rounded-lg text-emerald-400 font-bold shrink-0">
                          &#123;&#123;{i + 1}&#125;&#125;
                        </div>
                        <select 
                          value={variablesMapping[i + 1] || 'customer_name'}
                          onChange={(e) => setVariablesMapping({ ...variablesMapping, [i + 1]: e.target.value })}
                          className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm focus:border-emerald-500 outline-none"
                        >
                          <option value="customer_name">Customer Name</option>
                          <option value="order_number">Order Number</option>
                          <option value="phone_number">Customer Phone Number</option>
                          <option value="tracking_url">Order Tracking URL</option>
                          <option value="static_text:Hello">Static Text ("Hello")</option>
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedTemplate && (
              <div className="bg-[#1E293B] rounded-xl p-6 border border-slate-300 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-4">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span className="bg-emerald-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span> 
                  Select Customer Segment
                </h3>
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                  <select 
                    value={segment} 
                    onChange={e => setSegment(e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm focus:border-emerald-500 outline-none"
                  >
                    <option value="last_30_days">Customers who ordered in last 30 days</option>
                    <option value="no_orders_30_days">Customers with NO orders in last 30 days</option>
                    <option value="abandoned_carts_30_days">Abandoned Carts (last 30 days)</option>
                    <option value="signed_up_not_ordered">Signed Up but Not Ordered (Abandoned Carts without orders)</option>
                    <option value="all">All Customers (Who Ordered)</option>
                    <option value="custom">🛠️ Custom Segment Builder</option>
                  </select>
                </div>
                
                {segment === 'custom' && (
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 mb-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Min Spend (₹)</label>
                        <input 
                          type="number" 
                          placeholder="e.g. 5000" 
                          value={segmentConfig.minSpend} 
                          onChange={e => { setSegmentConfig({ ...segmentConfig, minSpend: e.target.value }); setEstimate({ ...estimate, count: 0 }); }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md p-2 text-sm focus:border-emerald-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Location (State/City)</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Maharashtra" 
                          value={segmentConfig.location} 
                          onChange={e => { setSegmentConfig({ ...segmentConfig, location: e.target.value }); setEstimate({ ...estimate, count: 0 }); }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md p-2 text-sm focus:border-emerald-500 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Product Keywords</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Whey Protein" 
                        value={segmentConfig.productKeywords} 
                        onChange={e => { setSegmentConfig({ ...segmentConfig, productKeywords: e.target.value }); setEstimate({ ...estimate, count: 0 }); }}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md p-2 text-sm focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <button 
                      onClick={calculateEstimate}
                      className="bg-slate-800 text-white hover:bg-slate-700 text-xs font-bold px-4 py-2 rounded-lg transition-all"
                    >
                      Calculate Audience Size
                    </button>
                  </div>
                )}
                
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Target Audience</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 mt-1">
                      {estimate.loading ? <RefreshCw className="w-5 h-5 animate-spin text-slate-500" /> : estimate.count} 
                      <Users className="w-5 h-5 text-emerald-400" />
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Estimated Cost</p>
                    <p className="text-2xl font-black text-emerald-400 mt-1">
                      {estimate.loading ? '...' : `₹${estimate.cost}`}
                    </p>
                  </div>
                </div>

                {!estimate.loading && estimate.previewCustomers && estimate.previewCustomers.length > 0 && (
                  <div className="mt-6 border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden">
                    <div className="bg-white dark:bg-slate-800 p-3 border-b border-slate-300 dark:border-slate-700">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Audience Preview (Sample of {estimate.previewCustomers.length})</p>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/50 dark:bg-slate-900/50 sticky top-0">
                          <tr className="text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                            <th className="p-3 font-semibold">Name</th>
                            <th className="p-3 font-semibold">Phone</th>
                            <th className="p-3 font-semibold">Order/Context</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {estimate.previewCustomers.map((c, i) => (
                            <tr key={i} className="hover:bg-white/30 dark:bg-slate-800/30">
                              <td className="p-3 text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{c.customer_name || c.name || 'N/A'}</td>
                              <td className="p-3 font-mono text-emerald-400/80">{c.phone_last10}</td>
                              <td className="p-3 text-slate-600 dark:text-slate-400 truncate max-w-[120px]">{c.order_number || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedTemplate && (
              <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 bg-[#1E293B] rounded-xl p-4 border border-slate-300 dark:border-slate-700 flex items-center gap-2">
                    <input 
                      type="text" 
                      placeholder="Test Phone Number"
                      value={testPhone}
                      onChange={e => setTestPhone(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none text-sm placeholder-slate-500"
                    />
                    <button 
                      onClick={handleTestSend}
                      disabled={loading}
                      className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                    >
                      Test Send
                    </button>
                  </div>
                  <div className="flex-1 bg-[#1E293B] rounded-xl p-4 border border-slate-300 dark:border-slate-700 flex items-center gap-2 relative">
                    <span className="text-slate-600 dark:text-slate-400 text-sm font-bold shrink-0">Schedule:</span>
                    <input 
                      type="datetime-local" 
                      value={scheduledAt}
                      onChange={e => setScheduledAt(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 dark:text-white focus:ring-0 [&::-webkit-calendar-picker-indicator]:invert"
                    />
                    {scheduledAt && (
                      <button onClick={() => setScheduledAt('')} className="absolute right-4 text-xs text-slate-500 hover:text-slate-900 dark:text-white">Clear</button>
                    )}
                  </div>
                </div>
                
                <button 
                  onClick={handleStartBroadcast}
                  disabled={loading || estimate.count === 0}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white w-full py-4 rounded-xl text-lg font-black transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/20"
                >
                  <Send className="w-6 h-6" /> {scheduledAt ? 'Schedule Broadcast' : 'Start Broadcast Now'}
                </button>
              </div>
            )}
            
            {selectedTemplate && (
              <div className="w-full lg:w-[320px] shrink-0 animate-in fade-in slide-in-from-right-4">
                <div className="sticky top-6">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Smartphone className="w-4 h-4" /> Live Preview
                  </h3>
                  <div className="bg-[#EFEAE2] rounded-3xl border-[8px] border-slate-900 shadow-2xl h-[550px] overflow-hidden flex flex-col relative">
                    {/* Fake WhatsApp Header */}
                    <div className="bg-[#008069] px-4 py-3 flex items-center gap-3 shadow-md z-10">
                      <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center overflow-hidden">
                        <img src="/logo.png" alt="11Fit" className="w-full h-full object-cover" onError={(e) => e.target.style.display = 'none'} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white font-semibold text-[15px] leading-none">11FIT</h4>
                        <p className="text-white/80 text-[11px] mt-0.5">Business Account</p>
                      </div>
                    </div>
                    {/* Chat Body */}
                    <div className="flex-1 overflow-y-auto p-4" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: 'cover' }}>
                      <div className="bg-white rounded-lg p-2 shadow-sm inline-block max-w-[90%] float-left rounded-tl-none relative mb-4">
                        {headerMediaUrl && (selectedTemplate?.components?.some(c => c.type === 'HEADER' && (c.format === 'IMAGE' || c.format === 'VIDEO'))) && (
                          <div className="rounded-md overflow-hidden mb-2 bg-slate-100 max-h-[160px] flex items-center justify-center">
                            <img src={headerMediaUrl} alt="Header" className="w-full h-auto object-cover" onError={(e) => { e.target.src = 'https://via.placeholder.com/300x160?text=Invalid+Image+URL' }} />
                          </div>
                        )}
                        {selectedTemplate?.components?.find(c => c.type === 'HEADER' && c.format === 'DOCUMENT') && (
                          <div className="bg-slate-100 p-3 rounded-md flex items-center gap-3 mb-2">
                            <div className="bg-red-500 p-2 rounded text-white"><LinkIcon className="w-4 h-4" /></div>
                            <span className="text-sm font-semibold truncate text-slate-700">Document.pdf</span>
                          </div>
                        )}
                        <p className="text-[14px] text-[#111b21] leading-relaxed whitespace-pre-wrap">
                          {(() => {
                            const bodyComp = selectedTemplate?.components?.find(c => c.type === 'BODY');
                            let text = bodyComp?.text || '';
                            const maxVars = getMaxVariables(selectedTemplate);
                            for(let i = 1; i <= maxVars; i++) {
                              const val = variablesMapping[i] || 'customer_name';
                              let displayVal = 'John Doe';
                              if(val === 'order_number') displayVal = '#1024';
                              if(val === 'phone_number') displayVal = '+91 9999999999';
                              if(val === 'tracking_url') displayVal = 'https://track.it';
                              if(val.startsWith('static_text:')) displayVal = val.split(':')[1];
                              text = text.replace(`{{${i}}}`, `*${displayVal}*`); // Using bold to simulate highlight
                            }
                            // Convert markdown bold
                            const parts = text.split(/\*(.*?)\*/g);
                            return parts.map((part, idx) => idx % 2 === 1 ? <strong key={idx}>{part}</strong> : part);
                          })()}
                        </p>
                        {selectedTemplate?.components?.find(c => c.type === 'FOOTER') && (
                          <p className="text-[11px] text-[#667781] mt-2">{selectedTemplate.components.find(c => c.type === 'FOOTER').text}</p>
                        )}
                        <div className="text-[10px] text-[#667781] text-right mt-1">12:00 PM</div>
                      </div>
                      
                      {selectedTemplate?.components?.find(c => c.type === 'BUTTONS') && (
                        <div className="clear-both flex flex-col gap-1 w-full max-w-[90%]">
                           {selectedTemplate.components.find(c => c.type === 'BUTTONS').buttons.map((b, i) => (
                             <div key={i} className="bg-white rounded-lg p-2.5 shadow-sm text-center text-[#00a884] font-semibold text-[14px] border border-slate-100 flex items-center justify-center gap-2">
                               {b.type === 'URL' ? <LinkIcon className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                               {b.text}
                             </div>
                           ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && !selectedBroadcast && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div className="flex justify-end mb-4">
              <button onClick={fetchBroadcasts} className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-all text-sm font-semibold">
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
            {broadcasts.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No broadcasts found. Create one to get started!</div>
            ) : (
              broadcasts.map(b => (
                <div 
                  key={b.id} 
                  onClick={() => fetchBroadcastDetails(b.id)}
                  className="bg-[#1E293B] rounded-xl p-5 border border-slate-300 dark:border-slate-700 cursor-pointer hover:border-emerald-500/50 hover:bg-white dark:bg-slate-800 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                >
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-emerald-400 transition-all">{b.name}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                      <span className="bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded text-slate-700 dark:text-slate-300">{b.template_name}</span>
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {b.total_count} targeted</span>
                      <span>{new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(b.created_at))}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Status</p>
                      <span className={`text-sm font-black ${b.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {b.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Delivered</p>
                      <span className="text-sm font-black text-blue-400">{b.delivered_count}</span>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Read</p>
                      <span className="text-sm font-black text-cyan-400">{b.read_count}</span>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Replies</p>
                      <span className="text-sm font-black text-pink-400">{b.replies_count || 0}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'history' && selectedBroadcast && (
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <button 
                onClick={() => setSelectedBroadcast(null)}
                className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-all text-sm font-semibold"
              >
                &larr; Back to all broadcasts
              </button>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleDownloadCSV}
                  className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-emerald-400 transition-all text-sm font-semibold bg-white dark:bg-slate-800 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-emerald-500/50"
                >
                  <Download className="w-4 h-4" /> Download Report
                </button>
                <button 
                  onClick={() => fetchBroadcastDetails(selectedBroadcast.id)}
                  className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-all text-sm font-semibold bg-white dark:bg-slate-800 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-emerald-500"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>
            </div>

            <div className="bg-[#1E293B] rounded-2xl p-6 border border-slate-300 dark:border-slate-700 shadow-xl mb-8">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white">{selectedBroadcast.name}</h2>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">Template: <span className="text-emerald-400 font-bold">{selectedBroadcast.template_name}</span></p>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-black tracking-wider ${selectedBroadcast.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {selectedBroadcast.status.toUpperCase()}
                  </span>
                  <p className="text-xs font-bold text-slate-500 mt-2">Started: {new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(selectedBroadcast.created_at))}</p>
                </div>
              </div>

              {/* Analytics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 animate-in fade-in slide-in-from-bottom-4">
                <div 
                  onClick={() => setLogFilter('all')}
                  className={`rounded-xl p-4 border text-center cursor-pointer transition-all ${logFilter === 'all' ? 'bg-white dark:bg-slate-800 border-slate-500 shadow-lg' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:border-slate-600'}`}
                >
                  <Users className={`w-6 h-6 mx-auto mb-2 ${logFilter === 'all' ? 'text-white' : 'text-slate-600 dark:text-slate-400'}`} />
                  <p className="text-xs font-bold text-slate-500 uppercase">Targeted</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{selectedBroadcast.total_count}</p>
                </div>
                <div 
                  onClick={() => setLogFilter('sent')}
                  className={`rounded-xl p-4 border text-center cursor-pointer transition-all ${logFilter === 'sent' ? 'bg-amber-950/40 border-amber-500/50 shadow-lg' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-500/30'}`}
                >
                  <Send className={`w-6 h-6 mx-auto mb-2 ${logFilter === 'sent' ? 'text-amber-400' : 'text-amber-400/60'}`} />
                  <p className="text-xs font-bold text-slate-500 uppercase">Sent</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{broadcastLogs.filter(l => l.status === 'sent').length}</p>
                </div>
                <div 
                  onClick={() => setLogFilter('delivered')}
                  className={`rounded-xl p-4 border text-center cursor-pointer transition-all ${logFilter === 'delivered' ? 'bg-blue-950/40 border-blue-500/50 shadow-lg' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-500/30'}`}
                >
                  <CheckCircle2 className={`w-6 h-6 mx-auto mb-2 ${logFilter === 'delivered' ? 'text-blue-400' : 'text-blue-400/60'}`} />
                  <p className="text-xs font-bold text-slate-500 uppercase">Delivered</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{broadcastLogs.filter(l => l.status === 'delivered').length}</p>
                </div>
                <div 
                  onClick={() => setLogFilter('read')}
                  className={`rounded-xl p-4 border text-center cursor-pointer transition-all ${logFilter === 'read' ? 'bg-cyan-950/40 border-cyan-500/50 shadow-lg' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-cyan-500/30'}`}
                >
                  <Eye className={`w-6 h-6 mx-auto mb-2 ${logFilter === 'read' ? 'text-cyan-400' : 'text-cyan-400/60'}`} />
                  <p className="text-xs font-bold text-slate-500 uppercase">Read</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{broadcastLogs.filter(l => l.status === 'read').length}</p>
                </div>
                <div 
                  onClick={() => setLogFilter('clicked')}
                  className={`rounded-xl p-4 border text-center cursor-pointer transition-all ${logFilter === 'clicked' ? 'bg-purple-950/40 border-purple-500/50 shadow-lg' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-purple-500/30'}`}
                >
                  <MousePointerClick className={`w-6 h-6 mx-auto mb-2 ${logFilter === 'clicked' ? 'text-purple-400' : 'text-purple-400/60'}`} />
                  <p className="text-xs font-bold text-slate-500 uppercase">Clicked</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{broadcastLogs.filter(l => l.status === 'clicked').length}</p>
                </div>
                <div 
                  className="rounded-xl p-4 border bg-gradient-to-br from-emerald-950/40 to-slate-900 border-emerald-900/50 text-center relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-2 opacity-10">
                    <Activity className="w-16 h-16 text-emerald-400" />
                  </div>
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest relative z-10">Generated ROI</p>
                  <div className="mt-2 relative z-10">
                    {broadcastRoi[selectedBroadcast.id]?.loading ? (
                      <RefreshCw className="w-5 h-5 animate-spin text-emerald-500 mx-auto" />
                    ) : (
                      <>
                        <p className="text-2xl font-black text-emerald-400">
                          ₹{broadcastRoi[selectedBroadcast.id]?.revenue?.toLocaleString() || 0}
                        </p>
                        <p className="text-[10px] text-emerald-500/80 font-bold mt-1">
                          {broadcastRoi[selectedBroadcast.id]?.orders || 0} Orders (7-Day Attribution)
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {broadcastLogs.filter(l => l.status === 'failed').length > 0 && (
                <div 
                  onClick={() => setLogFilter('failed')}
                  className={`mt-4 border rounded-xl p-4 flex items-center justify-between cursor-pointer transition-all ${logFilter === 'failed' ? 'bg-red-950/60 border-red-500 shadow-lg' : 'bg-red-950/30 border-red-900/50 hover:border-red-500/50'}`}
                >
                  <div className="flex items-center gap-3">
                    <XCircle className="w-6 h-6 text-red-500" />
                    <div>
                      <p className="text-red-400 font-bold">Failed Messages</p>
                      <p className="text-red-500/70 text-xs">Some messages could not be delivered.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-black text-red-500">{broadcastLogs.filter(l => l.status === 'failed').length}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleRetryFailed(); }}
                      disabled={retrying}
                      className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {retrying ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Retry Failed
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[#1E293B] rounded-2xl p-6 border border-slate-300 dark:border-slate-700 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Detailed Logs {logFilter !== 'all' && <span className="ml-2 text-sm font-normal text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-1 rounded-full uppercase tracking-wider">{logFilter}</span>}
                </h3>
                {logFilter !== 'all' && (
                  <button onClick={() => setLogFilter('all')} className="text-xs text-emerald-400 hover:text-emerald-300 font-bold">
                    Clear Filter
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                      <th className="pb-3 font-semibold">Phone Number</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Last Updated</th>
                      <th className="pb-3 font-semibold">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {broadcastLogs.filter(l => logFilter === 'all' || l.status === logFilter).slice(0, 50).map((log, idx) => (
                      <tr key={idx} className="border-b border-slate-200/50 dark:border-slate-800/50 hover:bg-white/50 dark:bg-slate-800/50">
                        <td className="py-3 font-mono text-slate-700 dark:text-slate-300">+{log.phone}</td>
                        <td className="py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider
                            ${log.status === 'read' ? 'bg-cyan-500/20 text-cyan-400' : 
                              log.status === 'delivered' ? 'bg-blue-500/20 text-blue-400' : 
                              log.status === 'clicked' ? 'bg-purple-500/20 text-purple-400' : 
                              log.status === 'sent' ? 'bg-amber-500/20 text-amber-400' : 
                              log.status === 'failed' ? 'bg-red-500/20 text-red-400' : 
                              'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
                          >
                            {log.status === 'read' && <Eye className="w-3 h-3" />}
                            {log.status === 'delivered' && <CheckCircle2 className="w-3 h-3" />}
                            {log.status === 'clicked' && <MousePointerClick className="w-3 h-3" />}
                            {log.status === 'sent' && <Send className="w-3 h-3" />}
                            {log.status === 'failed' && <XCircle className="w-3 h-3" />}
                            {log.status}
                          </span>
                        </td>
                        <td className="py-3 text-slate-600 dark:text-slate-400">{new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(log.updated_at))}</td>
                        <td className="py-3 text-red-400 text-xs truncate max-w-[200px]">{log.error_message || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {broadcastLogs.filter(l => logFilter === 'all' || l.status === logFilter).length > 50 && (
                  <div className="text-center py-4 text-slate-500 text-sm italic">
                    Showing top 50 recent logs out of {broadcastLogs.length}.
                  </div>
                )}
                {broadcastLogs.filter(l => logFilter === 'all' || l.status === logFilter).length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    No logs found for this status.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
