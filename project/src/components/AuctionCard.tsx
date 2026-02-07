import React from 'react';
import { Clock, MapPin, Eye, Shield } from 'lucide-react';
import { Auction } from '../types/auction';
import { useCountdown } from '../hooks/useCountdown';
import { formatCurrency, formatDate } from '../utils/formatters';

interface AuctionCardProps {
  auction: Auction;
  onClick: () => void;
}

export default function AuctionCard({ auction, onClick }: AuctionCardProps) {
  const timeRemaining = useCountdown(auction.end_time);
  const currentBid = auction.current_bid || auction.starting_price;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:scale-105 overflow-hidden"
    >
      {/* Image */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={auction.image_url}
          alt={auction.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-4 left-4">
          <span className="bg-ironbound-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium">
            Event #{auction.lot_number}
          </span>
        </div>
        {auction.has_reserve && (
          <div className="absolute top-4 right-4">
            <span className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center space-x-1">
              <Shield className="h-3 w-3" />
              {auction.is_event ? 'Auction Event' : auction.category}
            </span>
          </div>
        )}
        <div className="absolute bottom-4 left-4 right-4">
          <div className="bg-black bg-opacity-75 text-white px-3 py-2 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm">Event Status</span>
              <span>{auction.is_event ? `${auction.total_lots || 0} lots` : `${auction.bid_count || 0} bids`}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="bg-ironbound-grey-100 text-ironbound-grey-700 px-2 py-1 rounded text-sm font-medium">
            Auction Event
          </span>
          <div className="flex items-center space-x-1 text-sm text-ironbound-grey-500">
            <span>Multi-lot event</span>
          </div>
        </div>

        <h3 className="text-xl font-bold text-ironbound-grey-900 mb-2 line-clamp-2">
          {auction.title}
        </h3>

        <p className="text-ironbound-grey-600 text-sm mb-4 line-clamp-2">
          {auction.description}
        </p>

        {/* Location and Inspection */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center space-x-2 text-sm text-ironbound-grey-600">
            <MapPin className="h-4 w-4" />
            <span>{auction.location}</span>
          </div>
          {auction.inspection_date && (
            <div className="text-sm text-ironbound-grey-600">
              <span className="font-medium">Inspection:</span> {formatDate(auction.inspection_date)}
            </div>
          )}
        </div>

        {/* Countdown */}
        <div className="border-t border-ironbound-grey-200 pt-4">
          {timeRemaining.isExpired ? (
            <div className="text-center">
              <span className="text-red-600 font-semibold">Auction Ended</span>
            </div>
          ) : (
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 text-sm text-ironbound-grey-600 mb-2">
                <Clock className="h-4 w-4" />
                <span>Ends in:</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-lg font-bold text-ironbound-orange-600">{timeRemaining.days}</div>
                  <div className="text-xs text-ironbound-grey-500">Days</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-ironbound-orange-600">{timeRemaining.hours}</div>
                  <div className="text-xs text-ironbound-grey-500">Hours</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-ironbound-orange-600">{timeRemaining.minutes}</div>
                  <div className="text-xs text-ironbound-grey-500">Min</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-ironbound-orange-600">{timeRemaining.seconds}</div>
                  <div className="text-xs text-ironbound-grey-500">Sec</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="mt-4">
          {timeRemaining.isExpired ? (
            <button className="w-full bg-ironbound-grey-300 text-ironbound-grey-600 py-2 px-4 rounded-lg font-medium cursor-not-allowed">
              Event Ended
            </button>
          ) : (
            <button className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
              auction.is_event 
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white'
            }`}>
              {auction.is_event ? 'View Event Details' : 'Place Bid'}
            </button>
          )}
        </div>

        {/* Info Footer */}
        <div className="mt-4 pt-4 border-t border-ironbound-grey-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <img
                src="/ironbound_primarylogog.png"
                alt="IronBound Auctions"
                className="h-6 w-6"
              />
              <p className="text-sm font-medium text-ironbound-grey-900">
                {auction.is_event ? 'Auction Event' : 'Individual Auction'}
              </p>
            </div>
            <p className="text-xs text-ironbound-grey-500">
              {auction.is_event ? 'Multiple Consigners' : auction.seller?.name || 'Consigner'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}