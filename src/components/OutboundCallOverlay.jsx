import React, { useEffect, useState, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, User, Loader2 } from 'lucide-react';

export default function OutboundCallOverlay({ phone, customerName, onComplete }) {
  const [callState, setCallState] = useState('initializing'); // initializing, calling, ringing, active, ended, failed, declined
  const [errorMsg, setErrorMsg] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [callId, setCallId] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  
  const pcRef = useRef(null);
  const streamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    startOutboundCall();
    return () => {
      cleanupCall();
    };
  }, []);

  useEffect(() => {
    let timerInterval;
    if (callState === 'active') {
      timerInterval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timerInterval);
  }, [callState]);

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const cleanupCall = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
  };

  const startOutboundCall = async () => {
    try {
      setCallState('initializing');
      
      // 1. Get Microphone Access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      // 2. Setup WebRTC Peer Connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      pcRef.current = pc;

      // Add local audio tracks explicitly as sendrecv
      stream.getTracks().forEach(track => {
        pc.addTransceiver(track, { direction: 'sendrecv', streams: [stream] });
      });

      // Handle incoming remote audio track
      pc.ontrack = (event) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play().catch(e => console.error('Audio play error:', e));
        }
      };

      // Detect call disconnection via ICE state
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
          setCallState('ended');
          clearInterval(pollIntervalRef.current);
          cleanupCall();
          setTimeout(() => onComplete(), 2000);
        }
      };

      // 3. Create SDP Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 4. Wait for ICE gathering to complete (Meta needs complete SDP with ICE)
      await new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') resolve();
        else {
          const checkState = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', checkState);
              resolve();
            }
          };
          pc.addEventListener('icegatheringstatechange', checkState);
          // Failsafe timeout after 5s
          setTimeout(resolve, 5000);
        }
      });

      // Fix SDP formatting for Meta (strict uppercase fingerprint validation)
      let finalSdp = pc.localDescription.sdp;
      finalSdp = finalSdp.replace(/(a=fingerprint:sha-256\s+)([a-fA-F0-9:]+)/g, (match, prefix, hex) => {
        return prefix + hex.toUpperCase();
      });

      setCallState('calling');

      // 5. Initiate Call via Backend
      const res = await fetch('/api/whatsapp-calling?action=initiate_outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone,
          sdp_offer: finalSdp
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate call');
      }

      setCallId(data.call_id);
      
      // 6. Start Polling for SDP Answer (or decline/error state)
      startPolling(data.call_id, pc);

    } catch (err) {
      console.error('Outbound call error:', err);
      setErrorMsg(err.message || 'Call failed to connect');
      setCallState('failed');
      setTimeout(() => onComplete(), 3000);
    }
  };

  const startPolling = (cid, pc) => {
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/whatsapp-calling?action=outbound_status&call_id=${cid}&phone=${phone}`);
        const data = await res.json();
        
        if (data.status === 'answered' && data.sdp_answer && pc.signalingState !== 'stable') {
          setCallState('active');
          
          // Apply SDP Answer
          await pc.setRemoteDescription(new RTCSessionDescription({
            type: 'answer',
            sdp: data.sdp_answer
          }));
        } 
        else if (data.status === 'declined' || data.status === 'rejected') {
          clearInterval(pollIntervalRef.current);
          setCallState('declined');
          setErrorMsg('Customer declined the call');
          cleanupCall();
          setTimeout(() => onComplete(), 3000);
        }
        else if (data.status === 'ended') {
          clearInterval(pollIntervalRef.current);
          setCallState('ended');
          cleanupCall();
          setTimeout(() => onComplete(), 2000);
        }
        else if (data.status === 'failed') {
          clearInterval(pollIntervalRef.current);
          setCallState('failed');
          setErrorMsg('Call failed');
          setTimeout(() => onComplete(), 3000);
        }
        else if (data.status === 'ringing') {
          setCallState('ringing');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000); // poll every 2s
  };

  const handleEndCall = async () => {
    setCallState('ended');
    clearInterval(pollIntervalRef.current);
    
    if (callId) {
      try {
        await fetch('/api/whatsapp-calling?action=end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ call_id: callId })
        });
      } catch (_) {}
    }
    
    cleanupCall();
    onComplete();
  };

  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const formatPhone = (p) => {
    const s = String(p).replace(/\D/g, '');
    if (s.startsWith('91') && s.length === 12) return `+91 ${s.slice(2,7)} ${s.slice(7)}`;
    return `+${s}`;
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111a20] border border-[#2a3942] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col relative animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="p-6 pb-4 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 relative">
            <User className="w-10 h-10 text-emerald-400" />
            {(callState === 'calling' || callState === 'ringing' || callState === 'initializing') && (
              <span className="absolute inset-0 border-2 border-emerald-500 rounded-full animate-ping opacity-20"></span>
            )}
          </div>

          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
            {customerName || formatPhone(phone)}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 capitalize">
            {callState === 'initializing' && 'Starting Call...'}
            {callState === 'calling' && 'Connecting...'}
            {callState === 'ringing' && 'Ringing...'}
            {callState === 'active' && formatDuration(callDuration)}
            {callState === 'ended' && 'Call Ended'}
            {callState === 'declined' && 'Call Declined'}
            {callState === 'failed' && 'Call Failed'}
          </p>
          {errorMsg && (
            <p className="text-xs text-rose-400 mt-2 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">
              {errorMsg}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="p-6 pt-4 bg-[#0b141a] flex items-center justify-center gap-6">
          <button 
            onClick={toggleMute}
            disabled={callState !== 'active'}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isMuted ? 'bg-white text-slate-900' : 'bg-[#2a3942] text-white hover:bg-[#3a4952]'
            } disabled:opacity-50`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button 
            onClick={handleEndCall}
            className="w-16 h-16 rounded-full bg-rose-500 flex items-center justify-center text-white hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/20"
          >
            <PhoneOff className="w-7 h-7" />
          </button>

          <button 
            disabled={true}
            className="w-12 h-12 rounded-full flex items-center justify-center bg-[#2a3942] text-slate-900 dark:text-white opacity-50 cursor-not-allowed"
          >
            <Volume2 className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden Audio Player for Remote Stream */}
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      </div>
    </div>
  );
}
