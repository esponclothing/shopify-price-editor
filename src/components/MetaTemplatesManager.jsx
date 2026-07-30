import React, { useState, useEffect } from 'react';
import {
  FileText, Plus, RefreshCw, CheckCircle2, Clock, XCircle, Trash2,
  Copy, Check, AlertCircle, ExternalLink, Send, ShieldAlert, Sparkles,
  MessageSquare, Edit3, Save, X, Layers, Globe, Tag, Smartphone,
  HelpCircle, ChevronRight, CornerDownRight, Bot
} from 'lucide-react';

export default function MetaTemplatesManager() {
  const [wabaId, setWabaId] = useState('');
  const [savingWaba, setSavingWaba] = useState(false);
  const [editingWaba, setEditingWaba] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED'
  const [copiedName, setCopiedName] = useState(null);

  // Create Template Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('MARKETING');
  const [formLanguage, setFormLanguage] = useState('en_US');
  const [headerType, setHeaderType] = useState('NONE'); // 'NONE' | 'TEXT'
  const [headerText, setHeaderText] = useState('');
  const [bodyText, setBodyText] = useState('Hello {{1}},\n\nWe have an exclusive offer just for you! Get 30% OFF on your favorite 11FIT Activewear combos.\n\nUse code: FIT30 at checkout.');
  const [footerText, setFooterText] = useState('11FIT Activewear • Reply STOP to unsubscribe');
  const [buttonsType, setButtonsType] = useState('NONE'); // 'NONE' | 'QUICK_REPLY' | 'URL'
  const [quickReplyText1, setQuickReplyText1] = useState('Shop Now');
  const [quickReplyText2, setQuickReplyText2] = useState('Check Offers');
  const [ctaText, setCtaText] = useState('Shop Now');
  const [ctaUrl, setCtaUrl] = useState('https://11fit.in');

  // Load settings & templates on mount
  useEffect(() => {
    fetchSettingsAndTemplates();
  }, []);

  const fetchSettingsAndTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Get Settings (to check waba_id)
      let currentWabaId = wabaId;
      const setRes = await fetch('/api/whatsapp-settings');
      if (setRes.ok) {
        const setData = await setRes.json();
        if (setData.waba_id) {
          currentWabaId = setData.waba_id;
          setWabaId(setData.waba_id);
        }
      }

      if (!currentWabaId) {
        setLoading(false);
        setError('WhatsApp Business Account (WABA) ID is not set. Please enter your WABA ID above to load and create Meta templates.');
        return;
      }

      // 2. Fetch Templates from Meta Cloud API
      const res = await fetch(`/api/whatsapp-templates?waba_id=${currentWabaId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setTemplates(data.templates || []);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch templates from Meta API.');
      }
    } catch (err) {
      setError('Network error connecting to server.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWabaId = async () => {
    if (!wabaId.trim()) return;
    setSavingWaba(true);
    try {
      const res = await fetch('/api/whatsapp-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waba_id: wabaId.trim() })
      });
      if (res.ok) {
        setEditingWaba(false);
        await fetchSettingsAndTemplates();
      } else {
        alert('Failed to save WABA ID.');
      }
    } catch (err) {
      alert('Error saving WABA ID.');
    } finally {
      setSavingWaba(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedName(text);
    setTimeout(() => setCopiedName(null), 2000);
  };

  const handleDeleteTemplate = async (templateName) => {
    if (!window.confirm(`Are you sure you want to delete Meta template "${templateName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/whatsapp-templates?name=${encodeURIComponent(templateName)}&waba_id=${wabaId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`✅ Template "${templateName}" deleted successfully!`);
        setTemplates(prev => prev.filter(t => t.name !== templateName));
      } else {
        alert(`❌ Could not delete template: ${data.error || 'Failed'}`);
      }
    } catch (err) {
      alert('Network error deleting template.');
    }
  };

  const handleSubmitNewTemplate = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !bodyText.trim()) {
      alert('Template name and Body message are required.');
      return;
    }

    // Build components array according to Meta Graph API spec
    const components = [];

    if (headerType === 'TEXT' && headerText.trim()) {
      components.push({
        type: 'HEADER',
        format: 'TEXT',
        text: headerText.trim()
      });
    }

    components.push({
      type: 'BODY',
      text: bodyText.trim()
    });

    if (footerText.trim()) {
      components.push({
        type: 'FOOTER',
        text: footerText.trim()
      });
    }

    if (buttonsType === 'QUICK_REPLY') {
      const buttons = [];
      if (quickReplyText1.trim()) buttons.push({ type: 'QUICK_REPLY', text: quickReplyText1.trim() });
      if (quickReplyText2.trim()) buttons.push({ type: 'QUICK_REPLY', text: quickReplyText2.trim() });
      if (buttons.length > 0) {
        components.push({
          type: 'BUTTONS',
          buttons
        });
      }
    } else if (buttonsType === 'URL' && ctaText.trim() && ctaUrl.trim()) {
      components.push({
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: ctaText.trim(),
            url: ctaUrl.trim()
          }
        ]
      });
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/whatsapp-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waba_id: wabaId,
          name: formName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
          category: formCategory,
          language: formLanguage,
          components
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert(`🎉 Template "${formName}" submitted to Meta for review successfully!`);
        setShowCreateModal(false);
        setFormName('');
        await fetchSettingsAndTemplates();
      } else {
        alert(`❌ Meta API Rejection / Error:\n\n${data.error || 'Failed to submit template'}`);
      }
    } catch (err) {
      alert('Network error submitting template to Meta.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = !search || t.name?.toLowerCase().includes(search.toLowerCase()) || t.category?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0b1322] text-white overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* 1. TOP HEADER & WABA CONFIG BAR */}
      <div className="bg-[#111c30] border border-slate-800/80 rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/10">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                Meta WhatsApp Templates Manager
              </h2>
              <span className="px-2.5 py-0.5 text-[11px] font-extrabold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Official Cloud API
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Create, preview, and submit WhatsApp Message Templates directly to Meta for instant review & customer messaging.
            </p>
          </div>
        </div>

        {/* WABA ID Config Bar */}
        <div className="flex items-center gap-2 shrink-0 bg-slate-950/80 border border-slate-800 p-2 rounded-2xl">
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              WhatsApp Business Account ID
            </span>
            {editingWaba || !wabaId ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <input
                  type="text"
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  placeholder="Enter WABA ID..."
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500 w-40"
                />
                <button
                  onClick={handleSaveWabaId}
                  disabled={savingWaba || !wabaId.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
                  title="Save WABA ID"
                >
                  <Save className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono font-extrabold text-emerald-400">
                  {wabaId}
                </span>
                <button
                  onClick={() => setEditingWaba(true)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                  title="Edit WABA ID"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <button
            onClick={fetchSettingsAndTemplates}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/80"
            title="Refresh templates from Meta"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!wabaId}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Create Meta Template</span>
          </button>
        </div>
      </div>

      {/* 2. ERROR / AUTO-DETECT NOTICE */}
      {error && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200">
            <p className="font-bold mb-1">Notice / Configuration Needed:</p>
            <p>{error}</p>
            <p className="mt-1 text-slate-400">
              💡 <span className="text-amber-300 font-semibold">Tip:</span> Your WABA ID is automatically captured whenever any WhatsApp message arrives at your webhook, or you can find it in your Meta WhatsApp Manager under Account Settings.
            </p>
          </div>
        </div>
      )}

      {/* 3. SEARCH & STATUS FILTER BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#111c30] p-3 rounded-2xl border border-slate-800/80">
        <div className="flex items-center gap-2">
          {['ALL', 'APPROVED', 'PENDING', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === st
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {st === 'ALL' ? 'All Templates' : st}
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-full sm:w-64"
          />
        </div>
      </div>

      {/* 4. TEMPLATES GRID / LIST */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 text-sm">
          <RefreshCw className="w-6 h-6 animate-spin mr-3 text-emerald-400" />
          Fetching official templates from Meta WhatsApp Cloud API...
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-[#111c30] border border-slate-800/80 rounded-3xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">
            {search || statusFilter !== 'ALL' ? 'No matching templates found' : 'No WhatsApp Templates Found'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mb-6">
            {search || statusFilter !== 'ALL'
              ? 'Try adjusting your search filter or status tab above.'
              : 'You haven\'t created any message templates on this WhatsApp Business Account yet. Create your first template below to start sending outbound notifications!'}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!wabaId}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Create First Meta Template</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((tpl, i) => {
            const bodyComp = tpl.components?.find(c => c.type === 'BODY')?.text || 'No text content';
            const headerComp = tpl.components?.find(c => c.type === 'HEADER');
            const footerComp = tpl.components?.find(c => c.type === 'FOOTER')?.text;
            const buttonsComp = tpl.components?.find(c => c.type === 'BUTTONS')?.buttons;

            return (
              <div
                key={tpl.id || i}
                className="bg-[#111c30] border border-slate-800/80 hover:border-slate-700/80 rounded-3xl p-5 flex flex-col justify-between transition-all shadow-lg hover:shadow-xl group"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-white text-sm font-mono truncate group-hover:text-emerald-300 transition-colors">
                          {tpl.name}
                        </h4>
                        <button
                          onClick={() => handleCopy(tpl.name)}
                          className="text-slate-500 hover:text-emerald-400 p-1 rounded transition-colors"
                          title="Copy template name"
                        >
                          {copiedName === tpl.name ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {tpl.category}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 uppercase">
                          {tpl.language}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      {tpl.status === 'APPROVED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> APPROVED
                        </span>
                      ) : tpl.status === 'PENDING' || tpl.status === 'IN_APPEAL' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                          <Clock className="w-3 h-3 text-amber-400" /> IN REVIEW
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          <XCircle className="w-3 h-3 text-rose-400" /> {tpl.status || 'REJECTED'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Message Bubble Preview */}
                  <div className="bg-[#0b141a] border border-slate-800/80 rounded-2xl p-3.5 my-3 text-xs text-slate-200 relative shadow-inner">
                    {headerComp && (
                      <div className="font-extrabold text-emerald-400 mb-1.5 pb-1 border-b border-slate-800 text-[11px] uppercase">
                        {headerComp.format === 'TEXT' ? headerComp.text : `[${headerComp.format} ATTACHMENT]`}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap break-words leading-relaxed">
                      {bodyComp}
                    </p>
                    {footerComp && (
                      <div className="mt-2 text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                        {footerComp}
                      </div>
                    )}
                    {buttonsComp && buttonsComp.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-800/60 flex flex-wrap gap-1.5">
                        {buttonsComp.map((btn, bidx) => (
                          <span key={bidx} className="bg-slate-800/80 text-emerald-300 px-2 py-0.5 rounded-lg text-[10px] font-bold border border-slate-700">
                            {btn.type === 'URL' ? `🔗 ${btn.text}` : `⚡ ${btn.text}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-mono text-[10px]">
                    ID: {tpl.id ? String(tpl.id).slice(-8) : 'N/A'}
                  </span>
                  <button
                    onClick={() => handleDeleteTemplate(tpl.name)}
                    className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                    title="Delete template from Meta"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. CREATE META TEMPLATE MODAL (INTERACTIVE WITH LIVE PHONE PREVIEW) */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-[fadeIn_0.2s_ease]"
          onClick={() => !submitting && setShowCreateModal(false)}
        >
          <div
            className="bg-[#0b1322] border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 px-6 border-b border-slate-800 bg-[#111c30] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base sm:text-lg">
                    Create New Meta WhatsApp Template
                  </h3>
                  <p className="text-xs text-slate-400">
                    Submit a template directly to Meta WhatsApp Cloud API for review (usually approved in 1–5 mins)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !submitting && setShowCreateModal(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content: 2-Column (Form on Left, Live Phone Preview on Right) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT COLUMN: TEMPLATE FORM */}
              <form onSubmit={handleSubmitNewTemplate} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Template Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. combo_offer_discount_2026"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-emerald-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Lowercase letters, numbers, and underscores only.
                  </p>
                </div>

                {/* Category & Language */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                      Category
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="MARKETING">MARKETING (Promos/Offers)</option>
                      <option value="UTILITY">UTILITY (Order/Shipping)</option>
                      <option value="AUTHENTICATION">AUTHENTICATION (OTP/Codes)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                      Language
                    </label>
                    <select
                      value={formLanguage}
                      onChange={(e) => setFormLanguage(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="en_US">English (en_US)</option>
                      <option value="en_GB">English UK (en_GB)</option>
                      <option value="hi">Hindi (hi)</option>
                      <option value="en">English (en)</option>
                    </select>
                  </div>
                </div>

                {/* Header Option */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Header (Optional)
                  </label>
                  <div className="flex items-center gap-3 mb-2">
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="hdr"
                        checked={headerType === 'NONE'}
                        onChange={() => setHeaderType('NONE')}
                        className="accent-emerald-500"
                      />
                      <span>None</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="hdr"
                        checked={headerType === 'TEXT'}
                        onChange={() => setHeaderType('TEXT')}
                        className="accent-emerald-500"
                      />
                      <span>Text Header</span>
                    </label>
                  </div>
                  {headerType === 'TEXT' && (
                    <input
                      type="text"
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value)}
                      placeholder="e.g. 🔥 EXCLUSIVE 11FIT OFFER"
                      maxLength={60}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  )}
                </div>

                {/* Message Body */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Message Body <span className="text-rose-400">*</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500 mr-1">Insert Var:</span>
                      {['{{1}}', '{{2}}', '{{3}}'].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setBodyText(prev => prev + ' ' + v)}
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-emerald-400 border border-slate-700"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    required
                    rows="5"
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    placeholder="Enter your WhatsApp message text here..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 leading-relaxed font-sans"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Use <span className="text-emerald-400 font-mono">{'{{1}}'}</span>, <span className="text-emerald-400 font-mono">{'{{2}}'}</span> for dynamic variables like customer name or order number.
                  </p>
                </div>

                {/* Footer Text */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Footer (Optional)
                  </label>
                  <input
                    type="text"
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder="e.g. 11FIT Activewear • Reply STOP to unsubscribe"
                    maxLength={60}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-400 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Buttons Option */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Interactive Buttons (Optional)
                  </label>
                  <div className="flex items-center gap-4 mb-2">
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="btns"
                        checked={buttonsType === 'NONE'}
                        onChange={() => setButtonsType('NONE')}
                        className="accent-emerald-500"
                      />
                      <span>None</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="btns"
                        checked={buttonsType === 'QUICK_REPLY'}
                        onChange={() => setButtonsType('QUICK_REPLY')}
                        className="accent-emerald-500"
                      />
                      <span>Quick Reply Buttons</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="btns"
                        checked={buttonsType === 'URL'}
                        onChange={() => setButtonsType('URL')}
                        className="accent-emerald-500"
                      />
                      <span>CTA Web URL</span>
                    </label>
                  </div>

                  {buttonsType === 'QUICK_REPLY' && (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={quickReplyText1}
                        onChange={(e) => setQuickReplyText1(e.target.value)}
                        placeholder="Button 1 text (e.g. Shop Now)"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                      <input
                        type="text"
                        value={quickReplyText2}
                        onChange={(e) => setQuickReplyText2(e.target.value)}
                        placeholder="Button 2 text (optional)"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  )}

                  {buttonsType === 'URL' && (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={ctaText}
                        onChange={(e) => setCtaText(e.target.value)}
                        placeholder="Button text (e.g. Shop Now)"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                      <input
                        type="url"
                        value={ctaUrl}
                        onChange={(e) => setCtaUrl(e.target.value)}
                        placeholder="https://11fit.in"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-emerald-300"
                      />
                    </div>
                  )}
                </div>

                {/* Form Submit Footer */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !formName.trim() || !bodyText.trim()}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Submitting to Meta...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Submit Template to Meta</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* RIGHT COLUMN: LIVE WHATSAPP PHONE PREVIEW */}
              <div className="flex flex-col items-center justify-center bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-4 uppercase tracking-wider">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>Live WhatsApp Customer Preview</span>
                </div>

                {/* Sleek WhatsApp Chat Frame */}
                <div className="w-full max-w-[300px] bg-[#0b141a] border border-slate-800 rounded-3xl p-4 shadow-2xl relative overflow-hidden">
                  {/* Top Bar */}
                  <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800/80 mb-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-black text-xs">
                      11
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white">11FIT Activewear</h5>
                      <p className="text-[9px] text-emerald-400 font-medium">Official Business Account</p>
                    </div>
                  </div>

                  {/* Message Bubble */}
                  <div className="bg-[#005c4b] text-white rounded-2xl rounded-tl-sm p-3 shadow-md text-xs relative space-y-2">
                    {headerType === 'TEXT' && headerText && (
                      <div className="font-extrabold text-emerald-200 text-xs uppercase pb-1 border-b border-emerald-700/50">
                        {headerText}
                      </div>
                    )}

                    <p className="whitespace-pre-wrap break-words leading-relaxed text-[11px] font-sans">
                      {bodyText || 'Your WhatsApp message text here...'}
                    </p>

                    {footerText && (
                      <div className="text-[9px] text-emerald-200/70 pt-1 border-t border-emerald-700/40">
                        {footerText}
                      </div>
                    )}

                    <div className="text-right">
                      <span className="text-[9px] text-emerald-200/60 font-mono">12:45 PM</span>
                    </div>
                  </div>

                  {/* Buttons preview */}
                  {buttonsType === 'QUICK_REPLY' && (quickReplyText1 || quickReplyText2) && (
                    <div className="mt-2 space-y-1.5">
                      {quickReplyText1 && (
                        <div className="bg-[#1f2c34] text-emerald-400 font-bold text-[11px] text-center py-2 rounded-xl border border-slate-700/80">
                          ⚡ {quickReplyText1}
                        </div>
                      )}
                      {quickReplyText2 && (
                        <div className="bg-[#1f2c34] text-emerald-400 font-bold text-[11px] text-center py-2 rounded-xl border border-slate-700/80">
                          ⚡ {quickReplyText2}
                        </div>
                      )}
                    </div>
                  )}

                  {buttonsType === 'URL' && ctaText && (
                    <div className="mt-2">
                      <div className="bg-[#1f2c34] text-emerald-400 font-bold text-[11px] text-center py-2 rounded-xl border border-slate-700/80">
                        🔗 {ctaText}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
