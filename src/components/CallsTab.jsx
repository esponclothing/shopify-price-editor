import React, { useState, useEffect, useCallback } from 'react';
import { Phone, PhoneIncoming, PhoneMissed, PhoneOff, PhoneCall, RefreshCw, Clock, User, Search } from 'lucide-react';

function formatPhone(phone) {
  const s = String(phone || '');
  if (s.startsWith('91') && s.length === 12) return `+91 ${s.slice(2, 7)} ${s.slice(7)}`;
  return s.startsWith('+') ? s : `+${s}`;
}

function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

const STATUS_CONFIG = {
  answered:  { label: 'Answered',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: PhoneCall },
  ended:     { label: 'Ended',     color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: PhoneCall },
  ringing:   { label: 'Ringing',   color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/20',  icon: PhoneIncoming },
  missed:    { label: 'Missed',    color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',         icon: PhoneMissed },
  declined:  { label: 'Declined',  color: 'text-slate-600 dark:text-slate-400',   bg: 'bg-slate-500/10 border-slate-500/20',    icon: PhoneOff },
  inbound:   { label: 'Inbound',   color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',      icon: PhoneIncoming },
};

export default function CallsTab({ onSelectChat }) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState({ total: 0, answered: 0, missed: 0, totalDuration: 0 });

  const fetchCalls = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch('/api/whatsapp-calling?action=logs');
      if (res.ok) {
        const data = await res.json();
        const callList = data.calls || [];
        setCalls(callList);
        // Compute stats
        const answered = callList.filter(c => c.status === 'answered' || c.status === 'ended').length;
        const missed = callList.filter(c => c.status === 'missed').length;
        const totalDuration = callList.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
        setStats({ total: callList.length, answered, missed, totalDuration });
      }
    } catch (err) {
      console.error('Failed to fetch calls:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalls();
    const interval = setInterval(() => fetchCalls(true), 10000);
    return () => clearInterval(interval);
  }, [fetchCalls]);

  const filtered = calls.filter(c => {
    const matchSearch = !search || 
      String(c.phone).includes(search) || 
      (c.customer_name || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusFilters = [
    { id: 'all', label: 'All Calls' },
    { id: 'answered', label: '✅ Answered' },
    { id: 'missed', label: '📵 Missed' },
    { id: 'declined', label: '🚫 Declined' },
    { id: 'ringing', label: '🔔 Ringing' },
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#0B0F19] overflow-hidden">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0F172A]/80">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Phone className="w-5 h-5 text-emerald-400" /> WhatsApp Calls
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Inbound & outbound call history with your customers</p>
          </div>
          <button
            onClick={() => fetchCalls(false)}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Total Calls', value: stats.total, color: 'text-white', icon: Phone },
            { label: 'Answered', value: stats.answered, color: 'text-emerald-400', icon: PhoneCall },
            { label: 'Missed', value: stats.missed, color: 'text-red-400', icon: PhoneMissed },
            { label: 'Total Duration', value: formatDuration(stats.totalDuration), color: 'text-yellow-400', icon: Clock },
          ].map(stat => (
            <div key={stat.label} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
                <span className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">{stat.label}</span>
              </div>
              <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {statusFilters.map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === f.id
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-white border border-slate-200 dark:border-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="ml-auto relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-slate-500" />
            <input
              type="text"
              placeholder="Search phone or name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-48"
            />
          </div>
        </div>
      </div>

      {/* Call List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-4">
              <Phone className="w-7 h-7 text-slate-600" />
            </div>
            <p className="text-slate-600 dark:text-slate-400 font-semibold text-sm">No calls yet</p>
            <p className="text-slate-600 text-xs mt-1 max-w-xs">
              Once customers call your WhatsApp number (+91 74949 61428), all calls will appear here.
            </p>
          </div>
        ) : (
          filtered.map(call => {
            const cfg = STATUS_CONFIG[call.status] || STATUS_CONFIG['inbound'];
            const Icon = cfg.icon;
            return (
              <div
                key={call.id}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:border-slate-700 rounded-2xl p-4 flex items-center gap-4 transition-all group"
              >
                {/* Icon */}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${cfg.bg}`}>
                  <Icon className={`w-5 h-5 ${cfg.color}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {call.customer_name || formatPhone(call.phone)}
                    </span>
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    {call.customer_name && <span>{formatPhone(call.phone)}</span>}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(call.started_at)}
                    </span>
                    {(call.duration_seconds > 0) && (
                      <span className="text-emerald-400 font-bold">
                        {formatDuration(call.duration_seconds)}
                      </span>
                    )}
                    <span className="capitalize text-slate-600">{call.direction}</span>
                  </div>
                </div>

                {/* Callback button */}
                <button
                  className="opacity-0 group-hover:opacity-100 p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all shrink-0 cursor-pointer"
                  title="View chat"
                  onClick={() => {
                    if (onSelectChat) onSelectChat(call.phone);
                  }}
                >
                  <Phone className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Coming Soon banner */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0F172A]/60">
        <div className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl px-4 py-3">
          <span className="text-lg">🚧</span>
          <div>
            <p className="text-xs font-bold text-emerald-400">Outbound AI Calling (COD Verification) — Coming Soon</p>
            <p className="text-[10px] text-slate-500">Automatically call COD customers to verify orders before dispatch.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
