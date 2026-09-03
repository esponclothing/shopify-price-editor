import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, PhoneOff, User, PhoneCall } from 'lucide-react';

const SUPABASE_URL = 'https://xkiukbebnntjzfilyfmh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhraXVrYmVibm50anpmaWx5Zm1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMjIxMTgsImV4cCI6MjEwMDc5ODExOH0.NxPKFvFSx3WBLl6yBJNb3v10fGJ2H5bFzJnAcgqQaOs';

// Generate a stable device ID per browser tab
function getDeviceId() {
  let id = sessionStorage.getItem('11fit_device_id');
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('11fit_device_id', id);
  }
  return id;
}

function formatPhone(phone) {
  const s = String(phone || '');
  if (s.startsWith('91') && s.length === 12) return `+91 ${s.slice(2, 7)} ${s.slice(7)}`;
  return `+${s}`;
}

let ringAudioCtx = null;
let ringOsc = null;
let ringGain = null;

function startRinging() {
  try {
    ringAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    ringOsc = ringAudioCtx.createOscillator();
    ringGain = ringAudioCtx.createGain();
    ringOsc.type = 'sine';
    const playPattern = (t) => {
      ringOsc.frequency.setValueAtTime(440, t);
      ringGain.gain.setValueAtTime(0.3, t);
      ringGain.gain.setValueAtTime(0.3, t + 0.8);
      ringGain.gain.setValueAtTime(0, t + 0.9);
      ringGain.gain.setValueAtTime(0, t + 1.5);
      ringOsc.frequency.setValueAtTime(480, t + 1.5);
      ringGain.gain.setValueAtTime(0.3, t + 1.5);
      ringGain.gain.setValueAtTime(0.3, t + 2.3);
      ringGain.gain.setValueAtTime(0, t + 2.4);
      ringGain.gain.setValueAtTime(0, t + 3.5);
    };
    for (let i = 0; i < 10; i++) playPattern(ringAudioCtx.currentTime + i * 3.5);
    ringOsc.connect(ringGain);
    ringGain.connect(ringAudioCtx.destination);
    ringOsc.start();
  } catch (_) {}
}

function stopRinging() {
  try { ringOsc?.stop(); } catch (_) {}
  try { ringAudioCtx?.close(); } catch (_) {}
  ringOsc = null; ringGain = null; ringAudioCtx = null;
}

