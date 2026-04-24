import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Download, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CatalogLot } from '../services/preBidService';

interface MediaItem {
  url: string;
  isVideo: boolean;
}

export interface GalleryItem {
  inventory_id: string;
  title: string;
  lot_number?: string;
  image_url?: string | null;
  barcode_asset_group_id?: string | null;
}

interface LotGalleryModalProps {
  lot: GalleryItem;
  onClose: () => void;
}

export default function LotGalleryModal({ lot, onClose }: LotGalleryModalProps) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    loadMedia();
  }, [lot.inventory_id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (lightboxIndex === null) {
        if (e.key === 'Escape') onClose();
        return;
      }
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowLeft') navigateLightbox(-1);
      if (e.key === 'ArrowRight') navigateLightbox(1);
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(5, z + 0.5));
      if (e.key === '-') setZoom(z => Math.max(1, z - 0.5));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxIndex, media.length]);

  const loadMedia = async () => {
    setLoading(true);
    try {
      const { data: files } = await supabase
        .from('auction_files')
        .select('cdn_url, mime_type, variant, asset_group_id, display_order')
        .eq('item_id', lot.inventory_id)
        .eq('published_status', 'published')
        .is('detached_at', null)
        .in('variant', ['display', 'video'])
        .order('display_order', { ascending: true, nullsFirst: false });

      const barcodeGroupId = lot.barcode_asset_group_id;
      const assetGroups = new Map<string, any[]>();
      (files || []).forEach(file => {
        if (barcodeGroupId && file.asset_group_id === barcodeGroupId) return;
        const groupId = file.asset_group_id || file.cdn_url;
        if (!assetGroups.has(groupId)) assetGroups.set(groupId, []);
        assetGroups.get(groupId)!.push(file);
      });

      const items: MediaItem[] = [];
      assetGroups.forEach(groupFiles => {
        const videoFile = groupFiles.find(f => f.variant === 'video');
        if (videoFile) {
          items.push({ url: videoFile.cdn_url, isVideo: true });
        } else {
          const displayFile = groupFiles.find(f => f.variant === 'display');
          if (displayFile) items.push({ url: displayFile.cdn_url, isVideo: false });
        }
      });

      if (items.length === 0 && lot.image_url) {
        items.push({ url: lot.image_url, isVideo: false });
      }

      // Always show video first
      items.sort((a, b) => (b.isVideo ? 1 : 0) - (a.isVideo ? 1 : 0));

      setMedia(items);
    } catch (err) {
      console.error('[GALLERY] Error loading media:', err);
      if (lot.image_url) setMedia([{ url: lot.image_url, isVideo: false }]);
    } finally {
      setLoading(false);
    }
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const navigateLightbox = useCallback((dir: number) => {
    setLightboxIndex(prev => {
      if (prev === null) return null;
      const next = (prev + dir + media.length) % media.length;
      return next;
    });
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [media.length]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setZoom(z => Math.min(5, Math.max(1, z + delta)));
    if (zoom <= 1) setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart.current) return;
    setPan({
      x: dragStart.current.px + (e.clientX - dragStart.current.x),
      y: dragStart.current.py + (e.clientY - dragStart.current.y),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStart.current = null;
  };

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const imageCount = media.length;
  const cols = imageCount === 1 ? 1 : 2;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-stretch justify-center"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="relative bg-white w-full max-w-4xl flex flex-col max-h-screen">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ironbound-grey-200 flex-shrink-0">
            <div>
              {lot.lot_number && (
                <p className="text-xs font-semibold text-ironbound-orange-500 uppercase tracking-wide mb-0.5">{lot.lot_number}</p>
              )}
              <h2 className="text-base font-bold text-ironbound-grey-900 leading-snug line-clamp-1">{lot.title}</h2>
            </div>
            <button
              onClick={onClose}
              className="ml-4 p-2 rounded-xl hover:bg-ironbound-grey-100 text-ironbound-grey-500 hover:text-ironbound-grey-900 transition-colors flex-shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <div className="w-8 h-8 border-2 border-ironbound-orange-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-ironbound-grey-400">Loading images...</p>
              </div>
            ) : media.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-ironbound-grey-400">
                <ImageIcon className="h-12 w-12 opacity-30" />
                <p className="text-sm">No images available for this lot.</p>
              </div>
            ) : (
              <div className={`grid gap-3 ${cols === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {media.map((item, i) => (
                  <div
                    key={i}
                    className="relative group overflow-hidden rounded-xl bg-ironbound-grey-100 cursor-pointer"
                    style={{ aspectRatio: '4/3' }}
                    onClick={() => openLightbox(i)}
                  >
                    {item.isVideo ? (
                      <video
                        src={item.url}
                        className="w-full h-full object-cover"
                        muted
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={item.url}
                        alt={`${lot.title} — photo ${i + 1}`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading={i < 4 ? 'eager' : 'lazy'}
                      />
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                      <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg" />
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">
                      {i + 1} / {imageCount}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {imageCount > 0 && !loading && (
            <div className="px-5 py-2.5 border-t border-ironbound-grey-100 flex-shrink-0">
              <p className="text-xs text-ironbound-grey-400 text-center">
                {imageCount} {imageCount === 1 ? 'item' : 'items'} — click any to view full screen
              </p>
            </div>
          )}
        </div>
      </div>

      {lightboxIndex !== null && media[lightboxIndex] && (
        <div
          className="fixed inset-0 z-60 bg-black/95 flex flex-col"
          style={{ zIndex: 60 }}
        >
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
            <p className="text-white/60 text-sm">
              {lightboxIndex + 1} / {imageCount}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom(z => Math.min(5, z + 0.5))}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                onClick={() => setZoom(z => Math.max(1, z - 0.5))}
                disabled={zoom <= 1}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-40"
                title="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                onClick={resetZoom}
                disabled={zoom === 1}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-40"
                title="Reset zoom"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              {!media[lightboxIndex].isVideo && (
                <a
                  href={media[lightboxIndex].url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Open original"
                >
                  <Download className="h-4 w-4" />
                </a>
              )}
              <button
                onClick={closeLightbox}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors ml-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            className="flex-1 relative overflow-hidden flex items-center justify-center"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
          >
            {media[lightboxIndex].isVideo ? (
              <video
                src={media[lightboxIndex].url}
                controls
                autoPlay
                className="max-w-full max-h-full rounded-lg"
                style={{ maxHeight: 'calc(100vh - 120px)' }}
              />
            ) : (
              <img
                ref={imgRef}
                src={media[lightboxIndex].url}
                alt={`${lot.title} — photo ${lightboxIndex + 1}`}
                draggable={false}
                className="max-w-full max-h-full rounded-lg select-none transition-transform duration-100"
                style={{
                  transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                  maxHeight: 'calc(100vh - 120px)',
                  cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
                }}
                onClick={() => zoom === 1 && setZoom(2)}
              />
            )}

            {imageCount > 1 && (
              <>
                <button
                  onClick={() => navigateLightbox(-1)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors backdrop-blur-sm"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={() => navigateLightbox(1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors backdrop-blur-sm"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>

          {imageCount > 1 && (
            <div className="flex-shrink-0 px-4 py-3 overflow-x-auto">
              <div className="flex gap-2 justify-center">
                {media.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => { setLightboxIndex(i); setZoom(1); setPan({ x: 0, y: 0 }); }}
                    className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                      i === lightboxIndex
                        ? 'border-ironbound-orange-500 opacity-100'
                        : 'border-transparent opacity-50 hover:opacity-80'
                    }`}
                  >
                    {item.isVideo ? (
                      <video src={item.url} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={item.url} alt="" className="w-full h-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
