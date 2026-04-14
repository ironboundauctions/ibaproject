import React from 'react';
import { Clock, MapPin, Gavel, Radio, Timer, CheckCircle } from 'lucide-react';
import { Auction } from '../types/auction';
import { useCountdown } from '../hooks/useCountdown';

interface AuctionCardProps {
  auction: Auction;
  onClick: () => void;
}

export default function AuctionCard({ auction, onClick }: AuctionCardProps) {
  const timeRemaining = useCountdown(auction.end_time);
  const isEvent = !!(auction as any).is_event;
  const status = (auction as any).status || '';

  const statusConfig: Record<string, { label: string; icon: any; bg: string; pulse: boolean }> = {
    active: { label: 'LIVE NOW', icon: Radio, bg: 'bg-red-600', pulse: true },
    published: { label: 'Upcoming', icon: Timer, bg: 'bg-blue-600', pulse: false },
    completed: { label: 'Ended', icon: CheckCircle, bg: 'bg-ironbound-grey-400', pulse: false },
  };
  const badge = statusConfig[status] || null;
  const auctionTypeLabel = (auction as any).auction_type === 'timed' ? 'Timed Auction' : 'Live Auction';

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl shadow-sm hover:shadow-xl border border-ironbound-grey-200 hover:border-ironbound-orange-200 transition-all duration-300 cursor-pointer overflow-hidden group"
    >
      <div className="relative h-52 overflow-hidden bg-ironbound-grey-100">
        <img
          src={auction.image_url}
          alt={auction.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {(auction as any).event_number && (
          <div className="absolute top-3 left-3">
            <span className="bg-ironbound-orange-500 text-white px-2.5 py-1 rounded-full text-xs font-bold">
              Event #{(auction as any).event_number}
            </span>
          </div>
        )}

        {badge && (
          <div className="absolute top-3 right-3">
            <span className={`inline-flex items-center gap-1.5 ${badge.bg} text-white px-2.5 py-1 rounded-full text-xs font-bold`}>
              <badge.icon className={`h-3 w-3 ${badge.pulse ? 'animate-pulse' : ''}`} />
              {badge.label}
            </span>
          </div>
        )}

        {isEvent && (
          <div className="absolute bottom-3 left-3">
            <span className="inline-block bg-white/15 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full border border-white/20">
              {auctionTypeLabel}
            </span>
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="text-base font-bold text-ironbound-grey-900 mb-1.5 line-clamp-2 leading-snug">
          {auction.title}
        </h3>

        {auction.description && (
          <p className="text-ironbound-grey-500 text-sm mb-3 line-clamp-2 leading-relaxed">
            {auction.description}
          </p>
        )}

        <div className="space-y-1.5 mb-4">
          {auction.location && (
            <div className="flex items-center gap-1.5 text-sm text-ironbound-grey-500">
              <MapPin className="h-3.5 w-3.5 text-ironbound-grey-400 flex-shrink-0" />
              <span className="truncate">{auction.location}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-sm text-ironbound-grey-500">
            <Gavel className="h-3.5 w-3.5 text-ironbound-grey-400 flex-shrink-0" />
            <span>
              {isEvent
                ? `${(auction as any).total_lots ?? 0} lots`
                : `${auction.bid_count ?? 0} bids`}
            </span>
          </div>
        </div>

        <div className="border-t border-ironbound-grey-100 pt-3 mb-4">
          {timeRemaining.isExpired || status === 'completed' ? (
            <div className="text-center py-1">
              <span className="text-sm text-ironbound-grey-400 font-medium">Auction Ended</span>
            </div>
          ) : status === 'active' ? (
            <div className="text-center py-1">
              <span className="text-sm font-bold text-red-600 flex items-center justify-center gap-1.5">
                <Radio className="h-3.5 w-3.5 animate-pulse" />
                In Progress
              </span>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-center gap-1 text-xs text-ironbound-grey-400 mb-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>Starts in</span>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center">
                {[
                  { val: timeRemaining.days, lbl: 'Days' },
                  { val: timeRemaining.hours, lbl: 'Hrs' },
                  { val: timeRemaining.minutes, lbl: 'Min' },
                  { val: timeRemaining.seconds, lbl: 'Sec' },
                ].map(({ val, lbl }) => (
                  <div key={lbl} className="bg-ironbound-grey-50 rounded-lg py-1.5">
                    <div className="text-base font-bold text-ironbound-orange-500 tabular-nums">
                      {String(val).padStart(2, '0')}
                    </div>
                    <div className="text-xs text-ironbound-grey-400">{lbl}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm transition-colors ${
          status === 'active'
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : status === 'completed' || timeRemaining.isExpired
              ? 'bg-ironbound-grey-100 text-ironbound-grey-400 cursor-not-allowed'
              : 'bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white'
        }`}>
          {status === 'active'
            ? 'Join Live Auction'
            : status === 'completed' || timeRemaining.isExpired
              ? 'Auction Ended'
              : 'View Event Catalog'}
        </button>
      </div>
    </div>
  );
}
