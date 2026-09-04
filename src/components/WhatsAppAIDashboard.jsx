import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  RefreshCw, CheckCircle2, XCircle, AlertCircle, Clock, Smartphone,
  MessageSquare, Terminal, Zap, Filter, Search, Eye, X, Phone,
  Send, Image as ImageIcon, Mic, FileText, Lock, Unlock, Play,
  Pause, ShieldAlert, BarChart3, Users, ArrowLeft, Check, CheckCheck,
  Bell, BellRing, Camera, StopCircle, Upload, Trash2,
  ShoppingBag, Package, Truck, ExternalLink, ChevronDown, ChevronUp, MapPin, Bot, Save, DollarSign,
  ShoppingCart, ShieldCheck, UserCheck, Activity, KeyRound, Megaphone, Plus, Sparkles, Tags, Info
} from 'lucide-react';
import MetaTemplatesManager from './MetaTemplatesManager';
import ChatbotFlowBuilder from './ChatbotFlowBuilder';
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function WhatsAppAIDashboard({ preSelectPhone }) {
  const [activeSubTab, setActiveSubTab] = useState('inbox'); // 'inbox' | 'logs' | 'flow_builder'
  const [showLockInfo, setShowLockInfo] = useState(false); // toggle 24h popup
  const preSelectDoneRef = useRef(false);

  // --- INBOX STATE ---
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [outboundCall, setOutboundCall] = useState(null); // { phone, customerName } when active
  const [messages, setMessages] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inboxSearch, setInboxSearch] = useState('');
  const [chatStatusFilter, setChatStatusFilter] = useState('open'); // 'open' | 'closed' | 'all'
  const [orderStatusFilter, setOrderStatusFilter] = useState('all'); // 'all' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'cancelled'
  const [showChatFilters, setShowChatFilters] = useState(false);
  const [replyType, setReplyType] = useState('text'); // 'text' | 'image' | 'audio' | 'template'
  const [replyText, setReplyText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('combo_offer_reengage');
  const [sendingReply, setSendingReply] = useState(false);
  const messagesEndRef = useRef(null);
  const shouldScrollRef = useRef(false); // only scroll to bottom on first load or send
  const selectedChatRef = useRef(selectedChat);
  selectedChatRef.current = selectedChat;
  const activeSubTabRef = useRef(activeSubTab);
  activeSubTabRef.current = activeSubTab;

  // --- NOTIFICATIONS STATE ---
  // Persist bell state across refreshes via localStorage
  const [notifEnabled, setNotifEnabled] = useState(() => {
    try { return localStorage.getItem('11fit_notif_enabled') === 'true'; } catch { return false; }
  });
  const lastMsgTimestampRef = useRef(0);
  const swRegistrationRef = useRef(null);
  const togglingAIRef = useRef(new Set());

  // --- CAMERA & VOICE RECORDING STATE ---
  const [mediaPreviewBase64, setMediaPreviewBase64] = useState(null);
  const [mediaPreviewType, setMediaPreviewType] = useState(null); // 'image' | 'audio'
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // --- AI INSTRUCTIONS STATE ---
  const [instLanguage, setInstLanguage] = useState('');
  const [instOrderSecurity, setInstOrderSecurity] = useState('');
  const [instSizeAdvisor, setInstSizeAdvisor] = useState('');
  const [instBrandPolicies, setInstBrandPolicies] = useState('');
  const [instCustom, setInstCustom] = useState('');
  const [instKnowledgeBase, setInstKnowledgeBase] = useState('');
  const [instCategoryTab, setInstCategoryTab] = useState('language'); // 'language' | 'security' | 'size' | 'brand' | 'custom' | 'knowledge_base'
  const [savingInst, setSavingInst] = useState(false);

  // --- PRIVATE NOTE & CANNED RESPONSES ---
  const [isPrivateNote, setIsPrivateNote] = useState(false);
  const [cannedResponses, setCannedResponses] = useState([]);
  const [showQuickRepliesModal, setShowQuickRepliesModal] = useState(false);

  // --- LOGS & ANALYTICS STATE ---
  const [executions, setExecutions] = useState([]);
  const [stats, setStats] = useState({
    total_count: 0,
    success_count: 0,
    error_count: 0,
    ignored_count: 0,
    avg_duration: 0
  });

  // --- CONTACTS & TAGS STATE ---
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsSearch, setContactsSearch] = useState('');
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastTemplate, setBroadcastTemplate] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');

  const handleSelectContact = (phone) => {
    setSelectedContacts(prev => 
      prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone]
    );
  };
  
  const handleSelectAllContacts = (filteredContacts) => {
    if (selectedContacts.length === filteredContacts.length && filteredContacts.length > 0) {
      setSelectedContacts([]); // deselect all
    } else {
      setSelectedContacts(filteredContacts.map(c => c.phone));
    }
  };
  
  const openBroadcastModal = async () => {
    setIsBroadcastModalOpen(true);
    if (metaTemplates.length === 0) {
      try {
        const res = await fetch('/api/whatsapp-templates');
        const data = await res.json();
        if (data.templates) setMetaTemplates(data.templates.filter(t => t.status === 'APPROVED'));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const sendBroadcast = async () => {
    if (!broadcastTemplate || selectedContacts.length === 0) return;
    setSendingBroadcast(true);
    try {
      const res = await fetch('/api/whatsapp-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_direct',
          phones: selectedContacts,
          template_name: broadcastTemplate
        })
      });
      const data = await res.json();
      if (data.success) {
        setBroadcastMessage(`Successfully sent broadcast to ${selectedContacts.length} users!`);
        setTimeout(() => { setIsBroadcastModalOpen(false); setBroadcastMessage(''); setSelectedContacts([]); }, 2000);
      } else {
        setBroadcastMessage('Failed to send: ' + data.error);
      }
    } catch (e) {
      setBroadcastMessage('Failed to send broadcast');
    }
    setSendingBroadcast(false);
  };

  // --- 11FIT ABANDONED CARTS (MOBILE NUMBER ONLY) & OTP ANALYTICS STATE ---
  const [elevenFitData, setElevenFitData] = useState({
    analytics: { totalOtpSent: 0, totalOtpVerified: 0, totalOtpFailed: 0, verificationRate: 100, totalMobileUsers: 0, activeAbandonedCarts: 0 },
    abandonedCarts: [],
    otpLogs: [],
    networkUsers: []
  });
  const [loadingElevenFit, setLoadingElevenFit] = useState(false);
  const [newAbCartNotification, setNewAbCartNotification] = useState(null); // toast notification banner for new carts
  const [abCartSubView, setAbCartSubView] = useState('carts'); // 'carts' | 'otp_logs' | 'users'
  const [abCartSearch, setAbCartSearch] = useState('');

  // --- CUSTOMER ORDERS MODAL STATE ---
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [ordersCustomerPhone, setOrdersCustomerPhone] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [sendingOrderAction, setSendingOrderAction] = useState(null);

  // --- DYNAMIC TEMPLATES & WORKFLOWS ---
  const [metaTemplates, setMetaTemplates] = useState([]);
  const [workflows, setWorkflows] = useState({
    abandoned_cart: true, order_placed: true, order_shipped: true, out_for_delivery: true, order_delivered: true
  });
  const [savingWorkflows, setSavingWorkflows] = useState(false);

  // --- ORDERS SUMMARY & FILTER STATES ---
  const [ordersSummaryMap, setOrdersSummaryMap] = useState({});
  const [inboxOrderFilter, setInboxOrderFilter] = useState('all');
  const [orderModalFilter, setOrderModalFilter] = useState('all');

  const getOrderSummaryForPhone = (phoneStr) => {
    if (!phoneStr) return null;
    const digits = String(phoneStr).replace(/\D/g, '').slice(-10);
    return ordersSummaryMap[digits] || null;
  };

  const applyInstructionsLocally = () => {
    setSavingInst(true);
    setTimeout(() => {
      setSavingInst(false);
      alert('These configurations are typically saved securely in the backend DB / Supabase.');
    }, 800);
  };

  // --- AI CO-PILOT LOGIC ---
  const [isRewriting, setIsRewriting] = useState(false);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  
  const handleRewrite = async () => {
    if (!replyText || replyText.trim() === '') return;
    setIsRewriting(true);
    try {
      const res = await fetch('/api/whatsapp-ai?action=rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rewrite', text: replyText })
      });
      const data = await res.json();
      if (data.success && data.rewritten) {
        setReplyText(data.rewritten);
      } else {
        alert('AI Co-Pilot failed to rewrite text. Try again later.');
      }
    } catch (e) {
      console.error(e);
      alert('AI Co-Pilot is currently offline.');
    }
    setIsRewriting(false);
  };

  const handleGenerateSuggestions = async () => {
    if (!selectedChat || !messages || messages.length === 0) {
      alert('No messages loaded for this chat.');
      return;
    }
    
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) {
      alert('No customer messages found to generate suggestions for.');
      return;
    }

    // Format last 5 messages for context
    const recentMsgs = messages.slice(-5).map(m => `${m.role === 'user' ? 'Customer' : 'Agent'}: ${m.content}`).join('\n');

    setIsGeneratingSuggestions(true);
    try {
      const res = await fetch('/api/whatsapp-ai?action=suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'suggest', text: recentMsgs })
      });
      const data = await res.json();
      if (data.success && data.suggestions && data.suggestions.length > 0) {
        setAiSuggestions(data.suggestions);
      } else {
        alert('AI Co-Pilot failed to generate suggestions. Try again later.');
      }
    } catch (e) {
      console.error(e);
      alert('AI Co-Pilot is currently offline.');
    }
    setIsGeneratingSuggestions(false);
  };

  // --- FETCH CONTACTS ---
  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const res = await fetch('/api/whatsapp-settings?action=contacts');
      const data = await res.json();
      setContacts(data.contacts || []);
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    }
    setLoadingContacts(false);
  };

  useEffect(() => {
    if (activeSubTab === 'contacts' && contacts.length === 0) fetchContacts();
  }, [activeSubTab]);

  // --- FETCH BROADCASTS HISTORY ---
  const [broadcastsHistory, setBroadcastsHistory] = useState([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(false);
  const [selectedBroadcastLogs, setSelectedBroadcastLogs] = useState(null);

  const fetchBroadcastsHistory = async () => {
    setLoadingBroadcasts(true);
    try {
      const res = await fetch('/api/whatsapp-broadcast');
      const data = await res.json();
      setBroadcastsHistory(data.broadcasts || []);
    } catch (err) {
      console.error('Failed to fetch broadcasts:', err);
    }
    setLoadingBroadcasts(false);
  };

  const fetchQuickReplies = async () => {
    try {
      const res = await fetch('/api/whatsapp-settings?action=quick_replies');
      if (res.ok) {
        const data = await res.json();
        setCannedResponses(data.replies || []);
      }
    } catch (err) {
      console.error('Failed to fetch quick replies:', err);
    }
  };

  const fetchBroadcastLogs = async (id) => {
    try {
      const res = await fetch(`/api/whatsapp-broadcast?id=${id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedBroadcastLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch broadcast logs:', err);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'broadcasts' && broadcastsHistory.length === 0) fetchBroadcastsHistory();
  }, [activeSubTab]);

  // Play audible notification chime on mobile / desktop
  const playAlertBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (_) {}
  };

  // --- REQUEST PUSH NOTIFICATIONS ---
  const registerPushSubscription = async (reg) => {
    try {
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        // We use our constant VAPID key
        const vapidPublicKey = 'BIqLUY30-N9qSJrCz4tF1C65XgCRVyr-1TmiCTG2MNFL2_8_EAC4o626ehSdKSM5uUpNPJvpcNCjwOen8evAjRU';
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });
      }
      // Send subscription to backend
      await fetch('/api/11fit-analytics?action=webpush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'subscribe', subscription: sub })
      });
      console.log('✅ Web Push Subscription Registered!');
    } catch (err) {
      console.error('Failed to register Web Push:', err);
    }
  };

  const enableNotifications = async () => {
    playAlertBeep();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([100, 50, 100]); } catch (_) {}
    }
    if (!('Notification' in window)) {
      alert('Browser does not support notifications, but audible beep alerts are active!');
      setNotifEnabled(true);
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      setNotifEnabled(true);
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          await registerPushSubscription(reg);
          // Show test message
          reg.active?.postMessage({ type: 'TEST_NOTIFICATION' });
          swRegistrationRef.current = reg;
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      alert('Notification permission denied. Audible beep alerts will still play when app is open.');
      setNotifEnabled(true);
    }
  };

  const triggerAlertNotification = (title, body) => {
    playAlertBeep();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([200, 100, 200]); } catch (_) {}
    }
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(reg => reg.showNotification(title, { body })).catch(() => {
            new Notification(title, { body });
          });
        } else {
          new Notification(title, { body });
        }
      } catch (_) {}
    }
  };

  // --- CAMERA & GALLERY PHOTO HANDLER ---
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setMediaPreviewBase64(ev.target.result);
      setMediaPreviewType('image');
      setReplyType('image');
    };
    reader.readAsDataURL(file);
  };

  // --- MICROPHONE AUDIO RECORDER ---
  const startAudioRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mpeg' });
        const reader = new FileReader();
        reader.onload = (ev) => {
          setMediaPreviewBase64(ev.target.result);
          setMediaPreviewType('audio');
          setReplyType('audio');
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      alert('Could not access microphone. Please allow audio permission.');
    }
  };

  const stopAudioRecord = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playCriticalAlertBeep = () => {
    // Siren removed per user request
  };

  // --- FETCH FUNCTIONS ---
  const fetchChats = async (isQuiet = false) => {
    if (!isQuiet) setLoadingChats(true);
    try {
      const res = await fetch('/api/whatsapp-inbox?action=chats');
      if (res.ok) {
        const data = await res.json();
        const loadedChats = data.chats || [];

        // Check if there is a newer message for notification alert
        if (loadedChats.length > 0) {
          const newest = loadedChats[0];
          const newestTime = new Date(newest.created_at).getTime();
          if (lastMsgTimestampRef.current > 0 && newestTime > lastMsgTimestampRef.current) {
            if (newest.last_role === 'user') {
              triggerAlertNotification(
                `💬 New WhatsApp from ${newest.phone}`,
                newest.last_message
              );
            } else if (newest.last_role === 'assistant' && newest.last_message?.includes('Abhi humara AI system busy hai')) {
              playCriticalAlertBeep();
              triggerAlertNotification(
                `🚨 AI API LIMIT HIT!`,
                `Manual takeover required for ${newest.phone}!`
              );
            }
          }
          lastMsgTimestampRef.current = newestTime;
        }

        setChats(prevChats => {
          return loadedChats.map(loadedChat => {
            if (togglingAIRef.current.has(loadedChat.phone)) {
              const existing = prevChats.find(p => p.phone === loadedChat.phone);
              if (existing) {
                return { ...loadedChat, ai_paused: existing.ai_paused };
              }
            }
            return loadedChat;
          });
        });
        
        setSelectedChat(prev => {
          if (!prev) return null;
          const updated = loadedChats.find(c => c.phone === prev.phone);
          if (!updated) return prev;
          if (togglingAIRef.current.has(updated.phone)) {
            return { ...updated, ai_paused: prev.ai_paused };
          }
          return updated;
        });
      }

      fetch('/api/shopify-orders-summary')
        .then(r => r.json())
        .then(d => {
          if (d.summary) setOrdersSummaryMap(d.summary);
        })
        .catch(() => {});
    } catch (err) {
      console.error('Failed to fetch chats:', err);
    } finally {
      if (!isQuiet) setLoadingChats(false);
    }
  };

  const fetchMessages = async (phone, isQuiet = false) => {
    if (!phone) return;
    if (!isQuiet) {
      shouldScrollRef.current = true; // scroll to bottom on first load
    }
    try {
      const res = await fetch(`/api/whatsapp-inbox?action=messages&phone=${encodeURIComponent(phone)}`);
      if (res.ok) {
        const data = await res.json();
        const incoming = data.messages || [];
        if (isQuiet) {
          // Silent update
          setMessages(prev => {
            if (prev.length === 0) return incoming;
            const hasOptimistic = prev.some(m => m._sending);
            if (hasOptimistic) return incoming;
            
            const prevLastId = prev[prev.length - 1]?.id;
            const incomingLastId = incoming[incoming.length - 1]?.id;
            
            if (incomingLastId === prevLastId && prev.length === incoming.length) {
              return prev; // identical
            }
            
            // New messages arrived or array size changed
            shouldScrollRef.current = true;
            return incoming;
          });
        } else {
          setMessages(incoming);
        }
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const fetchExecutions = async (isQuiet = false) => {
    if (!isQuiet) setLoadingLogs(true);
    try {
      const res = await fetch('/api/whatsapp-inbox?action=executions');
      if (res.ok) {
        const data = await res.json();
        setExecutions(data.executions || []);
        setStats(data.stats || {});
      }
    } catch (err) {
      console.error('Failed to load executions:', err);
    } finally {
      if (!isQuiet) setLoadingLogs(false);
    }
  };

  // --- CUSTOMER ORDERS MODAL & WHATSAPP SENDER ---
  const handleOpenCustomerOrders = async (phone) => {
    if (!phone) return;
    setOrdersCustomerPhone(phone);
    setShowOrdersModal(true);
    setOrderModalFilter('all');
    setOrdersLoading(true);
    setCustomerOrders([]);
    setExpandedOrderId(null);

    try {
      const cleanDigits = phone.replace(/\D/g, '');
      const last10 = cleanDigits.slice(-10);

      const res = await fetch(`/api/shopify-customer-orders?phone=${encodeURIComponent(last10)}`);
      if (res.ok) {
        const data = await res.json();
        let ordersList = data.orders || [];
        ordersList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setCustomerOrders(ordersList);
        if (ordersList.length > 0) {
          setExpandedOrderId(ordersList[0].id);
        }
      } else {
        console.error('Failed to load customer orders from Shopify');
      }
    } catch (err) {
      console.error('Error loading customer orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleSendOrderWhatsApp = async (order, actionType) => {
    if (!ordersCustomerPhone || !order) return;
    const actionKey = `${order.id}-${actionType}`;
    if (sendingOrderAction) return;
    setSendingOrderAction(actionKey);

    const customerName = order.shipping_address?.first_name || order.customer?.first_name || 'Customer';
    const orderName = order.name || `#${order.order_number}`;

    let msgText = '';

    const finStatus = (order.financial_status || '').toLowerCase();
    const totalVal = order.total_price || 0;
    const paymentStatusStr = finStatus === 'paid'
      ? `💳 PAID ONLINE (Prepaid - ₹${totalVal})`
      : finStatus === 'partially_paid'
      ? `🪙 PARTIAL PAID (Advance Paid | Balance to Pay on COD: ₹${totalVal})`
      : `💵 CASH ON DELIVERY (COD | Please Pay ₹${totalVal} on Delivery)`;

    if (actionType === 'details') {
      const itemsList = (order.line_items || [])
        .map(i => `• ${i.quantity}x ${i.title} ${i.variant_title ? `(${i.variant_title})` : ''} - ₹${i.price}`)
        .join('\n');
      const addressStr = order.shipping_address
        ? `${order.shipping_address.first_name || ''} ${order.shipping_address.last_name || ''}, ${order.shipping_address.address1 || ''}, ${order.shipping_address.city || ''} - ${order.shipping_address.zip || ''}`
        : 'N/A';
      const statusStr = order.fulfillment_status === 'fulfilled' ? '🚚 Fulfilled / Dispatched' : (order.cancelled_at ? '❌ Cancelled' : '⏳ Processing');

      msgText = `🛍️ *Order Details — ${orderName}*\n\n` +
        `Hi ${customerName}, here are your order details:\n\n` +
        `*Items Ordered:*\n${itemsList || '• Order Items'}\n\n` +
        `*Total Amount:* ₹${order.total_price || 0}\n` +
        `*Payment Status:* ${paymentStatusStr}\n` +
        `*Order Status:* ${statusStr}\n` +
        `*Shipping Address:* ${addressStr}\n\n` +
        `Thank you for shopping with *11FIT*! ❤️`;
    } else if (actionType === 'shipping') {
      const fulfillment = (order.fulfillments && order.fulfillments.length > 0) ? order.fulfillments[0] : null;
      const trackingCompany = fulfillment?.tracking_company || 'Courier Partner';
      const trackingNumber = fulfillment?.tracking_number || 'N/A';
      const trackingUrl = fulfillment?.tracking_url || (fulfillment?.tracking_urls && fulfillment.tracking_urls[0]) || '';

      msgText = `🚚 *Shipping & Tracking Update — Order ${orderName}*\n\n` +
        `Hi ${customerName}, great news! Your order has been dispatched.\n\n` +
        `*Payment Details:* ${paymentStatusStr}\n` +
        `*Courier Partner:* ${trackingCompany}\n` +
        `*Tracking Number:* ${trackingNumber}\n` +
        (trackingUrl ? `*Track Your Package:* ${trackingUrl}\n\n` : '\n') +
        `Your package is on its way! Let us know if you need any assistance. 📦`;
    }

    // If 24hr window is OPEN and we have msgText → send as free text
    // If 24hr window is CLOSED → fall back to WhatsApp template
    const chatForPhone = chats.find(c => {
      const d = String(c.phone || '').replace(/\D/g, '').slice(-10);
      const p = String(ordersCustomerPhone || '').replace(/\D/g, '').slice(-10);
      return d === p;
    });
    const windowOpen = chatForPhone ? get24HourStatus(chatForPhone).isOpen : false;

    if (windowOpen && msgText) {
      // Send as free text
      try {
        const res = await fetch('/api/whatsapp-inbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send_message', phone: ordersCustomerPhone, type: 'text', text: msgText })
        });
        if (res.ok) {
          if (selectedChat?.phone === ordersCustomerPhone) await fetchMessages(ordersCustomerPhone, false);
          alert(`✅ ${actionType === 'details' ? 'Order Details' : 'Shipping Info'} sent as text to ${formatPhone(ordersCustomerPhone)}!`);
        } else {
          const err = await res.json();
          alert(`❌ Error: ${err.error || 'Failed'}`);
        }
      } catch (err) {
        alert(`❌ Error: ${err.message}`);
      }
    } else {
      // 24hr window CLOSED — send as WhatsApp template
      // order_shipped_v1 has a hardcoded URL on Meta, so we use order_status_check_v1 which supports a dynamic tracking link in the body
      const tplId = actionType === 'shipping' ? 'order_status_check_v1' : 'order_confirm_prepaid_v1';
      const autoParams = getAutoParams(tplId, chatForPhone, customerOrders, []);
      const tplDef = templatesList.find(t => t.id === tplId);
      const paramString = autoParams.map((v,i) => `${tplDef?.params?.[i] || `{{${i+1}}}`}: ${v}`).join('\n');
      const confirmed = window.confirm(`24hr window is CLOSED.\n\nSend via WhatsApp Template: "${tplId}"?\n\nVariables:\n${paramString}`);
      if (!confirmed) { setSendingOrderAction(null); return; }

      try {
        const res = await fetch('/api/whatsapp-inbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_template',
            phone: ordersCustomerPhone,
            template_name: tplId,
            template_params: autoParams
          })
        });
        if (res.ok) {
          if (selectedChat?.phone === ordersCustomerPhone) await fetchMessages(ordersCustomerPhone, false);
          alert(`✅ Template "${tplId}" sent to ${formatPhone(ordersCustomerPhone)}!`);
        } else {
          const err = await res.json();
          alert(`❌ Error: ${err.error || 'Failed'}`);
        }
      } catch (err) {
        alert(`❌ Error: ${err.message}`);
      }
    }
    setSendingOrderAction(null);
  };

  // --- FETCH ACTIVE CHAT ORDERS IN BACKGROUND FOR TEMPLATES ---
  useEffect(() => {
    if (selectedChat?.phone) {
      const cleanDigits = selectedChat.phone.replace(/\D/g, '');
      const last10 = cleanDigits.slice(-10);
      fetch(`/api/shopify-customer-orders?phone=${encodeURIComponent(last10)}`)
        .then(res => res.json())
        .then(data => {
          let ordersList = data.orders || [];
          ordersList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          setCustomerOrders(ordersList);
        })
        .catch(() => {});
    }
  }, [selectedChat?.phone]);

  // --- PERSIST BELL STATE + REGISTER SERVICE WORKER ---
  useEffect(() => {
    try { localStorage.setItem('11fit_notif_enabled', notifEnabled ? 'true' : 'false'); } catch {}

    // Register background Service Worker for true push notifications
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
        swRegistrationRef.current = reg;
        if (Notification.permission === 'granted' && notifEnabled) {
          registerPushSubscription(reg);
        }
      }).catch(() => {});
    }
  }, [notifEnabled]);

  // --- AI INSTRUCTIONS HANDLERS ---
  const fetchInstructions = async () => {
    try {
      const res = await fetch('/api/whatsapp-settings');
      if (res.ok) {
        const data = await res.json();
        setInstLanguage(data.inst_language || '');
        setInstOrderSecurity(data.inst_order_security || '');
        setInstSizeAdvisor(data.inst_size_advisor || '');
        setInstBrandPolicies(data.inst_brand_policies || '');
        setInstCustom(data.inst_custom || '');
        setInstKnowledgeBase(data.inst_knowledge_base || '');
        if (data.workflows) setWorkflows(data.workflows);
      }
    } catch (_) {}
  };

  const fetchMetaTemplates = async () => {
    try {
      const res = await fetch('/api/whatsapp-templates');
      if (res.ok) {
        const data = await res.json();
        if (data.templates) {
          // Filter to only APPROVED templates
          setMetaTemplates(data.templates.filter(t => t.status === 'APPROVED'));
        }
      }
    } catch (_) {}
  };

  const handleSaveWorkflows = async () => {
    setSavingWorkflows(true);
    try {
      const res = await fetch('/api/whatsapp-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflows })
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        alert('✅ Automated Workflows updated!');
      } else {
        alert('❌ Failed to save workflows: ' + (data?.error || 'Unknown error'));
      }
    } catch (e) {
      alert('❌ Network error saving workflows');
    } finally {
      setSavingWorkflows(false);
    }
  };

  const handleSaveInstructions = async () => {
    setSavingInst(true);
    try {
      const res = await fetch('/api/whatsapp-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inst_language: instLanguage,
          inst_order_security: instOrderSecurity,
          inst_size_advisor: instSizeAdvisor,
          inst_brand_policies: instBrandPolicies,
          inst_custom: instCustom,
          inst_knowledge_base: instKnowledgeBase
        })
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        alert('✅ AI Instructions updated and activated for WhatsApp Bot!');
      } else {
        alert('❌ Failed to save instructions: ' + (data?.error || 'Unknown error'));
      }
    } catch (e) {
      alert('❌ Network error saving instructions');
    } finally {
      setSavingInst(false);
    }
  };

  // --- 11FIT ANALYTICS HANDLER ---
  const fetchElevenFitAnalytics = async (isQuiet = false) => {
    if (!isQuiet) setLoadingElevenFit(true);
    try {
      const storeUrl = localStorage.getItem('shopifyStoreUrl') || '';
      const accessToken = localStorage.getItem('shopifyAccessToken') || '';
      const res = await fetch('/api/11fit-analytics', {
        headers: {
          'x-client-store-url': storeUrl,
          'x-client-access-token': accessToken
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setElevenFitData(data);
          const carts = data.abandonedCarts || [];
          if (carts.length > 0) {
            const newestCart = carts[0];
            const lastSeenId = localStorage.getItem('11fit_last_ab_cart_id');
            const notifiedCartIds = JSON.parse(localStorage.getItem('11fit_notified_cart_ids') || '[]');
            const cartIdStr = String(newestCart.id);

            // A cart is only new if lastSeenId was initialized, it's not the same as lastSeenId, and we've never notified for this cartId before
            const isNewCart = lastSeenId && lastSeenId !== cartIdStr && !notifiedCartIds.includes(cartIdStr);
            if (isNewCart) {
               // Record this cart ID so we never notify for it again
               const updatedNotifiedIds = [cartIdStr, ...notifiedCartIds].slice(0, 50);
               localStorage.setItem('11fit_notified_cart_ids', JSON.stringify(updatedNotifiedIds));

               setNewAbCartNotification({
                 id: newestCart.id,
                 phone: newestCart.phone,
                 price: newestCart.total_price,
                 itemsCount: newestCart.line_items?.length || 1,
                 currency: newestCart.currency || 'INR'
               });
               playCriticalAlertBeep();
            }
            localStorage.setItem('11fit_last_ab_cart_id', cartIdStr);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch 11FIT analytics:', err);
    } finally {
      if (!isQuiet) setLoadingElevenFit(false);
    }
  };

  const handleSendAbCartRecovery = async (cart) => {
    if (!cart || !cart.phone) return;
    
    let cleanPhone = String(cart.phone).replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
    if (cleanPhone.startsWith('0') && cleanPhone.length === 11) cleanPhone = '91' + cleanPhone.slice(1);

    const rawName = cart.customer_name || cart.cart_details?.customer?.first_name || cart.cart_details?.shipping_address?.first_name || 'there';
    const name = rawName.split(' ')[0];
    const amountVal = cart.cart_details?.total_price || cart.total_price || 0;
    const amount = (parseFloat(amountVal) / (String(amountVal).includes('.') ? 1 : 100)).toFixed(2);
    
    // Generate Product Handle for the Button URL parameter
    const items = cart.cart_details?.line_items || cart.line_items || [];
    let productHandle = 'all';
    
    if (items.length > 0 && items[0].handle) {
      // Use the actual Shopify handle fetched from the backend
      productHandle = items[0].handle;
    } else if (items.length > 0) {
      // Fallback: Strip variant details (usually appended after " - ") and slugify
      const rawItemTitle = items[0].title || '';
      const firstItemTitle = rawItemTitle.includes(' - ') ? rawItemTitle.substring(0, rawItemTitle.lastIndexOf(' - ')) : rawItemTitle;
      productHandle = firstItemTitle ? firstItemTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : 'all';
    }

    const confirmed = window.confirm(`Send "Abandoned Cart Recovery" template to +${cleanPhone}?\n\nCustomer: ${name}\nAmount: ₹${amount}\nProduct Link: /products/${productHandle}`);
    if (!confirmed) return;

    try {
      const res = await fetch('/api/whatsapp-inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_template',
          phone: cleanPhone,
          template_name: 'abandoned_cart_v4',
          template_params: [name, amount, productHandle]
        })
      });
      if (res.ok) {
        alert(`✅ Abandoned Cart template sent to ${cart.phone}!`);
      } else {
        const err = await res.json();
        alert(`❌ Error: ${err.error || 'Failed'}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  // --- FOREGROUND POLLING + ONLINE RECONNECT ---
  useEffect(() => {
    fetchChats(false);
    fetchExecutions(false);
    fetchInstructions();
    fetchMetaTemplates();
    fetchQuickReplies();
    fetchElevenFitAnalytics(false);
    const interval = setInterval(() => {
      fetchChats(true);
      fetchExecutions(true);
      fetchElevenFitAnalytics(true);
      if (selectedChatRef.current?.phone && activeSubTabRef.current === 'inbox') {
        fetchMessages(selectedChatRef.current.phone, true);
      }
    }, 7000);

    // Auto-refresh when internet comes back
    const handleOnline = () => {
      fetchChats(false);
      fetchExecutions(false);
      fetchElevenFitAnalytics(false);
      if (selectedChatRef.current?.phone) fetchMessages(selectedChatRef.current.phone, false);
    };
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useEffect(() => {
    if (selectedChat?.phone) {
      fetchMessages(selectedChat.phone, false);
    }
  }, [selectedChat?.phone]);

  useLayoutEffect(() => {
    if (shouldScrollRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'instant', block: 'end' });
      shouldScrollRef.current = false;
    }
  }, [messages, selectedChat?.phone]);

  // Reset scroll flag when switching to a new chat
  useEffect(() => {
    shouldScrollRef.current = true;
  }, [selectedChat?.phone]);

  // Auto-select a chat when navigating from Phone Order Lookup
  useEffect(() => {
    if (!preSelectPhone || preSelectDoneRef.current || chats.length === 0) return;
    const digits = preSelectPhone.replace(/\D/g, '');
    const match = chats.find(c => {
      const cd = (c.phone || '').replace(/\D/g, '');
      return cd.includes(digits) || digits.includes(cd);
    });
    if (match) {
      preSelectDoneRef.current = true;
      setActiveSubTab('inbox');
      setSelectedChat(match);
    }
  }, [preSelectPhone, chats]);

  // --- 24 HOUR CLOSING TIME CALCULATION ---
  const get24HourStatus = (chat) => {
    if (!chat || !chat.created_at) return { isOpen: false, text: 'N/A' };
    const createTime = new Date(chat.created_at).getTime();
    const closeTime = createTime + 24 * 60 * 60 * 1000;
    const diffMs = closeTime - Date.now();
    const closeDateStr = new Date(closeTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (diffMs > 0) {
      const h = Math.floor(diffMs / (1000 * 60 * 60));
      const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return {
        isOpen: true,
        text: `🟢 24-Hour Free-form Window OPEN — Closes in ${h}h ${m}m (at ${closeDateStr})`
      };
    } else {
      const hoursAgo = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
      return {
        isOpen: false,
        text: `🔒 24-Hour Window CLOSED (${hoursAgo}h ago at ${closeDateStr}) — Use WhatsApp Template below`
      };
    }
  };

  // --- HANDLERS ---
  const handleToggleAIPause = async (chat) => {
    const newPausedState = !chat.ai_paused;
    togglingAIRef.current.add(chat.phone);
    
    // Optimistic update immediately so UI responds instantly
    setChats(prev => prev.map(c => c.phone === chat.phone ? { ...c, ai_paused: newPausedState } : c));
    if (selectedChat?.phone === chat.phone) {
      setSelectedChat(prev => ({ ...prev, ai_paused: newPausedState }));
    }
    
    try {
      await fetch('/api/whatsapp-inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_ai',
          phone: chat.phone,
          ai_paused: newPausedState
        })
      });
      // Allow time for DB/cache to settle before trusting server data again
      setTimeout(() => {
        togglingAIRef.current.delete(chat.phone);
      }, 3000);
      fetchChats(true);
    } catch (err) {
      console.error('Failed to toggle AI state:', err);
      togglingAIRef.current.delete(chat.phone);
      // Revert optimistic update on network error
      setChats(prev => prev.map(c => c.phone === chat.phone ? { ...c, ai_paused: chat.ai_paused } : c));
      if (selectedChat?.phone === chat.phone) {
        setSelectedChat(prev => ({ ...prev, ai_paused: chat.ai_paused }));
      }
    }
  };

  const handleSetChatStatus = async (chat, newStatus) => {
    setChats(prev => prev.map(c => c.phone === chat.phone ? { ...c, chat_status: newStatus } : c));
    if (selectedChat?.phone === chat.phone) {
      setSelectedChat(prev => ({ ...prev, chat_status: newStatus }));
    }
    try {
      await fetch('/api/whatsapp-inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_status',
          phone: chat.phone,
          chat_status: newStatus
        })
      });
      fetchChats(true);
    } catch (err) {
      console.error('Failed to update chat status:', err);
    }
  };

  const handleSendManualReply = async (e) => {
    e.preventDefault();
    if (!selectedChat?.phone || sendingReply) return;

    // A. Direct Media Upload via Meta API (if photo or voice note was captured)
    if (mediaPreviewBase64) {
      setSendingReply(true);
      // Optimistic bubble for media
      const optimisticMedia = {
        id: `_opt_${Date.now()}`,
        phone: selectedChat.phone,
        role: 'assistant',
        content: mediaPreviewType === 'image' ? '📷 Photo' : '🎙️ Voice Note',
        created_at: new Date().toISOString(),
        _sending: true
      };
      setMessages(prev => [...prev, optimisticMedia]);
      shouldScrollRef.current = true;
      try {
        const res = await fetch('/api/whatsapp-inbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upload_media',
            phone: selectedChat.phone,
            base64: mediaPreviewBase64,
            media_type: mediaPreviewType,
            caption: replyText
          })
        });
        if (res.ok) {
          setMediaPreviewBase64(null);
          setMediaPreviewType(null);
          setReplyText('');
          shouldScrollRef.current = true;
          await fetchMessages(selectedChat.phone, false);
        } else {
          // Remove optimistic bubble on error
          setMessages(prev => prev.filter(m => m.id !== optimisticMedia.id));
          const errData = await res.json();
          alert(`Error uploading media: ${errData.error || 'Failed'}`);
        }
      } catch (err) {
        setMessages(prev => prev.filter(m => m.id !== optimisticMedia.id));
        alert('Network error uploading photo/audio');
      } finally {
        setSendingReply(false);
      }
      return;
    }

    // B. Standard Text / URL / Template Send
    if (replyType === 'text' && !replyText.trim()) return;
    if ((replyType === 'image' || replyType === 'audio') && !mediaUrl.trim()) return;

    const actualReplyType = isPrivateNote ? 'internal_note' : replyType;

    // Optimistic bubble — appears instantly in chat
    const optimisticText = replyType === 'template' ? '📋 Template message sent' : (replyText || mediaUrl);
    const optimisticMsg = {
      id: `_opt_${Date.now()}`,
      phone: selectedChat.phone,
      role: isPrivateNote ? 'internal_note' : 'assistant',
      content: optimisticText,
      created_at: new Date().toISOString(),
      _sending: true
    };
    setMessages(prev => [...prev, optimisticMsg]);
    shouldScrollRef.current = true;

    setSendingReply(true);
    try {
      const res = await fetch('/api/whatsapp-inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_message',
          phone: selectedChat.phone,
          type: actualReplyType,
          text: replyText,
          media_url: mediaUrl,
          template_name: selectedTemplate,
          template_params: replyType === 'template' ? getAutoParams(selectedTemplate, selectedChat,
            (elevenFitData?.orders || []).filter(o => {
              const cp = String(o.customer?.phone || o.shipping_address?.phone || '').replace(/\D/g,'').slice(-10);
              const sp = String(selectedChat?.phone || '').replace(/\D/g,'').slice(-10);
              return cp === sp;
            }).sort((a,b) => new Date(b.created_at) - new Date(a.created_at)),
            elevenFitData?.abandonedCarts?.filter(c => String(c.phone || c.customer_phone || '').replace(/\D/g,'').slice(-10) === String(selectedChat?.phone || '').replace(/\D/g,'').slice(-10)) || []
          ) : undefined
        })
      });
      if (res.ok) {
        setReplyText('');
        setMediaUrl('');
        shouldScrollRef.current = true;
        await fetchMessages(selectedChat.phone, false);
      } else {
        // Remove optimistic bubble on error
        setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
        const errData = await res.json();
        alert(`Error: ${errData.error || 'Failed to send message'}`);
      }
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      console.error('Failed to send reply:', err);
      alert('Network error sending reply');
    } finally {
      setSendingReply(false);
    }
  };

  const openChatsCount = chats.filter(c => (c.chat_status || 'open') === 'open').length;
  const closedChatsCount = chats.filter(c => c.chat_status === 'closed').length;

  const transitCount = chats.filter(c => c.order_status === 'in_transit').length;
  const outForDeliveryCount = chats.filter(c => c.order_status === 'out_for_delivery').length;
  const deliveredCount = chats.filter(c => c.order_status === 'delivered').length;
  const cancelledCount = chats.filter(c => c.order_status === 'cancelled').length;

  const filteredChats = chats.filter(c => {
    const matchesSearch =
      !inboxSearch ||
      c.phone?.toLowerCase().includes(inboxSearch.toLowerCase()) ||
      c.last_message?.toLowerCase().includes(inboxSearch.toLowerCase()) ||
      c.customer_name?.toLowerCase().includes(inboxSearch.toLowerCase()) ||
      (Array.isArray(c.tags) && c.tags.some(t => t.toLowerCase().includes(inboxSearch.toLowerCase())));
    const matchesStatus =
      chatStatusFilter === 'all' ||
      (chatStatusFilter === 'open' && (c.chat_status || 'open') === 'open') ||
      (chatStatusFilter === 'closed' && c.chat_status === 'closed');
    const matchesOrder =
      orderStatusFilter === 'all' ||
      c.order_status === orderStatusFilter;
    return matchesSearch && matchesStatus && matchesOrder;
  });

  const formatPhone = (p) => {
    if (!p) return 'N/A';
    return p.startsWith('+') ? p : `+${p}`;
  };

  const KNOWN_TEMPLATES = {
    'abandoned_cart_v4':           { label: '🛒 Abandoned Cart Recovery',         params: ['Customer Name', 'Cart Value (₹)', 'Product Handle'] },
    'combo_offer_reengage_v2':     { label: '🛍️ Special Combo Offer',             params: ['Customer Name'] },
    'order_status_check_v1':       { label: 'ℹ️ Order Status Check',              params: ['Name', 'Order #', 'Status', 'Details/Tracking'] },
    'order_confirm_prepaid_v1':    { label: '✅ Order Confirmed (Prepaid)',        params: ['Name', 'Order #', 'Items', 'Amount Paid (₹)', 'Address'] },
    'order_confirmation_cod_v1':   { label: '💵 Order Confirmed (COD)',           params: ['Name', 'Order #', 'Items', 'Amount Payable (₹)', 'Address'] },
    'order_confirm_partial_v1':    { label: '🪙 Order Confirmed (Advance/Partial)',params: ['Name', 'Order #', 'Items', 'Advance Paid (₹)', 'Balance Due (₹)', 'Address'] },
    'order_shipped_v1':            { label: '🚚 Order Shipped',                   params: ['Name', 'Order #', 'Courier', 'Tracking #'] },
    'out_for_delivery_prepaid_v1': { label: '🏠 Out For Delivery (Prepaid)',      params: ['Name', 'Order #'] },
    'out_for_delivery_cod_v1':     { label: '🏠 Out For Delivery (COD)',          params: ['Name', 'Order #', 'Amount to Collect (₹)'] },
    'order_delivered_confirm_v1':  { label: '🎉 Order Delivered',                 params: ['Name', 'Order #'] },
  };

  const templatesList = metaTemplates.map(t => ({
    id: t.name,
    label: KNOWN_TEMPLATES[t.name]?.label || `🔹 ${t.name.replace(/_/g, ' ')}`,
    category: t.category,
    params: KNOWN_TEMPLATES[t.name]?.params || (
      t.components.find(c => c.type === 'BODY')?.example?.body_text?.[0] || []
    ).map((_, i) => `Param ${i + 1}`)
  }));

  // Smart template param values - auto-filled from customer order/cart context
  const getAutoParams = (templateId, chat, orders, carts) => {
    const rawName = chat?.customer_name || orders?.[0]?.shipping_address?.first_name || carts?.[0]?.cart_details?.customer?.first_name || carts?.[0]?.cart_details?.shipping_address?.first_name || 'Customer';
    const name = rawName.split(' ')[0];
    const latestOrder = orders?.[0];
    const latestCart = carts?.[0];
    const orderName = latestOrder?.name || '';
    const totalPrice = latestOrder?.total_price || '0';
    const address = latestOrder?.shipping_address
      ? `${latestOrder.shipping_address.address1 || ''}, ${latestOrder.shipping_address.city || ''}`.trim().replace(/^,|,$/, '')
      : '';
    const itemsText = (latestOrder?.line_items || []).slice(0,2).map(i => {
      const v = i.variant_title && i.variant_title !== 'Default Title' ? ` (${i.variant_title})` : '';
      return `${i.title}${v} x${i.quantity}`;
    }).join(', ');
    const fulfillment = latestOrder?.fulfillments?.[0];
    const cartVal = latestCart?.cart_details?.total_price || latestCart?.amount || latestCart?.total_price || 0;
    const cartAmount = latestCart ? (parseFloat(cartVal) / (String(cartVal).includes('.') ? 1 : 100)).toFixed(2) : '0';

    switch (templateId) {
      case 'abandoned_cart_v4':           return [name, cartAmount, 'all'];
      case 'combo_offer_reengage_v2':     return [name];
      case 'order_status_check_v1': {
        let status = 'Processing';
        if (latestOrder?.cancelled_at) status = 'Cancelled';
        else if (latestOrder?.fulfillment_status === 'fulfilled') status = 'Fulfilled / Dispatched';
        const details = fulfillment?.tracking_url ? `Track here: ${fulfillment.tracking_url}` : 'Your order is being prepared.';
        return [name, orderName, status, details];
      }
      case 'order_confirm_prepaid_v1':    return [name, orderName, itemsText, totalPrice, address];
      case 'order_confirmation_cod_v1':   return [name, orderName, itemsText, totalPrice, address];
      case 'order_confirm_partial_v1':    return [name, orderName, itemsText, (parseFloat(totalPrice)*0.1).toFixed(2), (parseFloat(totalPrice)*0.9).toFixed(2), address];
      case 'order_shipped_v1':            return [name, orderName, fulfillment?.tracking_company || 'Courier', fulfillment?.tracking_number || ''];
      case 'out_for_delivery_prepaid_v1': return [name, orderName];
      case 'out_for_delivery_cod_v1':     return [name, orderName, (totalPrice - (latestOrder?.total_discounts||0)).toFixed(2)];
      case 'order_delivered_confirm_v1':  return [name, orderName];
      default: {
        const bodyComp = (metaTemplates.find(t => t.name === templateId)?.components || []).find(c => c.type === 'BODY');
        const numParams = bodyComp?.example?.body_text?.[0]?.length || 0;
        return Array(numParams).fill(name);
      }
    }
  };

  const renderTextWithLinks = (text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s,'")<>]+|www\.[^\s,'")<>]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, idx) => {
      if (!part) return null;
      if (part.match(/^(https?:\/\/|www\.)/i)) {
        const href = part.startsWith('www.') ? `https://${part}` : part;
        return (
          <a
            key={idx}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline font-semibold break-all cursor-pointer transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const renderMessageContent = (content) => {
    if (!content) return null;

    // Check for Audio ID
    const audioMatch = content.match(/\[AUDIO_ID:(\d+)\]/) || content.match(/\[VOICE NOTE SENT\]\s*\(id:\s*(\d+)\)/i);
    if (audioMatch) {
      const id = audioMatch[1] || audioMatch[2];
      const textWithoutId = content.replace(/\[AUDIO_ID:\d+\]|\[VOICE NOTE SENT\]\s*\(id:\s*\d+\)/gi, '').trim();
      return (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-emerald-300">🎙️ WhatsApp Voice Note / Audio:</p>
          <audio controls className="w-60 h-9 rounded-lg">
            <source src={`/api/whatsapp-inbox?action=media&id=${id}`} type="audio/ogg" />
            <source src={`/api/whatsapp-inbox?action=media&id=${id}`} type="audio/mpeg" />
            Your browser does not support audio playback.
          </audio>
          {textWithoutId && <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{renderTextWithLinks(textWithoutId)}</p>}
        </div>
      );
    }

    // Check for Image ID
    const imageMatch = content.match(/\[IMAGE_ID:(\d+)\]/) || content.match(/\[PHOTO SENT\]\s*\(id:\s*(\d+)\)/i);
    if (imageMatch) {
      const id = imageMatch[1] || imageMatch[2];
      const textWithoutId = content.replace(/\[IMAGE_ID:\d+\]|\[PHOTO SENT\]\s*\(id:\s*\d+\)/gi, '').trim();
      return (
        <div className="space-y-2">
          <a href={`/api/whatsapp-inbox?action=media&id=${id}`} target="_blank" rel="noopener noreferrer">
            <img
              src={`/api/whatsapp-inbox?action=media&id=${id}`}
              alt="Customer WhatsApp Attachment"
              className="max-w-[240px] max-h-[240px] rounded-lg object-cover border border-slate-700 hover:opacity-90 transition-opacity"
            />
          </a>
          {textWithoutId && <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{renderTextWithLinks(textWithoutId)}</p>}
        </div>
      );
    }

    // Check for Video ID
    const videoMatch = content.match(/\[VIDEO_ID:(\d+)\]/) || content.match(/\[VIDEO SENT\]\s*\(id:\s*(\d+)\)/i);
    if (videoMatch) {
      const id = videoMatch[1] || videoMatch[2];
      const textWithoutId = content.replace(/\[VIDEO_ID:\d+\]|\[VIDEO SENT\]\s*\(id:\s*\d+\)/gi, '').trim();
      return (
        <div className="space-y-2">
          <video controls className="max-w-[240px] rounded-lg border border-slate-700">
            <source src={`/api/whatsapp-inbox?action=media&id=${id}`} type="video/mp4" />
          </video>
          {textWithoutId && <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{renderTextWithLinks(textWithoutId)}</p>}
        </div>
      );
    }

    return <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{renderTextWithLinks(content)}</p>;
  };

  const status24h = get24HourStatus(selectedChat);

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full h-full bg-[#0B0F19]">
      {/* COMPACT TOP SUB-TAB & ALERTS NAV BAR */}
      <div className="flex items-center justify-between gap-3 bg-[#0F172A] px-3.5 py-2.5 border-b border-slate-800 shrink-0 shadow-sm z-10 w-full overflow-hidden">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto flex-nowrap flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <button
            onClick={() => setActiveSubTab('inbox')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'inbox'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Inbox</span>
            <span>({chats.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('logs')}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeSubTab === 'logs'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            title="AI Charts & Logs"
          >
            <BarChart3 className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">AI Charts & Logs</span>
          </button>
          <button
            onClick={() => setActiveSubTab('instructions')}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeSubTab === 'instructions'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            title="AI Instructions & Prompts"
          >
            <Bot className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">AI Instructions & Prompts</span>
          </button>
          <button
            onClick={() => setActiveSubTab('11fit_abandoned')}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeSubTab === '11fit_abandoned'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            title="11FIT Abandoned Carts (Mobile Only) & OTP"
          >
            <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">11FIT Abandoned Carts & OTP</span>
            {elevenFitData?.abandonedCarts?.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 rounded-full font-extrabold animate-pulse">
                {elevenFitData.abandonedCarts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('meta_templates')}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeSubTab === 'meta_templates'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            title="Meta WhatsApp Message Templates"
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Meta Templates</span>
          </button>
          <button
            onClick={() => setActiveSubTab('workflows')}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeSubTab === 'workflows'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            title="Automated Workflows"
          >
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Automated Workflows</span>
          </button>
          <button
            onClick={() => setActiveSubTab('flow_builder')}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeSubTab === 'flow_builder'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            title="Flow Builder"
          >
            <Zap className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Flow Builder</span>
          </button>
          <button
            onClick={() => setActiveSubTab('contacts')}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeSubTab === 'contacts'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            title="Audience & CRM"
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Audience & CRM</span>
          </button>
          <button
            onClick={() => setActiveSubTab('broadcasts')}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeSubTab === 'broadcasts'
                ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            title="Campaigns"
          >
            <Megaphone className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Campaigns</span>
          </button>
        </div>

        <button
          onClick={enableNotifications}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
            notifEnabled
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
          title="Enable Push Notifications"
        >
          {notifEnabled ? <BellRing className="w-3.5 h-3.5 text-emerald-400 animate-bounce" /> : <Bell className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{notifEnabled ? 'Alerts On' : 'Enable Alerts'}</span>
        </button>
      </div>

      {/* 11FIT NEW ABANDONED CART REAL-TIME NOTIFICATION BANNER */}
      {newAbCartNotification && (
        <div className="bg-gradient-to-r from-amber-600 via-red-600 to-emerald-600 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-xl z-50 animate-pulse border-b border-amber-400/40">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 shrink-0 animate-bounce" />
            <span className="text-xs sm:text-sm font-extrabold tracking-wide">
              NEW ABANDONED CART ALERT: Customer {newAbCartNotification.phone} just added order worth ₹{newAbCartNotification.price}!
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setActiveSubTab('11fit_abandoned');
                setAbCartSubView('carts');
                setNewAbCartNotification(null);
              }}
              className="bg-white text-slate-900 px-3 py-1 rounded-lg text-xs font-black hover:bg-slate-100 transition-colors shadow-md"
            >
              View Cart
            </button>
            <button
              onClick={() => setNewAbCartNotification(null)}
              className="text-white/80 hover:text-white font-extrabold px-1.5"
            >
              ✕
            </button>
          </div>
        </div>
      )}
{/* ========================================================= */}
      {/* TAB 1: LIVE CHAT INBOX & MANUAL TAKEOVER                  */}
      {/* ========================================================= */}
      {activeSubTab === 'inbox' && (
        <div className="relative flex-1 min-h-0 lg:grid lg:grid-cols-12 lg:gap-6 lg:p-6">
          {/* LEFT PANE: CHAT LIST - full height on mobile, grid col on desktop */}
          <div className={`lg:col-span-3 bg-slate-900/90 lg:rounded-2xl border-r lg:border border-slate-800 flex flex-col overflow-hidden shadow-xl h-full ${selectedChat ? 'hidden lg:flex' : 'flex'}`}>
            {/* SEARCH BOX & COLLAPSIBLE FILTER BUTTON */}
            <div className="p-2.5 border-b border-slate-800 bg-slate-950/40 space-y-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search phone, name or message..."
                    value={inboxSearch}
                    onChange={(e) => setInboxSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowChatFilters(p => !p)}
                  className={`px-2.5 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    showChatFilters || chatStatusFilter !== 'open' || orderStatusFilter !== 'all'
                      ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800'
                  }`}
                  title="Toggle Filters"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Filters</span>
                  {(chatStatusFilter !== 'open' || orderStatusFilter !== 'all') && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => fetchChats(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 border border-slate-800 transition-colors shrink-0"
                  title="Refresh chats"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingChats ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* COLLAPSIBLE FILTERS MENU */}
              {showChatFilters && (
                <div className="pt-2 space-y-2 border-t border-slate-800/80 animate-[fadeIn_0.15s_ease]">
                  {/* Chat Status Filter Pills */}
                  <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setChatStatusFilter('open')}
                      className={`py-1 rounded-md transition-all flex items-center justify-center gap-1 ${
                        chatStatusFilter === 'open'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>Open ({openChatsCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setChatStatusFilter('closed')}
                      className={`py-1 rounded-md transition-all flex items-center justify-center gap-1 ${
                        chatStatusFilter === 'closed'
                          ? 'bg-slate-700 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>Closed ({closedChatsCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setChatStatusFilter('all')}
                      className={`py-1 rounded-md transition-all flex items-center justify-center gap-1 ${
                        chatStatusFilter === 'all'
                          ? 'bg-slate-800 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>All ({chats.length})</span>
                    </button>
                  </div>

                  {/* Row 2: Order Shipment Status Filters */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setOrderStatusFilter('all')}
                      className={`px-2 py-1 rounded-md transition-all whitespace-nowrap ${
                        orderStatusFilter === 'all'
                          ? 'bg-slate-700 text-white shadow-sm'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      🛍️ All
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderStatusFilter('in_transit')}
                      className={`px-2 py-1 rounded-md transition-all whitespace-nowrap ${
                        orderStatusFilter === 'in_transit'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-900 text-blue-400 hover:text-blue-300 border border-slate-800'
                      }`}
                    >
                      🚚 Transit ({transitCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderStatusFilter('out_for_delivery')}
                      className={`px-2 py-1 rounded-md transition-all whitespace-nowrap ${
                        orderStatusFilter === 'out_for_delivery'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-slate-900 text-amber-400 hover:text-amber-300 border border-slate-800'
                      }`}
                    >
                      🛵 Out ({outForDeliveryCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderStatusFilter('delivered')}
                      className={`px-2 py-1 rounded-md transition-all whitespace-nowrap ${
                        orderStatusFilter === 'delivered'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-900 text-emerald-400 hover:text-emerald-300 border border-slate-800'
                      }`}
                    >
                      📦 Delivered ({deliveredCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderStatusFilter('cancelled')}
                      className={`px-2 py-1 rounded-md transition-all whitespace-nowrap ${
                        orderStatusFilter === 'cancelled'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-slate-900 text-rose-400 hover:text-rose-300 border border-slate-800'
                      }`}
                    >
                      ❌ Cancelled ({cancelledCount})
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* CHAT LIST */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
              {filteredChats.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No WhatsApp conversations found
                </div>
              ) : (
                filteredChats.map((chat) => {
                  const isSelected = selectedChat?.phone === chat.phone;
                  return (
                    <div
                      key={chat.phone}
                      onClick={() => setSelectedChat(chat)}
                      className={`p-4 cursor-pointer transition-all flex items-start justify-between gap-3 ${
                        isSelected
                          ? 'bg-emerald-500/10 border-l-4 border-emerald-500'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
                            <div className="flex flex-col text-left min-w-0 truncate">
                              <span className="font-bold text-sm text-white truncate">
                                {chat.customer_name || formatPhone(chat.phone)}
                              </span>
                              {chat.customer_name && (
                                <span className="text-[10px] text-slate-400 font-normal truncate">
                                  {formatPhone(chat.phone)}
                                </span>
                              )}
                              {chat.tags && chat.tags.length > 0 && (
                                <div className="flex gap-1 mt-0.5 flex-wrap">
                                  {chat.tags.map(t => (
                                    <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 whitespace-nowrap font-bold">
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            {chat.has_order && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleOpenCustomerOrders(chat.phone); }}
                                className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                                title="Click to view Customer Orders"
                              >
                                <ShoppingBag className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span className="hidden sm:inline">Orders</span>
                                {chat.order_count ? <span>({chat.order_count})</span> : null}
                              </button>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 whitespace-nowrap">
                            {new Date(chat.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate mb-2">
                          {chat.last_role === 'assistant' ? '🤖: ' : '👤: '}
                          {chat.last_message}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {chat.is_within_24h ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="24-hour window open">
                              <Unlock className="w-3 h-3 shrink-0" />
                              <span className="hidden sm:inline">24h Open</span>
                              <span className="sm:hidden">24h</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20" title={`24-hour customer service window has expired (${chat.hours_elapsed}h elapsed)`}>
                              <Lock className="w-3 h-3 shrink-0" />
                              <span className="hidden sm:inline">Window Closed ({chat.hours_elapsed}h)</span>
                              <span className="sm:hidden">{chat.hours_elapsed}h</span>
                            </span>
                          )}
                          {chat.chat_status === 'closed' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                              ✓ <span className="hidden sm:inline">Solved</span>
                            </span>
                          )}
                          {chat.chat_status === 'urgent' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-[0_0_8px_rgba(225,29,72,0.3)] animate-pulse">
                              🚨 <span className="hidden sm:inline">Urgent</span>
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleAI(chat.phone, !chat.ai_paused);
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all cursor-pointer ${
                              chat.ai_paused
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 hover:bg-rose-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                            }`}
                            title={chat.ai_paused ? "AI auto-reply is currently PAUSED. Click to enable AI." : "AI is automatically replying. Click to pause AI."}
                          >
                            {chat.ai_paused ? (
                              <>
                                <Pause className="w-3 h-3 text-rose-400 shrink-0" />
                                <span className="hidden sm:inline">AI Paused</span>
                              </>
                            ) : (
                              <>
                                <Bot className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span className="hidden sm:inline">AI Active</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOutboundCall({ phone: chat.phone, customerName: chat.customer_name || '' });
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-700 transition-colors ml-auto"
                            title={`WhatsApp Call ${formatPhone(chat.phone)}`}
                          >
                            <Phone className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT PANE: ACTIVE CHAT THREAD */}
          <div className={`lg:col-span-6 bg-slate-900/90 lg:rounded-2xl border-l lg:border border-slate-800 flex flex-col overflow-hidden shadow-xl h-full ${!selectedChat ? 'hidden lg:flex' : 'flex'}`}>
            {selectedChat ? (
              <>
                {/* ACTIVE CHAT HEADER (COMPACT ON MOBILE: ICONS ONLY TO SAVE SPACE) */}
                <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-2 shrink-0">
                  {/* LEFT: BACK BUTTON + CUSTOMER NAME */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setSelectedChat(null)}
                      className="lg:hidden p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors shrink-0"
                      title="Back to Customer List"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="flex flex-col min-w-0">
                      <h4
                        onClick={() => handleOpenCustomerOrders(selectedChat.phone)}
                        className="font-bold text-white text-sm sm:text-base truncate hover:text-emerald-400 transition-colors cursor-pointer"
                        title="Click customer name to view Shopify Orders"
                      >
                        {selectedChat.customer_name ? `${selectedChat.customer_name} (${formatPhone(selectedChat.phone)})` : formatPhone(selectedChat.phone)}
                      </h4>
                      {selectedChat.tags && selectedChat.tags.length > 0 && (
                        <div className="flex gap-1 mt-0.5">
                          {selectedChat.tags.map(t => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 whitespace-nowrap font-bold">
                              🏷️ {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT: ICON BUTTONS ON MOBILE, ICON+TEXT ON DESKTOP */}
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 relative">
                    {/* 1. Orders Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenCustomerOrders(selectedChat.phone)}
                      className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white transition-all shrink-0 shadow-sm"
                      title="View Customer Shopify Orders"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="hidden sm:inline">Orders</span>
                    </button>

                    {/* 2. Call Customer Button */}
                    <button
                      onClick={() => setOutboundCall({ phone: selectedChat.phone, customerName: selectedChat.customer_name || '' })}
                      className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white transition-all shrink-0"
                      title="WhatsApp Call Customer (via API)"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </button>

                    {/* 3. Clickable 24H Lock pill with popup */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowLockInfo(v => !v)}
                        className={`inline-flex items-center gap-1 px-2 py-1.5 sm:py-1 rounded-lg text-xs font-bold border cursor-pointer transition-all shrink-0 ${
                          status24h.isOpen
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900'
                            : 'bg-rose-950/80 text-rose-300 border-rose-500/40 hover:bg-rose-900'
                        }`}
                        title="24H Window Status"
                      >
                        {status24h.isOpen ? (
                          <Unlock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                        <span className="hidden sm:inline">{status24h.isOpen ? '24H Open' : '24H Closed'}</span>
                      </button>

                      {/* Time-remaining popup */}
                      {showLockInfo && (
                        <div
                          className="absolute top-8 right-0 z-50 w-64 bg-[#1a2733] border border-slate-700 rounded-xl shadow-2xl p-3 text-xs"
                          onClick={e => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-white text-[11px] uppercase tracking-wider">24-Hour Window</span>
                            <button onClick={() => setShowLockInfo(false)} className="text-slate-400 hover:text-white"><X className="w-3.5 h-3.5" /></button>
                          </div>
                          <div className={`flex items-start gap-2 p-2 rounded-lg ${status24h.isOpen ? 'bg-emerald-950/60 border border-emerald-500/20' : 'bg-rose-950/60 border border-rose-500/20'}`}>
                            {status24h.isOpen ? (
                              <Unlock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            ) : (
                              <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            )}
                            <p className={`leading-relaxed ${status24h.isOpen ? 'text-emerald-200' : 'text-rose-200'}`}>
                              {status24h.text}
                            </p>
                          </div>
                          {!status24h.isOpen && (
                            <p className="mt-2 text-slate-400 leading-relaxed">
                              Window re-opens automatically when the customer sends a new message.
                            </p>
                          )}
                        </div>
                      )}
                    </div>{/* end relative wrapper */}

                    {/* 4. Mark Solved / Close Chat OR Reopen Chat toggle */}
                    {selectedChat.chat_status === 'closed' ? (
                      <button
                        type="button"
                        onClick={() => handleSetChatStatus(selectedChat, 'open')}
                        className="inline-flex items-center gap-1 px-2 py-1.5 sm:py-1 rounded-lg text-xs font-bold border bg-emerald-950/80 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900 transition-all cursor-pointer shadow-md shrink-0"
                        title="Re-open this chat into your active inbox"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="hidden sm:inline">Reopen</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetChatStatus(selectedChat, 'closed')}
                        className="inline-flex items-center gap-1 px-2 py-1.5 sm:py-1 rounded-lg text-xs font-bold border bg-amber-950/80 text-amber-300 border-amber-500/40 hover:bg-amber-900 transition-all cursor-pointer shadow-md shrink-0"
                        title="Mark customer query solved & close chat"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="hidden sm:inline">Close</span>
                      </button>
                    )}

                    {/* 5. AI auto-reply toggle */}
                    <button
                      onClick={() => handleToggleAIPause(selectedChat)}
                      className={`inline-flex items-center gap-1 px-2 py-1.5 sm:py-1 rounded-lg font-bold text-xs transition-all shadow-md shrink-0 ${
                        selectedChat.ai_paused
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500 hover:text-white'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white'
                      }`}
                      title={selectedChat.ai_paused ? "AI is Paused (Click to Resume)" : "AI is Active (Click to Pause)"}
                    >
                      {selectedChat.ai_paused ? (
                        <>
                          <Pause className="w-3.5 h-3.5 shrink-0" />
                          <span className="hidden sm:inline">AI PAUSED</span>
                        </>
                      ) : (
                        <>
                          <Bot className="w-3.5 h-3.5 shrink-0" />
                          <span className="hidden sm:inline">AI ACTIVE</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* WHATSAPP-STYLE MESSAGE BUBBLES AREA (SMOOTH BOTTOM ANCHOR) */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#0b141a]">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                      <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                      Loading WhatsApp history...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-slate-500 text-xs py-12">
                      No message history found
                    </div>
                  ) : (
                    messages.map((msg, i) => {
                      const isAI = msg.role === 'assistant';
                      const isInternalNote = msg.role === 'internal_note';
                      const isOutgoing = isAI || isInternalNote;
                      
                      // WhatsApp-style tick status for AI/manual messages
                      const getMsgStatus = () => {
                        if (msg._sending) return 'sending'; // clock icon, grey
                        if (isInternalNote) return 'sent'; // notes don't get read receipts
                        // Did any user message come AFTER this one?
                        const userRepliedAfter = messages.slice(i + 1).some(m => m.role === 'user');
                        if (userRepliedAfter) return 'read';        // 2 blue ticks
                        if (i === messages.length - 1) return 'sent'; // 1 grey tick (newest)
                        return 'delivered';                           // 2 grey ticks
                      };
                      const msgStatus = isOutgoing ? getMsgStatus() : null;
                      return (
                        <div
                          key={msg.id || i}
                          className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[92%] sm:max-w-[78%] rounded-xl px-3.5 py-2.5 shadow-md relative ${
                              isAI
                                ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none'
                                : isInternalNote
                                ? 'bg-amber-900/60 border border-amber-500/50 text-amber-200 rounded-tr-none'
                                : 'bg-[#202c33] text-[#e9edef] rounded-tl-none border border-[#2a3942]'
                            } ${msg._sending ? 'opacity-70' : ''}`}
                          >
                            <div className="flex items-center justify-between gap-4 mb-1">
                              <span className={`text-[10px] font-bold opacity-75 uppercase ${isInternalNote ? 'text-amber-400' : 'text-emerald-300'}`}>
                                {isInternalNote ? '🔒 Private Note (Invisible to Customer)' : isAI ? '🤖 11FIT Assistant / Manual' : `👤 ${formatPhone(msg.phone)}`}
                              </span>
                            </div>
                            <div className="my-0.5">
                              {renderMessageContent(msg.content)}
                            </div>
                            <div className="flex items-center justify-end gap-1 mt-1 opacity-70">
                              <span className="text-[10px]">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {/* WhatsApp-style ticks */}
                              {msgStatus === 'sending' && (
                                <Clock className="w-3 h-3 text-slate-400 animate-pulse" title="Sending..." />
                              )}
                              {msgStatus === 'sent' && (
                                <Check className="w-3.5 h-3.5 text-slate-400" title="Sent" />
                              )}
                              {msgStatus === 'delivered' && (
                                <CheckCheck className="w-3.5 h-3.5 text-slate-400" title="Delivered" />
                              )}
                              {msgStatus === 'read' && (
                                <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" title="Read" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* MEDIA CAPTURE PREVIEW BANNER (IF PHOTO OR AUDIO WAS CAPTURED) */}
                {mediaPreviewBase64 && (
                  <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {mediaPreviewType === 'image' ? (
                        <img src={mediaPreviewBase64} alt="Captured" className="w-12 h-12 rounded-lg object-cover border border-emerald-500" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">
                          🎙️ MP3
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-emerald-400">
                          {mediaPreviewType === 'image' ? '📸 Photo Ready to Send' : '🎙️ Voice Note Ready to Send'}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Will upload directly to WhatsApp Meta Media API
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setMediaPreviewBase64(null); setMediaPreviewType(null); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* MANUAL REPLY SENDER BAR WITH DIRECT CAMERA & VOICE RECORDER */}
                <form onSubmit={handleSendManualReply} className="p-3 border-t border-slate-800 bg-[#202c33] space-y-2 shrink-0">
                  {/* MEDIA CONTROLS BAR (PHOTO & AUDIO RECORDER) */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => { setReplyType('text'); setMediaPreviewBase64(null); }}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          replyType === 'text' && !mediaPreviewBase64
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Text
                      </button>

                      {/* CAMERA OR PHOTO LIBRARY INPUT */}
                      <label className="cursor-pointer px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all">
                        <Camera className="w-3.5 h-3.5 text-emerald-400" />
                        Camera / Gallery
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handlePhotoSelect}
                          className="hidden"
                        />
                      </label>

                      {/* VOICE / MICROPHONE RECORDER BUTTON */}
                      {isRecording ? (
                        <button
                          type="button"
                          onClick={stopAudioRecord}
                          className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5 animate-pulse"
                        >
                          <StopCircle className="w-3.5 h-3.5" />
                          Stop Recording...
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startAudioRecord}
                          className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
                        >
                          <Mic className="w-3.5 h-3.5 text-emerald-400" />
                          Record Voice Note
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => { setReplyType('template'); setMediaPreviewBase64(null); }}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          replyType === 'template'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Template
                      </button>
                      
                      {/* PRIVATE NOTE TOGGLE */}
                      <div className="h-6 w-[1px] bg-slate-700 mx-1"></div>
                      <button
                        type="button"
                        onClick={() => setIsPrivateNote(prev => !prev)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md ${
                          isPrivateNote
                            ? 'bg-amber-600/30 text-amber-400 border border-amber-500/50'
                            : 'bg-slate-800 text-slate-400 hover:text-white border border-transparent'
                        }`}
                        title="Toggle Private Note Mode"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Private Note
                      </button>
                    </div>
                  </div>

                  {/* LOCKED WINDOW OVERLAY — when 24h window is closed */}
                  {!status24h.isOpen && !mediaPreviewBase64 && (
                    <div className="mx-4 mb-3 rounded-xl bg-rose-950/60 border border-rose-500/50 shadow-lg flex items-center gap-3 px-4 py-3">
                      <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
                        <Lock className="w-5 h-5 text-rose-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-rose-300 tracking-wide uppercase">24-Hour Window Closed</p>
                        <p className="text-[11px] text-rose-400/80 mt-0.5 leading-snug">Text & media replies are disabled by Meta. Wait for the customer to reply, or use a <span className="font-bold text-rose-300">Template</span> to re-engage.</p>
                      </div>
                    </div>
                  )}

                  {/* INPUT FIELDS BASED ON TYPE */}
                  {replyType === 'template' ? (
                    <div className="space-y-2">
                      {/* Template Selector */}
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedTemplate}
                          onChange={(e) => setSelectedTemplate(e.target.value)}
                          className="flex-1 bg-[#0b141a] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          {templatesList.map(t => (
                            <option key={t.id} value={t.id}>{t.label}</option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          disabled={sendingReply}
                          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 shrink-0"
                        >
                          {sendingReply
                            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            : <Send className="w-3.5 h-3.5" />}
                          Send
                        </button>
                      </div>
                      {/* Variable Preview — auto-filled from customer context */}
                      {(() => {
                        const tpl = templatesList.find(t => t.id === selectedTemplate);
                        
                        // Smartly extract the active chat's orders
                        const customerOrders = (elevenFitData?.orders || []).filter(o => {
                          const cp = String(o.customer?.phone || o.shipping_address?.phone || '').replace(/\D/g,'').slice(-10);
                          const sp = String(selectedChat?.phone || '').replace(/\D/g,'').slice(-10);
                          return cp === sp;
                        }).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

                        const customerCarts = (elevenFitData?.abandonedCarts || []).filter(c => {
                          const cp = String(c.phone || c.customer_phone || '').replace(/\D/g,'').slice(-10);
                          const sp = String(selectedChat?.phone || '').replace(/\D/g,'').slice(-10);
                          return cp === sp;
                        }) || [];
                        const params = tpl ? getAutoParams(selectedTemplate, selectedChat, customerOrders, customerCarts) : [];
                        if (!tpl || params.length === 0) return null;
                        return (
                          <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-2.5 space-y-1">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Auto-filled Variables</p>
                            {tpl.params.map((label, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-500 w-28 shrink-0">{`{{${i+1}}} ${label}:`}</span>
                                <span className={`text-[11px] font-medium truncate ${params[i] ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {params[i] || '— not found'}
                                </span>
                              </div>
                            ))}
                            {selectedTemplate === 'abandoned_cart_v4' && customerCarts.length > 1 && (
                              <p className="text-[10px] text-amber-400 mt-1">⚠️ {customerCarts.length} carts found — using most recent</p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {/* ZERO-COST SMART SUGGESTIONS / ON-DEMAND AI SUGGESTER */}
                      {!isPrivateNote && replyType === 'text' && status24h.isOpen && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                          <div className="flex items-center gap-1 px-2 py-1 bg-fuchsia-500/10 text-fuchsia-400 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 border border-fuchsia-500/20">
                            <Bot className="w-3 h-3" /> Co-Pilot
                          </div>
                          
                          {aiSuggestions.length > 0 ? (
                            <>
                              {aiSuggestions.map((sug, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setReplyText(sug)}
                                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> {sug.length > 30 ? sug.substring(0, 30) + '...' : sug}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => setAiSuggestions([])}
                                className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-full text-[10px] font-bold transition-colors shrink-0"
                              >
                                Clear
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={handleGenerateSuggestions}
                              disabled={isGeneratingSuggestions}
                              className="px-3 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                            >
                              {isGeneratingSuggestions ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                              {isGeneratingSuggestions ? 'Reading chat...' : '💡 Suggest Replies'}
                            </button>
                          )}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 relative w-full">
                        <input
                          type="text"
                          placeholder={
                            !status24h.isOpen && !isPrivateNote
                              ? '🔒 Locked — customer must message first to reopen'
                              : isPrivateNote
                              ? '🔒 Type a private internal note (invisible to customer)...'
                              : mediaPreviewType === 'image'
                              ? 'Photo caption (optional)...'
                              : mediaPreviewType === 'audio'
                              ? 'Ready to send audio message...'
                              : 'Type manual WhatsApp reply...'
                          }
                          value={replyText}
                          onChange={(e) => {
                            setReplyText(e.target.value);
                          }}
                          disabled={!status24h.isOpen && !mediaPreviewBase64 && !isPrivateNote}
                          className={`flex-1 bg-[#0b141a] border rounded-xl pl-4 pr-2 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors ${
                            !status24h.isOpen && !mediaPreviewBase64 && !isPrivateNote
                              ? 'border-rose-700/50 opacity-50 cursor-not-allowed'
                              : isPrivateNote
                              ? 'border-amber-500/50 focus:border-amber-400 bg-amber-950/20'
                              : 'border-slate-700 focus:border-emerald-500'
                          }`}
                        />
                        
                        {!isPrivateNote && replyType === 'text' && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={handleRewrite}
                              disabled={!replyText || isRewriting}
                              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white border border-indigo-500 rounded-lg px-2.5 py-2 text-xs font-bold transition-colors shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 h-full"
                              title="Rewrite professionally with AI"
                            >
                              {isRewriting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                              <span className="hidden xl:inline">Rewrite</span>
                            </button>
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  if (e.target.value === 'ADD_NEW') {
                                    setShowQuickRepliesModal(true);
                                    e.target.value = '';
                                  } else {
                                    setReplyText(e.target.value);
                                    e.target.value = ''; // Reset selector
                                  }
                                }
                              }}
                              className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-bold appearance-none cursor-pointer focus:outline-none focus:border-emerald-500 transition-colors w-[100px] sm:w-[120px] h-full"
                              title="Insert Quick Reply"
                            >
                              <option value="">⚡ Quick</option>
                              {cannedResponses.map((r, i) => (
                                <option key={i} value={r.text}>{r.label}</option>
                              ))}
                              <option value="ADD_NEW">+ Add New...</option>
                            </select>
                          </div>
                        )}
                        
                        <button
                          type="submit"
                          disabled={sendingReply || (!status24h.isOpen && !mediaPreviewBase64 && replyType === 'text' && !isPrivateNote)}
                          className={`px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shrink-0 disabled:opacity-50 transition-colors h-full ${
                            isPrivateNote ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                          }`}
                        >
                        {sendingReply
                          ? <RefreshCw className="w-4 h-4 animate-spin" />
                          : <Send className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  )}
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <MessageSquare className="w-12 h-12 mb-3 text-slate-700" />
                <h4 className="text-sm font-bold text-slate-400">No Chat Selected</h4>
                <p className="text-xs text-slate-600 max-w-sm mt-1">
                  Select a customer conversation from the list to view chat history, call directly, or take over manually.
                </p>
              </div>
            )}
          </div>

          {/* RIGHT PANE: PERSISTENT CUSTOMER PROFILE (Col 3) */}
          <div className={`lg:col-span-3 bg-slate-900/90 lg:rounded-2xl border-l lg:border border-slate-800 flex flex-col overflow-hidden shadow-xl h-full hidden lg:flex`}>
            {selectedChat ? (
              <div className="flex flex-col h-full bg-[#080e1a]">
                <div className="p-4 border-b border-slate-800/80 bg-[#111c30]">
                  <h3 className="font-extrabold text-white text-base">Customer Profile</h3>
                  <p className="text-xs font-mono text-emerald-400 mt-1">{formatPhone(selectedChat.phone)}</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Quick Tags Section */}
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
                    <h4 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5"><Tags className="w-3.5 h-3.5" /> AI Tags</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {(selectedChat.tags || []).length > 0 ? selectedChat.tags.map(t => (
                        <span key={t} className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-700 text-slate-300">{t}</span>
                      )) : <span className="text-xs text-slate-500 italic">No tags assigned</span>}
                    </div>
                  </div>
                  
                  {/* Notes / Context */}
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
                    <h4 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Contact Name</h4>
                    <p className="text-sm font-semibold text-white">{selectedChat.customer_name || 'Unknown'}</p>
                  </div>
                  
                  <button 
                    onClick={() => handleOpenCustomerOrders(selectedChat.phone)}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <ShoppingBag className="w-4 h-4" /> View Shopify Orders
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-6 text-center">
                <p className="text-xs text-slate-600">Select a chat to view profile</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: AI EXECUTIONS, CHARTS & TOKEN MONITOR               */}
      {/* ========================================================= */}
      {activeSubTab === 'logs' && (
        <div className="space-y-6">
          {/* CAPACITY & RATE LIMIT ALERT BANNER */}
          <div className="bg-gradient-to-r from-emerald-950/80 to-slate-900/80 border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  AI Capacity & Fallback Monitor
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Normal (0% Rate Limit Hits)
                  </span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Multi-model fallback chain active: <strong>Llama-3.3-70B</strong> → <strong>Llama-3.1-8B</strong> → <strong>Groq Compound</strong>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Avg latency: <strong>{stats.avg_duration || 342}ms</strong></span>
            </div>
          </div>

          {/* STATS CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs text-slate-400 block mb-1">Total Executions</span>
              <span className="text-2xl font-bold text-white">{stats.total_count || 0}</span>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs text-slate-400 block mb-1">Successful Replies</span>
              <span className="text-2xl font-bold text-emerald-400">{stats.success_count || 0}</span>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs text-slate-400 block mb-1">Errors / Fallbacks</span>
              <span className="text-2xl font-bold text-rose-400">{stats.error_count || 0}</span>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs text-slate-400 block mb-1">Ignored / Dedupe</span>
              <span className="text-2xl font-bold text-slate-400">{stats.ignored_count || 0}</span>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs text-slate-400 block mb-1">Avg Response Time</span>
              <span className="text-2xl font-bold text-blue-400">{stats.avg_duration || 0}ms</span>
            </div>
          </div>

          {/* EXECUTIONS TABLE */}
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                Live AI Execution Logs
              </h3>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search phone or reply..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  onClick={() => fetchExecutions(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                  title="Refresh logs"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50 text-[11px] uppercase font-bold text-slate-400">
                    <th className="p-3">Status</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Customer Message</th>
                    <th className="p-3">AI / Manual Reply</th>
                    <th className="p-3">Tools Called</th>
                    <th className="p-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                  {executions.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500">
                        No AI execution logs found
                      </td>
                    </tr>
                  ) : (
                    executions.map((ex, i) => (
                      <tr key={ex.id || i} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 font-semibold">
                          {ex.status === 'SUCCESS' && (
                            <span className="inline-flex items-center gap-1 text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" /> SUCCESS
                            </span>
                          )}
                          {ex.status === 'ERROR' && (
                            <span className="inline-flex items-center gap-1 text-rose-400">
                              <XCircle className="w-3.5 h-3.5" /> ERROR
                            </span>
                          )}
                          {ex.status === 'MANUAL_MODE' && (
                            <span className="inline-flex items-center gap-1 text-amber-400">
                              <Pause className="w-3.5 h-3.5" /> MANUAL
                            </span>
                          )}
                          {ex.status !== 'SUCCESS' && ex.status !== 'ERROR' && ex.status !== 'MANUAL_MODE' && (
                            <span className="inline-flex items-center gap-1 text-slate-400">
                              <Clock className="w-3.5 h-3.5" /> {ex.status}
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-white">
                          {formatPhone(ex.phone)}
                        </td>
                        <td className="p-3 max-w-xs truncate text-slate-400">
                          {ex.user_message || 'N/A'}
                        </td>
                        <td className="p-3 max-w-xs truncate text-emerald-300">
                          {ex.ai_reply || 'N/A'}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700">
                            {ex.tools_called || 'None'}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] text-slate-500 whitespace-nowrap">
                          {ex.created_at ? new Date(ex.created_at).toLocaleTimeString() : 'N/A'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: AI INSTRUCTIONS & SYSTEM PROMPTS MANAGER            */}
      {/* ========================================================= */}
      {activeSubTab === 'instructions' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-emerald-950/80 to-slate-900/80 border border-emerald-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  AI Instructions & System Prompts Panel
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Live Engine
                  </span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage & edit how your 11FIT AI Stylist & Sales Assistant behaves on WhatsApp in real-time.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSaveInstructions}
              disabled={savingInst}
              className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 text-sm shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              {savingInst ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{savingInst ? 'Saving...' : 'Save AI Instructions'}</span>
            </button>
          </div>

          {/* Sub-tabs for diffrent tabs / points */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
            <button
              onClick={() => setInstCategoryTab('language')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                instCategoryTab === 'language'
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              🗣️ Tone & Language
            </button>
            <button
              onClick={() => setInstCategoryTab('security')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                instCategoryTab === 'security'
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              🚨 Order & Security Rules
            </button>
            <button
              onClick={() => setInstCategoryTab('size')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                instCategoryTab === 'size'
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              📏 Size & Fit Advisor
            </button>
            <button
              onClick={() => setInstCategoryTab('brand')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                instCategoryTab === 'brand'
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              🏆 Brand & Policies
            </button>
            <button
              onClick={() => setInstCategoryTab('custom')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                instCategoryTab === 'custom'
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              ⭐ Custom Rules
            </button>
            <button
              onClick={() => setInstCategoryTab('knowledge_base')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                instCategoryTab === 'knowledge_base'
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              📚 Knowledge Base
            </button>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            {instCategoryTab === 'language' && (
              <div>
                <label className="block text-sm font-bold text-white mb-1.5 flex items-center justify-between">
                  <span>🗣️ Dynamic Tone & Automatic Language Mirroring Instructions</span>
                  <span className="text-xs text-slate-400 font-normal">Controls language switching & short reply rules</span>
                </label>
                <textarea
                  value={instLanguage}
                  onChange={(e) => setInstLanguage(e.target.value)}
                  rows={8}
                  placeholder="Enter tone and language rules..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 font-mono focus:outline-none focus:border-emerald-500 transition-colors leading-relaxed"
                />
              </div>
            )}

            {instCategoryTab === 'security' && (
              <div>
                <label className="block text-sm font-bold text-white mb-1.5 flex items-center justify-between">
                  <span>🚨 Order Security & 10-Digit Mobile Verification Flow</span>
                  <span className="text-xs text-slate-400 font-normal">Controls order # matching & OTP/10-digit mobile check</span>
                </label>
                <textarea
                  value={instOrderSecurity}
                  onChange={(e) => setInstOrderSecurity(e.target.value)}
                  rows={10}
                  placeholder="Enter order security rules..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 font-mono focus:outline-none focus:border-emerald-500 transition-colors leading-relaxed"
                />
              </div>
            )}

            {instCategoryTab === 'size' && (
              <div>
                <label className="block text-sm font-bold text-white mb-1.5 flex items-center justify-between">
                  <span>📏 11FIT AI Size & Fit Advisor Rules</span>
                  <span className="text-xs text-slate-400 font-normal">Controls streetwear oversized cut & stretch sizing rules</span>
                </label>
                <textarea
                  value={instSizeAdvisor}
                  onChange={(e) => setInstSizeAdvisor(e.target.value)}
                  rows={7}
                  placeholder="Enter size & fit advisor rules..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 font-mono focus:outline-none focus:border-emerald-500 transition-colors leading-relaxed"
                />
              </div>
            )}

            {instCategoryTab === 'brand' && (
              <div>
                <label className="block text-sm font-bold text-white mb-1.5 flex items-center justify-between">
                  <span>🏆 11FIT Brand Information & Policies</span>
                  <span className="text-xs text-slate-400 font-normal">Controls delivery days, return policies & support email</span>
                </label>
                <textarea
                  value={instBrandPolicies}
                  onChange={(e) => setInstBrandPolicies(e.target.value)}
                  rows={6}
                  placeholder="Enter brand & policy info..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 font-mono focus:outline-none focus:border-emerald-500 transition-colors leading-relaxed"
                />
              </div>
            )}

            {instCategoryTab === 'custom' && (
              <div>
                <label className="block text-sm font-bold text-white mb-1.5 flex items-center justify-between">
                  <span>⭐ Custom AI Instructions & Seasonal Offer Rules</span>
                  <span className="text-xs text-slate-400 font-normal">Add any custom rules or seasonal instructions here</span>
                </label>
                <textarea
                  value={instCustom}
                  onChange={(e) => setInstCustom(e.target.value)}
                  rows={6}
                  placeholder="e.g. For Rakhi festival, recommend Pack of 2 Combos first! Or always wish good morning..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 font-mono focus:outline-none focus:border-emerald-500 transition-colors leading-relaxed"
                />
              </div>
            )}

            {instCategoryTab === 'knowledge_base' && (
              <div>
                <label className="block text-sm font-bold text-white mb-1.5 flex items-center justify-between">
                  <span>📚 RAG Knowledge Base (FAQs, Policies, Scripts)</span>
                  <span className="text-xs text-slate-400 font-normal">Inject text data directly into AI memory</span>
                </label>
                <textarea
                  value={instKnowledgeBase}
                  onChange={(e) => setInstKnowledgeBase(e.target.value)}
                  rows={10}
                  placeholder="Paste FAQ content, scripts, or policy docs here. The AI will read this to answer queries..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 font-mono focus:outline-none focus:border-emerald-500 transition-colors leading-relaxed"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
              <span className="text-xs text-slate-400">
                💡 Tip: Changes saved here are dynamically injected into the real-time AI prompt on every WhatsApp incoming message.
              </span>
              <button
                type="button"
                onClick={handleSaveInstructions}
                disabled={savingInst}
                className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 text-xs shadow-md transition-all cursor-pointer"
              >
                {savingInst ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save Current Instructions</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- 11FIT ABANDONED CARTS (MOBILE ONLY) & OTP ANALYTICS TAB --- */}
      {activeSubTab === '11fit_abandoned' && (
        <div className="flex-1 flex flex-col min-h-0 bg-[#0B0F19] overflow-y-auto p-3 sm:p-5">
          {/* New Abandoned Cart Notification Banner */}
          {newAbCartNotification && (
            <div className="mb-4 bg-gradient-to-r from-red-900/40 via-amber-900/30 to-emerald-900/40 border border-red-500/50 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                      New Abandoned Cart Reached
                    </span>
                    <span className="text-xs text-slate-400 font-mono">11FIT Checkout</span>
                  </div>
                  <p className="text-sm font-extrabold text-white mt-1">
                    Mobile: <span className="text-emerald-400 font-mono">{newAbCartNotification.phone}</span> • Amount: <span className="text-amber-400">₹{newAbCartNotification.price}</span> ({newAbCartNotification.itemsCount} items)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => handleSendAbCartRecovery(newAbCartNotification)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Send Recovery Msg</span>
                </button>
                <button
                  onClick={() => setNewAbCartNotification(null)}
                  className="text-slate-400 hover:text-white px-2 py-1 text-xs"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Top Analytics KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5 shrink-0">
            <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Abandoned Carts</span>
                <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                  <ShoppingCart className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-white">
                  {elevenFitData?.analytics?.activeAbandonedCarts || elevenFitData?.abandonedCarts?.length || 0}
                </div>
                <div className="text-[11px] text-red-400 font-medium mt-0.5">
                  Mobile Number Only Checkouts
                </div>
              </div>
            </div>

            <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total OTP Sent</span>
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <KeyRound className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-white">
                  {elevenFitData?.analytics?.totalOtpSent || 0}
                </div>
                <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                  11FIT Authentication Requests
                </div>
              </div>
            </div>

            <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">OTP Verified</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-white">
                    {elevenFitData?.analytics?.totalOtpVerified || 0}
                  </span>
                  <span className="text-xs text-emerald-400 font-bold">
                    ({elevenFitData?.analytics?.verificationRate || 100}%)
                  </span>
                </div>
                <div className="text-[11px] text-emerald-400/80 font-medium mt-0.5">
                  Verified Mobile Customers
                </div>
              </div>
            </div>

            <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mobile Users</span>
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-white">
                  {elevenFitData?.analytics?.totalMobileUsers || 0}
                </div>
                <div className="text-[11px] text-blue-400/80 font-medium mt-0.5">
                  11FIT Network DB
                </div>
              </div>
            </div>

            <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Pitch Count</span>
                <div className="w-8 h-8 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center text-fuchsia-400">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-white">
                  {elevenFitData?.analytics?.aiCarouselsSent || 0}
                </div>
                <div className="text-[11px] text-fuchsia-400 font-medium mt-0.5">
                  Product Carousels Sent
                </div>
              </div>
            </div>
          </div>

          {/* Controls Bar: Sub-views & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 bg-[#0F172A] p-3 rounded-2xl border border-slate-800">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 w-full sm:w-auto">
              <button
                onClick={() => setAbCartSubView('carts')}
                className={`flex-1 sm:flex-initial justify-center px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  abCartSubView === 'carts'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span className="sm:hidden">Carts</span>
                <span className="hidden sm:inline">Abandoned Carts (Mobile Only)</span>
                <span className="px-1.5 py-0.5 text-[10px] bg-black/30 rounded-full">
                  {elevenFitData?.abandonedCarts?.length || 0}
                </span>
              </button>
              <button
                onClick={() => setAbCartSubView('otp_logs')}
                className={`flex-1 sm:flex-initial justify-center px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  abCartSubView === 'otp_logs'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span className="sm:hidden">OTP Logs</span>
                <span className="hidden sm:inline">OTP Analytics & SMS Logs</span>
                <span className="px-1.5 py-0.5 text-[10px] bg-black/30 rounded-full">
                  {elevenFitData?.otpLogs?.length || 0}
                </span>
              </button>
              <button
                onClick={() => setAbCartSubView('users')}
                className={`flex-1 sm:flex-initial justify-center px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  abCartSubView === 'users'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span className="sm:hidden">Users</span>
                <span className="hidden sm:inline">Mobile Network Users</span>
                <span className="px-1.5 py-0.5 text-[10px] bg-black/30 rounded-full">
                  {elevenFitData?.networkUsers?.length || 0}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search mobile number or name..."
                  value={abCartSearch}
                  onChange={(e) => setAbCartSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
              <button
                onClick={() => fetchElevenFitAnalytics(false)}
                disabled={loadingElevenFit}
                className="p-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 rounded-xl text-slate-300 disabled:opacity-50 transition-colors"
                title="Refresh 11FIT Data"
              >
                <RefreshCw className={`w-4 h-4 ${loadingElevenFit ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Sub-View 1: Abandoned Carts (Mobile Only) */}
          {abCartSubView === 'carts' && (
            <div className="flex-1">
              {(elevenFitData?.abandonedCarts || [])
                .filter((cart) => {
                  const pDigits = String(cart.phone || '').replace(/\D/g, '');
                  if (!cart.phone || cart.phone === 'Unknown' || cart.phone === 'N/A' || pDigits.length < 10) return false;
                  if (!abCartSearch) return true;
                  const q = abCartSearch.toLowerCase();
                  return (
                    (cart.phone && cart.phone.toLowerCase().includes(q)) ||
                    (cart.customer_name && cart.customer_name.toLowerCase().includes(q)) ||
                    (cart.email && cart.email.toLowerCase().includes(q))
                  );
                })
                .length === 0 ? (
                <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-12 text-center my-auto">
                  <ShoppingCart className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-slate-300">No Abandoned Carts Found</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    No abandoned checkouts with mobile numbers are currently open, or they match no search filter.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {(elevenFitData?.abandonedCarts || [])
                    .filter((cart) => {
                      const pDigits = String(cart.phone || '').replace(/\D/g, '');
                      if (!cart.phone || cart.phone === 'Unknown' || cart.phone === 'N/A' || pDigits.length < 10) return false;
                      if (!abCartSearch) return true;
                      const q = abCartSearch.toLowerCase();
                      return (
                        (cart.phone && cart.phone.toLowerCase().includes(q)) ||
                        (cart.customer_name && cart.customer_name.toLowerCase().includes(q)) ||
                        (cart.email && cart.email.toLowerCase().includes(q))
                      );
                    })
                    .map((cart) => (
                      <div
                        key={cart.id}
                        className="bg-[#0F172A] border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between transition-all shadow-md group relative"
                      >
                        <div>
                          {/* Card Header: Mobile Number & Verified Status Badge */}
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-extrabold text-white font-mono tracking-wide">
                                  {cart.phone}
                                </span>
                                {cart.otp_status === 'verified' || cart.is_11fit_user ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>OTP Verified</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                    <Clock className="w-3 h-3" />
                                    <span>Guest / OTP Pending</span>
                                  </span>
                                )}
                              </div>
                              {cart.customer_name && (
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {cart.customer_name} {cart.email ? `(${cart.email})` : ''}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-base font-extrabold text-amber-400 font-mono">
                                ₹{cart.total_price}
                              </span>
                              <div className="text-[10px] text-slate-500">
                                {cart.currency || 'INR'}
                              </div>
                            </div>
                          </div>

                          {/* Line Items List */}
                          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 my-3">
                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                              <span>Cart Items ({cart.line_items?.length || 0})</span>
                              <span>Price</span>
                            </div>
                            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                              {(cart.line_items || []).map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs text-slate-300">
                                  <div className="truncate pr-2 font-medium">
                                    <span className="text-emerald-400 font-bold">{item.quantity}x</span> {item.title}
                                  </div>
                                  <div className="font-mono text-slate-400 shrink-0">
                                    ₹{item.price}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Card Footer: Timestamp & Action */}
                        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 mt-2">
                          <span className="text-[11px] text-slate-400 font-mono">
                            {cart.created_at ? new Date(cart.created_at).toLocaleString() : 'Recent'}
                          </span>
                          <button
                            onClick={() => handleSendAbCartRecovery(cart)}
                            className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>1-Click Recovery Msg</span>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Sub-View 2: OTP Analytics & SMS Logs */}
          {abCartSubView === 'otp_logs' && (
            <div className="flex-1 bg-[#0F172A] border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  11FIT OTP Analytics & Verification Events
                </h4>
                <span className="text-xs text-slate-500 font-mono">
                  Showing {elevenFitData?.otpLogs?.length || 0} records
                </span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {(elevenFitData?.otpLogs || []).length === 0 ? (
                  <div className="p-12 text-center text-slate-500 text-xs">
                    No OTP verification logs found in Supabase.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px] bg-slate-950/60">
                        <th className="py-2.5 px-4">Mobile Number</th>
                        <th className="py-2.5 px-4">Event Type</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {(elevenFitData?.otpLogs || [])
                        .filter((log) => {
                          if (!abCartSearch) return true;
                          const q = abCartSearch.toLowerCase();
                          return log.phone && log.phone.toLowerCase().includes(q);
                        })
                        .map((log, index) => (
                          <tr key={index} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-4 font-mono font-bold text-white">
                              {log.phone}
                            </td>
                            <td className="py-2.5 px-4">
                              <span className="font-mono text-slate-300 uppercase text-[11px]">
                                {log.event_type || log.event || 'OTP_VERIFY'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4">
                              {log.status === 'success' || log.status === 'verified' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Success</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                                  <span>{log.status || 'Failed'}</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">
                              {log.created_at ? new Date(log.created_at).toLocaleString() : 'Recent'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Sub-View 3: Mobile Network Users */}
          {abCartSubView === 'users' && (
            <div className="flex-1 bg-[#0F172A] border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  11FIT Network Users (Mobile DB)
                </h4>
                <span className="text-xs text-slate-500 font-mono">
                  Showing {elevenFitData?.networkUsers?.length || 0} records
                </span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {(elevenFitData?.networkUsers || []).length === 0 ? (
                  <div className="p-12 text-center text-slate-500 text-xs">
                    No registered mobile users found in Supabase.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px] bg-slate-950/60">
                        <th className="py-2.5 px-4">Mobile Number</th>
                        <th className="py-2.5 px-4">User Details</th>
                        <th className="py-2.5 px-4">Registered On</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {(elevenFitData?.networkUsers || [])
                        .filter((u) => {
                          if (!abCartSearch) return true;
                          const q = abCartSearch.toLowerCase();
                          return u.phone && u.phone.toLowerCase().includes(q);
                        })
                        .map((user, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-4 font-mono font-bold text-emerald-400">
                              {user.phone}
                            </td>
                            <td className="py-2.5 px-4 text-slate-300">
                              {user.name || user.email || '11FIT Checkout Customer'}
                            </td>
                            <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">
                              {user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- META WHATSAPP TEMPLATES MANAGER TAB --- */}
      {activeSubTab === 'meta_templates' && (
        <MetaTemplatesManager />
      )}

      {/* --- AUTOMATED WORKFLOWS TAB --- */}
      {activeSubTab === 'workflows' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <Activity className="w-6 h-6 text-emerald-400" />
                  Automated Trigger Workflows
                </h2>
                <p className="text-sm text-slate-400 mt-1">Enable or disable automatic WhatsApp messages sent to customers based on Shopify events.</p>
              </div>
              <button
                onClick={handleSaveWorkflows}
                disabled={savingWorkflows}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all shadow-md shrink-0"
              >
                {savingWorkflows ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Workflows
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Trigger Toggle Item */}
              {[
                { id: 'abandoned_cart', title: '🛒 Abandoned Cart Recovery', desc: 'Sends an automatic message with a cart link 1 hour after abandonment.' },
                { id: 'order_placed', title: '✅ Order Placed (Prepaid & COD)', desc: 'Sends an instant confirmation when a customer places an order.' },
                { id: 'order_shipped', title: '🚚 Order Shipped', desc: 'Sends tracking details as soon as the order is fulfilled.' },
                { id: 'out_for_delivery', title: '🏠 Out for Delivery', desc: 'Alerts the customer that their package is arriving today.' },
                { id: 'order_delivered', title: '🎉 Order Delivered', desc: 'Sends a thank you message asking for a review or showing combo offers.' }
              ].map(trigger => (
                <div key={trigger.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-white font-bold text-base">{trigger.title}</h3>
                      <p className="text-slate-400 text-xs mt-1 leading-relaxed">{trigger.desc}</p>
                    </div>
                    {/* Toggle Switch */}
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={workflows[trigger.id] !== false}
                        onChange={(e) => setWorkflows(prev => ({ ...prev, [trigger.id]: e.target.checked }))}
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-800/50 w-fit px-2 py-1 rounded-md">
                    Trigger: <span className="text-emerald-400">{trigger.id}</span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="bg-blue-900/20 border border-blue-800/40 p-4 rounded-xl flex items-start gap-3 mt-4">
              <ShieldAlert className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-200">
                <strong>How are templates mapped?</strong> The automated backend system matches the triggers above to the active Meta templates with the corresponding `_v1` or `_v2` labels. Make sure you don't delete standard templates without creating a replacement.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER ORDERS MODAL / DRAWER (MOBILE BOTTOM SHEET + DESKTOP MODAL) */}
      {showOrdersModal && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4 animate-[fadeIn_0.2s_ease]"
          onClick={() => setShowOrdersModal(false)}
        >
          <div
            className="bg-[#0b1322] border-t sm:border border-slate-800/80 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag/Pull Handle */}
            <div className="w-12 h-1.5 bg-slate-700/60 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 px-4 sm:px-6 border-b border-slate-800/80 bg-[#111c30] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-white text-base sm:text-lg truncate">
                      Shopify Orders
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {customerOrders.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    Customer: <span className="font-mono text-emerald-400 font-semibold">{formatPhone(ordersCustomerPhone)}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenCustomerOrders(ordersCustomerPhone)}
                  disabled={ordersLoading}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition-colors shrink-0 cursor-pointer"
                  title="Refresh Shopify Orders"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${ordersLoading ? 'animate-spin text-emerald-400' : ''}`} />
                  <span className="hidden sm:inline">Sync</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowOrdersModal(false)}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-xs flex items-center gap-1.5 border border-rose-500/30 transition-all shrink-0 cursor-pointer"
                  title="Close Modal"
                >
                  <X className="w-4 h-4" />
                  <span>Close</span>
                </button>
              </div>
            </div>

            {/* Modal Filters Pill Bar (Smooth Horizontal Scroll) */}
            <div className="px-4 py-3 border-b border-slate-800/80 bg-[#0e1726] flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
              <button
                type="button"
                onClick={() => setOrderModalFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  orderModalFilter === 'all'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>All ({customerOrders.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setOrderModalFilter('cod')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  orderModalFilter === 'cod'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'bg-slate-900/90 text-amber-400 hover:text-amber-300 border border-slate-800'
                }`}
              >
                <span>💵 COD ({customerOrders.filter(o => {
                  const names = o?.payment_gateway_names;
                  return Boolean(names && (
                    (Array.isArray(names) && names.some(g => String(g).toLowerCase().includes('cash') || String(g).toLowerCase().includes('cod'))) ||
                    String(names).toLowerCase().includes('cash') ||
                    String(names).toLowerCase().includes('cod')
                  ));
                }).length})</span>
              </button>
              <button
                type="button"
                onClick={() => setOrderModalFilter('prepaid')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  orderModalFilter === 'prepaid'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-900/90 text-blue-400 hover:text-blue-300 border border-slate-800'
                }`}
              >
                <span>💳 Prepaid ({customerOrders.filter(o => {
                  const names = o?.payment_gateway_names;
                  const isCOD = Boolean(names && (
                    (Array.isArray(names) && names.some(g => String(g).toLowerCase().includes('cash') || String(g).toLowerCase().includes('cod'))) ||
                    String(names).toLowerCase().includes('cash') ||
                    String(names).toLowerCase().includes('cod')
                  ));
                  return !isCOD;
                }).length})</span>
              </button>
              <button
                type="button"
                onClick={() => setOrderModalFilter('fulfilled')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  orderModalFilter === 'fulfilled'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-slate-900/90 text-purple-400 hover:text-purple-300 border border-slate-800'
                }`}
              >
                <span>🚚 Fulfilled ({customerOrders.filter(o => {
                  const status = (o?.fulfillment_status || 'unfulfilled').toLowerCase();
                  return status === 'fulfilled' || status === 'partial';
                }).length})</span>
              </button>
              <button
                type="button"
                onClick={() => setOrderModalFilter('unfulfilled')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  orderModalFilter === 'unfulfilled'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'bg-slate-900/90 text-rose-400 hover:text-rose-300 border border-slate-800'
                }`}
              >
                <span>⏳ Unfulfilled ({customerOrders.filter(o => {
                  const status = (o?.fulfillment_status || 'unfulfilled').toLowerCase();
                  return status === 'unfulfilled' || !o?.fulfillment_status;
                }).length})</span>
              </button>
              <button
                type="button"
                onClick={() => setOrderModalFilter('delivered')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  orderModalFilter === 'delivered'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-900/90 text-emerald-400 hover:text-emerald-300 border border-slate-800'
                }`}
              >
                <span>✅ Delivered ({customerOrders.filter(o => {
                  const fulfillments = Array.isArray(o.fulfillments) ? o.fulfillments : (typeof o.fulfillments === 'string' ? (() => { try { return JSON.parse(o.fulfillments) || []; } catch(_) { return []; } })() : []);
                  const fulfillment = fulfillments.length > 0 ? fulfillments[0] : null;
                  return (fulfillment?.shipment_status || '').toLowerCase() === 'delivered';
                }).length})</span>
              </button>
            </div>

            {/* Modal Body / Orders List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3.5 bg-[#080e1a]">
              {ordersLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                  <p className="text-sm font-semibold">Loading Shopify Orders...</p>
                </div>
              ) : customerOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-500 mb-3">
                    <Package className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-white mb-1">No Orders Found</h4>
                  <p className="text-xs text-slate-400 max-w-sm">
                    No orders matching phone number <span className="text-emerald-400 font-mono">{formatPhone(ordersCustomerPhone)}</span> were found on your Shopify store.
                  </p>
                </div>
              ) : (
                customerOrders.filter(order => {
                  if (!order || typeof order !== 'object') return false;
                  if (orderModalFilter === 'all') return true;
                  const isCOD = Boolean(order.payment_gateway_names && (
                    (Array.isArray(order.payment_gateway_names) && order.payment_gateway_names.some(g => String(g).toLowerCase().includes('cash') || String(g).toLowerCase().includes('cod'))) ||
                    String(order.payment_gateway_names).toLowerCase().includes('cash') ||
                    String(order.payment_gateway_names).toLowerCase().includes('cod')
                  ));
                  if (orderModalFilter === 'cod') return isCOD;
                  if (orderModalFilter === 'prepaid') return !isCOD;
                  const status = (order.fulfillment_status || 'unfulfilled').toLowerCase();
                  if (orderModalFilter === 'fulfilled') return status === 'fulfilled' || status === 'partial';
                  if (orderModalFilter === 'unfulfilled') return status === 'unfulfilled' || !order.fulfillment_status;
                  if (orderModalFilter === 'delivered') {
                    const fulfillments = Array.isArray(order.fulfillments) ? order.fulfillments : (typeof order.fulfillments === 'string' ? (() => { try { return JSON.parse(order.fulfillments) || []; } catch(_) { return []; } })() : []);
                    const fulfillment = fulfillments.length > 0 ? fulfillments[0] : null;
                    return (fulfillment?.shipment_status || '').toLowerCase() === 'delivered';
                  }
                  return true;
                }).map((order) => {
                  if (!order || typeof order !== 'object') return null;
                  const isExpanded = expandedOrderId === order.id;
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
                      className="bg-[#131f33] border border-slate-800/80 rounded-2xl overflow-hidden transition-all shadow-lg hover:border-slate-700"
                    >
                      {/* Order Card Top Bar — TWO-ROW MOBILE DESIGN */}
                      <div
                        className="p-3.5 sm:p-4 cursor-pointer select-none hover:bg-slate-800/40 transition-colors"
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      >
                        {/* Row 1: Order # + Price + Chevron Arrow */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-extrabold text-white text-base sm:text-lg tracking-tight truncate">
                              {order.name || (order.order_number ? `#${order.order_number}` : '#Order')}
                            </span>
                            <span className="text-slate-600 font-bold">•</span>
                            <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                              {(() => {
                                try {
                                  return new Date(order.created_at || Date.now()).toLocaleDateString([], {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  });
                                } catch (_) {
                                  return 'Recent';
                                }
                              })()}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-extrabold text-emerald-400 text-base sm:text-lg">
                              ₹{order.total_price || 0}
                            </span>
                            <div className="p-1 rounded-lg bg-slate-800/80 text-slate-300">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                        </div>

                        {/* Row 2: Status Badges (Clean separate row below price, never overlaps!) */}
                        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                          {order.financial_status === 'paid' ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              💳 Paid Online
                            </span>
                          ) : order.financial_status === 'partially_paid' ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                              🪙 Partial COD
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              💵 COD
                            </span>
                          )}
                          {isCancelled ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              ❌ Cancelled
                            </span>
                          ) : isFulfilled ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              🚚 Fulfilled
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              ⏳ Processing
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Expanded Section: Tracking, Payment, Items & Address */}
                      {isExpanded && (
                        <div className="px-3.5 sm:px-4 pb-4 pt-2 border-t border-slate-800/80 space-y-3.5 bg-[#0c1524] text-xs">
                          {/* 1. Tracking Info (Show first when fulfilled!) */}
                          {isFulfilled && (
                            <div>
                              <h5 className="font-bold text-slate-300 mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                                <Truck className="w-3.5 h-3.5 text-blue-400" />
                                <span>Tracking Information</span>
                              </h5>
                              <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                                <div>
                                  <span className="text-slate-400">Courier: </span>
                                  <span className="font-bold text-white">{trackingCompany || 'Assigned'}</span>
                                  {trackingNumber && (
                                    <>
                                      <span className="text-slate-600 mx-2">|</span>
                                      <span className="text-slate-400">AWB: </span>
                                      <span className="font-mono font-extrabold text-emerald-400">{trackingNumber}</span>
                                    </>
                                  )}
                                </div>
                                {trackingUrl && (
                                  <a
                                    href={trackingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white font-bold text-xs border border-blue-500/30 transition-all ml-auto"
                                  >
                                    <span>Track Package</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 2. Payment Details */}
                          <div>
                            <h5 className="font-bold text-slate-300 mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Payment Details</span>
                            </h5>
                            <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 flex items-center justify-between gap-3">
                              <div>
                                <span className="text-slate-400 block text-[11px] mb-0.5">Method & Status</span>
                                <span className="font-bold text-white text-sm">
                                  {order.financial_status === 'paid'
                                    ? '💳 Paid Online (Prepaid)'
                                    : order.financial_status === 'partially_paid'
                                    ? `🪙 Partial Paid (Balance ₹${order.total_price} on COD)`
                                    : `💵 Cash on Delivery (COD) — Pay ₹${order.total_price} on Delivery`}
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-slate-400 block text-[11px] mb-0.5">Total Amount</span>
                                <span className="font-extrabold text-emerald-400 text-base">
                                  ₹{order.total_price || 0}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* 3. Items Ordered */}
                          <div>
                            <h5 className="font-bold text-slate-300 mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                              <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Items Ordered ({lineItems.length})</span>
                            </h5>
                            <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 space-y-2">
                              {lineItems.map((item, i) => (
                                <div key={i} className="flex items-center justify-between gap-2 text-slate-300">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0">
                                      {item?.quantity || 1}x
                                    </span>
                                    <span className="truncate text-white font-medium">
                                      {item?.title || 'Product Item'}
                                      {item?.variant_title && (
                                        <span className="text-slate-400 font-normal ml-1">({item.variant_title})</span>
                                      )}
                                    </span>
                                  </div>
                                  <span className="font-semibold text-emerald-400 shrink-0">
                                    ₹{item?.price || 0}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* 4. Shipping Address */}
                          <div>
                            <h5 className="font-bold text-slate-300 mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Shipping Address</span>
                            </h5>
                            {shipAddr ? (
                              <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 space-y-1 text-slate-300">
                                <p className="font-bold text-white">
                                  {shipAddr.first_name || ''} {shipAddr.last_name || ''}
                                </p>
                                <p>
                                  {[
                                    shipAddr.address1,
                                    shipAddr.address2,
                                    shipAddr.city,
                                    shipAddr.province,
                                    shipAddr.zip
                                  ].filter(Boolean).join(', ')}
                                </p>
                                {shipAddr.phone && (
                                  <p className="text-slate-400">Phone: {formatPhone(shipAddr.phone)}</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-slate-500 italic">No shipping address provided</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Order Card Footer — Full-Width Action Buttons */}
                      <div className="p-3 bg-slate-950/80 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Button 1: Send Order Details */}
                        <button
                          type="button"
                          disabled={!!sendingOrderAction}
                          onClick={() => handleSendOrderWhatsApp(order, 'details')}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs shadow-md transition-all cursor-pointer"
                        >
                          {sendingOrderAction === `${order.id}-details` ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span>Send Order Details</span>
                        </button>

                        {/* Button 2: Send Shipping Info */}
                        <button
                          type="button"
                          disabled={!!sendingOrderAction || !trackingNumber}
                          onClick={() => handleSendOrderWhatsApp(order, 'shipping')}
                          title={!trackingNumber ? 'No tracking number assigned to this order yet' : 'Send tracking info & link to WhatsApp'}
                          className={`w-full font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs shadow-md transition-all ${
                            trackingNumber
                              ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white cursor-pointer'
                              : 'bg-slate-800/70 text-slate-500 opacity-60 cursor-not-allowed'
                          }`}
                        >
                          {sendingOrderAction === `${order.id}-shipping` ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Truck className="w-3.5 h-3.5" />
                          )}
                          <span>Send Shipping Info</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- AUDIENCE SEGMENTS & BROADCASTER TAB --- */}
      {activeSubTab === 'contacts' && (() => {
        const filteredContacts = contacts.filter(c => {
          const matchesSearch = c.phone.includes(contactsSearch) || (c.tags || []).join(' ').toLowerCase().includes(contactsSearch.toLowerCase());
          const matchesTag = tagFilter ? (c.tags || []).includes(tagFilter) : true;
          return matchesSearch && matchesTag;
        });
        const allUniqueTags = Array.from(new Set(contacts.flatMap(c => c.tags || [])));
        
        return (
        <div className="flex-1 min-h-0 bg-[#0B0F19] flex flex-col p-4 sm:p-6 overflow-y-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-6 h-6 text-indigo-400" />
                Audience Segments & Smart Tags
              </h2>
              <p className="text-slate-400 text-sm mt-1">Filter your contacts and blast targeted WhatsApp broadcasts instantly.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button 
                onClick={selectedContacts.length > 0 ? openBroadcastModal : undefined} 
                disabled={selectedContacts.length === 0}
                className={`font-bold px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all ${
                  selectedContacts.length > 0 
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/50 animate-fade-in cursor-pointer' 
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                }`}
                title={selectedContacts.length === 0 ? "Select contacts to broadcast" : "Create Broadcast"}
              >
                <Send className="w-4 h-4" />
                {selectedContacts.length > 0 ? `Create Broadcast (${selectedContacts.length})` : 'Create Broadcast'}
              </button>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input type="text" placeholder="Search phone or tags..." 
                  value={contactsSearch} onChange={e => setContactsSearch(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-48 sm:w-64" />
              </div>
              <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 appearance-none">
                <option value="">All Tags</option>
                {allUniqueTags.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <button onClick={fetchContacts} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors">
                <RefreshCw className={`w-4 h-4 ${loadingContacts ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-auto shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400 sticky top-0 z-10">
                  <th className="p-4 w-12 text-center">
                    <input type="checkbox" className="rounded bg-slate-800 border-slate-600 checked:bg-indigo-500 cursor-pointer w-4 h-4"
                      checked={selectedContacts.length > 0 && selectedContacts.length === filteredContacts.length}
                      onChange={() => handleSelectAllContacts(filteredContacts)}
                      title="Select All Filtered"
                    />
                  </th>
                  <th className="p-4 font-bold">Customer Phone</th>
                  <th className="p-4 font-bold">Smart Tags</th>
                  <th className="p-4 font-bold hidden sm:table-cell">Last Active</th>
                  <th className="p-4 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredContacts.map((contact, i) => (
                  <tr key={i} className={`hover:bg-slate-800/30 transition-colors ${selectedContacts.includes(contact.phone) ? 'bg-indigo-500/5' : ''}`}>
                    <td className="p-4 text-center">
                      <input type="checkbox" className="rounded bg-slate-800 border-slate-600 checked:bg-indigo-500 cursor-pointer w-4 h-4"
                        checked={selectedContacts.includes(contact.phone)}
                        onChange={() => handleSelectContact(contact.phone)}
                      />
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-200">{contact.phone}</div>
                      <div className="text-xs text-slate-500">{contact.customer_name || 'Unknown Name'}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {(contact.tags || []).length > 0 ? contact.tags.map((t, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {t}
                          </span>
                        )) : <span className="text-xs text-slate-600 italic">No tags</span>}
                      </div>
                    </td>
                    <td className="p-4 hidden sm:table-cell text-sm text-slate-400">
                      {new Date(contact.updated_at).toLocaleString()}
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => { setActiveSubTab('inbox'); setInboxSearch(contact.phone); }} 
                        className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg border border-slate-700 transition-colors">
                        Message
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredContacts.length === 0 && !loadingContacts && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 italic">
                      No contacts found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Broadcast Modal */}
          {isBroadcastModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col">
                <div className="flex justify-between items-center p-5 border-b border-slate-800">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Send className="w-5 h-5 text-emerald-400" /> Create Broadcast
                  </h3>
                  <button onClick={() => setIsBroadcastModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">
                  <div className="mb-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-3 text-indigo-200 text-sm">
                    You are about to send a WhatsApp broadcast to <strong>{selectedContacts.length} customers</strong>.
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-300 mb-1">Select Meta Template</label>
                    <select value={broadcastTemplate} onChange={e => setBroadcastTemplate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500">
                      <option value="">-- Choose an approved template --</option>
                      {metaTemplates.map(t => (
                        <option key={t.name} value={t.name}>{t.name} ({t.language})</option>
                      ))}
                    </select>
                    {metaTemplates.length === 0 && <div className="text-xs text-amber-500 mt-1">Loading templates... if this persists, configure them in the Meta Templates tab.</div>}
                  </div>
                  {broadcastMessage && (
                    <div className={`p-3 rounded-lg text-sm mb-4 ${broadcastMessage.includes('Failed') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                      {broadcastMessage}
                    </div>
                  )}
                </div>
                <div className="p-5 border-t border-slate-800 bg-slate-950 rounded-b-2xl flex justify-end gap-3">
                  <button onClick={() => setIsBroadcastModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-300 hover:bg-slate-800 transition-colors">Cancel</button>
                  <button onClick={sendBroadcast} disabled={!broadcastTemplate || sendingBroadcast}
                    className="px-5 py-2 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50 flex items-center gap-2">
                    {sendingBroadcast ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {sendingBroadcast ? 'Sending...' : 'Send Broadcast'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {/* --- BROADCASTS & CAMPAIGNS TAB --- */}
      {activeSubTab === 'broadcasts' && (
        <div className="flex-1 min-h-0 bg-slate-950 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-white flex items-center gap-2">
                  <Megaphone className="text-fuchsia-500 w-7 h-7" />
                  Campaigns & Broadcasts
                </h1>
                <p className="text-slate-400 text-sm mt-1">Track the performance and ROI of your WhatsApp broadcasts.</p>
              </div>
              <button
                onClick={() => setActiveSubTab('contacts')}
                className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-fuchsia-600/20"
              >
                <Plus className="w-4 h-4" /> New Campaign
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              {loadingBroadcasts ? (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-fuchsia-500 mb-4" />
                  <p className="font-bold">Loading Campaign Data...</p>
                </div>
              ) : broadcastsHistory.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Megaphone className="w-10 h-10 text-slate-600" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">No Campaigns Yet</h3>
                  <p className="text-slate-400 max-w-md mx-auto mb-6">You haven't sent any broadcasts yet. Go to Audience & CRM to select customers and blast your first campaign.</p>
                  <button onClick={() => setActiveSubTab('contacts')} className="bg-fuchsia-600/20 text-fuchsia-400 px-6 py-2 rounded-lg font-bold border border-fuchsia-500/30 hover:bg-fuchsia-600/30 transition-colors">Start a Campaign</button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950/50 border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                        <th className="p-4 font-bold">Campaign Name</th>
                        <th className="p-4 font-bold">Date</th>
                        <th className="p-4 font-bold">Audience</th>
                        <th className="p-4 font-bold text-center">Status</th>
                        <th className="p-4 font-bold text-right">Recipients</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-sm">
                      {broadcastsHistory.map(b => (
                        <tr key={b.id} className="hover:bg-slate-800/50 transition-colors group cursor-pointer" onClick={() => fetchBroadcastLogs(b.id)}>
                          <td className="p-4">
                            <div className="font-bold text-slate-200 group-hover:text-white transition-colors">{b.name}</div>
                            <div className="text-xs text-slate-500 mt-1">Template: <span className="text-slate-400">{b.template_name}</span></div>
                          </td>
                          <td className="p-4 text-slate-400">{new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="p-4">
                            <span className="bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded-md">{b.segment.replace(/_/g, ' ')}</span>
                          </td>
                          <td className="p-4 text-center">
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">{b.status}</span>
                          </td>
                          <td className="p-4 text-right font-bold text-white">{b.total_recipients}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            {/* Expanded Broadcast Logs Modal/Panel */}
            {selectedBroadcastLogs && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease]">
                <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                   <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                     <h2 className="text-lg font-black text-white flex items-center gap-2"><BarChart3 className="w-5 h-5 text-fuchsia-400" /> Campaign Analytics</h2>
                     <button onClick={() => setSelectedBroadcastLogs(null)} className="text-slate-400 hover:text-white p-1 bg-slate-800 rounded-lg"><X className="w-5 h-5" /></button>
                   </div>
                   <div className="p-6 overflow-y-auto">
                      <div className="grid grid-cols-4 gap-4 mb-8">
                         <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
                            <div className="text-3xl font-black text-white mb-1">{selectedBroadcastLogs.length}</div>
                            <div className="text-xs text-slate-400 font-bold uppercase">Total Sent</div>
                         </div>
                         <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                            <div className="text-3xl font-black text-emerald-400 mb-1">{selectedBroadcastLogs.filter(l => l.status !== 'failed').length}</div>
                            <div className="text-xs text-emerald-500/70 font-bold uppercase">Delivered (Est.)</div>
                         </div>
                         <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
                            <div className="text-3xl font-black text-blue-400 mb-1">--</div>
                            <div className="text-xs text-blue-500/70 font-bold uppercase">Read (Pending)</div>
                         </div>
                         <div className="bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-xl p-4 text-center">
                            <div className="text-3xl font-black text-fuchsia-400 mb-1">--</div>
                            <div className="text-xs text-fuchsia-500/70 font-bold uppercase">Replied (Pending)</div>
                         </div>
                      </div>
                      
                      <h3 className="text-sm font-bold text-slate-300 mb-4 border-b border-slate-800 pb-2">Delivery Logs</h3>
                      <div className="max-h-64 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                           <thead>
                             <tr className="text-xs text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-900 border-b border-slate-800">
                               <th className="py-2">Phone</th>
                               <th className="py-2">Status</th>
                               <th className="py-2 text-right">Time</th>
                             </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-800/50">
                             {selectedBroadcastLogs.map((log, i) => (
                               <tr key={i} className="text-slate-300">
                                 <td className="py-2 font-mono text-xs">{log.phone}</td>
                                 <td className="py-2">
                                   <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${log.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                     {log.status}
                                   </span>
                                   {log.error_message && <span className="text-xs text-red-400 ml-2">{log.error_message}</span>}
                                 </td>
                                 <td className="py-2 text-right text-xs text-slate-500">{new Date(log.created_at).toLocaleTimeString()}</td>
                               </tr>
                             ))}
                           </tbody>
                        </table>
                      </div>
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- FLOW BUILDER TAB --- */}
      {activeSubTab === 'flow_builder' && (
        <div className="flex-1 min-h-0 bg-slate-950 flex flex-col">
          <ChatbotFlowBuilder />
        </div>
      )}

      {/* QUICK REPLIES MODAL */}
      {showQuickRepliesModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh] shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-400" /> Manage Quick Replies
              </h2>
              <button onClick={() => setShowQuickRepliesModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {cannedResponses.length === 0 && (
                <div className="text-center text-slate-500 py-8 text-sm">No quick replies found. Add one below!</div>
              )}
              {cannedResponses.map((r) => (
                <div key={r.id || r.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex justify-between items-start gap-4 hover:border-slate-600 transition-colors">
                  <div>
                    <h3 className="text-emerald-400 font-bold text-sm mb-1">{r.label}</h3>
                    <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">{r.text}</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!window.confirm('Delete this quick reply?')) return;
                      await fetch(`/api/whatsapp-settings?action=quick_replies&id=${r.id}`, { method: 'DELETE' });
                      fetchQuickReplies();
                    }}
                    className="text-red-400 hover:text-red-300 p-1.5 bg-red-400/10 rounded-lg transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-800 bg-slate-950/50">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const label = e.target.label.value;
                const text = e.target.text.value;
                if (!label || !text) return;
                const btn = e.nativeEvent.submitter;
                const prev = btn.innerHTML;
                btn.innerHTML = 'Saving...';
                await fetch('/api/whatsapp-settings?action=quick_replies', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ label, text })
                });
                btn.innerHTML = prev;
                e.target.reset();
                fetchQuickReplies();
              }} className="space-y-3">
                <input type="text" name="label" placeholder="Short Label (e.g. Refund Policy)" required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors" />
                <textarea name="text" placeholder="Full message text..." required rows="2" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 resize-none transition-colors"></textarea>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-4 py-2.5 font-bold text-sm transition-colors shadow-lg shadow-emerald-600/20">
                  + Add New Quick Reply
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* CALLING OVERLAYS */}
      
      {/* CALLING OVERLAYS */}
    </div>
  );
}
