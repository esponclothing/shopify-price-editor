import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, Users, MessageSquare, DollarSign, 
  Activity, ShoppingCart, RefreshCw
} from 'lucide-react';

// Mock data generation for 30 days
const generateData = () => {
  const data = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    data.push({
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: Math.floor(Math.random() * 50000) + 10000,
      orders: Math.floor(Math.random() * 50) + 10,
      aiMessages: Math.floor(Math.random() * 500) + 100,
      humanMessages: Math.floor(Math.random() * 100) + 20,
      abCartsRecovered: Math.floor(Math.random() * 15) + 2,
    });
  }
  return data;
};

export default function AnalyticsDashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    aiHandled: 0,
    recoveryRate: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // In a real app, this would fetch from /api/store-reports or similar
      // For now, we simulate API delay and use generated data
      await new Promise(r => setTimeout(r, 800));
      const chartData = generateData();
      setData(chartData);

      // Calculate totals
      const totals = chartData.reduce((acc, curr) => ({
        totalRevenue: acc.totalRevenue + curr.revenue,
        totalOrders: acc.totalOrders + curr.orders,
        aiHandled: acc.aiHandled + curr.aiMessages,
        abCartsRecovered: acc.abCartsRecovered + curr.abCartsRecovered
      }), { totalRevenue: 0, totalOrders: 0, aiHandled: 0, abCartsRecovered: 0 });

      setKpis({
        totalRevenue: totals.totalRevenue,
        totalOrders: totals.totalOrders,
        aiHandled: totals.aiHandled,
        recoveryRate: ((totals.abCartsRecovered / (totals.abCartsRecovered * 3)) * 100).toFixed(1)
      });
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xl">
          <p className="text-white font-bold mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-300">{entry.name}:</span>
              <span className="font-bold text-white">
                {entry.name === 'Revenue' ? `₹${entry.value.toLocaleString()}` : entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-7 h-7 text-emerald-500" />
            Performance & Analytics
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Track your store revenue, AI chat performance, and recovery metrics over the last 30 days.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold border border-slate-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
          Refresh Data
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1E293B] border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full blur-2xl" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-400">Total Revenue (30d)</h3>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">
            ₹{kpis.totalRevenue.toLocaleString()}
          </div>
          <div className="text-xs font-semibold text-emerald-400 mt-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> +12.5% from last month
          </div>
        </div>

        <div className="bg-[#1E293B] border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-bl-full blur-2xl" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-400">Total Orders</h3>
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">
            {kpis.totalOrders.toLocaleString()}
          </div>
          <div className="text-xs font-semibold text-blue-400 mt-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> +8.2% from last month
          </div>
        </div>

        <div className="bg-[#1E293B] border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-bl-full blur-2xl" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-400">AI Messages Sent</h3>
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-purple-500" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">
            {kpis.aiHandled.toLocaleString()}
          </div>
          <div className="text-xs font-semibold text-slate-400 mt-2">
            Saving approx. {Math.round(kpis.aiHandled / 60)} hours of agent time
          </div>
        </div>

        <div className="bg-[#1E293B] border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-bl-full blur-2xl" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-400">AB Cart Recovery</h3>
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">
            {kpis.recoveryRate}%
          </div>
          <div className="text-xs font-semibold text-amber-400 mt-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> +2.1% improvement
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1E293B] border border-slate-800 rounded-2xl p-6 shadow-lg">
          <h3 className="text-base font-bold text-white mb-6">Revenue & Orders (30 Days)</h3>
          <div className="h-80 w-full">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-slate-500">Loading chart...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={val => `₹${val/1000}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-[#1E293B] border border-slate-800 rounded-2xl p-6 shadow-lg">
          <h3 className="text-base font-bold text-white mb-6">AI vs Human Messages</h3>
          <div className="h-80 w-full">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-slate-500">Loading chart...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{fill: '#334155', opacity: 0.4}} />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Bar dataKey="aiMessages" name="AI Handled" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="humanMessages" name="Human Agent" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
