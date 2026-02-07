import React, { useState } from 'react';
import { Calendar, MapPin, User, Gavel, AlertCircle, Image, FileText, Percent, Clock, Globe } from 'lucide-react';
import { AuctionEvent } from '../types/auction';

interface AdminEventFormProps {
  event?: AuctionEvent;
  onSubmit: (eventData: any) => Promise<void>;
  onCancel: () => void;
}

export default function AdminEventForm({ event, onSubmit, onCancel }: AdminEventFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Helper function to format date for datetime-local input
  const formatDateForInput = (dateString: string): string => {
    if (!dateString) return '';
    
    try {
      // Handle different date formats
      let date: Date;
      
      if (dateString.includes('T')) {
        // ISO format: "2025-10-23T09:00:00.000Z" or "2025-10-23T09:00"
        date = new Date(dateString);
      } else {
        // Simple format: "2025-10-23 09:00"
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateString);
        return '';
      }
      
      // Format for datetime-local input: YYYY-MM-DDTHH:MM
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      const formatted = `${year}-${month}-${day}T${hours}:${minutes}`;
      console.log('🔄 formatDateForInput:', dateString, '→', formatted);
      return formatted;
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return '';
    }
  };

  const [formData, setFormData] = useState({
    title: event?.title || '',
    description: event?.description || '',
    auction_type: event?.auction_type || 'live',
    timezone: event?.timezone || 'America/Chicago',
    start_date: formatDateForInput(event?.start_date || ''),
    end_date: formatDateForInput(event?.end_date || ''),
    registration_start: formatDateForInput(event?.registration_start || ''),
    location: event?.location || 'Seminole, TX',
    auctioneer_name: event?.auctioneer?.name || 'Harold Stokes',
    auctioneer_license: event?.auctioneer?.license || 'TX-AUC-2024-001',
    event_terms: event?.event_terms || '',
    main_image_url: event?.main_image_url || '',
    buyers_premium: event?.buyers_premium?.toString() || '10',
    cc_card_fees: event?.cc_card_fees?.toString() || '3'
  });

  // Common US timezones for auction events
  const timezones = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Phoenix', label: 'Arizona Time (MST)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Basic validation
    if (!formData.title.trim()) {
      setError('Event title is required');
      return;
    }
    if (!formData.description.trim()) {
      setError('Event description is required');
      return;
    }
    if (!formData.start_date || !formData.end_date) {
      setError('Start and end dates are required');
      return;
    }
    if (new Date(formData.start_date) >= new Date(formData.end_date)) {
      setError('End date must be after start date');
      return;
    }
    
    setIsLoading(true);

    try {
      console.log('🚀 handleSubmit - RAW form data dates:', {
        start_date: formData.start_date,
        end_date: formData.end_date,
        registration_start: formData.registration_start
      });
      
      // Store dates EXACTLY as entered - no conversion at all
      const eventData = {
        title: formData.title,
        description: formData.description,
        auction_type: formData.auction_type,
        timezone: formData.timezone,
        start_date: formData.start_date,
        end_date: formData.end_date,
        registration_start: formData.registration_start || formData.start_date,
        location: formData.location,
        auctioneer: {
          name: formData.auctioneer_name,
          license: formData.auctioneer_license
        },
        event_terms: formData.event_terms,
        main_image_url: formData.main_image_url,
        buyers_premium: parseFloat(formData.buyers_premium),
        cc_card_fees: parseFloat(formData.cc_card_fees)
      };

      console.log('📤 Submitting EXACT event data:', eventData);
      await onSubmit(eventData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save auction event');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    console.log(`📝 Input changed: ${name} = ${value}`);
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-ironbound-grey-900 mb-2">
          {event ? 'Edit Auction Event' : 'Create New Auction Event'}
        </h3>
        <p className="text-ironbound-grey-600">
          {event ? 'Update your auction event details' : 'Set up a new auction event that will contain multiple lots'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center space-x-2">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Basic Information Section */}
        <div className="space-y-6">
          <div className="border-b border-ironbound-grey-200 pb-4">
            <h4 className="text-lg font-semibold text-ironbound-grey-900 mb-2">Event Information</h4>
            <p className="text-sm text-ironbound-grey-600">Basic details about your auction event</p>
          </div>

          {/* Event Title */}
          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Auction Event Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
              placeholder="e.g., October 2025 Equipment Auction"
            />
          </div>

          {/* Event Description */}
          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Event Description *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              required
              rows={4}
              className="w-full px-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors resize-none text-gray-900 bg-white"
              placeholder="Describe the auction event, what types of equipment will be available, etc."
            />
          </div>

          {/* Auction Type */}
          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Auction Type *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                formData.auction_type === 'live' 
                  ? 'border-ironbound-orange-500 bg-ironbound-orange-50' 
                  : 'border-ironbound-grey-300 hover:border-ironbound-orange-300'
              }`}>
                <input
                  type="radio"
                  name="auction_type"
                  value="live"
                  checked={formData.auction_type === 'live'}
                  onChange={handleInputChange}
                  className="sr-only"
                />
                <div className="flex items-center space-x-3">
                  <Gavel className="h-6 w-6 text-ironbound-orange-500" />
                  <div>
                    <div className="font-medium text-ironbound-grey-900">Live Auction</div>
                    <div className="text-sm text-ironbound-grey-600">Online live bidding + in-person floor bidding</div>
                  </div>
                </div>
              </label>
              
              <label className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                formData.auction_type === 'timed' 
                  ? 'border-ironbound-orange-500 bg-ironbound-orange-50' 
                  : 'border-ironbound-grey-300 hover:border-ironbound-orange-300'
              }`}>
                <input
                  type="radio"
                  name="auction_type"
                  value="timed"
                  checked={formData.auction_type === 'timed'}
                  onChange={handleInputChange}
                  className="sr-only"
                />
                <div className="flex items-center space-x-3">
                  <Clock className="h-6 w-6 text-ironbound-orange-500" />
                  <div>
                    <div className="font-medium text-ironbound-grey-900">Timed Auction</div>
                    <div className="text-sm text-ironbound-grey-600">Online bidding until timer runs out</div>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                Event Timezone *
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                <select
                  name="timezone"
                  value={formData.timezone}
                  onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white appearance-none"
                >
                  {timezones.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-ironbound-grey-500 mt-1">
                All event times will be displayed in this timezone
              </p>
            </div>

            <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Auction Location *
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                required
                className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
                placeholder="City, State or Full Address"
              />
            </div>
            </div>
          </div>
        </div>

        {/* Schedule Section */}
        <div className="space-y-6">
          <div className="border-b border-ironbound-grey-200 pb-4">
            <h4 className="text-lg font-semibold text-ironbound-grey-900 mb-2">Event Schedule</h4>
            <p className="text-sm text-ironbound-grey-600">Set the dates and times for your auction event</p>
          </div>

          {/* Registration Start Date */}
          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Registration Start Date & Time
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
              <input
                type="datetime-local"
                name="registration_start"
                value={formData.registration_start}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
              />
            </div>
            <p className="text-xs text-ironbound-grey-500 mt-1">
              When bidders can start registering and viewing items (optional - defaults to auction start)
            </p>
          </div>

          {/* Auction Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                Auction Start Date & Time *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                <input
                  type="datetime-local"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
                />
              </div>
              <p className="text-xs text-ironbound-grey-400 mt-1">
                {timezones.find(tz => tz.value === formData.timezone)?.label}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                Auction End Date & Time *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                <input
                  type="datetime-local"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
                />
              </div>
              <p className="text-xs text-ironbound-grey-400 mt-1">
                {timezones.find(tz => tz.value === formData.timezone)?.label}
              </p>
            </div>
          </div>
        </div>

        {/* Auctioneer Section */}
        <div className="space-y-6">
          <div className="border-b border-ironbound-grey-200 pb-4">
            <h4 className="text-lg font-semibold text-ironbound-grey-900 mb-2">Auctioneer Information</h4>
            <p className="text-sm text-ironbound-grey-600">Licensed auctioneer conducting this event</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                Auctioneer Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                <input
                  type="text"
                  name="auctioneer_name"
                  value={formData.auctioneer_name}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
                  placeholder="Licensed Auctioneer Name"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                Auctioneer License *
              </label>
              <div className="relative">
                <Gavel className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                <input
                  type="text"
                  name="auctioneer_license"
                  value={formData.auctioneer_license}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
                  placeholder="e.g., NJ-AUC-2024-0156"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Fees Section */}
        <div className="space-y-6">
          <div className="border-b border-ironbound-grey-200 pb-4">
            <h4 className="text-lg font-semibold text-ironbound-grey-900 mb-2">Auction Fees</h4>
            <p className="text-sm text-ironbound-grey-600">Set the fees for this auction event</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                Buyers Premium (%) *
              </label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                <input
                  type="number"
                  name="buyers_premium"
                  value={formData.buyers_premium}
                  onChange={handleInputChange}
                  required
                  min="0"
                  max="25"
                  step="0.5"
                  className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
                  placeholder="10"
                />
              </div>
              <p className="text-xs text-ironbound-grey-500 mt-1">
                Percentage added to winning bid (typically 10-15%)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                CC Card Fees (%) *
              </label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                <input
                  type="number"
                  name="cc_card_fees"
                  value={formData.cc_card_fees}
                  onChange={handleInputChange}
                  required
                  min="0"
                  max="10"
                  step="0.1"
                  className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
                  placeholder="3"
                />
              </div>
              <p className="text-xs text-ironbound-grey-500 mt-1">
                Credit card processing fees (typically 2.5-3.5%)
              </p>
            </div>
          </div>
        </div>

        {/* Media & Terms Section */}
        <div className="space-y-6">
          <div className="border-b border-ironbound-grey-200 pb-4">
            <h4 className="text-lg font-semibold text-ironbound-grey-900 mb-2">Event Image & Terms</h4>
            <p className="text-sm text-ironbound-grey-600">Main catalog image and auction terms</p>
          </div>

          {/* Main Image */}
          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Event Main Picture
            </label>
            
            {/* File Upload Option */}
            <div className="mb-3">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const imageUrl = URL.createObjectURL(file);
                    setFormData(prev => ({ ...prev, main_image_url: imageUrl }));
                  }
                }}
                className="w-full px-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-ironbound-orange-50 file:text-ironbound-orange-700 hover:file:bg-ironbound-orange-100"
              />
              <p className="text-xs text-ironbound-grey-500 mt-1">
                Choose an image file from your computer (JPG, PNG, GIF)
              </p>
            </div>

            {/* OR Divider */}
            <div className="flex items-center my-4">
              <div className="flex-1 border-t border-ironbound-grey-300"></div>
              <span className="px-3 text-sm text-ironbound-grey-500 bg-white">OR</span>
              <div className="flex-1 border-t border-ironbound-grey-300"></div>
            </div>

            {/* URL Input */}
            <div className="relative">
              <Image className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
              <input
                type="url"
                name="main_image_url"
                value={formData.main_image_url}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
                placeholder="https://example.com/event-image.jpg"
              />
            </div>
            <p className="text-xs text-ironbound-grey-500 mt-1">
              Enter an image URL, or leave empty to use a default image
            </p>
            
            {/* Image Preview */}
            {formData.main_image_url && (
              <div className="mt-3">
                <img
                  src={formData.main_image_url}
                  alt="Event preview"
                  className="w-32 h-24 object-cover rounded-lg border border-ironbound-grey-200"
                  onError={(e) => {
                    console.log('Image failed to load');
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          {/* Event Terms */}
          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Event Terms & Conditions
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 h-4 w-4 text-ironbound-grey-400" />
              <textarea
                name="event_terms"
                value={formData.event_terms}
                onChange={handleInputChange}
                rows={6}
                className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors resize-none text-gray-900 bg-white"
                placeholder="Enter auction terms and conditions, payment requirements, pickup information, etc."
              />
            </div>
            <p className="text-xs text-ironbound-grey-500 mt-1">
              Terms that bidders must agree to when registering
            </p>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex space-x-4 pt-8 border-t border-ironbound-grey-200">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-6 py-3 border border-ironbound-grey-300 text-ironbound-grey-700 rounded-lg hover:bg-ironbound-grey-50 transition-colors font-medium"
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
              event ? 'Save Event Changes' : 'Create Auction Event'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}