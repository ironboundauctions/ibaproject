import React from 'react';
import { Undo2 } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export interface BidSnapshot {
  current_bid: number;
  asking_price: number;
}

interface BidUndoPanelProps {
  history: BidSnapshot[];
  onUndo: () => void;
  disabled?: boolean;
}

export default function BidUndoPanel({ history, onUndo, disabled }: BidUndoPanelProps) {
  const canUndo = history.length > 0 && !disabled;
  const last = history[history.length - 1];
  const prev = history[history.length - 2];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-ironbound-grey-300 uppercase tracking-wider">Undo Bid</span>
        {history.length > 0 && (
          <span className="text-xs text-ironbound-grey-500">{history.length} step{history.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={`flex flex-col items-center justify-center flex-1 rounded-lg border-2 transition-all select-none ${
          canUndo
            ? 'border-amber-500/60 bg-amber-500/10 hover:bg-amber-500/20 hover:border-amber-400 cursor-pointer active:scale-95'
            : 'border-ironbound-grey-700 bg-ironbound-grey-800/30 cursor-not-allowed opacity-40'
        }`}
      >
        <Undo2 className={`h-6 w-6 mb-1.5 ${canUndo ? 'text-amber-400' : 'text-ironbound-grey-600'}`} />
        {canUndo && last ? (
          <div className="text-center">
            <div className="text-xs text-ironbound-grey-400 mb-0.5">Restore</div>
            <div className="text-sm font-bold text-amber-300">{formatCurrency(last.current_bid)}</div>
            {prev && (
              <div className="text-xs text-ironbound-grey-500 mt-1">
                prev: {formatCurrency(prev.current_bid)}
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-ironbound-grey-600">Nothing to undo</div>
        )}
      </button>

      {history.length > 1 && (
        <div className="mt-2 space-y-0.5 max-h-14 overflow-y-auto">
          {[...history].reverse().slice(0, 4).map((snap, i) => (
            <div key={i} className={`flex items-center justify-between px-1.5 py-0.5 rounded text-xs ${i === 0 ? 'text-amber-400/70' : 'text-ironbound-grey-600'}`}>
              <span>{i === 0 ? 'latest' : `−${i}`}</span>
              <span className="font-mono">{formatCurrency(snap.current_bid)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
