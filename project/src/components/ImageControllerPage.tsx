import React, { useEffect, useState, useRef } from 'react';
import { Monitor, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LiveClerkService, LiveAuctionSession } from '../services/liveClerkService';
import { InventoryService } from '../services/inventoryService';

interface LotData {
  id: string;
  title: string;
  lot_number: string | null;
  images: string[];
}

export default function ImageControllerPage() {
  const eventId = (() => {
    const match = window.location.pathname.match(/\/image-controller\/([^/]+)/);
    return match ? match[1] : null;
  })();

  const [session, setSession] = useState<LiveAuctionSession | null>(null);
  const [lots, setLots] = useState<any[]>([]);
  const [bestImages, setBestImages] = useState<Record<string, string[]>>({});
  const [currentLot, setCurrentLot] = useState<LotData | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<LiveAuctionSession | null>(null);
  sessionRef.current = session;

  const lotsRef = useRef<any[]>([]);
  const bestImagesRef = useRef<Record<string, string[]>>({});
  lotsRef.current = lots;
  bestImagesRef.current = bestImages;

  const applySession = (updated: LiveAuctionSession, prevLotId: string | null | undefined) => {
    const lotId = updated.current_lot_id;
    const isNewLot = lotId !== prevLotId;
    const sessionToSet = isNewLot ? { ...updated, projector_image_index: 0 } : updated;

    if (isNewLot && updated.id) {
      LiveClerkService.updateSession(updated.id, { projector_image_index: 0 }).catch(() => {});
    }

    setSession(sessionToSet);

    if (!lotId) { setCurrentLot(null); return; }
    const lot = lotsRef.current.find((l: any) => l.id === lotId) ?? null;
    if (lot) {
      const hq = bestImagesRef.current[lot.id];
      const images = hq && hq.length > 0
        ? hq
        : [lot.image_url, ...(lot.additional_images || [])].filter(Boolean) as string[];
      setCurrentLot({ id: lot.id, title: lot.title, lot_number: lot.lot_number, images });
    } else {
      setCurrentLot(null);
    }
  };

  useEffect(() => {
    if (!eventId) return;
    loadInitial();
  }, [eventId]);

  // Realtime subscription
  useEffect(() => {
    if (!session?.id) return;
    const sessionId = session.id;
    const sub = LiveClerkService.subscribeToSession(sessionId, (updated) => {
      applySession(updated, sessionRef.current?.current_lot_id);
    }, '_imgctrl');
    return () => { supabase?.removeChannel(sub); };
  }, [session?.id]);

  // Polling fallback — catches updates if realtime channel drops
  useEffect(() => {
    if (!eventId) return;
    const interval = setInterval(async () => {
      try {
        const sess = await LiveClerkService.getOrCreateSession(eventId);
        const prev = sessionRef.current;
        if (!prev) return;
        if (sess.current_lot_id !== prev.current_lot_id || sess.projector_image_index !== prev.projector_image_index) {
          applySession(sess, prev.current_lot_id);
        }
      } catch { /* silent */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [eventId]);

  const loadInitial = async () => {
    setLoading(true);
    try {
      const sess = await LiveClerkService.getOrCreateSession(eventId!);
      const eventLots = await InventoryService.getItemsForEvent(eventId!);
      const ids = eventLots.map((l: any) => l.id);
      const hq = await InventoryService.getBestQualityImagesForItems(ids);
      // Set lots and images first so applySession can find them
      setLots(eventLots);
      setBestImages(hq);
      lotsRef.current = eventLots;
      bestImagesRef.current = hq;
      applySession(sess, null);
    } catch (err) {
      console.error('Image controller load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const sendImageIndex = async (index: number) => {
    const sess = sessionRef.current;
    if (!sess) return;
    await LiveClerkService.updateSession(sess.id, { projector_image_index: index });
    setSession(prev => prev ? { ...prev, projector_image_index: index } : prev);
  };

  const handlePrev = () => {
    const idx = session?.projector_image_index ?? 0;
    if (idx > 0) sendImageIndex(idx - 1);
  };

  const handleNext = () => {
    const idx = session?.projector_image_index ?? 0;
    const max = (currentLot?.images.length ?? 1) - 1;
    if (idx < max) sendImageIndex(idx + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ironbound-grey-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ironbound-orange-500 mx-auto mb-3" />
          <p className="text-ironbound-grey-300 text-sm">Loading image controller...</p>
        </div>
      </div>
    );
  }

  const imageIndex = session?.projector_image_index ?? 0;
  const images = currentLot?.images ?? [];
  const activeImage = images[imageIndex] ?? null;
  const lotNumber = currentLot?.lot_number ?? (session ? String((session.current_lot_index ?? 0) + 1) : '—');

  return (
    <div className="min-h-screen bg-ironbound-grey-900 flex flex-col text-white">
      <header className="flex-shrink-0 bg-ironbound-grey-800 border-b border-ironbound-grey-700 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Monitor className="h-5 w-5 text-ironbound-orange-500" />
          <div>
            <div className="text-xs text-ironbound-grey-400">Projector Image Controller</div>
            <div className="text-sm font-bold text-white">
              Lot {lotNumber}{currentLot?.title ? ` — ${currentLot.title}` : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ironbound-grey-500">
            {images.length > 0 ? `${imageIndex + 1} / ${images.length}` : 'No images'}
          </span>
          <button
            onClick={loadInitial}
            className="p-1.5 text-ironbound-grey-400 hover:text-white hover:bg-ironbound-grey-700 rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 bg-black relative" style={{ height: '55vh' }}>
          {activeImage ? (
            <img
              src={activeImage}
              alt={currentLot?.title}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ironbound-grey-600">
              No image selected
            </div>
          )}

          {images.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                disabled={imageIndex === 0}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/70 hover:bg-black/90 rounded-full text-white disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={handleNext}
                disabled={imageIndex === images.length - 1}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/70 hover:bg-black/90 rounded-full text-white disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <div className="absolute top-3 left-3 bg-black/70 text-ironbound-orange-400 text-xs font-bold px-2.5 py-1 rounded">
            LIVE ON PROJECTOR
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-3 text-xs font-semibold text-ironbound-grey-400 uppercase tracking-wider">
            All Images — Click to send to projector
          </div>

          {images.length === 0 ? (
            <div className="text-ironbound-grey-600 text-sm italic py-8 text-center">
              No images for this lot
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => sendImageIndex(i)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    i === imageIndex
                      ? 'border-ironbound-orange-500 ring-2 ring-ironbound-orange-500/50 scale-105'
                      : 'border-ironbound-grey-700 hover:border-ironbound-grey-500'
                  }`}
                  title={`Image ${i + 1} — Click to display on projector`}
                >
                  <img
                    src={img}
                    alt={`Image ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {i === imageIndex && (
                    <div className="absolute inset-0 bg-ironbound-orange-500/20 flex items-end justify-center pb-1">
                      <span className="text-[10px] font-bold text-white bg-ironbound-orange-500 px-1.5 py-0.5 rounded">
                        LIVE
                      </span>
                    </div>
                  )}
                  <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-bold px-1 rounded">
                    {i + 1}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 bg-ironbound-grey-800 border-t border-ironbound-grey-700 px-5 py-3 text-xs text-ironbound-grey-500 text-center">
        Auto-updates when the clerk advances. Click any image to send it to both projectors.
      </div>
    </div>
  );
}
