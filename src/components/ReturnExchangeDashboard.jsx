import React, { useState, useEffect, useCallback } from 'react';
import {
  RotateCcw, ArrowLeftRight, Package, Clock, CheckCircle2, XCircle,
  Truck, RefreshCw, Search, Eye, ChevronDown, AlertCircle,
  CheckCircle, X, ChevronRight, Phone, ShoppingBag, Tag, CalendarDays,
  MessageSquare, PackageCheck, TrendingUp
} from 'lucide-react';

const RETURNS_API = '/api/shopify-customer-orders';
const ADMIN_SECRET = import.meta.env.VITE_SHOPIFY_ACCESS_TOKEN || '';

const STATUS_CONFIG = {
  pending:           { label: 'Pending Review',       color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20', dot: 'bg-amber-400' },
  approved:          { label: 'Approved',              color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', dot: 'bg-emerald-400' },
  rejected:          { label: 'Rejected',              color: 'bg-red-500/10 text-red-400 border border-red-500/20', dot: 'bg-red-400' },
  pickup_scheduled:  { label: 'Pickup Scheduled',      color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20', dot: 'bg-blue-400' },
  in_transit:        { label: 'In Transit',            color: 'bg-violet-500/10 text-violet-400 border border-violet-500/20', dot: 'bg-violet-400' },
  received:          { label: 'Package Received',      color: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20', dot: 'bg-cyan-400' },
  exchange_shipped:  { label: 'Exchange Shipped',      color: 'bg-purple-500/10 text-purple-400 border border-purple-500/20', dot: 'bg-purple-400' },
  completed:         { label: 'Completed',             color: 'bg-green-500/10 text-green-400 border border-green-500/20', dot: 'bg-green-400' },
  cancelled:         { label: 'Cancelled',             color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20', dot: 'bg-slate-400' },
};

const TYPE_CONFIG = {
  return:   { label: 'RETURN',   color: 'bg-rose-500/10 text-rose-400 border border-rose-500/20', icon: RotateCcw },
  exchange: { label: 'EXCHANGE', color: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20', icon: ArrowLeftRight },
};

const REASON_LABELS = {
  size_issue:     'Size Issue',
  damaged:        'Damaged / Defective',
  wrong_product:  'Wrong Product',
  quality:        'Quality Issue',
  other:          'Other',
};

const STATUS_FLOW = ['pending','approved','pickup_scheduled','in_transit','received','exchange_shipped','completed'];

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function TypeBadge({ type }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.return;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ─── REQUEST DETAIL DRAWER ─────────────────────────────────────────────────────
function RequestDetailDrawer({ request, onClose, onRefresh }) {
  const [actionLoading, setActionLoading] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [adminNote, setAdminNote] = useState(request.admin_note || '');
  const [tracking, setTracking] = useState({
    return_tracking_number: request.return_tracking_number || '',
    return_tracking_company: request.return_tracking_company || '',
    return_tracking_url: request.return_tracking_url || '',
    exchange_tracking_number: request.exchange_tracking_number || '',
    exchange_tracking_company: request.exchange_tracking_company || '',
    exchange_tracking_url: request.exchange_tracking_url || '',
  });
  const [showTracking, setShowTracking] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const callApi = async (body) => {
    const res = await fetch(RETURNS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
      body: JSON.stringify(body)
    });
    return res.json();
  };

  const updateStatus = async (status, note) => {
    setActionLoading(status);
    try {
      const data = await callApi({ action: 'update_status', id: request.id, status, admin_note: note || adminNote || undefined });
      if (data.success) {
        setSuccessMsg(`Status updated to: ${STATUS_CONFIG[status]?.label || status}`);
        setTimeout(() => { setSuccessMsg(''); onRefresh(); onClose(); }, 1500);
      }
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setActionLoading('');
    }
  };

  const saveTracking = async () => {
    setActionLoading('tracking');
    try {
      const cleanUrl = (url) => {
        if (!url || !url.trim()) return '';
        const trimmed = url.trim();
        return trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
      };
      const cleanedTracking = {
        ...tracking,
        return_tracking_url: cleanUrl(tracking.return_tracking_url),
        exchange_tracking_url: cleanUrl(tracking.exchange_tracking_url),
      };
      const data = await callApi({ action: 'add_tracking', id: request.id, ...cleanedTracking });
      if (data.success) {
        setSuccessMsg('Tracking info saved!');
        setTimeout(() => { setSuccessMsg(''); onRefresh(); }, 1200);
      }
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setActionLoading('');
    }
  };

  const timelineSteps = request.request_type === 'exchange' ? [
    { key: 'pending', label: 'Exchange Requested', time: request.created_at },
    { key: 'approved', label: 'Approved', time: request.approved_at },
    { key: 'pickup_scheduled', label: 'Return Pickup Scheduled', time: request.pickup_at },
    { key: 'in_transit', label: 'Return In Transit', time: null },
    { key: 'received', label: 'Return Package Received', time: request.received_at },
    { key: 'exchange_shipped', label: 'Exchange Parcel Shipped (Our Side)', time: request.exchange_shipped_at },
    { key: 'completed', label: 'Exchange Delivered', time: request.completed_at },
  ] : [
    { key: 'pending', label: 'Return Requested', time: request.created_at },
    { key: 'approved', label: 'Approved', time: request.approved_at },
    { key: 'pickup_scheduled', label: 'Return Pickup Scheduled', time: request.pickup_at },
    { key: 'in_transit', label: 'Return In Transit', time: null },
    { key: 'received', label: 'Return Package Received', time: request.received_at },
    { key: 'completed', label: 'Completed (Refund Issued)', time: request.completed_at },
  ];

  const activeStepIdx = STATUS_FLOW.indexOf(request.status);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl h-full bg-[#0F172A] border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0F172A] border-b border-slate-200 dark:border-slate-800 p-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TypeBadge type={request.request_type} />
              <StatusBadge status={request.status} />
            </div>
            <p className="text-slate-900 dark:text-white font-bold text-sm">#{request.id?.slice(0, 8).toUpperCase()}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMsg && (
          <div className="mx-5 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-400 text-sm">
            <CheckCircle className="w-4 h-4" />
            {successMsg}
          </div>
        )}

        <div className="p-5 space-y-5 flex-1">
          {/* Customer + Order Info */}
          <div className="bg-slate-50/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-3">Customer & Order</h3>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-slate-900 dark:text-white font-semibold">{request.phone}</span>
              {request.customer_name && <span className="text-slate-600 dark:text-slate-400">— {request.customer_name}</span>}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Package className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-slate-900 dark:text-white font-semibold">{request.order_name}</span>
              <span className="text-slate-500 text-xs">ID: {request.order_id}</span>
            </div>
            {request.email && (
              <div className="text-xs text-slate-600 dark:text-slate-400">📧 {request.email}</div>
            )}
          </div>

          {/* Product Info */}
          <div className="bg-slate-50/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-3">Product</h3>
            <div className="flex items-start gap-3">
              {request.image_url ? (
                <img src={request.image_url} alt={request.product_title} className="w-14 h-14 rounded-lg object-cover border border-slate-300 dark:border-slate-700 shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center border border-slate-300 dark:border-slate-700 shrink-0 text-slate-500">
                  <ShoppingBag className="w-6 h-6" />
                </div>
              )}
              <div>
                <p className="text-slate-900 dark:text-white font-semibold text-sm">{request.product_title}</p>
                {request.variant_title && <p className="text-slate-600 dark:text-slate-400 text-xs mt-0.5">{request.variant_title}</p>}
                <p className="text-slate-500 text-xs mt-1">Qty: {request.quantity} · ₹{request.item_price?.toFixed(2) || '—'}</p>
                {request.request_type === 'exchange' && request.exchange_size && (
                  <p className="text-indigo-400 text-xs mt-1 font-semibold">Exchange Size: {request.exchange_size}</p>
                )}
              </div>
            </div>
          </div>

          {/* Reason */}
          <div className="bg-slate-50/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">Reason</h3>
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-slate-500" />
              <span className="text-slate-900 dark:text-white font-semibold text-sm">{REASON_LABELS[request.reason] || request.reason}</span>
            </div>
            {request.reason_detail && (
              <p className="text-slate-600 dark:text-slate-400 text-xs mt-2 leading-relaxed italic">"{request.reason_detail}"</p>
            )}
          </div>

          {/* Customer Uploaded Photo */}
          {request.photo_url && (
            <div className="bg-slate-50/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Customer Uploaded Photo</h3>
                <a
                  href={request.photo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Eye className="w-3.5 h-3.5" /> View Fullscreen
                </a>
              </div>
              <div className="mt-2 rounded-xl overflow-hidden border border-slate-300/60 dark:border-slate-700/60 bg-slate-950 max-h-64 flex items-center justify-center p-1">
                <img
                  src={request.photo_url}
                  alt="Customer upload"
                  className="max-h-60 w-auto object-contain cursor-pointer transition hover:scale-105"
                  onClick={() => window.open(request.photo_url, '_blank')}
                />
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-slate-50/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-4">Status Timeline</h3>
            <div className="space-y-3">
              {timelineSteps.map((step, idx) => {
                const isDone = idx <= activeStepIdx && request.status !== 'rejected' && request.status !== 'cancelled';
                const isActive = STATUS_FLOW[activeStepIdx] === step.key;
                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 shrink-0 ${
                      isDone ? 'bg-emerald-500 border-emerald-500' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                    } ${isActive ? 'ring-2 ring-emerald-500/40 ring-offset-1 ring-offset-slate-900' : ''}`}>
                      {isDone ? <CheckCircle2 className="w-3 h-3 text-slate-900 dark:text-white" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />}
                    </div>
                    <div className="flex-1">
                      <p className={`text-xs font-semibold ${isDone ? 'text-white' : 'text-slate-500'}`}>{step.label}</p>
                      {step.time && <p className="text-[10px] text-slate-500 mt-0.5">{new Date(step.time).toLocaleString('en-IN')}</p>}
                    </div>
                  </div>
                );
              })}
              {(request.status === 'rejected' || request.status === 'cancelled') && (
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center border-2 bg-red-500 border-red-500 shrink-0">
                    <XCircle className="w-3 h-3 text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-red-400">{request.status === 'rejected' ? 'Rejected' : 'Cancelled'}</p>
                    {request.rejected_at && <p className="text-[10px] text-slate-500 mt-0.5">{new Date(request.rejected_at).toLocaleString('en-IN')}</p>}
                  </div>
                </div>
              )}
            </div>
            {request.admin_note && (
              <div className="mt-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-xs text-red-400 font-semibold">Admin Note:</p>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">{request.admin_note}</p>
              </div>
            )}
          </div>

          {/* Tracking Info */}
          {(request.return_tracking_number || request.exchange_tracking_number) && (
            <div className="bg-slate-50/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">Tracking Info</h3>
              {request.return_tracking_number && (
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">Return Shipment</p>
                  <p className="text-sm text-slate-900 dark:text-white">{request.return_tracking_company} — #{request.return_tracking_number}</p>
                  {request.return_tracking_url && (
                    <a href={request.return_tracking_url.startsWith('http://') || request.return_tracking_url.startsWith('https://') ? request.return_tracking_url : `https://${request.return_tracking_url}`} target="_blank" rel="noreferrer" className="text-xs text-blue-400 underline">Track →</a>
                  )}
                </div>
              )}
              {request.exchange_tracking_number && (
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold mt-2">Exchange Dispatch</p>
                  <p className="text-sm text-slate-900 dark:text-white">{request.exchange_tracking_company} — #{request.exchange_tracking_number}</p>
                  {request.exchange_tracking_url && (
                    <a href={request.exchange_tracking_url.startsWith('http://') || request.exchange_tracking_url.startsWith('https://') ? request.exchange_tracking_url : `https://${request.exchange_tracking_url}`} target="_blank" rel="noreferrer" className="text-xs text-blue-400 underline">Track →</a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="sticky bottom-0 bg-[#0F172A] border-t border-slate-200 dark:border-slate-800 p-4 space-y-3">
          {/* Quick Status Actions */}
          {request.status === 'pending' && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => updateStatus('approved')}
                disabled={!!actionLoading}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
              >
                {actionLoading === 'approved' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Approve Request
              </button>
              <button
                onClick={() => setShowRejectInput(v => !v)}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs font-bold rounded-xl transition"
              >
                <XCircle className="w-3.5 h-3.5" />
                Reject
              </button>
            </div>
          )}
          {showRejectInput && (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Reason for rejection (shown to customer)"
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-red-500"
              />
              <button
                onClick={() => updateStatus('rejected', rejectNote)}
                disabled={!rejectNote || !!actionLoading}
                className="w-full py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
              >
                {actionLoading === 'rejected' ? 'Saving...' : 'Confirm Rejection'}
              </button>
            </div>
          )}

          {request.status === 'approved' && (
            <button
              onClick={() => updateStatus('pickup_scheduled')}
              disabled={!!actionLoading}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
            >
              <Truck className="w-3.5 h-3.5" />
              Mark: Pickup Scheduled
            </button>
          )}
          {request.status === 'pickup_scheduled' && (
            <button
              onClick={() => updateStatus('in_transit')}
              disabled={!!actionLoading}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-violet-500 hover:bg-violet-400 text-slate-900 dark:text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
            >
              <Truck className="w-3.5 h-3.5" />
              Mark: In Transit
            </button>
          )}
          {request.status === 'in_transit' && (
            <button
              onClick={() => updateStatus('received')}
              disabled={!!actionLoading}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-900 dark:text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
            >
              <PackageCheck className="w-3.5 h-3.5" />
              Mark: Package Received
            </button>
          )}
          {request.status === 'received' && request.request_type === 'exchange' && (
            <button
              onClick={() => updateStatus('exchange_shipped')}
              disabled={!!actionLoading}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-purple-500 hover:bg-purple-400 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 shadow-lg shadow-purple-500/20"
            >
              <Truck className="w-3.5 h-3.5" />
              Mark: Send Exchange Parcel (Our Side)
            </button>
          )}
          {request.status === 'received' && request.request_type !== 'exchange' && (
            <button
              onClick={() => updateStatus('completed')}
              disabled={!!actionLoading}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-green-500 hover:bg-green-400 text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Mark: Completed (Refund Issued)
            </button>
          )}
          {request.status === 'exchange_shipped' && (
            <button
              onClick={() => updateStatus('completed')}
              disabled={!!actionLoading}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-green-500 hover:bg-green-400 text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Mark: Completed (Exchange Delivered)
            </button>
          )}

          {/* Add Tracking Button */}
          {['approved','pickup_scheduled','in_transit','received','exchange_shipped'].includes(request.status) && (
            <>
              <button
                onClick={() => setShowTracking(v => !v)}
                className="w-full flex items-center justify-center gap-1.5 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-white dark:bg-slate-800 transition"
              >
                <Truck className="w-3.5 h-3.5" />
                {showTracking ? 'Hide' : 'Add / Edit'} Tracking Info
                <ChevronDown className={`w-3.5 h-3.5 transition ${showTracking ? 'rotate-180' : ''}`} />
              </button>
              {showTracking && (
                <div className="space-y-2 bg-slate-50/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Return Shipment Tracking</p>
                  <input type="text" placeholder="Courier Name (e.g. Delhivery)" value={tracking.return_tracking_company}
                    onChange={e => setTracking(t => ({...t, return_tracking_company: e.target.value}))}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white text-xs focus:outline-none" />
                  <input type="text" placeholder="Tracking Number" value={tracking.return_tracking_number}
                    onChange={e => setTracking(t => ({...t, return_tracking_number: e.target.value}))}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white text-xs focus:outline-none" />
                  <input type="text" placeholder="Tracking URL (optional)" value={tracking.return_tracking_url}
                    onChange={e => setTracking(t => ({...t, return_tracking_url: e.target.value}))}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white text-xs focus:outline-none" />

                  {request.request_type === 'exchange' && (
                    <>
                      <p className="text-xs font-bold text-indigo-400 uppercase mt-2">Exchange Dispatch Tracking</p>
                      <input type="text" placeholder="Courier Name" value={tracking.exchange_tracking_company}
                        onChange={e => setTracking(t => ({...t, exchange_tracking_company: e.target.value}))}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white text-xs focus:outline-none" />
                      <input type="text" placeholder="Tracking Number" value={tracking.exchange_tracking_number}
                        onChange={e => setTracking(t => ({...t, exchange_tracking_number: e.target.value}))}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white text-xs focus:outline-none" />
                      <input type="text" placeholder="Tracking URL (optional)" value={tracking.exchange_tracking_url}
                        onChange={e => setTracking(t => ({...t, exchange_tracking_url: e.target.value}))}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white text-xs focus:outline-none" />
                    </>
                  )}
                  <button onClick={saveTracking} disabled={actionLoading === 'tracking'}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition disabled:opacity-50">
                    {actionLoading === 'tracking' ? 'Saving...' : 'Save Tracking Info'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* WhatsApp Customer Link */}
          <a
            href={`https://wa.me/${request.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${request.customer_name || ''}! Regarding your ${request.request_type} request for ${request.product_title} (Order ${request.order_name}).`)}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 w-full py-2 bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] text-xs font-bold rounded-xl hover:bg-[#25D366]/20 transition"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            WhatsApp Customer
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD ────────────────────────────────────────────────────────────

const FILTER_GROUPS = [
  { id: 'action', label: 'Action Required', statuses: ['pending', 'approved'] },
  { id: 'reverse', label: 'Reverse Logistics', statuses: ['pickup_scheduled', 'in_transit'] },
  { id: 'resolution', label: 'Resolution', statuses: ['received', 'exchange_shipped'] },
  { id: 'archive', label: 'Archive', statuses: ['completed', 'rejected', 'cancelled'] },
  { id: 'all', label: 'All Requests', statuses: [] }
];

export default function ReturnExchangeDashboard() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState('action');
  const [filterStatus, setFilterStatus] = useState('pending'); // specific status or 'all_in_group'
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [fetchError, setFetchError] = useState('');

  const handleBulkUpdate = async (status) => {
    if (!selectedIds.length) return;
    setBulkLoading(true);
    try {
      const res = await fetch(RETURNS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
        body: JSON.stringify({ action: 'update_status', ids: selectedIds, status })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedIds([]);
        fetchRequests();
      } else {
        alert('Failed: ' + data.error);
      }
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setBulkLoading(false);
    }
  };

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const url = `${RETURNS_API}?action=returns&admin=true&admin_secret=${ADMIN_SECRET}`;
      const res = await fetch(url, { headers: { 'x-admin-secret': ADMIN_SECRET } });
      const data = await res.json();
      if (data.success) {
        // Deduplicate by ID in case of DB duplicates
        const seen = new Set();
        const unique = (data.requests || []).filter(r => {
          if (seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        });
        setRequests(unique);
      } else {
        setFetchError(data.error || 'Failed to load returns data.');
      }
    } catch (e) {
      console.error('Failed to fetch returns:', e);
      setFetchError('Network error: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // Stats
  const thisMonth = new Date(); thisMonth.setDate(1);
  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    inProgress: requests.filter(r => ['approved','pickup_scheduled','in_transit','received'].includes(r.status)).length,
    completed: requests.filter(r => r.status === 'completed' && new Date(r.created_at) >= thisMonth).length,
    returns: requests.filter(r => r.request_type === 'return').length,
    exchanges: requests.filter(r => r.request_type === 'exchange').length,
  };

  const filtered = requests.filter(r => {
    // 1. Group filtering
    const group = FILTER_GROUPS.find(g => g.id === activeGroup);
    if (group.id !== 'all') {
      if (filterStatus === 'all_in_group') {
        if (!group.statuses.includes(r.status)) return false;
      } else {
        if (r.status !== filterStatus) return false;
      }
    } else {
      if (filterStatus !== 'all_in_group' && r.status !== filterStatus) return false;
    }

    if (filterType !== 'all' && r.request_type !== filterType) return false;

    // 2. Search filtering
    if (search) {
      const s = search.toLowerCase();
      return (
        r.phone?.includes(s) ||
        r.order_name?.toLowerCase().includes(s) ||
        r.product_title?.toLowerCase().includes(s) ||
        r.customer_name?.toLowerCase().includes(s) ||
        r.id?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  return (
    <div className="min-h-full space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-rose-400" />
            Returns & Exchanges
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">Review and manage all customer return and exchange requests</p>
        </div>
        <button onClick={fetchRequests} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition border border-slate-300 dark:border-slate-700">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Requests', value: stats.total, icon: Package, color: 'from-slate-700/40 to-slate-800/40 border-slate-300 dark:border-slate-700 hover:border-slate-500', action: () => { setActiveGroup('all'); setFilterStatus('all_in_group'); setFilterType('all'); } },
          { label: '⚡ Pending', value: stats.pending, icon: Clock, color: 'from-amber-500/10 to-amber-500/5 border-amber-500/20 hover:border-amber-500/50', textColor: 'text-amber-400', action: () => { setActiveGroup('action'); setFilterStatus('pending'); } },
          { label: 'In Progress', value: stats.inProgress, icon: Truck, color: 'from-blue-500/10 to-blue-500/5 border-blue-500/20 hover:border-blue-500/50', textColor: 'text-blue-400', action: () => { setActiveGroup('reverse'); setFilterStatus('all_in_group'); } },
          { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'from-green-500/10 to-green-500/5 border-green-500/20 hover:border-green-500/50', textColor: 'text-green-400', action: () => { setActiveGroup('archive'); setFilterStatus('completed'); } },
          { label: 'Returns', value: stats.returns, icon: RotateCcw, color: 'from-rose-500/10 to-rose-500/5 border-rose-500/20 hover:border-rose-500/50', textColor: 'text-rose-400', action: () => { setFilterType('return'); } },
          { label: 'Exchanges', value: stats.exchanges, icon: ArrowLeftRight, color: 'from-indigo-500/10 to-indigo-500/5 border-indigo-500/20 hover:border-indigo-500/50', textColor: 'text-indigo-400', action: () => { setFilterType('exchange'); } },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} onClick={s.action} className={`bg-gradient-to-br ${s.color} border rounded-xl p-4 cursor-pointer transition transform hover:-translate-y-0.5`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">{s.label}</p>
                <Icon className={`w-4 h-4 ${s.textColor || 'text-slate-500'}`} />
              </div>
              <p className={`text-2xl font-black ${s.textColor || 'text-white'}`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Filter Tabs */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="flex overflow-x-auto hide-scrollbar border-b border-slate-200 dark:border-slate-800">
          {FILTER_GROUPS.map(g => {
            const groupCount = g.id === 'all'
              ? requests.length
              : requests.filter(r => g.statuses.includes(r.status)).length;
            return (
            <button
              key={g.id}
              onClick={() => {
                setActiveGroup(g.id);
                setFilterStatus(g.id === 'all' ? 'all_in_group' : (g.statuses[0] || 'all_in_group'));
                setSelectedIds([]);
              }}
              className={`whitespace-nowrap px-4 py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${activeGroup === g.id ? 'border-rose-500 text-rose-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              {g.label}
              {groupCount > 0 && (
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black ${activeGroup === g.id ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>{groupCount}</span>
              )}
            </button>
            );
          })}
        </div>
        

        {/* Sub-status filters */}
        <div className="p-3 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center gap-2">
          {FILTER_GROUPS.find(g => g.id === activeGroup)?.statuses.length > 0 && (
            <button
              onClick={() => setFilterStatus('all_in_group')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${filterStatus === 'all_in_group' ? 'bg-white text-slate-900 border-white' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-white hover:border-slate-400 dark:border-slate-600'}`}
            >
              All in Group
            </button>
          )}
          {(activeGroup === 'all' ? Object.keys(STATUS_CONFIG) : FILTER_GROUPS.find(g => g.id === activeGroup)?.statuses || []).map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${filterStatus === st ? 'bg-white text-slate-900 border-white' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-white hover:border-slate-400 dark:border-slate-600'}`}
            >
              {STATUS_CONFIG[st]?.label}
            </button>
          ))}
          
          <div className="ml-auto relative min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by order #, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50"
            />
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-center justify-between animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center">
              <span className="text-rose-400 font-bold text-sm">{selectedIds.length}</span>
            </div>
            <p className="text-sm font-semibold text-rose-300">Requests Selected</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white transition"
            >
              Cancel
            </button>
            <button
              onClick={() => handleBulkUpdate('approved')}
              disabled={bulkLoading}
              className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold rounded-lg shadow-lg shadow-rose-500/20 transition disabled:opacity-50 flex items-center gap-2"
            >
              {bulkLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Approve Selected
            </button>
            <button
              onClick={() => handleBulkUpdate('completed')}
              disabled={bulkLoading}
              className="px-4 py-2 bg-green-500 hover:bg-green-400 text-white text-xs font-bold rounded-lg shadow-lg shadow-green-500/20 transition disabled:opacity-50 flex items-center gap-2"
            >
              {bulkLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Mark Completed
            </button>
          </div>
        </div>
      )}

      {/* Requests Table */}
      {fetchError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-600 dark:text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mb-4 text-rose-500" />
          <p className="text-sm">Loading return & exchange requests...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24">
          <RotateCcw className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-1">No requests found</h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            {requests.length === 0
              ? 'No return or exchange requests have been submitted yet.'
              : 'No requests match your current filters.'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-50/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/50 dark:bg-slate-900/50">
                <th className="px-5 py-3 w-12">
                  <input 
                    type="checkbox" 
                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(filtered.map(r => r.id));
                      else setSelectedIds([]);
                    }}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-rose-500 focus:ring-rose-500 focus:ring-offset-slate-900" 
                  />
                </th>
                <th className="px-5 py-3">Customer / Order</th>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Type / Reason</th>
                <th className="px-5 py-3">Requested</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map(r => (
                <tr
                  key={r.id}
                  className={`hover:bg-white/30 dark:bg-slate-800/30 transition group cursor-pointer ${selectedIds.includes(r.id) ? 'bg-white/50 dark:bg-slate-800/50' : ''}`}
                  onClick={() => setSelectedRequest(r)}
                >
                  <td className="px-5 py-4 w-12" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox"
                      checked={selectedIds.includes(r.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(prev => [...prev, r.id]);
                        else setSelectedIds(prev => prev.filter(id => id !== r.id));
                      }}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-rose-500 focus:ring-rose-500 focus:ring-offset-slate-900" 
                    />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <p className="text-slate-900 dark:text-white font-bold text-sm">{r.order_name}</p>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-xs">{r.phone}</p>
                    {r.customer_name && <p className="text-slate-500 text-[11px]">{r.customer_name}</p>}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {r.image_url ? (
                        <img src={r.image_url} alt={r.product_title} className="w-10 h-10 rounded-lg object-cover border border-slate-300 dark:border-slate-700 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center border border-slate-300 dark:border-slate-700 shrink-0">
                          <Package className="w-4 h-4 text-slate-500" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-slate-900 dark:text-white text-xs font-semibold truncate max-w-[200px]">{r.product_title}</p>
                        {r.variant_title && <p className="text-slate-500 text-[10px]">{r.variant_title}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="space-y-1.5">
                      <TypeBadge type={r.request_type} />
                      <p className="text-slate-600 dark:text-slate-400 text-[10px]">{REASON_LABELS[r.reason] || r.reason}</p>
                      {r.photo_url && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                          📷 Photo
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-slate-700 dark:text-slate-300 text-xs whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-slate-500 text-[10px] whitespace-nowrap">
                      {new Date(r.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition group-hover:bg-rose-500/20 group-hover:text-rose-300">
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">View</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Drawer */}
      {selectedRequest && (
        <RequestDetailDrawer
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onRefresh={() => { fetchRequests(); setSelectedRequest(null); }}
        />
      )}
    </div>
  );
}
