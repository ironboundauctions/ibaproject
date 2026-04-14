import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, MapPin, Calendar, Gavel, AlertCircle,
  Radio, CheckCircle, Timer, Tag, Clock, Lock,
} from 'lucide-react';
import { PreBidService, CatalogLot } from '../services/preBidService';
import { EventService } from '../services/eventService';
import { formatCurrency, formatDate } from '../utils/formatters';
import LotCatalogGrid from './LotCatalogGrid';
import { useAuth } from '../hooks/useAuth';

interface EventCatalogPageProps {
  eventId: string;
  onBack: () => void;
  onAuthRequired: () => void;
  onJoinLive?: (eventId: string, eventType: 'live' | 'timed') => void;
}

function CountdownDisplay({ targetDate, label }: { targetDate: string; label: string }) {
  const [remaining, setRemaining] = useState(() => calcRemaining(targetDate));

  function calcRemaining(target: string) {
    const diff = new Date(target).getTime() - Date.now();
    if (diff <= 0) return null;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return { days, hours, minutes, seconds };
  }

  useEffect(() => {
    const interval = setInterval(() => setRemaining(calcRemaining(targetDate)), 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!remaining) return null;

  const parts = remaining.days > 0
    ? [
        { val: remaining.days, lbl: 'Days' },
        { val: remaining.hours, lbl: 'Hours' },
        { val: remaining.minutes, lbl: 'Min' },
      ]
    : [
        { val: remaining.hours, lbl: 'Hours' },
        { val: remaining.minutes, lbl: 'Min' },
        { val: remaining.seconds, lbl: 'Sec' },
      ];

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1 text-ironbound-grey-400">
        <Clock className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {parts.map(({ val, lbl }, i) => (
          <React.Fragment key={lbl}>
            <div className="text-center">
              <span className="text-xl font-bold text-ironbound-orange-500 tabular-nums">
                {String(val).padStart(2, '0')}
              </span>
              <span className="text-xs text-ironbound-grey-400 ml-0.5">{lbl}</span>
            </div>
            {i < parts.length - 1 && <span className="text-ironbound-orange-400 font-bold text-lg">:</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
        <Radio className="h-3 w-3 animate-pulse" />
        LIVE NOW
      </span>
    );
  }
  if (status === 'published') {
    return (
      <span className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
        <Timer className="h-3 w-3" />
        Upcoming
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 bg-ironbound-grey-300 text-ironbound-grey-700 text-xs font-bold px-3 py-1.5 rounded-full">
        <CheckCircle className="h-3 w-3" />
        Ended
      </span>
    );
  }
  return null;
}

export default function EventCatalogPage({
  eventId,
  onBack,
  onAuthRequired,
  onJoinLive,
}: EventCatalogPageProps) {
  const { user } = useAuth();
  const [event, setEvent] = useState<any | null>(null);
  const [lots, setLots] = useState<CatalogLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'lots' | 'details'>('lots');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await EventService.getEventById(eventId);
      if (!raw) { setError('Event not found.'); return; }
      const normalized = EventService.normalizeEventForDisplay(raw);
      setEvent(normalized);

      const lotData = await PreBidService.getEventLots(eventId, user?.id);
      setLots(lotData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [eventId, user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-ironbound-grey-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ironbound-orange-500 mx-auto mb-3" />
          <p className="text-ironbound-grey-500 text-sm">Loading event catalog...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-ironbound-grey-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-ironbound-grey-600">{error || 'Event not found'}</p>
          <button onClick={onBack} className="mt-4 text-ironbound-orange-500 hover:underline text-sm font-medium">
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  const isLive = event.status === 'active';
  const isEnded = event.status === 'completed' || event.status === 'cancelled';
  const auctionType: 'live' | 'timed' = event.auction_type === 'timed' ? 'timed' : 'live';
  const auctioneerName = event.auctioneer?.name;
  const preBiddingEnabled = !!event.pre_bidding_enabled;

  const joinButtonDisabled = !isLive;
  const joinButtonTitle = isLive
    ? `Join ${auctionType === 'timed' ? 'Timed' : 'Live'} Auction`
    : 'Auction Not Yet Started';

  const infoItems = [
    event.location && { icon: MapPin, label: 'Location', value: event.location },
    { icon: Calendar, label: 'Starts', value: formatDate(event.start_date) },
    event.bid_increment && { icon: Tag, label: 'Bid Increment', value: formatCurrency(event.bid_increment) },
    auctioneerName && { icon: Gavel, label: 'Auctioneer', value: auctioneerName },
  ].filter(Boolean) as { icon: any; label: string; value: string }[];

  return (
    <div className="min-h-screen bg-ironbound-grey-50">
      {/* Hero */}
      <div className="relative bg-ironbound-grey-900 overflow-hidden" style={{ minHeight: '300px' }}>
        {event.image_url && !event.image_url.includes('pexels') && (
          <img
            src={event.image_url}
            alt={event.title}
            className="absolute inset-0 w-full h-full object-cover opacity-25"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ironbound-grey-900 via-ironbound-grey-900/75 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-ironbound-grey-400 hover:text-white transition-colors mb-6 text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Events
          </button>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {event.event_number && (
                  <span className="bg-ironbound-orange-500/20 border border-ironbound-orange-500/40 text-ironbound-orange-300 text-xs font-bold px-2.5 py-1 rounded-full">
                    Event #{event.event_number}
                  </span>
                )}
                <span className="bg-white/10 text-ironbound-grey-300 text-xs font-medium px-2.5 py-1 rounded-full">
                  {auctionType === 'timed' ? 'Timed Auction' : 'Live Auction'}
                </span>
                <StatusBadge status={event.status} />
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-2">{event.title}</h1>

              {!isEnded && !isLive && (
                <div className="mt-3">
                  <CountdownDisplay targetDate={event.start_date} label="Starts in" />
                </div>
              )}
            </div>

            <div className="flex flex-col items-start sm:items-end gap-3 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 text-center border border-white/10">
                  <p className="text-xl font-bold text-white">{lots.length}</p>
                  <p className="text-ironbound-grey-400 text-xs">Lots</p>
                </div>
                {event.buyers_premium > 0 && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 text-center border border-white/10">
                    <p className="text-xl font-bold text-white">{event.buyers_premium}%</p>
                    <p className="text-ironbound-grey-400 text-xs">Buyer's Premium</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  if (!isLive) return;
                  if (!user) { onAuthRequired(); return; }
                  onJoinLive?.(eventId, auctionType);
                }}
                disabled={joinButtonDisabled}
                title={joinButtonDisabled ? 'Auction has not started yet' : undefined}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                  isLive
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-red-700/30 animate-pulse-subtle'
                    : 'bg-white/10 text-ironbound-grey-400 cursor-not-allowed border border-white/10'
                }`}
              >
                {isLive ? (
                  <Radio className="h-4 w-4 animate-pulse" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                {joinButtonTitle}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Info Strip */}
      <div className="bg-white border-b border-ironbound-grey-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {infoItems.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-1.5 text-sm text-ironbound-grey-600">
                <Icon className="h-3.5 w-3.5 text-ironbound-grey-400 flex-shrink-0" />
                <span className="text-ironbound-grey-400">{label}:</span>
                <span className="font-medium text-ironbound-grey-800">{value}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 text-sm ml-auto">
              {preBiddingEnabled ? (
                <span className="flex items-center gap-1 text-green-600 font-medium text-xs bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Pre-Bidding Open
                </span>
              ) : (
                <span className="flex items-center gap-1 text-ironbound-grey-400 text-xs bg-ironbound-grey-100 px-2.5 py-1 rounded-full">
                  <Lock className="h-3.5 w-3.5" />
                  Pre-Bidding Closed
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-ironbound-grey-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            {(['lots', 'details'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-ironbound-orange-500 text-ironbound-orange-500'
                    : 'border-transparent text-ironbound-grey-500 hover:text-ironbound-grey-800'
                }`}
              >
                {tab === 'lots' ? `Lot Catalog (${lots.length})` : 'Event Details'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'lots' && (
          <LotCatalogGrid
            lots={lots}
            eventId={eventId}
            preBiddingEnabled={preBiddingEnabled}
            eventStatus={event.status}
            onAuthRequired={onAuthRequired}
            onLotsUpdate={setLots}
          />
        )}

        {activeTab === 'details' && (
          <div className="max-w-3xl space-y-5">
            {event.description && (
              <div className="bg-white rounded-2xl border border-ironbound-grey-200 p-6">
                <h3 className="font-bold text-ironbound-grey-900 mb-3">About This Auction</h3>
                <p className="text-ironbound-grey-600 text-sm leading-relaxed whitespace-pre-line">
                  {event.description}
                </p>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-ironbound-grey-200 p-6">
              <h3 className="font-bold text-ironbound-grey-900 mb-4">Fees & Terms</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-ironbound-grey-50 rounded-xl p-4">
                  <p className="text-xs text-ironbound-grey-400 mb-1">Buyer's Premium</p>
                  <p className="text-2xl font-bold text-ironbound-grey-900">{event.buyers_premium}%</p>
                </div>
                {event.cc_card_fees > 0 && (
                  <div className="bg-ironbound-grey-50 rounded-xl p-4">
                    <p className="text-xs text-ironbound-grey-400 mb-1">Credit Card Fee</p>
                    <p className="text-2xl font-bold text-ironbound-grey-900">{event.cc_card_fees}%</p>
                  </div>
                )}
              </div>
              {event.event_terms && (
                <div>
                  <p className="text-xs font-semibold text-ironbound-grey-500 uppercase tracking-wide mb-2">
                    Terms & Conditions
                  </p>
                  <p className="text-sm text-ironbound-grey-600 leading-relaxed whitespace-pre-line">
                    {event.event_terms}
                  </p>
                </div>
              )}
            </div>

            {auctioneerName && (
              <div className="bg-white rounded-2xl border border-ironbound-grey-200 p-6">
                <h3 className="font-bold text-ironbound-grey-900 mb-3">Auctioneer</h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-ironbound-orange-100 flex items-center justify-center flex-shrink-0">
                    <Gavel className="h-5 w-5 text-ironbound-orange-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-ironbound-grey-900">{auctioneerName}</p>
                    {event.auctioneer?.license && (
                      <p className="text-xs text-ironbound-grey-400">License: {event.auctioneer.license}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
