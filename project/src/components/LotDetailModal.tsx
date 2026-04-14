import React from 'react';
import { X, Tag, Wrench, Calendar, Building2, AlertTriangle } from 'lucide-react';
import { CatalogLot } from '../services/preBidService';

interface LotDetailModalProps {
  lot: CatalogLot;
  onClose: () => void;
}

export default function LotDetailModal({ lot, onClose }: LotDetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-ironbound-grey-100">
          <span className="bg-ironbound-grey-900 text-white text-xs font-bold px-3 py-1 rounded-full">
            {lot.lot_number}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-ironbound-grey-100 text-ironbound-grey-400 hover:text-ironbound-grey-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          <h2 className="text-xl font-bold text-ironbound-grey-900 leading-snug mb-4">
            {lot.title}
          </h2>

          <div className="flex flex-wrap gap-3 mb-4">
            {lot.category && (
              <div className="flex items-center gap-1.5 text-sm text-ironbound-grey-600 bg-ironbound-grey-50 border border-ironbound-grey-200 rounded-lg px-3 py-1.5">
                <Tag className="h-3.5 w-3.5 text-ironbound-grey-400" />
                {lot.category}
              </div>
            )}
            {lot.year_made && (
              <div className="flex items-center gap-1.5 text-sm text-ironbound-grey-600 bg-ironbound-grey-50 border border-ironbound-grey-200 rounded-lg px-3 py-1.5">
                <Calendar className="h-3.5 w-3.5 text-ironbound-grey-400" />
                {lot.year_made}
              </div>
            )}
            {lot.manufacturer && (
              <div className="flex items-center gap-1.5 text-sm text-ironbound-grey-600 bg-ironbound-grey-50 border border-ironbound-grey-200 rounded-lg px-3 py-1.5">
                <Building2 className="h-3.5 w-3.5 text-ironbound-grey-400" />
                {lot.manufacturer}
              </div>
            )}
            {lot.condition && (
              <div className="flex items-center gap-1.5 text-sm text-ironbound-grey-600 bg-ironbound-grey-50 border border-ironbound-grey-200 rounded-lg px-3 py-1.5">
                <Wrench className="h-3.5 w-3.5 text-ironbound-grey-400" />
                {lot.condition}
              </div>
            )}
          </div>

          {lot.description && (
            <p className="text-sm text-ironbound-grey-600 leading-relaxed">
              {lot.description}
            </p>
          )}

          {!lot.description && (
            <p className="text-sm text-ironbound-grey-400 italic">No description provided.</p>
          )}

          {lot.buyer_attention && (
            <div className="mt-5 flex gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Attention to Buyer</p>
                <p className="text-sm text-amber-800 leading-relaxed">{lot.buyer_attention}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
