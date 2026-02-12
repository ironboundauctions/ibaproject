import React, { useState, useEffect } from 'react';
import { Edit, Trash2, Eye, DollarSign, User } from 'lucide-react';
import { AdminService } from '../services/adminService';
import { formatCurrency } from '../utils/formatters';

interface LotsGridProps {
  auctionId: string;
  onEditLot: (lot: any) => void;
}

export default function LotsGrid({ auctionId, onEditLot }: LotsGridProps) {
  const [lots, setLots] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLots = async () => {
      try {
        const lotsData = await AdminService.getLotsForAuction(auctionId);
        setLots(lotsData);
      } catch (error) {
        console.error('Error fetching lots:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLots();
  }, [auctionId]);

  const handleDeleteLot = async (lotId: string) => {
    if (!confirm('Are you sure you want to delete this lot?')) return;
    
    try {
      await AdminService.deleteLot(lotId);
      setLots(prev => prev.filter(lot => lot.id !== lotId));
    } catch (error) {
      console.error('Error deleting lot:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ironbound-orange-500 mx-auto mb-4"></div>
          <p className="text-ironbound-grey-500">Loading lots...</p>
        </div>
      </div>
    );
  }

  if (lots.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="text-center py-12">
          <div className="bg-ironbound-grey-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Eye className="h-8 w-8 text-ironbound-grey-400" />
          </div>
          <h3 className="text-lg font-semibold text-ironbound-grey-900 mb-2">No lots added yet</h3>
          <p className="text-ironbound-grey-600 mb-4">
            Start building your auction catalog by adding individual lots
          </p>
          <p className="text-sm text-ironbound-grey-500">
            Each lot will appear as a separate item in the auction catalog
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Header */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-ironbound-orange-600">{lots.length}</div>
            <div className="text-sm text-ironbound-grey-600">Total Lots</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {lots.filter(lot => lot.status === 'active').length}
            </div>
            <div className="text-sm text-ironbound-grey-600">Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(lots.reduce((sum, lot) => sum + (lot.starting_price || 0), 0))}
            </div>
            <div className="text-sm text-ironbound-grey-600">Total Starting Value</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {new Set(lots.map(lot => lot.category)).size}
            </div>
            <div className="text-sm text-ironbound-grey-600">Categories</div>
          </div>
        </div>
      </div>

      {/* Lots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {lots.map((lot) => (
          <div key={lot.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
            {/* Image */}
            <div className="relative h-48">
              <img
                src={lot.image_url}
                alt={lot.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3">
                <span className="bg-ironbound-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                  {lot.lot_number}
                </span>
              </div>
              <div className="absolute top-3 right-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  lot.status === 'active' 
                    ? 'bg-green-100 text-green-800'
                    : lot.status === 'sold'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {lot.status || 'active'}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="bg-ironbound-grey-100 text-ironbound-grey-700 px-2 py-1 rounded text-xs font-medium">
                  {lot.category}
                </span>
                {lot.has_reserve && (
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                    Reserve
                  </span>
                )}
              </div>

              <h3 className="font-bold text-ironbound-grey-900 mb-2 line-clamp-2">
                {lot.title}
              </h3>

              <p className="text-sm text-ironbound-grey-600 mb-3 line-clamp-2">
                {lot.description}
              </p>

              {/* Pricing */}
              <div className="border-t border-ironbound-grey-200 pt-3 mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-ironbound-grey-500">Starting Price</p>
                    <p className="text-lg font-bold text-ironbound-orange-600">
                      {formatCurrency(lot.starting_price)}
                    </p>
                  </div>
                  {lot.estimated_value && (
                    <div className="text-right">
                      <p className="text-xs text-ironbound-grey-500">Estimate</p>
                      <p className="text-sm font-medium text-ironbound-grey-900">
                        {formatCurrency(lot.estimated_value.low)} - {formatCurrency(lot.estimated_value.high)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Consigner */}
              {lot.consigner && (
                <div className="flex items-center space-x-2 mb-3 text-sm text-ironbound-grey-600">
                  <User className="h-4 w-4" />
                  <span>Consigned by {lot.consigner.name}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-ironbound-grey-200">
                <div className="text-xs text-ironbound-grey-500">
                  Created {new Date(lot.created_at).toLocaleDateString()}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onEditLot(lot)}
                    className="text-ironbound-orange-600 hover:text-ironbound-orange-800 transition-colors p-1"
                    title="Edit Lot"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteLot(lot.id)}
                    className="text-red-600 hover:text-red-800 transition-colors p-1"
                    title="Delete Lot"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}