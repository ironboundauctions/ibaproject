import React, { useState } from 'react';
import { X, Gavel, TrendingUp, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { CatalogLot, PreBidService } from '../services/preBidService';
import { formatCurrency } from '../utils/formatters';

interface PreBidModalProps {
  lot: CatalogLot;
  eventId: string;
  onClose: () => void;
  onSuccess: (updated: CatalogLot) => void;
}

export default function PreBidModal({ lot, eventId, onClose, onSuccess }: PreBidModalProps) {
  const startingPrice = lot.lot_starting_price || 0;
  const existing = lot.pre_bid?.status === 'active' ? lot.pre_bid : null;
  const [amount, setAmount] = useState(existing ? String(existing.max_amount) : '');
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseFloat(amount);
  const isValid = !isNaN(parsed) && parsed > 0 && (startingPrice === 0 || parsed >= startingPrice);

  const mainImage = lot.image_url;

  async function handleSubmit() {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await PreBidService.placePreBid(eventId, lot.assignment_id, parsed);
      const delta = existing ? 0 : 1;
      onSuccess({ ...lot, pre_bid: updated, pre_bid_count: lot.pre_bid_count + delta });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pre-bid');
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!existing) return;
    setCancelling(true);
    setError(null);
    try {
      await PreBidService.cancelPreBid(existing.id);
      onSuccess({
        ...lot,
        pre_bid: { ...existing, status: 'cancelled' },
        pre_bid_count: Math.max(0, lot.pre_bid_count - 1),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove pre-bid');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative h-44 bg-ironbound-grey-900 overflow-hidden">
          {mainImage ? (
            <img src={mainImage} alt={lot.title} className="w-full h-full object-cover opacity-50" />
          ) : (
            <div className="w-full h-full bg-ironbound-grey-800" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="absolute bottom-3 left-4 right-12">
            <span className="text-ironbound-orange-400 text-xs font-bold uppercase tracking-widest">
              {lot.lot_number}
            </span>
            <h3 className="text-white font-bold text-lg leading-tight mt-0.5 line-clamp-2">{lot.title}</h3>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {existing && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3">
              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-700">
                Active pre-bid: <strong>{formatCurrency(existing.max_amount)}</strong>. Update or remove it below.
              </p>
            </div>
          )}

          <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
            <TrendingUp className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Enter your maximum. During the auction the system will automatically bid on your behalf
              up to this amount, one increment at a time.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-ironbound-grey-800 mb-1">
              Your Maximum Pre-Bid
            </label>
            {startingPrice > 0 && (
              <p className="text-xs text-ironbound-grey-400 mb-1.5">
                Starting bid: {formatCurrency(startingPrice)}
              </p>
            )}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ironbound-grey-500 font-semibold">$</span>
              <input
                type="number"
                min={startingPrice || 1}
                step="1"
                value={amount}
                onChange={e => { setAmount(e.target.value); setError(null); }}
                placeholder="0"
                className="w-full pl-8 pr-4 py-3 border-2 border-ironbound-grey-300 focus:border-ironbound-orange-500 rounded-xl text-2xl font-bold text-ironbound-grey-900 focus:outline-none transition-colors bg-white"
                autoFocus
              />
            </div>
            {error && (
              <div className="flex items-center gap-1.5 text-red-600 text-xs mt-1.5">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            {existing && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex items-center gap-1.5 px-3 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {cancelling ? 'Removing...' : 'Remove'}
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-ironbound-grey-300 text-ironbound-grey-700 hover:bg-ironbound-grey-50 rounded-xl text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid || saving}
              className="flex-1 px-4 py-2.5 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Gavel className="h-4 w-4" />
              {saving ? 'Saving...' : existing ? 'Update Pre-Bid' : 'Set Pre-Bid'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
