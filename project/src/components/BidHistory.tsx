import React from 'react';
import { TrendingUp, Clock } from 'lucide-react';

interface BidHistoryProps {
  auctionId: string;
}

export default function BidHistory({ auctionId }: BidHistoryProps) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center space-x-2 mb-6">
        <TrendingUp className="h-5 w-5 text-emerald-600" />
        <h3 className="text-lg font-semibold text-gray-900">Bid History</h3>
      </div>
      <div className="text-center py-8">
        <div className="bg-ironbound-grey-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
          <Clock className="h-8 w-8 text-ironbound-grey-400" />
        </div>
        <h3 className="text-lg font-semibold text-ironbound-grey-900 mb-2">Database Connection Required</h3>
        <p className="text-ironbound-grey-600 mb-4">
          Bid history requires a Supabase database connection.
        </p>
        <p className="text-sm text-ironbound-grey-500">
          Click "Connect to Supabase" in the top right to set up your database.
        </p>
      </div>
    </div>
  );
}