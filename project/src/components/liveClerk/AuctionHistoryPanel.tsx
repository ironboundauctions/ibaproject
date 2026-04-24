import React, { useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { HistoryLogEntry } from '../../services/liveClerkService';

interface AuctionHistoryPanelProps {
  entries: HistoryLogEntry[];
  onClear: () => void;
}

const ENTRY_COLORS: Record<string, string> = {
  auction_start: 'text-green-400',
  auction_pause: 'text-yellow-400',
  auction_resume: 'text-green-400',
  auction_end: 'text-red-400',
  lot_start: 'text-blue-400',
  lot_sold: 'text-ironbound-orange-400',
  lot_passed: 'text-ironbound-grey-400',
  bid_posted: 'text-ironbound-grey-200',
  message_sent: 'text-cyan-400',
  system: 'text-ironbound-grey-500',
};

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const VISIBLE_LIMIT = 20;

export default function AuctionHistoryPanel({ entries, onClear }: AuctionHistoryPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const visibleEntries = entries.slice(-VISIBLE_LIMIT);
  const hiddenCount = Math.max(0, entries.length - VISIBLE_LIMIT);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
        <span className="text-xs font-semibold text-ironbound-grey-300 uppercase tracking-wider">Auction History</span>
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-xs text-ironbound-grey-500 hover:text-red-400 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
          Clear
        </button>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 bg-ironbound-grey-950 rounded border border-ironbound-grey-700 p-2 font-mono text-xs space-y-0.5">
        {entries.length === 0 ? (
          <p className="text-ironbound-grey-600 italic">No history yet...</p>
        ) : (
          <>
            {hiddenCount > 0 && (
              <p className="text-ironbound-grey-600 italic text-center py-0.5">
                — {hiddenCount} older {hiddenCount === 1 ? 'entry' : 'entries'} not shown —
              </p>
            )}
            {visibleEntries.map(entry => (
              <div key={entry.id} className="leading-relaxed">
                <span className="text-ironbound-grey-600 mr-1.5">[{formatTime(entry.created_at)}]</span>
                <span className={ENTRY_COLORS[entry.entry_type] || 'text-ironbound-grey-300'}>{entry.message}</span>
              </div>
            ))}
          </>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
