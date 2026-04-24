import React, { useState } from 'react';
import { Gavel, Search, Tag, CheckCircle, Image as ImageIcon, Lock, ChevronLeft, ChevronRight, Users, Play } from 'lucide-react';
import { CatalogLot } from '../services/preBidService';
import { formatCurrency } from '../utils/formatters';
import PreBidModal from './PreBidModal';
import LotGalleryModal from './LotGalleryModal';
import LotDetailModal from './LotDetailModal';
import { useAuth } from '../hooks/useAuth';

const PAGE_SIZE = 100;

interface LotCatalogGridProps {
  lots: CatalogLot[];
  eventId: string;
  preBiddingEnabled: boolean;
  eventStatus: string;
  onAuthRequired: () => void;
  onLotsUpdate: (lots: CatalogLot[]) => void;
}

export default function LotCatalogGrid({
  lots,
  eventId,
  preBiddingEnabled,
  eventStatus,
  onAuthRequired,
  onLotsUpdate,
}: LotCatalogGridProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLot, setSelectedLot] = useState<CatalogLot | null>(null);
  const [galleryLot, setGalleryLot] = useState<CatalogLot | null>(null);
  const [detailLot, setDetailLot] = useState<CatalogLot | null>(null);

  const filtered = lots
    .filter(lot => {
      if (!lot.lot_published) return false;
      const q = search.toLowerCase();
      return (
        lot.title.toLowerCase().includes(q) ||
        lot.lot_number.toLowerCase().includes(q) ||
        (lot.category || '').toLowerCase().includes(q) ||
        (lot.manufacturer || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const extractNum = (s: string) => {
        const m = s.match(/(\d+)/g);
        return m ? parseInt(m[m.length - 1], 10) : 0;
      };
      const aNum = extractNum(a.lot_number);
      const bNum = extractNum(b.lot_number);
      if (aNum !== bNum) return aNum - bNum;
      return a.lot_number.localeCompare(b.lot_number);
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePagePage = Math.min(page, totalPages);
  const pageLots = filtered.slice((safePagePage - 1) * PAGE_SIZE, safePagePage * PAGE_SIZE);

  const canPreBid = preBiddingEnabled && (eventStatus === 'published' || eventStatus === 'active');
  const isEnded = eventStatus === 'completed' || eventStatus === 'cancelled';

  function handlePreBidClick(lot: CatalogLot) {
    if (!canPreBid) return;
    if (!user) { onAuthRequired(); return; }
    setSelectedLot(lot);
  }

  function handlePreBidSuccess(updated: CatalogLot) {
    onLotsUpdate(lots.map(l => l.assignment_id === updated.assignment_id ? updated : l));
    setSelectedLot(null);
  }

  function handleSearchChange(val: string) {
    setSearch(val);
    setPage(1);
  }

  if (lots.length === 0) {
    return (
      <div className="text-center py-20 text-ironbound-grey-400">
        <Gavel className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="text-lg font-medium text-ironbound-grey-500">No lots assigned to this event yet.</p>
        <p className="text-sm mt-1">Check back closer to the auction date.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
          <input
            type="text"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder={`Search ${lots.length} lots...`}
            className="w-full pl-9 pr-4 py-2.5 border border-ironbound-grey-300 rounded-xl text-sm text-ironbound-grey-900 bg-white focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 focus:outline-none"
          />
        </div>
        <p className="text-sm text-ironbound-grey-400 flex-shrink-0">
          {filtered.length} {filtered.length === 1 ? 'lot' : 'lots'}
          {totalPages > 1 && ` — Page ${safePagePage} of ${totalPages}`}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {pageLots.map(lot => {
          const hasActivePrebid = lot.pre_bid?.status === 'active';
          const startingPrice = lot.lot_starting_price;

          let preBidButtonContent: React.ReactNode;
          let preBidButtonClass: string;

          if (isEnded) {
            preBidButtonContent = <span className="text-xs">Auction Ended</span>;
            preBidButtonClass = 'bg-ironbound-grey-100 text-ironbound-grey-400 cursor-not-allowed';
          } else if (!preBiddingEnabled) {
            preBidButtonContent = (
              <>
                <Lock className="h-3.5 w-3.5" />
                <span>Pre-Bidding Not Open</span>
              </>
            );
            preBidButtonClass = 'bg-ironbound-grey-100 text-ironbound-grey-400 cursor-not-allowed opacity-60';
          } else if (!user) {
            preBidButtonContent = (
              <>
                <Lock className="h-3.5 w-3.5" />
                <span>Sign In to Pre-Bid</span>
              </>
            );
            preBidButtonClass = 'bg-ironbound-grey-100 text-ironbound-grey-500 hover:bg-ironbound-grey-200 cursor-pointer';
          } else if (hasActivePrebid) {
            preBidButtonContent = (
              <>
                <CheckCircle className="h-3.5 w-3.5" />
                <span>Pre-Bid: {formatCurrency(lot.pre_bid!.max_amount)}</span>
              </>
            );
            preBidButtonClass = 'bg-green-50 border border-green-300 text-green-700 hover:bg-green-100';
          } else {
            preBidButtonContent = (
              <>
                <Gavel className="h-3.5 w-3.5" />
                <span>Place Pre-Bid</span>
              </>
            );
            preBidButtonClass = 'bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white shadow-sm';
          }

          const clickable = canPreBid && !isEnded;

          return (
            <div
              key={lot.assignment_id}
              className="bg-white rounded-2xl overflow-hidden border border-ironbound-grey-200 hover:border-ironbound-orange-200 hover:shadow-lg transition-all duration-200 flex flex-col group"
            >
              <div
                className="relative h-48 bg-ironbound-grey-100 overflow-hidden cursor-pointer"
                onClick={() => setGalleryLot(lot)}
              >
                {lot.image_url ? (
                  <img
                    src={lot.image_url}
                    alt={lot.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-ironbound-grey-300">
                    <ImageIcon className="h-10 w-10" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-end justify-end p-2.5">
                  <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 backdrop-blur-sm">
                    <ImageIcon className="h-3 w-3" />
                    View Photos
                  </span>
                </div>
                <div className="absolute top-2.5 left-2.5">
                  <span className="bg-ironbound-grey-900/80 text-white text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-sm">
                    {lot.lot_number}
                  </span>
                </div>
                <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1.5">
                  {lot.has_video && (
                    <span className="bg-black/70 text-white text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-sm">
                      <Play className="h-2.5 w-2.5 fill-white" />
                      Video
                    </span>
                  )}
                  {hasActivePrebid && (
                    <span className="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      My Bid
                    </span>
                  )}
                </div>
              </div>

              <div
                className="p-4 flex flex-col flex-1 cursor-pointer"
                onClick={() => setDetailLot(lot)}
              >
                <h3 className="font-semibold text-ironbound-grey-900 text-sm leading-snug line-clamp-2 mb-1.5 group-hover:text-ironbound-orange-600 transition-colors">
                  {lot.title}
                </h3>

                {lot.category && (
                  <div className="flex items-center gap-1 mb-1.5">
                    <Tag className="h-3 w-3 text-ironbound-grey-400" />
                    <span className="text-xs text-ironbound-grey-400">{lot.category}</span>
                  </div>
                )}

                {(lot.year_made || lot.manufacturer) && (
                  <p className="text-xs text-ironbound-grey-500 mb-1.5">
                    {[lot.year_made, lot.manufacturer].filter(Boolean).join(' ')}
                  </p>
                )}

                <div className="mt-auto pt-3 border-t border-ironbound-grey-100">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      {startingPrice != null && startingPrice > 0 ? (
                        <>
                          <p className="text-xs text-ironbound-grey-400">Starting Bid</p>
                          <p className="text-ironbound-orange-500 font-bold text-base">{formatCurrency(startingPrice)}</p>
                        </>
                      ) : (
                        <p className="text-xs text-ironbound-grey-400 italic">No starting price set</p>
                      )}
                    </div>
                    {lot.pre_bid_count > 0 && (
                      <div className="flex items-center gap-1 text-xs text-ironbound-grey-400">
                        <Users className="h-3 w-3" />
                        <span>{lot.pre_bid_count} pre-{lot.pre_bid_count === 1 ? 'bid' : 'bids'}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={e => { e.stopPropagation(); clickable && handlePreBidClick(lot); }}
                    className={`w-full py-2 rounded-xl text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 ${preBidButtonClass}`}
                  >
                    {preBidButtonContent}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-10">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePagePage === 1}
            className="flex items-center gap-1.5 px-4 py-2 border border-ironbound-grey-300 rounded-xl text-sm font-medium text-ironbound-grey-700 hover:bg-ironbound-grey-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <span className="text-sm text-ironbound-grey-600">
            Page {safePagePage} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePagePage === totalPages}
            className="flex items-center gap-1.5 px-4 py-2 border border-ironbound-grey-300 rounded-xl text-sm font-medium text-ironbound-grey-700 hover:bg-ironbound-grey-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {selectedLot && (
        <PreBidModal
          lot={selectedLot}
          eventId={eventId}
          onClose={() => setSelectedLot(null)}
          onSuccess={handlePreBidSuccess}
        />
      )}

      {galleryLot && (
        <LotGalleryModal
          lot={galleryLot}
          onClose={() => setGalleryLot(null)}
        />
      )}

      {detailLot && (
        <LotDetailModal
          lot={detailLot}
          onClose={() => setDetailLot(null)}
        />
      )}
    </div>
  );
}
