import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Gavel, Play, Pause } from 'lucide-react';
import { ClerkLot, LiveClerkService, LotResultEntry } from '../../services/liveClerkService';
import { formatCurrency } from '../../utils/formatters';

interface CurrentLotPanelProps {
  lot: ClerkLot | null;
  totalLots: number;
  currentIndex: number;
  currentBid: number;
  askingPrice: number;
  sessionId: string | null;
  eventId: string | null;
  projectorImageIndex: number;
  lotImages: string[];
  onOverrideAsk: (price: number) => void;
  onOverridePost: (price: number) => void;
  sessionStatus: string;
  lotResult?: LotResultEntry | null;
}

export default function CurrentLotPanel({
  lot,
  totalLots,
  currentIndex,
  currentBid,
  askingPrice,
  sessionId,
  eventId,
  projectorImageIndex,
  lotImages,
  onOverrideAsk,
  onOverridePost,
  sessionStatus,
  lotResult,
}: CurrentLotPanelProps) {
  const [overrideValue, setOverrideValue] = useState('');
  const [localImageIndex, setLocalImageIndex] = useState(projectorImageIndex);
  const [autoPlay, setAutoPlay] = useState(false);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunning = sessionStatus === 'running';
  const thumbScrollRef = useRef<HTMLDivElement>(null);
  const activeThumbRef = useRef<HTMLButtonElement>(null);

  const images: string[] = lotImages.length > 0
    ? lotImages
    : lot
      ? [lot.image_url, ...(lot.additional_images || [])].filter(Boolean) as string[]
      : [];

  useEffect(() => {
    setLocalImageIndex(projectorImageIndex);
  }, [projectorImageIndex]);

  const imageIndex = Math.min(localImageIndex, Math.max(0, images.length - 1));
  const currentImage = images[imageIndex] || null;

  const syncImageIndex = useCallback(async (idx: number) => {
    setLocalImageIndex(idx);
    if (!sessionId) return;
    try {
      await LiveClerkService.updateSession(sessionId, { projector_image_index: idx });
    } catch {}
  }, [sessionId]);

  const handleScrollLeft = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (thumbScrollRef.current) {
      thumbScrollRef.current.scrollBy({ left: -80, behavior: 'smooth' });
    }
  };

  const handleScrollRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (thumbScrollRef.current) {
      thumbScrollRef.current.scrollBy({ left: 80, behavior: 'smooth' });
    }
  };

  const handleImageDoubleClick = () => {
    if (!eventId) return;
    window.open(`/image-controller/${eventId}`, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    setLocalImageIndex(0);
    syncImageIndex(0);
    setAutoPlay(false);
  }, [lot?.id]);

  useEffect(() => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
    }
    if (autoPlay && images.length > 1) {
      autoPlayRef.current = setInterval(() => {
        setLocalImageIndex(prev => {
          const next = (prev + 1) % images.length;
          syncImageIndex(next);
          return next;
        });
      }, 5000);
    }
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [autoPlay, images.length, syncImageIndex]);

  useEffect(() => {
    if (activeThumbRef.current && thumbScrollRef.current) {
      const container = thumbScrollRef.current;
      const thumb = activeThumbRef.current;
      const thumbLeft = thumb.offsetLeft;
      const thumbRight = thumbLeft + thumb.offsetWidth;
      const visibleLeft = container.scrollLeft;
      const visibleRight = visibleLeft + container.offsetWidth;
      if (thumbLeft < visibleLeft) {
        container.scrollLeft = thumbLeft - 4;
      } else if (thumbRight > visibleRight) {
        container.scrollLeft = thumbRight - container.offsetWidth + 4;
      }
    }
  }, [imageIndex]);

  if (!lot) {
    return (
      <div className="flex items-center justify-center h-full text-ironbound-grey-600">
        <div className="text-center">
          <div className="text-4xl mb-2">—</div>
          <div className="text-sm">No lot selected</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex gap-4 flex-shrink-0">
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div>
            <div className="text-xs text-ironbound-grey-400 mb-0.5">
              Lot {currentIndex + 1} of {totalLots}
              {lot.lot_number && <span className="ml-2 font-mono text-ironbound-orange-400">#{lot.lot_number}</span>}
            </div>
            <h2 className="text-lg font-bold text-white leading-tight">{lot.title}</h2>
            {lot.description && (
              <p className="text-xs text-ironbound-grey-400 mt-1 line-clamp-2">{lot.description}</p>
            )}
          </div>

          {lotResult && (
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${
              lotResult.result === 'sold' ? 'bg-green-600/20 border border-green-500/40 text-green-400' :
              lotResult.result === 'conditional' ? 'bg-blue-600/20 border border-blue-500/40 text-blue-400' :
              lotResult.result === 'passed' ? 'bg-ironbound-orange-500/20 border border-ironbound-orange-500/40 text-ironbound-orange-400' :
              'bg-red-600/20 border border-red-500/40 text-red-400'
            }`}>
              <Gavel className="h-4 w-4 flex-shrink-0" />
              {lotResult.result === 'sold' && `SOLD — ${formatCurrency(lotResult.sold_price ?? 0)}`}
              {lotResult.result === 'conditional' && `CONDITIONAL — ${formatCurrency(lotResult.sold_price ?? 0)}`}
              {lotResult.result === 'passed' && 'PASSED'}
              {lotResult.result === 'no_sale' && 'NO SALE'}
              <span className="ml-auto text-xs font-normal opacity-70">bidding can be reset</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-ironbound-grey-800 rounded-lg p-3">
              <div className="text-xs text-ironbound-grey-400 mb-0.5">Current Bid</div>
              <div className={`text-2xl font-bold font-mono transition-colors ${currentBid > 0 ? 'text-green-400' : 'text-ironbound-grey-500'}`}>
                {formatCurrency(currentBid)}
              </div>
            </div>
            <div className="bg-ironbound-grey-800 rounded-lg p-3 border border-ironbound-orange-500/40">
              <div className="text-xs text-ironbound-orange-300 mb-0.5 font-semibold uppercase tracking-wide">Asking</div>
              <div className={`text-2xl font-bold font-mono transition-colors ${askingPrice > 0 ? 'text-ironbound-orange-400' : 'text-ironbound-grey-500'}`}>
                {formatCurrency(askingPrice)}
              </div>
            </div>
          </div>

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs text-ironbound-grey-400 mb-1 block">Override</label>
              <div className="flex">
                <span className="flex items-center px-2.5 bg-ironbound-grey-700 border border-ironbound-grey-600 border-r-0 rounded-l text-ironbound-grey-300 text-sm font-semibold">$</span>
                <input
                  type="number"
                  value={overrideValue}
                  onChange={e => setOverrideValue(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2.5 bg-ironbound-grey-700 border border-ironbound-grey-600 rounded-r text-white text-sm font-mono focus:outline-none focus:border-ironbound-orange-500 transition-colors"
                  placeholder="Amount"
                />
              </div>
            </div>
            <button
              onClick={() => {
                const val = parseFloat(overrideValue);
                if (val > 0) onOverrideAsk(val);
              }}
              disabled={!isRunning || !overrideValue}
              className="px-4 py-2.5 bg-ironbound-grey-600 hover:bg-ironbound-grey-500 text-white text-sm font-bold rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Ask
            </button>
            <button
              onClick={() => {
                const val = parseFloat(overrideValue);
                if (val > 0) { onOverridePost(val); setOverrideValue(''); }
              }}
              disabled={!isRunning || !overrideValue}
              className="px-4 py-2.5 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white text-sm font-bold rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Post
            </button>
          </div>

          {(lot.estimated_value_low || lot.estimated_value_high) && (
            <div className="text-xs text-ironbound-grey-500">
              Est: {lot.estimated_value_low ? formatCurrency(lot.estimated_value_low) : '$?'}
              {' — '}
              {lot.estimated_value_high ? formatCurrency(lot.estimated_value_high) : '$?'}
            </div>
          )}

          {lot.buyer_attention && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 text-xs text-yellow-400">
              <span className="font-semibold">Buyer Attention: </span>{lot.buyer_attention}
            </div>
          )}
        </div>

        {currentImage && (
          <div className="flex-shrink-0 w-56 flex flex-col gap-1.5">
            <div className="relative rounded-lg overflow-hidden bg-ironbound-grey-900 w-56 h-44 group">
              <img
                src={currentImage}
                alt={lot.title}
                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                onDoubleClick={handleImageDoubleClick}
                title="Double-click to open Image Controller"
              />
              <button
                onClick={handleImageDoubleClick}
                className="absolute top-2 right-2 p-1 bg-black/60 rounded text-white hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100"
                title="Open Image Controller"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
              {images.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setAutoPlay(prev => !prev); }}
                  className={`absolute bottom-2 left-2 p-1 rounded transition-colors ${
                    autoPlay
                      ? 'bg-ironbound-orange-500 text-white'
                      : 'bg-black/60 text-white hover:bg-black/80'
                  }`}
                  title={autoPlay ? 'Stop auto-play' : 'Auto-play images (5s)'}
                >
                  {autoPlay ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex items-center gap-1 w-full min-w-0">
                <button
                  onClick={handleScrollLeft}
                  className="p-1 bg-ironbound-grey-700 hover:bg-ironbound-grey-600 rounded text-white transition-colors flex-shrink-0"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <div ref={thumbScrollRef} className="flex-1 flex items-center gap-1 overflow-x-auto py-0.5 scroll-smooth" style={{ scrollbarWidth: 'none' }}>
                  {images.map((img, i) => (
                    <button
                      key={i}
                      ref={i === imageIndex ? activeThumbRef : null}
                      onClick={(e) => { e.stopPropagation(); syncImageIndex(i); }}
                      className={`flex-shrink-0 rounded overflow-hidden border-2 transition-all ${
                        i === imageIndex
                          ? 'border-ironbound-orange-500 opacity-100'
                          : 'border-transparent opacity-50 hover:opacity-80'
                      }`}
                      style={{ width: 28, height: 22 }}
                      title={`Image ${i + 1}`}
                    >
                      <img src={img} alt={`img ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleScrollRight}
                  className="p-1 bg-ironbound-grey-700 hover:bg-ironbound-grey-600 rounded text-white transition-colors flex-shrink-0"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {images.length > 1 && (
              <div className="text-xs text-center text-ironbound-grey-500">
                {imageIndex + 1} / {images.length} — dbl-click for controller
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
