import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ClerkLot, LotResultEntry } from '../../services/liveClerkService';
import { formatCurrency } from '../../utils/formatters';

interface LotCatalogPanelProps {
  lots: ClerkLot[];
  currentIndex: number;
  onSelectLot: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  sessionStatus: string;
  lotResults?: Record<string, LotResultEntry>;
}

export default function LotCatalogPanel({
  lots,
  currentIndex,
  onSelectLot,
  onPrevious,
  onNext,
  sessionStatus,
  lotResults = {},
}: LotCatalogPanelProps) {
  const isRunning = sessionStatus === 'running' || sessionStatus === 'paused';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <span className="text-xs font-semibold text-ironbound-grey-300 uppercase tracking-wider">
          Catalog — {lots.length} Lots
        </span>
        <div className="flex gap-1">
          <button
            onClick={onPrevious}
            disabled={currentIndex === 0}
            className="p-1 rounded bg-ironbound-grey-700 hover:bg-ironbound-grey-600 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onNext}
            disabled={currentIndex >= lots.length - 1}
            className="p-1 rounded bg-ironbound-grey-700 hover:bg-ironbound-grey-600 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-ironbound-grey-800">
            <tr className="text-ironbound-grey-400 border-b border-ironbound-grey-700">
              <th className="text-left py-1.5 px-2 font-medium">Lot</th>
              <th className="text-left py-1.5 px-2 font-medium">Title</th>
              <th className="text-right py-1.5 px-2 font-medium">Start</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot, index) => {
              const result = lotResults[lot.id];
              return (
                <tr
                  key={lot.id}
                  onClick={() => isRunning && onSelectLot(index)}
                  className={`border-b border-ironbound-grey-800 transition-colors ${
                    index === currentIndex
                      ? 'bg-ironbound-orange-500/20 border-l-2 border-l-ironbound-orange-500'
                      : isRunning
                      ? 'hover:bg-ironbound-grey-700 cursor-pointer'
                      : 'opacity-60'
                  }`}
                >
                  <td className={`py-1.5 px-2 font-mono font-semibold ${index === currentIndex ? 'text-ironbound-orange-400' : 'text-ironbound-grey-300'}`}>
                    {lot.lot_number || `${index + 1}`}
                  </td>
                  <td className={`py-1.5 px-2 max-w-0 ${index === currentIndex ? 'text-white font-medium' : 'text-ironbound-grey-300'}`}>
                    <span className="block truncate">{lot.title}</span>
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono">
                    {result ? (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        result.result === 'sold' ? 'bg-green-600/30 text-green-400' :
                        result.result === 'conditional' ? 'bg-blue-600/30 text-blue-400' :
                        result.result === 'passed' ? 'bg-ironbound-orange-500/30 text-ironbound-orange-400' :
                        'bg-red-600/30 text-red-400'
                      }`}>
                        {result.result === 'sold' ? `$${(result.sold_price ?? 0).toLocaleString()}` :
                         result.result === 'conditional' ? 'COND' :
                         result.result === 'passed' ? 'PASS' : 'N/S'}
                      </span>
                    ) : (
                      <span className={`font-mono ${index === currentIndex ? 'text-ironbound-orange-400' : 'text-ironbound-grey-400'}`}>
                        {formatCurrency(lot.lot_starting_price ?? lot.starting_price)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
