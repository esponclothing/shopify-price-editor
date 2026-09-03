import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  Search, Phone, ShoppingBag, MapPin, Truck, ExternalLink, RefreshCw,
  User, Mail, ChevronDown, ChevronUp, Copy, Check,
  AlertCircle, Package, MessageSquare, Send, X, FileText,
  Lock, CheckCheck, Image as ImageIcon, Mic, StopCircle
} from 'lucide-react';

const formatPhone = (raw) => {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return raw.startsWith('+') ? raw : `+${raw}`;
};

// ─── WhatsApp Chat Modal ──────────────────────────────────────────────────────
function WhatsAppChatModal({ phone, customerName, onClose }) {
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [chatInfo, setChatInfo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyType, setReplyType] = useState('text');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [metaTemplates, setMetaTemplates] = useState([]);
  const [templateParams, setTemplateParams] = useState([]);
  const [sending, setSending] = useState(false);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaPreviewBase64, setMediaPreviewBase64] = useState(null);
  const [mediaPreviewType, setMediaPreviewType] = useState(null);
  const messagesEndRef = useRef(null);
  const shouldScrollRef = useRef(true);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const pollRef = useRef(null);

  const KNOWN_TEMPLATES = {
    'abandoned_cart_v2':           { label: '🛒 Abandoned Cart Recovery',          params: ['Customer Name', 'Cart Value (₹)'] },
    'combo_offer_reengage_v2':     { label: '🛍️ Special Combo Offer',              params: ['Customer Name'] },
    'order_status_check_v1':       { label: 'ℹ️ Order Status Check',               params: ['Name', 'Order #', 'Status', 'Details/Tracking'] },
    'order_confirm_prepaid_v1':    { label: '✅ Order Confirmed (Prepaid)',         params: ['Name', 'Order #', 'Items', 'Amount Paid (₹)', 'Address'] },
    'order_confirmation_cod_v1':   { label: '💵 Order Confirmed (COD)',            params: ['Name', 'Order #', 'Items', 'Amount Payable (₹)', 'Address'] },
    'order_confirm_partial_v1':    { label: '🪙 Order Confirmed (Advance/Partial)', params: ['Name', 'Order #', 'Items', 'Advance Paid (₹)', 'Balance Due (₹)', 'Address'] },
    'order_shipped_v1':            { label: '🚚 Order Shipped',                    params: ['Name', 'Order #', 'Courier', 'Tracking #'] },
    'out_for_delivery_prepaid_v1': { label: '🏠 Out For Delivery (Prepaid)',       params: ['Name', 'Order #'] },
    'out_for_delivery_cod_v1':     { label: '🏠 Out For Delivery (COD)',           params: ['Name', 'Order #', 'Amount to Collect (₹)'] },
    'order_delivered_confirm_v1':  { label: '🎉 Order Delivered',                  params: ['Name', 'Order #'] },
  };

  const templatesList = metaTemplates
    .filter(t => t.status === 'APPROVED')
    .map(t => ({
      id: t.name,
      label: KNOWN_TEMPLATES[t.name]?.label || `🔹 ${t.name.replace(/_/g, ' ')}`,
      params: KNOWN_TEMPLATES[t.name]?.params || (
        (t.components?.find(c => c.type === 'BODY')?.example?.body_text?.[0] || [])
          .map((_, i) => `Param ${i + 1}`)
      )
    }));

  const windowOpen = chatInfo
    ? (Date.now() < new Date(chatInfo.created_at).getTime() + 24 * 60 * 60 * 1000)
    : false;

  const fetchMessages = async (quiet = false) => {
    if (!quiet) setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/whatsapp-inbox?action=messages&phone=${encodeURIComponent(phone)}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        if (!quiet) shouldScrollRef.current = true;
      }
    } catch (_) {}
    if (!quiet) setLoadingMsgs(false);
  };

  const fetchChatInfo = async () => {
    try {
      const res = await fetch('/api/whatsapp-inbox?action=chats');
      if (res.ok) {
        const data = await res.json();
        const digits = phone.replace(/\D/g, '');
        const match = (data.chats || []).find(c => {
          const cd = (c.phone || '').replace(/\D/g, '');
          return cd.includes(digits) || digits.includes(cd);
        });
        setChatInfo(match || null);
      }
    } catch (_) {}
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/whatsapp-templates');
      if (res.ok) {
        const data = await res.json();
        setMetaTemplates(data.templates || []);
      }
    } catch (_) {}
  };

  const fetchOrders = async () => {
    try {
      const digits = phone.replace(/\D/g, '').slice(-10);
      const res = await fetch(`/api/shopify-customer-orders?phone=${encodeURIComponent(digits)}`);
      if (res.ok) {
        const data = await res.json();
        setCustomerOrders((data.orders || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchMessages();
    fetchChatInfo();
    fetchTemplates();
    fetchOrders();
    pollRef.current = setInterval(() => {
      fetchMessages(true);
      fetchChatInfo();
    }, 7000);
    return () => clearInterval(pollRef.current);
  }, [phone]);

  useLayoutEffect(() => {
    if (shouldScrollRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      shouldScrollRef.current = false;
    }
  }, [messages]);

  const getAutoParams = (templateId) => {
    const name = (customerName || customerOrders[0]?.shipping_address?.first_name || 'Customer').split(' ')[0];
    const order = customerOrders[0];
    const orderName = order?.name || '';
    const totalPrice = order?.total_price || '0';
    const address = order?.shipping_address
      ? `${order.shipping_address.address1 || ''}, ${order.shipping_address.city || ''}`.replace(/^,|,$/g, '').trim()
      : '';
    const itemsText = (order?.line_items || []).slice(0, 2).map(i => `${i.title} x${i.quantity}`).join(', ');
    const fulfillment = order?.fulfillments?.[0];

    switch (templateId) {
      case 'abandoned_cart_v2': return [name, '0'];
      case 'combo_offer_reengage_v2': return [name];
      case 'order_status_check_v1': {
        let status = order?.cancelled_at ? 'Cancelled' : order?.fulfillment_status === 'fulfilled' ? 'Fulfilled / Dispatched' : 'Processing';
        const details = fulfillment?.tracking_url ? `Track: ${fulfillment.tracking_url}` : 'Being prepared.';
        return [name, orderName, status, details];
      }
      case 'order_confirm_prepaid_v1': return [name, orderName, itemsText, totalPrice, address];
      case 'order_confirmation_cod_v1': return [name, orderName, itemsText, totalPrice, address];
      case 'order_confirm_partial_v1': return [name, orderName, itemsText, (parseFloat(totalPrice) * 0.1).toFixed(2), (parseFloat(totalPrice) * 0.9).toFixed(2), address];
      case 'order_shipped_v1': return [name, orderName, fulfillment?.tracking_company || 'Courier', fulfillment?.tracking_number || ''];
      case 'out_for_delivery_prepaid_v1': return [name, orderName];
      case 'out_for_delivery_cod_v1': return [name, orderName, totalPrice];
      case 'order_delivered_confirm_v1': return [name, orderName];
      default: {
        // For unknown templates, derive param count from Meta template definition
        const tplMeta = metaTemplates.find(t => t.name === templateId);
        const bodyComp = (tplMeta?.components || []).find(c => c.type === 'BODY');
        const numParams = bodyComp?.example?.body_text?.[0]?.length || 0;
        const params = Array(numParams).fill('');
        if (numParams > 0) params[0] = name;
        return params;
      }
    }
  };

  const handleSelectTemplate = (tplId) => {
    setSelectedTemplate(tplId);
    setTemplateParams(getAutoParams(tplId));
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (sending) return;

    if (mediaPreviewBase64) {
      setSending(true);
      try {
        const res = await fetch('/api/whatsapp-inbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'upload_media', phone, base64: mediaPreviewBase64, media_type: mediaPreviewType, caption: replyText })
        });
        if (res.ok) {
          setMediaPreviewBase64(null); setMediaPreviewType(null); setReplyText('');
          shouldScrollRef.current = true;
          await fetchMessages();
        } else {
          const err = await res.json();
          alert(`Error: ${err.error || 'Failed'}`);
        }
      } catch (_) { alert('Network error'); }
      setSending(false);
      return;
    }

    if (replyType === 'text' && !replyText.trim()) return;
    if (replyType === 'template' && !selectedTemplate) return;

    setSending(true);
    const optimistic = {
      id: `_opt_${Date.now()}`, phone, role: 'assistant',
      content: replyType === 'template' ? `📋 Template: ${selectedTemplate}` : replyText,
      created_at: new Date().toISOString(), _sending: true
    };
    setMessages(prev => [...prev, optimistic]);
    shouldScrollRef.current = true;

    try {
      const payload = { action: 'send_message', phone, type: replyType, text: replyText };
      if (replyType === 'template') {
        payload.template_name = selectedTemplate;
        payload.template_params = templateParams;
      }
      const res = await fetch('/api/whatsapp-inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setReplyText('');
        shouldScrollRef.current = true;
        await fetchMessages();
      } else {
        setMessages(prev => prev.filter(m => m.id !== optimistic.id));
        const err = await res.json();
        alert(`Error: ${err.error || 'Failed'}`);
      }
    } catch (_) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      alert('Network error');
    }
    setSending(false);
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setMediaPreviewBase64(ev.target.result); setMediaPreviewType('image'); };
    reader.readAsDataURL(file);
  };

  const startAudioRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/mpeg' });
        const reader = new FileReader();
        reader.onload = (ev) => { setMediaPreviewBase64(ev.target.result); setMediaPreviewType('audio'); };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      setIsRecording(true);
    } catch (_) { alert('Could not access microphone.'); }
  };

  const stopAudioRecord = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const renderMessageContent = (content) => {
    if (!content) return null;
    const audioMatch = content.match(/\[AUDIO_ID:(\d+)\]/) || content.match(/\[VOICE NOTE SENT\]\s*\(id:\s*(\d+)\)/i);
    if (audioMatch) {
      const id = audioMatch[1] || audioMatch[2];
      return (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-emerald-300">🎙️ Voice Note:</p>
          <audio controls className="w-52 h-8 rounded-lg">
            <source src={`/api/whatsapp-inbox?action=media&id=${id}`} type="audio/ogg" />
            <source src={`/api/whatsapp-inbox?action=media&id=${id}`} type="audio/mpeg" />
          </audio>
        </div>
      );
    }
    const imageMatch = content.match(/\[IMAGE_ID:(\d+)\]/) || content.match(/\[PHOTO SENT\]\s*\(id:\s*(\d+)\)/i);
    if (imageMatch) {
      const id = imageMatch[1] || imageMatch[2];
      const caption = content.replace(/\[IMAGE_ID:\d+\]|\[PHOTO SENT\]\s*\(id:\s*\d+\)/gi, '').trim();
      return (
        <div className="space-y-1.5">
          <a href={`/api/whatsapp-inbox?action=media&id=${id}`} target="_blank" rel="noopener noreferrer">
            <img src={`/api/whatsapp-inbox?action=media&id=${id}`} alt="Attachment" className="max-w-[200px] rounded-xl border border-slate-600 hover:opacity-90" />
          </a>
          {caption && <p className="text-sm whitespace-pre-wrap">{caption}</p>}
        </div>
      );
    }
    return <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{content}</p>;
  };

  const selectedTpl = templatesList.find(t => t.id === selectedTemplate);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 bg-black/75 backdrop-blur-md" onClick={onClose}>
      <div
        className="w-full max-w-lg h-[85vh] max-h-[660px] bg-[#0F172A] border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800/80 to-slate-900 border-b border-slate-700/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm leading-tight">{customerName || 'Customer'}</h3>
              <p className="text-xs text-emerald-400 font-mono">{formatPhone(phone)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
              windowOpen ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
            }`}>
              {windowOpen ? '🟢 24H Open' : '🔒 24H Closed'}
            </span>
            {chatInfo && (
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                chatInfo.ai_paused ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
              }`}>
                {chatInfo.ai_paused ? '⏸️ AI Paused' : '🤖 AI Active'}
              </span>
            )}
            <button onClick={onClose} className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#0B1120]">
          {loadingMsgs ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-500">Loading messages...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3 py-12">
                <MessageSquare className="w-12 h-12 text-slate-700 mx-auto" />
                <p className="text-slate-500 text-sm">No messages yet.</p>
                <p className="text-slate-600 text-xs">Use a template below to start the conversation.</p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isOut = msg.role === 'assistant' || msg.role === 'system';
              return (
                <div key={msg.id || idx} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl shadow text-sm ${
                    isOut
                      ? 'bg-gradient-to-br from-emerald-700/80 to-teal-800/70 text-white rounded-br-sm border border-emerald-600/30'
                      : 'bg-slate-800 text-slate-100 rounded-bl-sm border border-slate-700/60'
                  } ${msg._sending ? 'opacity-60' : ''}`}>
                    {isOut && <p className="text-[10px] text-emerald-300/70 font-semibold mb-1 uppercase tracking-wide">11FIT</p>}
                    {renderMessageContent(msg.content)}
                    <p className={`text-[10px] mt-1.5 text-right ${isOut ? 'text-emerald-300/50' : 'text-slate-500'}`}>
                      {msg._sending ? 'Sending...' : new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isOut && !msg._sending && <CheckCheck className="w-3 h-3 inline ml-1 text-emerald-400" />}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 24H Closed Banner */}
        {!windowOpen && (
          <div className="shrink-0 px-4 py-2 bg-rose-950/40 border-t border-rose-800/40 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <p className="text-[11px] text-rose-300 font-medium">24H window closed — use a Template to re-engage</p>
          </div>
        )}

        {/* Media Preview */}
        {mediaPreviewBase64 && (
          <div className="shrink-0 px-4 py-2 bg-slate-900 border-t border-slate-700 flex items-center gap-3">
            {mediaPreviewType === 'image'
              ? <img src={mediaPreviewBase64} alt="preview" className="w-14 h-14 rounded-xl object-cover border border-slate-600" />
              : <div className="flex items-center gap-2 text-emerald-400"><Mic className="w-5 h-5" /><span className="text-xs font-semibold">Voice ready</span></div>
            }
            <button onClick={() => { setMediaPreviewBase64(null); setMediaPreviewType(null); }} className="ml-auto p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Reply Type Tabs */}
        <div className="shrink-0 border-t border-slate-700/60 bg-slate-900/90 px-4 pt-3 pb-1 flex items-center gap-2">
          <button onClick={() => setReplyType('text')} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${replyType === 'text' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            💬 Text
          </button>
          <button onClick={() => setReplyType('template')} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${replyType === 'template' ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            📋 Template
          </button>
          <label className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition-all flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" /><span>Photo</span>
            <input type="file" accept="image/*" capture="camera" className="hidden" onChange={handlePhotoSelect} />
          </label>
          <button
            onMouseDown={startAudioRecord} onMouseUp={stopAudioRecord}
            onTouchStart={startAudioRecord} onTouchEnd={stopAudioRecord}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${isRecording ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            {isRecording ? <StopCircle className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            <span>{isRecording ? 'Recording...' : 'Voice'}</span>
          </button>
        </div>

        {/* Template Selector */}
        {replyType === 'template' && (
          <div className="shrink-0 px-4 py-2 bg-slate-900/90 space-y-2">
            <select
              value={selectedTemplate}
              onChange={e => handleSelectTemplate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            >
              <option value="">— Select a WhatsApp Template —</option>
              {templatesList.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            {selectedTpl && templateParams.length > 0 && (
              <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60 space-y-2">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Variables (auto-filled, editable)</p>
                {selectedTpl.params.map((paramLabel, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 w-28 shrink-0">{paramLabel}:</span>
                    <input
                      type="text"
                      value={templateParams[idx] || ''}
                      onChange={e => { const u = [...templateParams]; u[idx] = e.target.value; setTemplateParams(u); }}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Send Area */}
        <form onSubmit={handleSend} className="shrink-0 px-4 pb-4 pt-2 bg-slate-900/90">
          {replyType === 'text' && !mediaPreviewBase64 && (
            <div className="flex items-end gap-2">
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
                placeholder={windowOpen ? 'Type a message...' : 'Use Template tab (24H window closed)'}
                rows={2}
                className="flex-1 bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={sending || !replyText.trim()}
                className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-40 text-slate-950 transition-all shadow-md flex items-center justify-center shrink-0"
              >
                {sending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          )}
          {(replyType === 'template' || mediaPreviewBase64) && (
            <button
              type="submit"
              disabled={sending || (replyType === 'template' && (!selectedTemplate || templateParams.some(p => !p.trim())))}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-400 hover:to-violet-500 disabled:opacity-40 text-white font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2"
            >
              {sending
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Sending...</>
                : mediaPreviewBase64
                  ? <><Send className="w-4 h-4" /> Send {mediaPreviewType === 'image' ? 'Photo' : 'Voice Note'}</>
                  : <><FileText className="w-4 h-4" /> Send Template</>
              }
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CustomerOrderLookup() {
  const [phoneQuery, setPhoneQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [orders, setOrders] = useState([]);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [whatsappChat, setWhatsappChat] = useState(null);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [orderFilter, setOrderFilter] = useState('all');
  const [expandedOrders, setExpandedOrders] = useState({});
  const [showWAModal, setShowWAModal] = useState(false);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const toggleOrderExpand = (orderId) => {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const cleanQuery = phoneQuery.trim().replace(/\s+/g, '');
    if (!cleanQuery) { setError('Please enter a valid phone number'); return; }

    setLoading(true);
    setError('');
    setHasSearched(true);
    setOrders([]);
    setCustomerInfo(null);
    setWhatsappChat(null);
    setShowWAModal(false);

    try {
      const ordersRes = await fetch(`/api/shopify-customer-orders?phone=${encodeURIComponent(cleanQuery)}`);
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        const loadedOrders = data.orders || [];
        setOrders(loadedOrders);

        let name = data.customer?.name || '';
        let email = data.customer?.email || '';
        if (!name && loadedOrders.length > 0) {
          const sa = loadedOrders[0].shipping_address;
          if (sa && (sa.first_name || sa.last_name)) name = `${sa.first_name || ''} ${sa.last_name || ''}`.trim();
        }
        if (!email && loadedOrders.length > 0) email = loadedOrders[0].email || '';

        const totalSpent = loadedOrders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0);
        setCustomerInfo({
          name: name || 'Valued Customer',
          email: email || '',
          phone: cleanQuery,
          totalOrders: loadedOrders.length,
          totalSpent: totalSpent.toFixed(2)
        });

        if (loadedOrders.length > 0) setExpandedOrders({ [loadedOrders[0].id]: true });
      } else {
        setError('Failed to fetch customer orders.');
      }

      try {
        const chatsRes = await fetch('/api/whatsapp-inbox?action=chats');
        if (chatsRes.ok) {
          const chatsData = await chatsRes.json();
          const digits = cleanQuery.replace(/\D/g, '');
          const match = (chatsData.chats || []).find(c => {
            const cd = (c.phone || '').replace(/\D/g, '');
            return cd.includes(digits) || digits.includes(cd);
          });
          if (match) setWhatsappChat(match);
        }
      } catch (_) {}
    } catch (err) {
      setError('Network error while looking up customer.');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (orderFilter === 'all') return true;
    const fulfillments = Array.isArray(order.fulfillments) ? order.fulfillments : [];
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

      {/* WhatsApp Chat Modal */}
      {showWAModal && customerInfo && (
        <WhatsAppChatModal
          phone={customerInfo.phone}
          customerName={customerInfo.name}
          onClose={() => setShowWAModal(false)}
        />
      )}

      {/* Search Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-60 h-60 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Search className="w-3.5 h-3.5" /><span>Instant Customer & Order Inspector</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Lookup Orders by Phone Number</h1>
          <p className="text-sm md:text-base text-slate-400">Search any customer's phone number to view their Shopify orders, shipment tracking, shipping address, and WhatsApp conversation status.</p>
          <form onSubmit={handleSearch} className="pt-2">
            <div className="relative flex items-center max-w-xl mx-auto">
              <div className="absolute left-4"><Phone className="w-5 h-5 text-emerald-400" /></div>
              <input
                type="text"
                value={phoneQuery}
                onChange={e => setPhoneQuery(e.target.value)}
                placeholder="Enter Phone Number (e.g. 9985553369 or +919833264430)..."
                className="w-full pl-12 pr-36 py-4 bg-slate-950/80 border-2 border-slate-700/80 focus:border-emerald-500 rounded-2xl text-white placeholder-slate-500 text-base font-medium outline-none transition-all shadow-lg"
              />
              <button type="submit" disabled={loading} className="absolute right-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-slate-950 font-extrabold rounded-xl text-sm transition-all shadow-md flex items-center gap-2">
                {loading ? <><RefreshCw className="w-4 h-4 animate-spin" /><span>Searching...</span></> : <><Search className="w-4 h-4" /><span>Search</span></>}
              </button>
            </div>
          </form>
          <div className="flex items-center justify-center gap-2 pt-2 text-xs text-slate-500">
            <span>Example:</span>
            <button type="button" onClick={() => setPhoneQuery('+919985553369')} className="text-slate-400 hover:text-emerald-400 underline font-mono">+919985553369</button>
            <span>•</span>
            <button type="button" onClick={() => setPhoneQuery('9833264430')} className="text-slate-400 hover:text-emerald-400 underline font-mono">9833264430</button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-center gap-3 text-rose-300">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {hasSearched && !loading && !error && (
        <div className="space-y-6">
          {/* Customer Card */}
          {customerInfo && (
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <User className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-2xl font-black text-white">{customerInfo.name}</h2>
                      {customerInfo.totalOrders >= 3
                        ? <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">👑 VIP Customer</span>
                        : <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">🛍️ Customer</span>
                      }
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1.5 font-mono text-emerald-400 font-semibold">
                        <Phone className="w-3.5 h-3.5" />{formatPhone(customerInfo.phone)}
                      </span>
                      <button onClick={() => copyToClipboard(customerInfo.phone)} className="text-xs px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1">
                        {copiedPhone ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedPhone ? 'Copied' : 'Copy'}</span>
                      </button>
                      {customerInfo.email && (
                        <span className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />{customerInfo.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="px-4 py-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                    <span className="text-[11px] text-slate-400 block font-semibold uppercase tracking-wider">Total Orders</span>
                    <span className="text-xl font-black text-white">{customerInfo.totalOrders}</span>
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                    <span className="text-[11px] text-slate-400 block font-semibold uppercase tracking-wider">Lifetime Spend</span>
                    <span className="text-xl font-black text-emerald-400">₹{customerInfo.totalSpent}</span>
                  </div>
                  {/* WhatsApp Chat Button — opens in-app modal */}
                  <button
                    onClick={() => setShowWAModal(true)}
                    className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/10 hover:from-emerald-500/30 hover:to-teal-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-sm transition-all flex items-center gap-2 shadow-md group"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <div className="text-left">
                      <span className="block leading-tight">WhatsApp Chat</span>
                      <span className="text-[10px] text-emerald-400/80 font-normal">
                        {whatsappChat ? (whatsappChat.ai_paused ? '⏸️ AI Paused' : '🤖 AI Active') : '💬 Open Chat'}
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Orders Filter */}
          <div className="flex items-center justify-between flex-wrap gap-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">Customer Orders ({orders.length})</h3>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'all', label: `All (${orders.length})` },
                { id: 'fulfilled', label: `🚚 Fulfilled (${orders.filter(o => o.fulfillment_status === 'fulfilled' || (Array.isArray(o.fulfillments) && o.fulfillments[0]?.tracking_number)).length})` },
                { id: 'unfulfilled', label: `⏳ Processing (${orders.filter(o => !o.cancelled_at && o.fulfillment_status !== 'fulfilled' && !(Array.isArray(o.fulfillments) && o.fulfillments[0]?.tracking_number)).length})` },
                { id: 'cancelled', label: `❌ Cancelled (${orders.filter(o => !!o.cancelled_at).length})` }
              ].map(tab => (
                <button key={tab.id} onClick={() => setOrderFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${orderFilter === tab.id ? 'bg-emerald-500 text-slate-950 shadow-md' : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Orders List */}
          {filteredOrders.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-12 text-center space-y-3">
              <Package className="w-12 h-12 text-slate-600 mx-auto" />
              <h4 className="text-lg font-bold text-slate-400">No orders matching filter</h4>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map(order => {
                if (!order || typeof order !== 'object') return null;
                const isExpanded = !!expandedOrders[order.id];
                const fulfillments = Array.isArray(order.fulfillments) ? order.fulfillments : [];
                const fulfillment = fulfillments[0] || null;
                const trackingNumber = fulfillment?.tracking_number || null;
                const trackingUrl = fulfillment?.tracking_url || (Array.isArray(fulfillment?.tracking_urls) && fulfillment.tracking_urls[0]) || null;
                const trackingCompany = fulfillment?.tracking_company || null;
                const isFulfilled = order.fulfillment_status === 'fulfilled' || trackingNumber;
                const isCancelled = !!order.cancelled_at;
                const shipAddr = typeof order.shipping_address === 'object' ? order.shipping_address : null;
                const lineItems = Array.isArray(order.line_items) ? order.line_items : [];

                return (
                  <div key={order.id || Math.random()} className="bg-slate-900/80 border border-slate-800/90 rounded-2xl overflow-hidden shadow-md hover:border-slate-700 transition-all">
                    <div className="p-5 flex items-center justify-between gap-4 cursor-pointer select-none hover:bg-slate-800/40 transition-colors" onClick={() => toggleOrderExpand(order.id)}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-300 font-black text-sm shrink-0">
                          #{order.order_number || '?'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-base">{order.name || `#${order.order_number}`}</span>
                            <span className="text-xs text-slate-400">
                              {order.created_at ? new Date(order.created_at).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">{lineItems.length} item{lineItems.length !== 1 ? 's' : ''}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="font-extrabold text-emerald-400 text-lg">₹{order.total_price || 0}</span>
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            {order.financial_status === 'paid'
                              ? <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">💳 Paid</span>
                              : order.financial_status === 'partially_paid'
                              ? <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">🪙 Partial</span>
                              : <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">💵 COD</span>
                            }
                            {isCancelled
                              ? <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">❌ Cancelled</span>
                              : isFulfilled
                              ? <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">🚚 Fulfilled</span>
                              : <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">⏳ Unfulfilled</span>
                            }
                          </div>
                        </div>
                        <div className="p-1.5 rounded-lg bg-slate-800 text-slate-400">
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-6 pb-6 pt-2 border-t border-slate-800 space-y-6 bg-slate-950/40 text-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h5 className="font-bold text-slate-300 mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                              <MapPin className="w-4 h-4 text-emerald-400" />Shipping Address
                            </h5>
                            {shipAddr ? (
                              <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 space-y-1.5">
                                <p className="font-bold text-white text-base">{shipAddr.first_name || ''} {shipAddr.last_name || ''}</p>
                                <p className="text-slate-300">{[shipAddr.address1, shipAddr.address2, shipAddr.city, shipAddr.province, shipAddr.zip].filter(Boolean).join(', ')}</p>
                                {shipAddr.phone && <p className="text-slate-400 text-xs font-mono">Phone: {formatPhone(shipAddr.phone)}</p>}
                              </div>
                            ) : <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 text-slate-500 italic">No address provided</div>}
                          </div>
                          <div>
                            <h5 className="font-bold text-slate-300 mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                              <Truck className="w-4 h-4 text-blue-400" />Shipment & Tracking
                            </h5>
                            <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 space-y-2">
                              {isCancelled ? <div className="text-rose-400 font-bold">❌ This order was cancelled.</div>
                                : isFulfilled ? (
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
                                      <a href={trackingUrl} target="_blank" rel="noopener noreferrer"
                                        className="mt-2 w-full py-2 px-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                                        Track Shipment Live <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    )}
                                  </div>
                                ) : <div className="text-amber-300/90 text-sm font-medium">⏳ Processing — No AWB assigned yet.</div>
                              }
                            </div>
                          </div>
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-300 mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                            <ShoppingBag className="w-4 h-4 text-emerald-400" />Ordered Items ({lineItems.length})
                          </h5>
                          <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 space-y-3">
                            {lineItems.map((item, i) => (
                              <div key={i} className="flex items-center justify-between gap-4 text-slate-300 pb-3 border-b border-slate-800/80 last:border-0 last:pb-0">
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 font-black flex items-center justify-center text-xs shrink-0">{item?.quantity || 1}x</span>
                                  <div className="truncate">
                                    <p className="font-bold text-white text-sm truncate">{item?.title || 'Product'}</p>
                                    {item?.variant_title && <p className="text-slate-400 text-xs">Variant: {item.variant_title}</p>}
                                  </div>
                                </div>
                                <span className="font-extrabold text-emerald-400 text-base shrink-0">₹{item?.price || 0}</span>
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

      {!hasSearched && !loading && (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-12 text-center max-w-2xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-emerald-400 mx-auto">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white">Ready to Inspect Customer Orders</h3>
          <p className="text-sm text-slate-400 leading-relaxed">Type any phone number above to see Shopify orders, tracking info, and WhatsApp chat status.</p>
        </div>
      )}
    </div>
  );
}
