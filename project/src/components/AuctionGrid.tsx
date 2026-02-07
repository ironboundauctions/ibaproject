import React from 'react';
import { Auction } from '../types/auction';
import AuctionCard from './AuctionCard';

interface AuctionGridProps {
  auctions: Auction[];
  onAuctionClick: (auction: Auction) => void;
  isLoading?: boolean;
}

export default function AuctionGrid({ auctions, onAuctionClick, isLoading }: AuctionGridProps) {
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-md overflow-hidden animate-pulse">
              <div className="h-48 bg-ironbound-grey-200"></div>
              <div className="p-6">
                <div className="h-4 bg-ironbound-grey-200 rounded mb-2"></div>
                <div className="h-4 bg-ironbound-grey-200 rounded w-3/4 mb-4"></div>
                <div className="flex justify-between mb-4">
                  <div className="h-6 bg-ironbound-grey-200 rounded w-20"></div>
                  <div className="h-6 bg-ironbound-grey-200 rounded w-16"></div>
                </div>
                <div className="h-16 bg-ironbound-grey-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (auctions.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <img
            src="https://images.pexels.com/photos/4386431/pexels-photo-4386431.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=2"
            alt="No auctions found"
            className="w-64 h-48 object-cover rounded-lg mx-auto mb-6 opacity-50"
          />
          <h3 className="text-2xl font-bold text-ironbound-grey-800 mb-2">No auctions found</h3>
          <h3 className="text-2xl font-bold text-ironbound-grey-800 mb-2">No events found</h3>
          <p className="text-ironbound-grey-600 mb-6">
            Try adjusting your search criteria or check back later for new events.
          </p>
          <button className="bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-md">
            Browse All Categories
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {auctions.map((auction) => (
          <AuctionCard
            key={auction.id}
            auction={auction}
            onClick={() => onAuctionClick(auction)}
          />
        ))}
      </div>
    </div>
  );
}