export default function IncomingCallOverlay({ onCallAnswered, onCallEnded }) {
  const [incomingCall, setIncomingCall] = useState(null); // { id, phone, customer_name, sdp_offer, started_at }
  const [callState, setCallState] = useState('idle'); // idle | ringing | answering | active | ended
  const [callDuration, setCallDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const deviceId = useRef(getDeviceId());
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const callTimerRef = useRef(null);
  const ringTimeoutRef = useRef(null);
  const pollRef = useRef(null);
  const ignoreCallIdRef = useRef(null);

  // Poll for ringing calls (fallback since Supabase Realtime needs client lib)
  const pollRingingCalls = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp-calling?action=ringing');
      if (!res.ok) return;
      const data = await res.json();
      const calls = data.calls || [];
      if (calls.length > 0) {
        const call = calls[0];
        // Don't show if already showing this call or a different call is active
        if (callState === 'active' || callState === 'answering') return;
        if (incomingCall?.id === call.id) return;
        if (ignoreCallIdRef.current === call.id) return; // Prevent re-ringing of just-ended call
        
        setIncomingCall(call);
        setCallState('ringing');
        startRinging();
        // Auto-miss after 30 seconds
        ringTimeoutRef.current = setTimeout(() => {
          handleMiss(call.id);
        }, 30000);
      } else {
        // If we were ringing and call disappeared (answered elsewhere), dismiss
        if (callState === 'ringing' && incomingCall) {
          stopRinging();
          clearTimeout(ringTimeoutRef.current);
          setCallState('idle');
          setIncomingCall(null);
        }
      }
    } catch (_) {}
  }, [callState, incomingCall]);

  useEffect(() => {
    pollRef.current = setInterval(pollRingingCalls, 2000);
    return () => clearInterval(pollRef.current);
  }, [pollRingingCalls]);

  const handleMiss = async (callId) => {
    stopRinging();
    clearTimeout(ringTimeoutRef.current);
    setCallState('idle');
    setIncomingCall(null);
    try {
      await fetch('/api/whatsapp-calling?action=missed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId || incomingCall?.id })
      });
    } catch (_) {}
  };

  const handleDecline = async () => {
    stopRinging();
    clearTimeout(ringTimeoutRef.current);
    const cid = incomingCall?.id;
    ignoreCallIdRef.current = cid;
    setCallState('idle');
    setIncomingCall(null);
    try {
      await fetch('/api/whatsapp-calling?action=decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: cid })
      });
    } catch (_) {}
  };

  const handleAnswer = async () => {
    if (!incomingCall) return;
    stopRinging();
    clearTimeout(ringTimeoutRef.current);
    setCallState('answering');
    setErrorMsg('');

    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      // Create WebRTC peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      peerRef.current = pc;

      // Add local audio track
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Handle remote audio
      const remoteAudio = new Audio();
      remoteAudio.autoplay = true;
      pc.ontrack = (event) => {
        remoteAudio.srcObject = event.streams[0];
      };

      // Set SDP offer from Meta (if we have it)
      if (incomingCall.sdp_offer) {
        await pc.setRemoteDescription(new RTCSessionDescription({
          type: 'offer',
          sdp: incomingCall.sdp_offer
        }));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Wait for ICE gathering
        await new Promise((resolve) => {
          if (pc.iceGatheringState === 'complete') { resolve(); return; }
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') resolve();
          };
          setTimeout(resolve, 3000); // Safety timeout
        });

        // Fix SDP formatting for Meta (strict uppercase fingerprint validation)
        let finalSdp = pc.localDescription.sdp;
        finalSdp = finalSdp.replace(/(a=fingerprint:sha-256\s+)([a-fA-F0-9:]+)/g, (match, prefix, hex) => {
          return prefix + hex.toUpperCase();
        });

        // Send answer to backend → Meta
        const res = await fetch('/api/whatsapp-calling?action=answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            call_id: incomingCall.id,
            sdp_answer: finalSdp,
            device_id: deviceId.current
          })
        });

        const answerData = await res.json();
        if (!res.ok) {
          if (res.status === 409) {
            setErrorMsg('Already answered on another device');
            setCallState('idle');
            setIncomingCall(null);
            stream.getTracks().forEach(t => t.stop());
            pc.close();
            return;
          }
          throw new Error(answerData.error || 'Failed to answer');
        }
      } else {
        // No SDP offer available — answer via API only (phone rings on device)
        const res = await fetch('/api/whatsapp-calling?action=answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            call_id: incomingCall.id,
            sdp_answer: 'no_sdp',
            device_id: deviceId.current
          })
        });
        const answerData = await res.json();
        if (!res.ok) {
          if (res.status === 409) {
            setErrorMsg('Already answered on another device');
            setCallState('idle');
            setIncomingCall(null);
            stream.getTracks().forEach(t => t.stop());
            return;
          }
          throw new Error(answerData.error || 'Failed to answer');
        }
      }

      setCallState('active');
      if (onCallAnswered) onCallAnswered(incomingCall);

      // Start call duration timer
      const startedAt = Date.now();
      callTimerRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - startedAt) / 1000));
      }, 1000);

    } catch (err) {
      console.error('Answer error:', err);
      setErrorMsg(err.message || 'Failed to answer call');
      
      // If the API error implies the call is already gone, or we just failed to connect,
      // we shouldn't keep ringing. We'll show the error briefly then close.
      setTimeout(() => {
        setCallState('idle');
        setIncomingCall(null);
        setErrorMsg('');
      }, 3000);
      
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      peerRef.current?.close();
    }
  };

  const handleHangup = async () => {
    clearInterval(callTimerRef.current);
    const dur = callDuration;
    const cid = incomingCall?.id;
    ignoreCallIdRef.current = cid;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current = null;
    setCallState('idle');
    setIncomingCall(null);
    setCallDuration(0);
    if (onCallEnded) onCallEnded(cid, dur);
    try {
      await fetch('/api/whatsapp-calling?action=end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: cid, duration_seconds: dur })
      });
    } catch (_) {}
  };

  if (callState === 'idle') return null;

  const fmtDuration = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-80 select-none" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className={`relative bg-[#0F172A] border rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 ${
        callState === 'ringing' ? 'border-emerald-500/60 shadow-emerald-500/20' : 
        callState === 'active' ? 'border-emerald-400/40 shadow-emerald-400/15' : 
        'border-slate-300 dark:border-slate-700'
      }`}
        style={{ boxShadow: callState === 'ringing' ? '0 0 40px rgba(16,185,129,0.25), 0 20px 60px rgba(0,0,0,0.8)' : '0 20px 60px rgba(0,0,0,0.8)' }}
      >
        {/* Animated ring glow for ringing state */}
        {callState === 'ringing' && (
          <div className="absolute inset-0 rounded-3xl animate-pulse pointer-events-none" 
            style={{ background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.08) 0%, transparent 70%)' }} />
        )}

        <div className="p-5">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              callState === 'active' ? 'bg-emerald-500/20' : 'bg-emerald-500/15 animate-pulse'
            }`}>
              {callState === 'active' 
                ? <PhoneCall className="w-6 h-6 text-emerald-400" />
                : <Phone className="w-6 h-6 text-emerald-400" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-0.5">
                {callState === 'ringing' ? '📲 Incoming WhatsApp Call' :
                 callState === 'answering' ? '⏳ Connecting...' :
                 callState === 'active' ? '🟢 Call Active' : 'Call'}
              </p>
              <p className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                {incomingCall?.customer_name || formatPhone(incomingCall?.phone)}
              </p>
              {incomingCall?.customer_name && (
                <p className="text-xs text-slate-600 dark:text-slate-400">{formatPhone(incomingCall.phone)}</p>
              )}
            </div>
            {callState === 'active' && (
              <div className="shrink-0 text-right">
                <p className="text-lg font-black text-emerald-400 tabular-nums">{fmtDuration(callDuration)}</p>
              </div>
            )}
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="mb-3 px-3 py-2 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-400 font-semibold">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {/* Decline / Hang up */}
            <button
              onClick={callState === 'active' ? handleHangup : handleDecline}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 font-bold text-sm transition-all active:scale-95"
            >
              <PhoneOff className="w-4 h-4" />
              {callState === 'active' ? 'Hang Up' : 'Decline'}
            </button>

            {/* Answer button (only when ringing) */}
            {(callState === 'ringing' || callState === 'answering') && (
              <button
                onClick={handleAnswer}
                disabled={callState === 'answering'}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/40 text-white font-bold text-sm transition-all active:scale-95 shadow-lg shadow-emerald-500/30"
              >
                <Phone className="w-4 h-4" />
                {callState === 'answering' ? 'Connecting...' : 'Answer'}
              </button>
            )}
          </div>

          {/* Ringing indicator dots */}
          {callState === 'ringing' && (
            <div className="flex justify-center gap-1.5 mt-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
