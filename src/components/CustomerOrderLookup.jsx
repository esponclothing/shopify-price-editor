import React, { useState, useEffect } from 'react';
import {
  Search, Phone, ShoppingBag, MapPin, Truck, ExternalLink, RefreshCw,
  User, Mail, DollarSign, ChevronDown, ChevronUp, Copy, Check, Filter,
  AlertCircle, Calendar, Package, ArrowRight, MessageSquare, ShieldCheck
} from 'lucide-react';

export default function CustomerOrderLookup({ onOpenWhatsApp }) {
  const [phoneQuery, setPhoneQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [orders, setOrders] = useState([]);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [whatsappChat, setWhatsappChat] = useState(null);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [orderFilter, setOrderFilter] = useState('all'); // 'all' | 'fulfilled' | 'unfulfilled' | 'cancelled'
  const [expandedOrders, setExpandedOrders] = useState({});

  const formatPhone = (raw) => {
    if (!raw) return '';
    let digits = raw.replace(/\D/g, '');
    if (digits.length === 10) return `+91 ${digits.slice(0,5)} ${digits.slice(5)}`;
    if (digits.length === 12 && digits.startsWith('91')) {
      return `+91 ${digits.slice(2,7)} ${digits.slice(7)}`;
    }
    return raw;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const toggleOrderExpand = (orderId) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const cleanQuery = phoneQuery.trim().replace(/\s+/g, '');
    if (!cleanQuery) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    setError('');
    setHasSearched(true);
    setOrders([]);
    setCustomerInfo(null);
    setWhatsappChat(null);

    try {
      // 1. Fetch orders from /api/shopify-customer-orders
      const ordersRes = await fetch(`/api/shopify-customer-orders?phone=${encodeURIComponent(cleanQuery)}`);
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        const loadedOrders = data.orders || [];
        setOrders(loadedOrders);

        // Compute customer profile summary
        let name = data.customer?.name || '';
        let email = data.customer?.email || '';
        if (!name && loadedOrders.length > 0) {
          const firstOrd = loadedOrders[0];
          const sa = firstOrd.shipping_address;
          if (sa && (sa.first_name || sa.last_name)) {
            name = `${sa.first_name || ''} ${sa.last_name || ''}`.trim();
          } else if (firstOrd.name) {
            name = `Customer #${firstOrd.order_number || ''}`;
          }
        }
        if (!email && loadedOrders.length > 0) {
          email = loadedOrders[0].email || '';
        }

        const totalSpent = loadedOrders.reduce((sum, ord) => {
          const val = parseFloat(ord.total_price) || 0;
          return sum + val;
        }, 0);

        setCustomerInfo({
          name: name || 'Valued Customer',
          email: email || 'No email on file',
          phone: cleanQuery,
          totalOrders: loadedOrders.length,
          totalSpent: totalSpent.toFixed(2)
        });

        // Expand first order by default if available
        if (loadedOrders.length > 0) {
          setExpandedOrders({ [loadedOrders[0].id]: true });
        }
      } else {
        setError('Failed to fetch customer orders.');
      }

      // 2. Check if this customer exists in WhatsApp AI Logs
      try {
        const chatsRes = await fetch('/api/whatsapp-inbox?action=chats');
        if (chatsRes.ok) {
          const chatsData = await chatsRes.json();
          const list = chatsData.chats || [];
          const digitsQuery = cleanQuery.replace(/\D/g, '');
          const matchingChat = list.find(c => {
            const chatDigits = (c.phone || '').replace(/\D/g, '');
            return chatDigits.includes(digitsQuery) || digitsQuery.includes(chatDigits);
          });
          if (matchingChat) {
            setWhatsappChat(matchingChat);
          }
        }
      } catch (err) {
        console.warn('Could not check WhatsApp chat status:', err);
      }
    } catch (err) {
      console.error('Customer lookup error:', err);
      setError('Network error while looking up customer.');
    } finally {
      setLoading(false);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    if (orderFilter === 'all') return true;
    const fulfillments = Array.isArray(order.fulfillments) ? order.fulfillments : (typeof order.fulfillments === 'string' ? (() => { try { return JSON.parse(order.fulfillments) || []; } catch(_) { return []; } })() : []);
    const trackingNumber = fulfillments[0]?.tracking_number || null;
    const isFulfilled = order.fulfillment_status === 'fulfilled' || trackingNumber;
    const isCancelled = !!order.cancelled_at;

    if (orderFilter === 'fulfilled') return isFulfilled && !isCancelled;
    if (orderFilter === 'unfulfilled') return !isFulfilled && !isCancelled;
    if (orderFilter === 'cancelled') return isCancelled;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Top Banner / Search Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-60 h-60 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Search className="w-3.5 h-3.5" />
            <span>Instant Customer & Order Inspector</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Lookup Orders by Phone Number
          </h1>
          <p className="text-sm md:text-base text-slate-400">
            Search any customer's phone number to view their Shopify orders, shipment tracking, shipping address, and WhatsApp conversation status.
          </p>

          {/* Search Input Box */}
          <form onSubmit={handleSearch} className="pt-2">
            <div className="relative flex items-center max-w-xl mx-auto">
              <div className="absolute left-4 text-slate-400">
                <Phone className="w-5 h-5 text-emerald-400" />
              </div>
              <input
                type="text"
                value={phoneQuery}
                onChange={(e) => setPhoneQuery(e.target.value)}
                placeholder="Enter Phone Number (e.g. 9985553369 or +919833264430)..."
                className="w-full pl-12 pr-36 py-4 bg-slate-950/80 border-2 border-slate-700/80 focus:border-emerald-500 rounded-2xl text-white placeholder-slate-500 text-base font-medium outline-none transition-all shadow-lg"
              />
              <button
                type="submit"
                disabled={loading}
                className="absolute right-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-slate-950 font-extrabold rounded-xl text-sm transition-all shadow-md flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Search</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Examples */}
          <div className="flex items-center justify-center gap-2 pt-2 text-xs text-slate-500">
            <span>Example format:</span>
            <button
              type="button"
              onClick={() => { setPhoneQuery('+919985553369'); }}
              className="text-slate-400 hover:text-emerald-400 underline font-mono"
            >
              +919985553369
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => { setPhoneQuery('9833264430'); }}
              className="text-slate-400 hover:text-emerald-400 underline font-mono"
            >
              9833264430
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-center gap-3 text-rose-300">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Results Section */}
      {hasSearched && !loading && !error && (
        <div className="space-y-6">
          {/* Customer Profile Overview */}
          {customerInfo && (
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                {/* Left: Customer Basic Info */}
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                    <User className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-2xl font-black text-white">
                        {customerInfo.name}
                      </h2>
                      {customerInfo.totalOrders >= 3 ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          👑 VIP Customer
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          🛍️ Customer
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1.5 font-mono text-emerald-400 font-semibold">
                        <Phone className="w-3.5 h-3.5" />
                        {formatPhone(customerInfo.phone)}
                      </span>
                      <button
                        onClick={() => copyToClipboard(customerInfo.phone)}
                        className="text-xs px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1"
                      >
                        {copiedPhone ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedPhone ? 'Copied' : 'Copy'}</span>
                      </button>
                      {customerInfo.email && customerInfo.email !== 'No email on file' && (
                        <span className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          {customerInfo.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Stats & WhatsApp Quick Jump */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="px-4 py-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                    <span className="text-[11px] text-slate-400 block font-semibold uppercase tracking-wider">
                      Total Orders
                    </span>
                    <span className="text-xl font-black text-white">
                      {customerInfo.totalOrders}
                    </span>
                  </div>

                  <div className="px-4 py-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                    <span className="text-[11px] text-slate-400 block font-semibold uppercase tracking-wider">
                      Lifetime Spend
                    </span>
                    <span className="text-xl font-black text-emerald-400">
                      ₹{customerInfo.totalSpent}
                    </span>
                  </div>

                  {/* WhatsApp Jump Button */}
                  {whatsappChat ? (
                    <button
                      onClick={() => onOpenWhatsApp && onOpenWhatsApp(customerInfo.phone)}
                      className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/10 hover:from-emerald-500/30 hover:to-teal-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-sm transition-all flex items-center gap-2 shadow-md group"
                    >
                      <MessageSquare className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                      <div className="text-left">
                        <span className="block leading-tight">View Chat Logs</span>
                        <span className="text-[10px] text-emerald-400/80 font-normal">
                          {whatsappChat.ai_paused ? '⏸️ AI Paused' : '🤖 AI Active'}
                        </span>
                      </div>
                    </button>
                  ) : (
                    <a
                      href={`https://wa.me/${customerInfo.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition-all flex items-center gap-2 border border-slate-700"
                    >
                      <Phone className="w-4 h-4 text-emerald-400" />
                      <span>WhatsApp Web</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Orders Filter Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">
                Customer Orders ({orders.length})
              </h3>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'all', label: `All (${orders.length})` },
                {
                  id: 'fulfilled',
                  label: `🚚 Fulfilled (${orders.filter(o => o.fulfillment_status === 'fulfilled' || (Array.isArray(o.fulfillments) && o.fulfillments[0]?.tracking_number)).length})`
                },
                {
                  id: 'unfulfilled',
                  label: `⏳ Processing (${orders.filter(o => !o.cancelled_at && o.fulfillment_status !== 'fulfilled' && !(Array.isArray(o.fulfillments) && o.fulfillments[0]?.tracking_number)).length})`
                },
                {
                  id: 'cancelled',
                  label: `❌ Cancelled (${orders.filter(o => !!o.cancelled_at).length})`
                }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setOrderFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    orderFilter === tab.id
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Orders List */}
          {filteredOrders.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-12 text-center space-y-3">
              <Package className="w-12 h-12 text-slate-600 mx-auto" />
              <h4 className="text-lg font-bold text-slate-400">
                No orders matching filter
              </h4>
              <p className="text-sm text-slate-500">
                This customer has no orders under the "{orderFilter}" filter category.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                if (!order || typeof order !== 'object') return null;
                const isExpanded = !!expandedOrders[order.id];
                const fulfillments = Array.isArray(order.fulfillments) ? order.fulfillments : (typeof order.fulfillments === 'string' ? (() => { try { return JSON.parse(order.fulfillments) || []; } catch(_) { return []; } })() : []);
                const fulfillment = fulfillments.length > 0 ? fulfillments[0] : null;
                const trackingNumber = fulfillment?.tracking_number || null;
                const trackingUrl = fulfillment?.tracking_url || (Array.isArray(fulfillment?.tracking_urls) && fulfillment.tracking_urls[0]) || null;
                const trackingCompany = fulfillment?.tracking_company || null;
                const isFulfilled = order.fulfillment_status === 'fulfilled' || trackingNumber;
                const isCancelled = !!order.cancelled_at;
                const shipAddr = order.shipping_address && typeof order.shipping_address === 'object' ? order.shipping_address : (typeof order.shipping_address === 'string' ? (() => { try { return JSON.parse(order.shipping_address) || null; } catch(_) { return null; } })() : null);
                const lineItems = Array.isArray(order.line_items) ? order.line_items : (typeof order.line_items === 'string' ? (() => { try { return JSON.parse(order.line_items) || []; } catch(_) { return []; } })() : []);

                return (
                  <div
                    key={order.id || Math.random()}
                    className="bg-slate-900/80 border border-slate-800/90 rounded-2xl overflow-hidden transition-all shadow-md hover:border-slate-700"
                  >
                    {/* Order Top Summary */}
                    <div
                      className="p-5 flex items-center justify-between gap-4 cursor-pointer select-none hover:bg-slate-800/40 transition-colors"
                      onClick={() => toggleOrderExpand(order.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-300 font-black text-sm shrink-0">
                          {order.order_number ? `#${order.order_number}` : '🛍️'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-base">
                              {order.name || `#${order.order_number}`}
                            </span>
                            <span className="text-xs text-slate-400">
                              {(() => {
                                try {
                                  return new Date(order.created_at || Date.now()).toLocaleString([], {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  });
                                } catch (_) {
                                  return 'Recent';
                                }
                              })()}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {lineItems.length} item{lineItems.length === 1 ? '' : 's'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="font-extrabold text-emerald-400 text-lg">
                            ₹{order.total_price || 0}
                          </span>
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            {order.financial_status === 'paid' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                💳 Paid
                              </span>
                            ) : order.financial_status === 'partially_paid' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                                🪙 Partial COD
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                💵 COD
                              </span>
                            )}

                            {isCancelled ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                ❌ Cancelled
                              </span>
                            ) : isFulfilled ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                🚚 Fulfilled
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                ⏳ Unfulfilled
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p-1.5 rounded-lg bg-slate-800 text-slate-400">
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>

                    {/* Order Details Accordion */}
                    {isExpanded && (
                      <div className="px-6 pb-6 pt-2 border-t border-slate-800 space-y-6 bg-slate-950/40 text-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Left Column: Shipping Address */}
                          <div>
                            <h5 className="font-bold text-slate-300 mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                              <MapPin className="w-4 h-4 text-emerald-400" />
                              <span>Shipping Address</span>
                            </h5>
                            {shipAddr ? (
                              <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 space-y-1.5 text-slate-300">
                                <p className="font-bold text-white text-base">
                                  {shipAddr.first_name || ''} {shipAddr.last_name || ''}
                                </p>
                                <p className="text-slate-300">
                                  {[
                                    shipAddr.address1,
                                    shipAddr.address2,
                                    shipAddr.city,
                                    shipAddr.province,
                                    shipAddr.zip
                                  ].filter(Boolean).join(', ')}
                                </p>
                                {shipAddr.phone && (
                                  <p className="text-slate-400 text-xs mt-2 font-mono">
                                    Phone: {formatPhone(shipAddr.phone)}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 text-slate-500 italic">
                                No shipping address provided
                              </div>
                            )}
                          </div>

                          {/* Right Column: Tracking & Payment Status */}
                          <div>
                            <h5 className="font-bold text-slate-300 mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                              <Truck className="w-4 h-4 text-blue-400" />
                              <span>Shipment & Tracking</span>
                            </h5>
                            <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 space-y-2">
                              {isCancelled ? (
                                <div className="text-rose-400 font-bold">
                                  ❌ This order was cancelled.
                                </div>
                              ) : isFulfilled ? (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400 text-xs">Courier:</span>
                                    <span className="font-bold text-white">{trackingCompany || 'Courier Partner'}</span>
                                  </div>
                                  {trackingNumber && (
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-400 text-xs">Tracking AWB:</span>
                                      <span className="font-mono text-emerald-400 font-bold">{trackingNumber}</span>
                                    </div>
                                  )}
                                  {trackingUrl && (
                                    <a
                                      href={trackingUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="mt-2 w-full py-2 px-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                                    >
                                      <span>Track Shipment Live</span>
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <div className="text-amber-300/90 text-sm font-medium">
                                  ⏳ Order is currently processing / unfulfilled. No AWB assigned yet.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Items Ordered Table */}
                        <div>
                          <h5 className="font-bold text-slate-300 mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                            <ShoppingBag className="w-4 h-4 text-emerald-400" />
                            <span>Ordered Items ({lineItems.length})</span>
                          </h5>
                          <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 space-y-3">
                            {lineItems.map((item, i) => (
                              <div key={i} className="flex items-center justify-between gap-4 text-slate-300 pb-3 border-b border-slate-800/80 last:border-0 last:pb-0">
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 font-black flex items-center justify-center text-xs shrink-0">
                                    {item?.quantity || 1}x
                                  </span>
                                  <div className="truncate">
                                    <p className="font-bold text-white text-sm truncate">
                                      {item?.title || 'Product Item'}
                                    </p>
                                    {item?.variant_title && (
                                      <p className="text-slate-400 text-xs font-medium">
                                        Variant: {item.variant_title}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <span className="font-extrabold text-emerald-400 text-base shrink-0">
                                  ₹{item?.price || 0}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty Initial State / Helper Banner */}
      {!hasSearched && !loading && (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-12 text-center max-w-2xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-emerald-400 mx-auto">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white">
            Ready to Inspect Customer Orders
          </h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Type any phone number in the search bar above to see complete order records from Shopify, lifetime amount spent, courier tracking links, and WhatsApp AI log status.
          </p>
        </div>
      )}
    </div>
  );
}
