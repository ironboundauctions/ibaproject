import React, { useState } from 'react';
import { ArrowLeft, Clock, MapPin, Eye, Shield, User, Calendar, FileText, Camera, Gavel } from 'lucide-react';
import { Auction } from '../types/auction';
import { useCountdown } from '../hooks/useCountdown';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency, formatDate, generateBidIncrement } from '../utils/formatters';
import { AuctionService } from '../services/auctionService';
import BidHistory from './BidHistory';

interface AuctionDetailProps {
  auction: Auction;
  onBack: () => void;
}

export default function AuctionDetail({ auction, onBack }: AuctionDetailProps) {
  const { user } = useAuth();
  const timeRemaining = useCountdown(auction.end_time);
  const [bidAmount, setBidAmount] = useState('');
  const [isPlacingBid, setIsPlacingBid] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showBidHistory, setShowBidHistory] = useState(false);

  const currentBid = auction.current_bid || auction.starting_price;
  const minimumBid = currentBid + generateBidIncrement(currentBid);
  const allImages = [auction.image_url, ...(auction.additional_images || [])];

  const handlePlaceBid = async () => {
    if (!user) return;
    
    const amount = parseFloat(bidAmount);
    if (amount < minimumBid) return;

    setIsPlacingBid(true);
    try {
      await AuctionService.placeBid(auction.id, amount);
      setBidAmount('');
      // In a real app, you'd refresh the auction data here
    } catch (error) {
      console.error('Error placing bid:', error);
    } finally {
      setIsPlacingBid(false);
    }
  };

  return (
    <div className="min-h-screen bg-ironbound-grey-500 text-white">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-ironbound-grey-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-ironbound-grey-600 hover:text-ironbound-orange-500 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Auctions</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="relative h-96">
                <img
                  src={allImages[selectedImage]}
                  alt={auction.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-4 left-4 flex space-x-2">
                  <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    Auction Event
                  </span>
                  {auction.has_reserve && (
                    <span className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center space-x-1">
                      <Shield className="h-3 w-3" />
                      <span>Reserve</span>
                    </span>
                  )}
                </div>
              </div>
              
              {allImages.length > 1 && (
                <div className="p-4 border-t border-ironbound-grey-200">
                  <div className="flex space-x-2 overflow-x-auto">
                    {allImages.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImage(index)}
                        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                          selectedImage === index ? 'border-ironbound-orange-500' : 'border-ironbound-grey-200'
                        }`}
                      >
                        <img src={image} alt={`View ${index + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Equipment Details */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-3xl font-bold text-ironbound-grey-900">{auction.title}</h1>
                <span className="bg-ironbound-grey-100 text-ironbound-grey-700 px-3 py-1 rounded-full text-sm font-medium">
                  {auction.category}
                </span>
              </div>

              <p className="text-ironbound-grey-600 mb-6 leading-relaxed">
                {auction.description}
              </p>

              {/* Specifications */}
              {auction.specifications && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-ironbound-grey-900 mb-3 flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>Specifications</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(auction.specifications).map(([key, value]) => (
                      <div key={key} className="flex justify-between p-3 bg-ironbound-grey-50 rounded-lg">
                        <span className="font-medium text-ironbound-grey-700">{key}:</span>
                        <span className="text-ironbound-grey-900">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Condition Report */}
              {auction.condition_report && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-ironbound-grey-900 mb-3">
                    Condition Report
                  </h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-ironbound-grey-700">{auction.condition_report}</p>
                  </div>
                </div>
              )}

              {/* Location and Inspection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="flex items-center space-x-3 p-4 bg-ironbound-grey-50 rounded-lg">
                  <MapPin className="h-5 w-5 text-ironbound-orange-500" />
                  <div>
                    <p className="font-medium text-ironbound-grey-900">Location</p>
                    <p className="text-sm text-ironbound-grey-600">{auction.location}</p>
                  </div>
                </div>
                {auction.inspection_date && (
                  <div className="flex items-center space-x-3 p-4 bg-ironbound-grey-50 rounded-lg">
                    <Calendar className="h-5 w-5 text-ironbound-orange-500" />
                    <div>
                      <p className="font-medium text-ironbound-grey-900">Inspection</p>
                      <p className="text-sm text-ironbound-grey-600">{formatDate(auction.inspection_date)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Auctioneer Info */}
              {auction.auctioneer && (
                <div className="border-t border-ironbound-grey-200 pt-6">
                  <h3 className="text-lg font-semibold text-ironbound-grey-900 mb-3 flex items-center space-x-2">
                    <Gavel className="h-5 w-5" />
                    <span>Auctioneer</span>
                  </h3>
                  <div className="flex items-center space-x-3">
                    <div className="bg-ironbound-orange-100 p-3 rounded-full">
                      <User className="h-6 w-6 text-ironbound-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium text-ironbound-grey-900">{auction.auctioneer.name}</p>
                      <p className="text-sm text-ironbound-grey-600">License: {auction.auctioneer.license}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bid History */}
            {showBidHistory && <BidHistory auctionId={auction.id} />}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Event Status Panel */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  Upcoming Event
                </div>
                <p className="text-sm text-ironbound-grey-600">
                  Auction Event Status
                </p>
              </div>

              {/* Countdown */}
              <div className="mb-6">
                {timeRemaining.isExpired ? (
                  <div className="text-center py-4 bg-red-50 rounded-lg">
                    <span className="text-red-600 font-semibold">Event Ended</span>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1 text-sm text-ironbound-grey-600 mb-3">
                      <Clock className="h-4 w-4" />
                      <span>Event Starts In:</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="bg-ironbound-grey-50 p-3 rounded-lg">
                        <div className="text-xl font-bold text-blue-600">{timeRemaining.days}</div>
                        <div className="text-xs text-ironbound-grey-500">Days</div>
                      </div>
                      <div className="bg-ironbound-grey-50 p-3 rounded-lg">
                        <div className="text-xl font-bold text-blue-600">{timeRemaining.hours}</div>
                        <div className="text-xs text-ironbound-grey-500">Hours</div>
                      </div>
                      <div className="bg-ironbound-grey-50 p-3 rounded-lg">
                        <div className="text-xl font-bold text-blue-600">{timeRemaining.minutes}</div>
                        <div className="text-xs text-ironbound-grey-500">Min</div>
                      </div>
                      <div className="bg-ironbound-grey-50 p-3 rounded-lg">
                        <div className="text-xl font-bold text-blue-600">{timeRemaining.seconds}</div>
                        <div className="text-xs text-ironbound-grey-500">Sec</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Event Actions */}
              {!timeRemaining.isExpired && (
                <button className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold transition-colors">
                  Register for Event
                </button>
              )}

              {/* Event Stats */}
              <div className="mt-6 pt-6 border-t border-ironbound-grey-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ironbound-grey-600">Total Lots:</span>
                  <span className="font-medium text-ironbound-grey-900">0</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-ironbound-grey-600">Registered Bidders:</span>
                  <span className="font-medium text-ironbound-grey-900">0</span>
                </div>
              </div>
            </div>

            {/* Seller Info */}
            {/* Event Info */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-ironbound-grey-900 mb-4">Auction Event</h3>
              <div className="flex items-center space-x-4">
                <img
                  src="/ironbound_primarylogog.png"
                  alt="IronBound Auctions"
                  className="h-12 w-12 rounded-lg"
                />
                <div>
                  <p className="font-medium text-ironbound-grey-900">IronBound Auctions</p>
                  <p className="text-sm text-ironbound-grey-600">Professional Auction Platform</p>
                </div>
              </div>
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Multi-Consigner Event:</strong> Individual items in this auction event 
                  will have their own consigners listed when you add lots to the event.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}