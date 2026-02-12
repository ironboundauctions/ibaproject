import React, { useState } from 'react';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';

interface AdvancedFiltersProps {
  categories: string[];
  consigners: Array<{ id: string; name: string }>;
  onFilterChange: (filters: FilterState) => void;
}

export interface FilterState {
  categories: string[];
  consignerIds: string[];
  priceMin: string;
  priceMax: string;
  dateFrom: string;
  dateTo: string;
}

export default function AdvancedFilters({ categories, consigners, onFilterChange }: AdvancedFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    categories: [],
    consignerIds: [],
    priceMin: '',
    priceMax: '',
    dateFrom: '',
    dateTo: ''
  });

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const toggleCategory = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    handleFilterChange('categories', newCategories);
  };

  const toggleConsigner = (consignerId: string) => {
    const newConsigners = filters.consignerIds.includes(consignerId)
      ? filters.consignerIds.filter(id => id !== consignerId)
      : [...filters.consignerIds, consignerId];
    handleFilterChange('consignerIds', newConsigners);
  };

  const clearAllFilters = () => {
    const emptyFilters: FilterState = {
      categories: [],
      consignerIds: [],
      priceMin: '',
      priceMax: '',
      dateFrom: '',
      dateTo: ''
    };
    setFilters(emptyFilters);
    onFilterChange(emptyFilters);
  };

  const activeFilterCount =
    filters.categories.length +
    filters.consignerIds.length +
    (filters.priceMin ? 1 : 0) +
    (filters.priceMax ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0);

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-ironbound-grey-50 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <Filter className="h-5 w-5 text-ironbound-grey-600" />
          <span className="font-medium text-ironbound-grey-900">Advanced Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-ironbound-orange-500 text-white text-xs px-2 py-1 rounded-full font-medium">
              {activeFilterCount}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-ironbound-grey-600" />
        ) : (
          <ChevronDown className="h-5 w-5 text-ironbound-grey-600" />
        )}
      </button>

      {isExpanded && (
        <div className="px-6 pb-6 space-y-6 border-t border-ironbound-grey-200">
          <div className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-ironbound-grey-700 mb-3">
                Category
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {categories.map((category) => (
                  <label key={category} className="flex items-center space-x-2 cursor-pointer hover:bg-ironbound-grey-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={filters.categories.includes(category)}
                      onChange={() => toggleCategory(category)}
                      className="h-4 w-4 text-ironbound-orange-500 focus:ring-ironbound-orange-500 border-ironbound-grey-300 rounded"
                    />
                    <span className="text-sm text-ironbound-grey-900">{category}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Consigner Filter */}
            <div>
              <label className="block text-sm font-medium text-ironbound-grey-700 mb-3">
                Consigner
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {consigners.map((consigner) => (
                  <label key={consigner.id} className="flex items-center space-x-2 cursor-pointer hover:bg-ironbound-grey-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={filters.consignerIds.includes(consigner.id)}
                      onChange={() => toggleConsigner(consigner.id)}
                      className="h-4 w-4 text-ironbound-orange-500 focus:ring-ironbound-orange-500 border-ironbound-grey-300 rounded"
                    />
                    <span className="text-sm text-ironbound-grey-900">{consigner.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price Range Filter */}
            <div>
              <label className="block text-sm font-medium text-ironbound-grey-700 mb-3">
                Reserve Price Range
              </label>
              <div className="space-y-3">
                <div>
                  <input
                    type="number"
                    placeholder="Min price"
                    value={filters.priceMin}
                    onChange={(e) => handleFilterChange('priceMin', e.target.value)}
                    className="w-full px-3 py-2 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-sm"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    placeholder="Max price"
                    value={filters.priceMax}
                    onChange={(e) => handleFilterChange('priceMax', e.target.value)}
                    className="w-full px-3 py-2 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-medium text-ironbound-grey-700 mb-3">
                Date Added
              </label>
              <div className="space-y-3">
                <div>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    className="w-full px-3 py-2 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-sm"
                  />
                </div>
                <div>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    className="w-full px-3 py-2 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Active Filters and Clear Button */}
          {activeFilterCount > 0 && (
            <div className="flex items-center justify-between pt-4 border-t border-ironbound-grey-200">
              <div className="flex flex-wrap gap-2">
                {filters.categories.map((category) => (
                  <span
                    key={category}
                    className="inline-flex items-center space-x-1 bg-ironbound-orange-100 text-ironbound-orange-800 text-xs px-2 py-1 rounded-full"
                  >
                    <span>{category}</span>
                    <button
                      onClick={() => toggleCategory(category)}
                      className="hover:bg-ironbound-orange-200 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {filters.consignerIds.map((consignerId) => {
                  const consigner = consigners.find(c => c.id === consignerId);
                  return consigner ? (
                    <span
                      key={consignerId}
                      className="inline-flex items-center space-x-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
                    >
                      <span>{consigner.name}</span>
                      <button
                        onClick={() => toggleConsigner(consignerId)}
                        className="hover:bg-blue-200 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ) : null;
                })}
                {(filters.priceMin || filters.priceMax) && (
                  <span className="inline-flex items-center space-x-1 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                    <span>
                      ${filters.priceMin || '0'} - ${filters.priceMax || '∞'}
                    </span>
                    <button
                      onClick={() => {
                        handleFilterChange('priceMin', '');
                        handleFilterChange('priceMax', '');
                      }}
                      className="hover:bg-green-200 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {(filters.dateFrom || filters.dateTo) && (
                  <span className="inline-flex items-center space-x-1 bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                    <span>
                      {filters.dateFrom || '...'} to {filters.dateTo || '...'}
                    </span>
                    <button
                      onClick={() => {
                        handleFilterChange('dateFrom', '');
                        handleFilterChange('dateTo', '');
                      }}
                      className="hover:bg-purple-200 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
              <button
                onClick={clearAllFilters}
                className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
