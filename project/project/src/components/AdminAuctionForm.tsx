import React, { useState } from 'react';
import { Upload, DollarSign, Calendar, Tag, MapPin, FileText, Image, Plus, Trash2 } from 'lucide-react';
import { Auction } from '../types/auction';
import { EQUIPMENT_CATEGORIES } from '../utils/formatters';

interface AdminAuctionFormProps {
  auction?: Auction;
  onSubmit: (auctionData: any) => Promise<void>;
  onCancel: () => void;
}

export default function AdminAuctionForm({ auction, onSubmit, onCancel }: AdminAuctionFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: auction?.title || '',
    description: auction?.description || '',
    starting_price: auction?.starting_price?.toString() || '',
    current_bid: auction?.current_bid?.toString() || '0',
    category: auction?.category || '',
    image_url: auction?.image_url || '',
    end_time: auction?.end_time ? new Date(auction.end_time).toISOString().slice(0, 16) : '',
    lot_number: auction?.lot_number || '',
    reserve_price: auction?.reserve_price?.toString() || '',
    has_reserve: auction?.has_reserve || false,
    location: auction?.location || 'Seminole, TX',
    inspection_date: auction?.inspection_date ? new Date(auction.inspection_date).toISOString().slice(0, 16) : '',
    condition_report: auction?.condition_report || '',
    specifications: auction?.specifications ? Object.entries(auction.specifications).map(([key, value]) => ({ key, value })) : [{ key: '', value: '' }],
    additional_images: auction?.additional_images?.join('\n') || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Convert specifications array back to object
      const specificationsObj: Record<string, string> = {};
      formData.specifications.forEach(spec => {
        if (spec.key && spec.value) {
          specificationsObj[spec.key] = spec.value;
        }
      });

      const auctionData = {
        title: formData.title,
        description: formData.description,
        starting_price: parseFloat(formData.starting_price),
        current_bid: parseFloat(formData.current_bid),
        category: formData.category,
        image_url: formData.image_url || 'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2',
        end_time: formData.end_time,
        lot_number: formData.lot_number,
        reserve_price: formData.reserve_price ? parseFloat(formData.reserve_price) : undefined,
        has_reserve: formData.has_reserve,
        location: formData.location,
        inspection_date: formData.inspection_date || undefined,
        condition_report: formData.condition_report || undefined,
        specifications: Object.keys(specificationsObj).length > 0 ? specificationsObj : undefined,
        additional_images: formData.additional_images ? formData.additional_images.split('\n').filter(url => url.trim()) : undefined
      };

      await onSubmit(auctionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save auction');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const addSpecification = () => {
    setFormData(prev => ({
      ...prev,
      specifications: [...prev.specifications, { key: '', value: '' }]
    }));
  };

  const removeSpecification = (index: number) => {
    setFormData(prev => ({
      ...prev,
      specifications: prev.specifications.filter((_, i) => i !== index)
    }));
  };

  const updateSpecification = (index: number, field: 'key' | 'value', value: string) => {
    setFormData(prev => ({
      ...prev,
      specifications: prev.specifications.map((spec, i) => 
        i === index ? { ...spec, [field]: value } : spec
      )
    }));
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Basic Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Auction Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
              placeholder="Enter auction title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Lot Number *
            </label>
            <input
              type="text"
              name="lot_number"
              value={formData.lot_number}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
              placeholder="e.g., Lot 1"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
            Description *
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            required
            rows={4}
            className="w-full px-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors resize-none"
            placeholder="Detailed description of the item"
          />
        </div>

        {/* Pricing and Category */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Starting Price *
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
              <input
                type="number"
                name="starting_price"
                value={formData.starting_price}
                onChange={handleInputChange}
                required
                min="1"
                step="0.01"
                className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Current Bid
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
              <input
                type="number"
                name="current_bid"
                value={formData.current_bid}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Category *
            </label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                required
                className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors appearance-none"
              >
                <option value="">Select category</option>
                {EQUIPMENT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Reserve Price */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Reserve Price
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
              <input
                type="number"
                name="reserve_price"
                value={formData.reserve_price}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
                placeholder="Optional reserve price"
              />
            </div>
          </div>

          <div className="flex items-center pt-8">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="has_reserve"
                checked={formData.has_reserve}
                onChange={handleInputChange}
                className="rounded border-ironbound-grey-300 text-ironbound-orange-500 focus:ring-ironbound-orange-500"
              />
              <span className="ml-2 text-sm text-ironbound-grey-700">Has Reserve Price</span>
            </label>
          </div>
        </div>

        {/* Dates and Location */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              End Time *
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
              <input
                type="datetime-local"
                name="end_time"
                value={formData.end_time}
                onChange={handleInputChange}
                required
                className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Inspection Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
              <input
                type="datetime-local"
                name="inspection_date"
                value={formData.inspection_date}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Location *
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                required
                className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
                placeholder="Auction location"
              />
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Main Image URL
            </label>
            <div className="relative">
              <Image className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
              <input
                type="url"
                name="image_url"
                value={formData.image_url}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Additional Images
            </label>
            <textarea
              name="additional_images"
              value={formData.additional_images}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors resize-none"
              placeholder="One URL per line"
            />
          </div>
        </div>

        {/* Specifications */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-ironbound-grey-700">
              Specifications
            </label>
            <button
              type="button"
              onClick={addSpecification}
              className="flex items-center space-x-1 text-ironbound-orange-500 hover:text-ironbound-orange-600 text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              <span>Add Specification</span>
            </button>
          </div>
          
          <div className="space-y-3">
            {formData.specifications.map((spec, index) => (
              <div key={index} className="flex items-center space-x-3">
                <input
                  type="text"
                  value={spec.key}
                  onChange={(e) => updateSpecification(index, 'key', e.target.value)}
                  placeholder="Specification name"
                  className="flex-1 px-3 py-2 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
                />
                <input
                  type="text"
                  value={spec.value}
                  onChange={(e) => updateSpecification(index, 'value', e.target.value)}
                  placeholder="Value"
                  className="flex-1 px-3 py-2 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => removeSpecification(index)}
                  className="text-red-500 hover:text-red-700 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Condition Report */}
        <div>
          <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
            Condition Report
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-3 h-4 w-4 text-ironbound-grey-400" />
            <textarea
              name="condition_report"
              value={formData.condition_report}
              onChange={handleInputChange}
              rows={3}
              className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors resize-none"
              placeholder="Detailed condition assessment"
            />
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex space-x-4 pt-6 border-t border-ironbound-grey-200">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-6 py-3 border border-ironbound-grey-300 text-ironbound-grey-700 rounded-lg hover:bg-ironbound-grey-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 disabled:bg-ironbound-grey-300 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              auction ? 'Update Auction' : 'Create Auction'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}