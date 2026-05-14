import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { LiveAuctionSession } from '../services/liveClerkService';
import { CloudflareStreamService } from '../services/cloudflareStreamService';
import {
  Video, VideoOff, Mic, MicOff, Monitor, Camera,
  Wifi, WifiOff, Loader, AlertTriangle, Settings,
  ChevronDown, Copy, Check, ExternalLink, Plus, Trash2
} from 'lucide-react';

type SetupState = 'loading' | 'no-stream' | 'creating' | 'ready';
type BroadcastState = 'idle' | 'connecting' | 'live' | 'error';

interface MediaDeviceInfo2 {
  deviceId: string;
  label: string;
}

export default function AuctioneerBroadcastPage() {
  const eventId = (() => {
    const match = window.location.pathname.match(/\/broadcast\/([^/]+)/);
    return match ? match[1] : null;
  })();

  const [session, setSession] = useState<LiveAuctionSession | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [setupState, setSetupState] = useState<SetupState>('loading');
  const [broadcastState, setBroadcastState] = useState<BroadcastState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [videoMuted, setVideoMuted] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [sourceMode, setSourceMode] = useState<'camera' | 'screen'>('camera');
  const [showDevices, setShowDevices] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo2[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo2[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [cfStatus, setCfStatus] = useState<string>('idle');
  const [resolution, setResolution] = useState('');
  const [viewerUrl, setViewerUrl] = useState('');

  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cfPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<LiveAuctionSession | null>(null);

  useEffect(() => {
    if (!eventId) return;
    init();
  }, [eventId]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Realtime session updates
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase!
      .channel(`broadcast_page_${eventId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_auction_sessions',
        filter: `event_id=eq.${eventId}`,
      }, (payload) => {
        const updated = payload.new as LiveAuctionSession;
        setSession(updated);
        if (updated.cf_stream_uid && setupState === 'no-stream') {
          setSetupState('ready');
        }
      })
      .subscribe();
    return () => { supabase?.removeChannel(channel); };
  }, [eventId, setupState]);

  useEffect(() => {
    return () => {
      stopBroadcast();
      if (cfPollRef.current) clearInterval(cfPollRef.current);
    };
  }, []);

  const init = async () => {
    try {
      const [eventRes, sessionRes] = await Promise.all([
        supabase!.from('auction_events').select('title').eq('id', eventId!).maybeSingle(),
        supabase!.from('live_auction_sessions').select('*').eq('event_id', eventId!).neq('status', 'ended').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      if (eventRes.data) setEventTitle(eventRes.data.title);

      const sess = sessionRes.data as LiveAuctionSession | null;
      setSession(sess);

      if (sess?.cf_stream_uid) {
        setSetupState('ready');
        setCfStatus(sess.cf_stream_status || 'idle');
        setViewerUrl(`${window.location.origin}/stream/${eventId}`);
        startCfPolling(sess.cf_stream_uid);
      } else {
        setSetupState('no-stream');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load event');
      setSetupState('no-stream');
    }

    enumerateDevices();
  };

  const enumerateDevices = async () => {
    try {
      // Request permission first so labels are populated
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
      const devices = await navigator.mediaDevices.enumerateDevices();
      const vd = devices.filter(d => d.kind === 'videoinput').map(d => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 6)}` }));
      const ad = devices.filter(d => d.kind === 'audioinput').map(d => ({ deviceId: d.deviceId, label: d.label || `Mic ${d.deviceId.slice(0, 6)}` }));
      setVideoDevices(vd);
      setAudioDevices(ad);
      if (vd.length) setSelectedVideoDevice(vd[0].deviceId);
      if (ad.length) setSelectedAudioDevice(ad[0].deviceId);
    } catch {}
  };

  const handleCreateStream = async () => {
    setSetupState('creating');
    setErrorMsg('');
    try {
      // Ensure session exists first
      let sess = sessionRef.current;
      if (!sess) {
        const { data, error } = await supabase!
          .from('live_auction_sessions')
          .insert({ event_id: eventId, status: 'idle', current_lot_index: 0, current_bid: 0, asking_price: 0 })
          .select()
          .single();
        if (error) throw error;
        sess = data as LiveAuctionSession;
        setSession(sess);
      }

      await CloudflareStreamService.createStream(eventId!, eventTitle || `Event ${eventId}`);

      // Fetch refreshed session with stream fields
      const { data: updated } = await supabase!
        .from('live_auction_sessions')
        .select('*')
        .eq('id', sess.id)
        .single();

      if (updated) {
        setSession(updated as LiveAuctionSession);
        setCfStatus('idle');
        setViewerUrl(`${window.location.origin}/stream/${eventId}`);
        startCfPolling((updated as LiveAuctionSession).cf_stream_uid!);
      }

      setSetupState('ready');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create stream');
      setSetupState('no-stream');
    }
  };

  const handleDeleteStream = async () => {
    const sess = sessionRef.current;
    if (!sess?.cf_stream_uid) return;
    if (!window.confirm('Delete this stream? The live input will be removed from Cloudflare.')) return;

    if (cfPollRef.current) clearInterval(cfPollRef.current);
    stopBroadcast();

    try {
      await CloudflareStreamService.deleteStream(sess.cf_stream_uid);
      await supabase!.from('live_auction_sessions').update({
        cf_stream_uid: null,
        cf_stream_whip_url: null,
        cf_stream_playback_url: null,
        cf_stream_status: 'idle',
        updated_at: new Date().toISOString(),
      }).eq('id', sess.id);

      setSession(prev => prev ? { ...prev, cf_stream_uid: null, cf_stream_whip_url: null, cf_stream_playback_url: null, cf_stream_status: 'idle' } : prev);
      setCfStatus('idle');
      setSetupState('no-stream');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete stream');
    }
  };

  const startCfPolling = (uid: string) => {
    if (cfPollRef.current) clearInterval(cfPollRef.current);
    const poll = async () => {
      try {
        const status = await CloudflareStreamService.getStreamStatus(uid);
        setCfStatus(status.status);
      } catch {}
    };
    poll();
    cfPollRef.current = setInterval(poll, 8000);
  };

  const getMediaStream = async (): Promise<MediaStream> => {
    if (sourceMode === 'screen') {
      return navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
    }
    return navigator.mediaDevices.getUserMedia({
      video: selectedVideoDevice
        ? { deviceId: { exact: selectedVideoDevice }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: selectedAudioDevice
        ? { deviceId: { exact: selectedAudioDevice }, echoCancellation: true, noiseSuppression: true }
        : { echoCancellation: true, noiseSuppression: true },
    });
  };

  const startBroadcast = async () => {
    const whipUrl = sessionRef.current?.cf_stream_whip_url;
    if (!whipUrl) return;

    setErrorMsg('');
    setBroadcastState('connecting');

    try {
      const mediaStream = await getMediaStream();
      streamRef.current = mediaStream;

      if (previewRef.current) {
        previewRef.current.srcObject = mediaStream;
        previewRef.current.play().catch(() => {});
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
        bundlePolicy: 'max-bundle',
      });
      pcRef.current = pc;

      for (const track of mediaStream.getTracks()) {
        pc.addTransceiver(track, { direction: 'sendonly' });
      }

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === 'connected') {
          setBroadcastState('live');
          startStatsPolling(pc);
        } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          if (broadcastState !== 'idle') {
            setErrorMsg('Connection lost. Click Go Live to reconnect.');
            setBroadcastState('error');
          }
          stopStatsPolling();
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await new Promise<void>(resolve => {
        if (pc.iceGatheringState === 'complete') { resolve(); return; }
        pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === 'complete') resolve(); };
        setTimeout(resolve, 4000);
      });

      const res = await fetch(whipUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription!.sdp,
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`WHIP ${res.status}: ${body.slice(0, 200)}`);
      }

      await pc.setRemoteDescription({ type: 'answer', sdp: await res.text() });

    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start broadcast');
      setBroadcastState('error');
      stopBroadcast();
    }
  };

  const stopBroadcast = useCallback(() => {
    stopStatsPolling();
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (previewRef.current) { previewRef.current.srcObject = null; }
    setBroadcastState('idle');
    setResolution('');
  }, []);

  const startStatsPolling = (pc: RTCPeerConnection) => {
    statsIntervalRef.current = setInterval(async () => {
      try {
        const reports = await pc.getStats();
        reports.forEach(r => {
          if (r.type === 'outbound-rtp' && r.kind === 'video' && r.frameWidth) {
            setResolution(`${r.frameWidth}×${r.frameHeight}`);
          }
        });
      } catch {}
    }, 3000);
  };

  const stopStatsPolling = () => {
    if (statsIntervalRef.current) { clearInterval(statsIntervalRef.current); statsIntervalRef.current = null; }
  };

  const toggleVideo = () => {
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = videoMuted; });
    setVideoMuted(v => !v);
  };

  const toggleAudio = () => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = audioMuted; });
    setAudioMuted(a => !a);
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {}
  };

  const isLive = broadcastState === 'live';
  const cfIsConnected = cfStatus === 'connected';

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col text-white">

      {/* Header */}
      <div className="flex-shrink-0 bg-zinc-900 border-b border-zinc-800 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/ironbound_primarylogog.png" alt="IronBound" className="h-7 object-contain" />
          <div>
            <h1 className="text-white text-sm font-bold leading-tight">{eventTitle || 'Broadcast Studio'}</h1>
            <p className="text-zinc-500 text-xs">Live Stream Control</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {viewerUrl && (
            <button
              onClick={() => window.open(viewerUrl, '_blank', 'noopener,noreferrer')}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Viewer Page
            </button>
          )}
          <div className="flex items-center gap-1.5">
            {isLive ? (
              <span className="flex items-center gap-1.5 text-xs text-red-400 font-bold">
                <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" /></span>
                ON AIR
              </span>
            ) : broadcastState === 'connecting' ? (
              <span className="flex items-center gap-1.5 text-xs text-yellow-400"><Loader className="h-3.5 w-3.5 animate-spin" /> Connecting...</span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-zinc-500"><WifiOff className="h-3.5 w-3.5" /> Off air</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* ── Left: video preview ── */}
        <div className="flex-1 relative bg-black flex items-center justify-center min-h-[260px]">
          <video
            ref={previewRef}
            className={`w-full h-full object-contain transition-opacity duration-500 ${isLive || broadcastState === 'connecting' ? 'opacity-100' : 'opacity-0'}`}
            autoPlay playsInline muted
          />

          {!isLive && broadcastState !== 'connecting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Camera className="h-14 w-14 text-zinc-800 mb-3" />
              <p className="text-zinc-600 text-sm">Preview will appear here</p>
            </div>
          )}

          {broadcastState === 'connecting' && !isLive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
              <Loader className="h-10 w-10 text-orange-500 animate-spin mb-3" />
              <p className="text-white text-sm font-semibold">Connecting to stream...</p>
            </div>
          )}

          {/* Overlays when live */}
          {isLive && (
            <>
              <div className="absolute top-3 left-3 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded">LIVE</div>
              {resolution && (
                <div className="absolute top-3 right-3 bg-black/60 text-zinc-300 text-xs font-mono px-2 py-1 rounded">{resolution}</div>
              )}
              {cfIsConnected && (
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/60 text-green-400 text-xs px-2 py-1 rounded">
                  <Wifi className="h-3 w-3" /> Cloudflare receiving
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right: controls ── */}
        <div className="flex-shrink-0 lg:w-80 bg-zinc-900 border-t lg:border-t-0 lg:border-l border-zinc-800 flex flex-col overflow-y-auto">

          {/* Stream setup section */}
          <div className="p-5 border-b border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-200">Stream Setup</h2>
              {setupState === 'ready' && session?.cf_stream_uid && (
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${cfIsConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <span className="text-xs text-zinc-400">{cfIsConnected ? 'Receiving' : 'Ready'}</span>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="mb-3 bg-red-950 border border-red-800 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-xs leading-relaxed">{errorMsg}</p>
              </div>
            )}

            {(setupState === 'loading') && (
              <div className="flex items-center gap-2 py-2">
                <Loader className="h-4 w-4 text-zinc-500 animate-spin" />
                <span className="text-xs text-zinc-500">Loading...</span>
              </div>
            )}

            {setupState === 'no-stream' && (
              <div className="space-y-3">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  No live stream configured for this event yet. Create one to get your WHIP broadcast URL and start streaming.
                </p>
                <button
                  onClick={handleCreateStream}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Create Stream
                </button>
              </div>
            )}

            {setupState === 'creating' && (
              <div className="flex items-center gap-2.5 py-2">
                <Loader className="h-4 w-4 text-orange-400 animate-spin" />
                <span className="text-sm text-zinc-300">Creating Cloudflare live input...</span>
              </div>
            )}

            {setupState === 'ready' && session?.cf_stream_whip_url && (
              <div className="space-y-3">
                {/* WHIP URL */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-zinc-500 uppercase tracking-wider">WHIP URL (OBS / broadcast apps)</span>
                    <button
                      onClick={() => copyToClipboard(session.cf_stream_whip_url!, 'whip')}
                      className="text-zinc-400 hover:text-white transition-colors"
                      title="Copy"
                    >
                      {copiedKey === 'whip' ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <div className="bg-zinc-800 rounded-lg px-3 py-2">
                    <p className="text-xs text-zinc-300 font-mono break-all leading-relaxed">{session.cf_stream_whip_url}</p>
                  </div>
                </div>

                {/* Viewer URL */}
                {viewerUrl && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-500 uppercase tracking-wider">Viewer URL (share with bidders)</span>
                      <button
                        onClick={() => copyToClipboard(viewerUrl, 'viewer')}
                        className="text-zinc-400 hover:text-white transition-colors"
                        title="Copy"
                      >
                        {copiedKey === 'viewer' ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <div className="bg-zinc-800 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-zinc-300 font-mono truncate">{viewerUrl}</p>
                      <button onClick={() => window.open(viewerUrl, '_blank', 'noopener,noreferrer')} className="text-zinc-500 hover:text-white flex-shrink-0 transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleDeleteStream}
                  className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove stream
                </button>
              </div>
            )}
          </div>

          {/* Browser broadcast section */}
          {setupState === 'ready' && (
            <div className="p-5 flex flex-col gap-4 flex-1">
              <h2 className="text-sm font-semibold text-zinc-200">Browser Broadcast</h2>

              {/* Source */}
              {broadcastState === 'idle' && (
                <>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Source</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(['camera', 'screen'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => setSourceMode(mode)}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-colors ${
                            sourceMode === mode
                              ? 'bg-orange-500/15 border-orange-500 text-orange-300'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                          }`}
                        >
                          {mode === 'camera' ? <Camera className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
                          {mode === 'camera' ? 'Camera' : 'Screen'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {sourceMode === 'camera' && (
                    <div>
                      <button
                        onClick={() => setShowDevices(v => !v)}
                        className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        Device settings
                        <ChevronDown className={`h-3 w-3 transition-transform ${showDevices ? 'rotate-180' : ''}`} />
                      </button>

                      {showDevices && (
                        <div className="mt-3 space-y-2.5">
                          {videoDevices.length > 0 && (
                            <div>
                              <label className="text-xs text-zinc-500 block mb-1">Camera</label>
                              <select
                                value={selectedVideoDevice}
                                onChange={e => setSelectedVideoDevice(e.target.value)}
                                className="w-full bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-orange-500"
                              >
                                {videoDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
                              </select>
                            </div>
                          )}
                          {audioDevices.length > 0 && (
                            <div>
                              <label className="text-xs text-zinc-500 block mb-1">Microphone</label>
                              <select
                                value={selectedAudioDevice}
                                onChange={e => setSelectedAudioDevice(e.target.value)}
                                className="w-full bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-orange-500"
                              >
                                {audioDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Go live / live controls */}
              <div className="mt-auto space-y-2">
                {(broadcastState === 'idle' || broadcastState === 'error') && (
                  <button
                    onClick={startBroadcast}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-sm rounded-lg transition-colors"
                  >
                    <Wifi className="h-4 w-4" />
                    Go Live
                  </button>
                )}

                {broadcastState === 'connecting' && (
                  <button disabled className="w-full flex items-center justify-center gap-2 py-3 bg-yellow-700 text-white font-bold text-sm rounded-lg cursor-not-allowed">
                    <Loader className="h-4 w-4 animate-spin" /> Connecting...
                  </button>
                )}

                {isLive && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={toggleVideo}
                        className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                          videoMuted ? 'bg-red-950 border-red-800 text-red-300' : 'bg-zinc-800 border-zinc-700 text-white hover:border-zinc-600'
                        }`}
                      >
                        {videoMuted ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                        {videoMuted ? 'Off' : 'Video'}
                      </button>
                      <button
                        onClick={toggleAudio}
                        className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                          audioMuted ? 'bg-red-950 border-red-800 text-red-300' : 'bg-zinc-800 border-zinc-700 text-white hover:border-zinc-600'
                        }`}
                      >
                        {audioMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        {audioMuted ? 'Muted' : 'Mic'}
                      </button>
                    </div>
                    <button
                      onClick={stopBroadcast}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-medium text-sm rounded-lg transition-colors"
                    >
                      <WifiOff className="h-4 w-4" /> Stop Broadcast
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
