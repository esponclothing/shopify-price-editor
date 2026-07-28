import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShoppingCart, Users, PackageX, RefreshCw, ChevronRight } from 'lucide-react';

export default function OrdersCustomersDashboard() {
  const [activeTab, setActiveTab] = useState('orders'); // orders, abandoned, customers
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    orders: [],
    abandoned: [],
    customers: []
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'orders' && data.orders.length === 0) {
        const res = await axios.get('/api/shopify/orders.json?status=any&limit=50');
        setData(prev => ({ ...prev, orders: res.data.orders || [] }));
      } else if (activeTab === 'abandoned' && data.abandoned.length === 0) {
        const res = await axios.get('/api/shopify/checkouts.json?limit=50');
        setData(prev => ({ ...prev, abandoned: res.data.checkouts || [] }));
      } else if (activeTab === 'customers' && data.customers.length === 0) {
        const res = await axios.get('/api/shopify/customers.json?limit=50');
        setData(prev => ({ ...prev, customers: res.data.customers || [] }));
      }
    } catch (error) {
      console.error(`Error fetching ${activeTab}:`, error);
    }
    setLoading(false);
  };

  const forceRefresh = async () => {
    setData({ orders: [], abandoned: [], customers: [] });
    setLoading(true);
    try {
      if (activeTab === 'orders') {
        const res = await axios.get('/api/shopify/orders.json?status=any&limit=50');
        setData(prev => ({ ...prev, orders: res.data.orders || [] }));
      } else if (activeTab === 'abandoned') {
        const res = await axios.get('/api/shopify/checkouts.json?limit=50');
        setData(prev => ({ ...prev, abandoned: res.data.checkouts || [] }));
      } else if (activeTab === 'customers') {
        const res = await axios.get('/api/shopify/customers.json?limit=50');
        setData(prev => ({ ...prev, customers: res.data.customers || [] }));
      }
    } catch (error) {
      console.error(`Error fetching ${activeTab}:`, error);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            Store Analytics
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            View your recent orders, abandoned checkouts, and customer base.
          </p>
        </div>
        <button
          onClick={forceRefresh}
          disabled={loading}
          className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold border border-slate-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-yellow-500' : ''}`} />
          Refresh Data
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'orders' ? 'bg-yellow-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <ShoppingCart className="w-4 h-4" /> Recent Orders
        </button>
        <button
          onClick={() => setActiveTab('abandoned')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'abandoned' ? 'bg-yellow-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <PackageX className="w-4 h-4" /> Abandoned Checkouts
        </button>
        <button
          onClick={() => setActiveTab('customers')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'customers' ? 'bg-yellow-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Users className="w-4 h-4" /> Customers
        </button>
      </div>

      {/* Content */}
      <div className="bg-[#1E293B] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        {loading && (data[activeTab].length === 0) ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center">
            <RefreshCw className="w-8 h-8 animate-spin text-yellow-500 mb-4" />
            Loading {activeTab}...
          </div>
        ) : data[activeTab].length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            No {activeTab} found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800">
                  {activeTab === 'orders' && (
                    <>
                      <th className="py-4 px-6 text-xs font-bold text-slate-300 uppercase">Order</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-300 uppercase">Date</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-300 uppercase">Customer</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-300 uppercase">Total</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-300 uppercase">Status</th>
                    </>
                  )}
                  {activeTab === 'abandoned' && (
                    <>
                      <th className="py-4 px-6 text-xs font-bold text-slate-300 uppercase">Checkout</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-300 uppercase">Date</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-300 uppercase">Customer</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-300 uppercase">Total</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-300 uppercase">Recovery Url</th>
                    </>
                  )}
                  {activeTab === 'customers' && (
                    <>
                      <th className="py-4 px-6 text-xs font-bold text-slate-300 uppercase">Name</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-300 uppercase">Email</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-300 uppercase">Orders</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-300 uppercase">Total Spent</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-300 uppercase">Location</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {activeTab === 'orders' && data.orders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 px-6 text-sm font-bold text-white">{order.name}</td>
                    <td className="py-4 px-6 text-sm text-slate-400">{new Date(order.created_at).toLocaleDateString()}</td>
                    <td className="py-4 px-6 text-sm text-slate-300">{order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}` : 'Guest'}</td>
                    <td className="py-4 px-6 text-sm font-bold text-yellow-500">{order.current_total_price} {order.currency}</td>
                    <td className="py-4 px-6 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${order.financial_status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-300'}`}>
                        {order.financial_status || 'Unknown'}
                      </span>
                    </td>
                  </tr>
                ))}

                {activeTab === 'abandoned' && data.abandoned.map(checkout => (
                  <tr key={checkout.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 px-6 text-sm font-bold text-white">#{checkout.id.toString().slice(-6)}</td>
                    <td className="py-4 px-6 text-sm text-slate-400">{new Date(checkout.created_at).toLocaleDateString()}</td>
                    <td className="py-4 px-6 text-sm text-slate-300">{checkout.customer ? `${checkout.customer.first_name || ''} ${checkout.customer.last_name || ''}` : (checkout.email || 'Guest')}</td>
                    <td className="py-4 px-6 text-sm font-bold text-yellow-500">{checkout.total_price} {checkout.currency || 'INR'}</td>
                    <td className="py-4 px-6 text-sm">
                      <a href={checkout.abandoned_checkout_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1">
                        Link <ChevronRight className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}

                {activeTab === 'customers' && data.customers.map(customer => (
                  <tr key={customer.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 px-6 text-sm font-bold text-white">{customer.first_name || ''} {customer.last_name || ''}</td>
                    <td className="py-4 px-6 text-sm text-slate-400">{customer.email || 'N/A'}</td>
                    <td className="py-4 px-6 text-sm text-slate-300">{customer.orders_count || 0}</td>
                    <td className="py-4 px-6 text-sm font-bold text-yellow-500">{customer.total_spent || '0.00'} {customer.currency || 'INR'}</td>
                    <td className="py-4 px-6 text-sm text-slate-400">{customer.default_address ? `${customer.default_address.city || ''}, ${customer.default_address.country || ''}` : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
