import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  RefreshCw, CheckCircle2, XCircle, AlertCircle, Clock, Smartphone,
  MessageSquare, Terminal, Zap, Filter, Search, Eye, X, Phone,
  Send, Image as ImageIcon, Mic, FileText, Lock, Unlock, Play,
  Pause, ShieldAlert, BarChart3, Users, ArrowLeft, Check, CheckCheck,
  Bell, BellRing, Camera, StopCircle, Upload, Trash2
} from 'lucide-react';

export default function WhatsAppAIDashboard() {
  const [activeSubTab, setActiveSubTab] = useState('inbox'); // 'inbox' | 'logs'

  // --- INBOX STATE ---
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inboxSearch, setInboxSearch] = useState('');
  const [replyType, setReplyType] = useState('text'); // 'text' | 'image' | 'audio' | 'template'
  const [replyText, setReplyText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('combo_offer_reengage');
  const [sendingReply, setSendingReply] = useState(false);
  const messagesEndRef = useRef(null);

  // --- NOTIFICATIONS STATE ---
  const [notifEnabled, setNotifEnabled] = useState(false);
  const lastMsgTimestampRef = useRef(0);

  // --- CAMERA & VOICE RECORDING STATE ---
  const [mediaPreviewBase64, setMediaPreviewBase64] = useState(null);
  const [mediaPreviewType, setMediaPreviewType] = useState(null); // 'image' | 'audio'
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // --- LOGS & ANALYTICS STATE ---
  const [executions, setExecutions] = useState([]);
  const [stats, setStats] = useState({
    total_count: 0,
    success_count: 0,
    error_count: 0,
    ignored_count: 0,
    avg_duration: 0
  });
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

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
  const enableNotifications = async () => {
    playAlertBeep();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([100, 50, 100]); } catch (_) {}
    }
    if (!('Notification' in window)) {
      alert('This browser does not support desktop/mobile notifications, but audible beep alerts are now active!');
      setNotifEnabled(true);
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      setNotifEnabled(true);
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(reg => reg.showNotification('11FIT AI Command Center', {
            body: '🔔 Push notifications & beep alerts enabled!'
          })).catch(() => {
            new Notification('11FIT AI Command Center', {
              body: '🔔 Push notifications & beep alerts enabled!'
            });
          });
        } else {
          new Notification('11FIT AI Command Center', {
            body: '🔔 Push notifications & beep alerts enabled!'
          });
        }
      } catch (_) {}
    } else {
      alert('Notification permission denied by browser, but audible beep alerts will still play!');
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
          if (lastMsgTimestampRef.current > 0 && newestTime > lastMsgTimestampRef.current && newest.last_role === 'user') {
            triggerAlertNotification(
              `💬 New WhatsApp from ${newest.phone}`,
              newest.last_message
            );
          }
          lastMsgTimestampRef.current = newestTime;
        }

        setChats(loadedChats);
        if (selectedChat) {
          const updated = loadedChats.find(c => c.phone === selectedChat.phone);
          if (updated) setSelectedChat(updated);
        }
      }
    } catch (err) {
      console.error('Failed to fetch chats:', err);
    } finally {
      if (!isQuiet) setLoadingChats(false);
    }
  };

  const fetchMessages = async (phone, isQuiet = false) => {
    if (!phone) return;
    if (!isQuiet) setLoadingMessages(true);
    try {
      const res = await fetch(`/api/whatsapp-inbox?action=messages&phone=${encodeURIComponent(phone)}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      if (!isQuiet) setLoadingMessages(false);
    }
  };

  const fetchExecutions = async (isQuiet = false) => {
    if (!isQuiet) setLoadingLogs(true);
    try {
      const res = await fetch('/api/whatsapp-executions');
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

  useEffect(() => {
    fetchChats(false);
    fetchExecutions(false);
    const interval = setInterval(() => {
      fetchChats(true);
      fetchExecutions(true);
      if (selectedChat?.phone && activeSubTab === 'inbox') {
        fetchMessages(selectedChat.phone, true); // Silent update without screen jumping
      }
    }, 7000);
    return () => clearInterval(interval);
  }, [activeSubTab, selectedChat?.phone]);

  useEffect(() => {
    if (selectedChat?.phone) {
      fetchMessages(selectedChat.phone, false); // Only spin on chat change
    }
  }, [selectedChat?.phone]);

  useLayoutEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'instant', block: 'end' });
    }
  }, [messages, selectedChat?.phone]);

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
    try {
      const res = await fetch('/api/whatsapp-inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_ai',
          phone: chat.phone,
          ai_paused: newPausedState
        })
      });
      if (res.ok) {
        setChats(prev => prev.map(c => c.phone === chat.phone ? { ...c, ai_paused: newPausedState } : c));
        if (selectedChat?.phone === chat.phone) {
          setSelectedChat(prev => ({ ...prev, ai_paused: newPausedState }));
        }
      }
    } catch (err) {
      console.error('Failed to toggle AI state:', err);
    }
  };

  const handleSendManualReply = async (e) => {
    e.preventDefault();
    if (!selectedChat?.phone || sendingReply) return;

    // A. Direct Media Upload via Meta API (if photo or voice note was captured)
    if (mediaPreviewBase64) {
      setSendingReply(true);
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
          await fetchMessages(selectedChat.phone, true);
        } else {
          const errData = await res.json();
          alert(`Error uploading media: ${errData.error || 'Failed'}`);
        }
      } catch (err) {
        alert('Network error uploading photo/audio');
      } finally {
        setSendingReply(false);
      }
      return;
    }

    // B. Standard Text / URL / Template Send
    if (replyType === 'text' && !replyText.trim()) return;
    if ((replyType === 'image' || replyType === 'audio') && !mediaUrl.trim()) return;

    setSendingReply(true);
    try {
      const res = await fetch('/api/whatsapp-inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_message',
          phone: selectedChat.phone,
          type: replyType,
          text: replyText,
          media_url: mediaUrl,
          template_name: selectedTemplate
        })
      });
      if (res.ok) {
        setReplyText('');
        setMediaUrl('');
        await fetchMessages(selectedChat.phone, true);
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error || 'Failed to send message'}`);
      }
    } catch (err) {
      console.error('Failed to send reply:', err);
      alert('Network error sending reply');
    } finally {
      setSendingReply(false);
    }
  };

  const filteredChats = chats.filter(c =>
    !inboxSearch ||
    c.phone?.toLowerCase().includes(inboxSearch.toLowerCase()) ||
    c.last_message?.toLowerCase().includes(inboxSearch.toLowerCase())
  );

  const formatPhone = (p) => {
    if (!p) return 'N/A';
    return p.startsWith('+') ? p : `+${p}`;
  };

  const templatesList = [
    { id: 'combo_offer_reengage', label: '🛍️ Combo Offer Re-engagement' },
    { id: 'order_update_notification', label: '📦 Order Status Notification' },
    { id: 'abandoned_cart_reminder', label: '🛒 Abandoned Cart Recovery' },
    { id: 'support_ticket_update', label: '💬 Support Assistance Update' }
  ];

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
          {textWithoutId && <p className="text-sm whitespace-pre-wrap">{textWithoutId}</p>}
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
          {textWithoutId && <p className="text-sm whitespace-pre-wrap">{textWithoutId}</p>}
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
          {textWithoutId && <p className="text-sm whitespace-pre-wrap">{textWithoutId}</p>}
        </div>
      );
    }

    return <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{content}</p>;
  };

  const status24h = get24HourStatus(selectedChat);

  return (
    <div className="space-y-6">
      {/* COMPACT TOP SUB-TAB & ALERTS NAV BAR */}
      <div className="flex items-center justify-between gap-3 bg-slate-900/80 px-3.5 py-2.5 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveSubTab('inbox')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'inbox'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Inbox ({chats.length})
          </button>
          <button
            onClick={() => setActiveSubTab('logs')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'logs'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            AI Charts & Logs
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
{/* ========================================================= */}
      {/* TAB 1: LIVE CHAT INBOX & MANUAL TAKEOVER                  */}
      {/* ========================================================= */}
      {activeSubTab === 'inbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[720px]">
          {/* LEFT PANE: CHAT LIST */}
          <div className={`lg:col-span-4 bg-slate-900/90 rounded-2xl border border-slate-800 flex-col overflow-hidden shadow-xl ${selectedChat ? 'hidden lg:flex' : 'flex'}`}>
            <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Customer Chats
              </h3>
              <button
                onClick={() => fetchChats(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="Refresh chats"
              >
                <RefreshCw className={`w-4 h-4 ${loadingChats ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* SEARCH BOX */}
            <div className="p-3 border-b border-slate-800 bg-slate-950/30">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search phone or message..."
                  value={inboxSearch}
                  onChange={(e) => setInboxSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
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
                          <span className="font-bold text-sm text-white truncate">
                            {formatPhone(chat.phone)}
                          </span>
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
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <Unlock className="w-3 h-3" />
                              24h Open
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Lock className="w-3 h-3" />
                              24h Locked
                            </span>
                          )}

                          {chat.ai_paused ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <Pause className="w-3 h-3" />
                              AI Paused
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              <Play className="w-3 h-3" />
                              AI Auto
                            </span>
                          )}
                        </div>
                      </div>

                      <a
                        href={`tel:+${chat.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        title={`Call ${formatPhone(chat.phone)} directly from mobile`}
                        className="p-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white transition-all shadow-md shrink-0"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT PANE: WHATSAPP-STYLE DARK CONVERSATION VIEW */}
          <div className={`lg:col-span-8 bg-[#0b141a] rounded-2xl border border-slate-800 flex-col overflow-hidden shadow-2xl ${selectedChat ? 'flex' : 'hidden lg:flex'}`}>
            {selectedChat ? (
              <>
                {/* COMPACT 1-ROW CHAT HEADER & CONTROLS */}
                <div className="py-2 px-3 border-b border-slate-800 bg-[#202c33] flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => setSelectedChat(null)}
                      className="lg:hidden p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors shrink-0"
                      title="Back to Customer List"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-1.5 truncate">
                      <h4 className="font-bold text-white text-sm truncate">
                        {formatPhone(selectedChat.phone)}
                      </h4>
                      <a
                        href={`tel:+${selectedChat.phone}`}
                        className="p-1 rounded-md bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white transition-all shrink-0"
                        title="Call Customer"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Compact 24H countdown pill */}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold border ${
                        status24h.isOpen
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-950/80 text-amber-300 border-amber-500/30'
                      }`}
                      title={status24h.text}
                    >
                      {status24h.isOpen ? (
                        <Unlock className="w-3 h-3 text-emerald-400 shrink-0" />
                      ) : (
                        <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                      )}
                      <span className="hidden sm:inline">{status24h.isOpen ? '24H Open' : 'Closed'}</span>
                    </span>

                    {/* AI auto-reply toggle */}
                    <button
                      onClick={() => handleToggleAIPause(selectedChat)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all shadow-md ${
                        selectedChat.ai_paused
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500 hover:text-white'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white'
                      }`}
                    >
                      {selectedChat.ai_paused ? (
                        <>
                          <Pause className="w-3 h-3" />
                          <span>AI PAUSED</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3" />
                          <span>AI ACTIVE</span>
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
                      return (
                        <div
                          key={msg.id || i}
                          className={`flex ${isAI ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[92%] sm:max-w-[78%] rounded-xl px-3.5 py-2.5 shadow-md relative ${
                              isAI
                                ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none'
                                : 'bg-[#202c33] text-[#e9edef] rounded-tl-none border border-[#2a3942]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4 mb-1">
                              <span className="text-[10px] font-bold opacity-75 uppercase text-emerald-300">
                                {isAI ? '11FIT Assistant / Manual' : formatPhone(msg.phone)}
                              </span>
                            </div>
                            <div className="my-0.5">
                              {renderMessageContent(msg.content)}
                            </div>
                            <div className="flex items-center justify-end gap-1 mt-1 opacity-70">
                              <span className="text-[10px]">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {isAI && (
                                <CheckCheck className="w-3.5 h-3.5 text-blue-400" title="Delivered & Read" />
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
                <form onSubmit={handleSendManualReply} className="p-4 border-t border-slate-800 bg-[#202c33] space-y-3">
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
                    </div>
                  </div>

                  {/* INPUT FIELDS BASED ON TYPE */}
                  {replyType === 'template' ? (
                    <div className="flex items-center gap-3">
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
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {sendingReply ? 'Sending...' : 'Send Template'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={
                          !status24h.isOpen
                            ? '⚠️ Meta 24H Window closed — Use Template to reply.'
                            : mediaPreviewType === 'image'
                            ? 'Photo caption (optional)...'
                            : mediaPreviewType === 'audio'
                            ? 'Ready to send audio message...'
                            : 'Type manual WhatsApp reply...'
                        }
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        disabled={!status24h.isOpen && !mediaPreviewBase64}
                        className="flex-1 bg-[#0b141a] border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={sendingReply || (!status24h.isOpen && !mediaPreviewBase64 && replyType === 'text')}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 shrink-0"
                      >
                        <Send className="w-4 h-4" />
                        {sendingReply ? 'Sending...' : (mediaPreviewBase64 ? 'Send Media' : 'Send')}
                      </button>
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
    </div>
  );
}
