import React from 'react';
import { Filter, X } from 'lucide-react';
import { AuctionCategory } from '../types/auction';
import { EQUIPMENT_CATEGORIES } from '../utils/formatters';

interface AuctionFiltersProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  priceRange: [number, number];
  onPriceRangeChange: (range: [number, number]) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
}

export default function AuctionFilters({
  selectedCategory,
  onCategoryChange,
  sortBy,
  onSortChange,
  priceRange,
  onPriceRangeChange,
  showFilters,
  onToggleFilters
}: AuctionFiltersProps) {
  const hasActiveFilters = selectedCategory !== '' || priceRange[0] > 0 || priceRange[1] < 10000;

  const clearFilters = () => {
    onCategoryChange('');
    onPriceRangeChange([0, 10000]);
  };

  return (
    <div className="bg-ironbound-grey-600 shadow-md border-b border-ironbound-grey-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">
          <button
            onClick={onToggleFilters}
            className="flex items-center space-x-2 text-white hover:text-ironbound-orange-500 transition-colors"
          >
            <Filter className="h-5 w-5" />
            <span className="font-medium">Filters</span>
            {hasActiveFilters && (
              <span className="bg-ironbound-orange-500 text-white text-xs px-2 py-1 rounded-full">
                Active
              </span>
            )}
          </button>

          <div className="flex items-center space-x-4">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-ironbound-grey-200 hover:text-ironbound-orange-500 text-sm flex items-center space-x-1 transition-colors"
              >
                <X className="h-4 w-4" />
                <span>Clear Filters</span>
              </button>
            )}

            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="bg-white border border-ironbound-grey-300 text-ironbound-grey-900 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
            >
              <option value="ending_soon">Ending Soon</option>
              <option value="newest">Newest First</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
              <option value="most_bids">Most Bids</option>
            </select>
          </div>
        </div>

        {showFilters && (
          <div className="border-t border-ironbound-grey-700 py-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => onCategoryChange(e.target.value)}
                  className="w-full bg-white border border-ironbound-grey-300 text-ironbound-grey-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
                >
                  <option value="">All Categories</option>
                  {EQUIPMENT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Price Range
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={priceRange[0] || ''}
                    onChange={(e) => onPriceRangeChange([Number(e.target.value) || 0, priceRange[1]])}
                    className="w-full bg-white border border-ironbound-grey-300 text-ironbound-grey-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
                  />
                  <span className="text-white">to</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={priceRange[1] === 10000 ? '' : priceRange[1]}
                    onChange={(e) => onPriceRangeChange([priceRange[0], Number(e.target.value) || 10000])}
                    className="w-full bg-white border border-ironbound-grey-300 text-ironbound-grey-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
                  />
                </div>
              </div>

              {/* Quick Filters */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Quick Filters
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onPriceRangeChange([0, 100])}
                    className="px-3 py-1 text-sm border border-white text-white rounded-full hover:border-ironbound-orange-500 hover:text-ironbound-orange-500 transition-colors"
                  >
                    Under $100
                  </button>
                  <button
                    onClick={() => onPriceRangeChange([100, 500])}
                    className="px-3 py-1 text-sm border border-white text-white rounded-full hover:border-ironbound-orange-500 hover:text-ironbound-orange-500 transition-colors"
                  >
                    $100 - $500
                  </button>
                  <button
                    onClick={() => onPriceRangeChange([500, 10000])}
                    className="px-3 py-1 text-sm border border-white text-white rounded-full hover:border-ironbound-orange-500 hover:text-ironbound-orange-500 transition-colors"
                  >
                    Over $500
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}