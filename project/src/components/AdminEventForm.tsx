import React, { useState, useRef } from 'react';
import { generateUUID } from '../utils/formatters';
import { Calendar, MapPin, User, Gavel, AlertCircle, Image, FileText, Percent, Clock, Globe, Upload, X, Loader, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';
import { AuctionEvent } from '../types/auction';
import { uploadEventImage } from '../services/fileUploadService';
import { LiveClerkService } from '../services/liveClerkService';

interface AdminEventFormProps {
  event?: AuctionEvent;
  onSubmit: (eventData: any) => Promise<void>;
  onCancel: () => void;
}

export default function AdminEventForm({ event, onSubmit, onCancel }: AdminEventFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>(event?.main_image_url || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingEventIdRef = useRef<string>(event?.id || generateUUID());
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

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
    cc_card_fees: event?.cc_card_fees?.toString() || '3',
    pre_bidding_enabled: (event as any)?.pre_bidding_enabled ?? false,
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
      
      const eventData = {
        id: pendingEventIdRef.current,
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
        cc_card_fees: parseFloat(formData.cc_card_fees),
        pre_bidding_enabled: formData.pre_bidding_enabled,
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

  const handleReset = async () => {
    if (!event?.id || resetConfirmText !== 'RESET') return;
    setIsResetting(true);
    try {
      await LiveClerkService.resetAuctionActivity(event.id);
      setResetSuccess(true);
      setShowResetModal(false);
      setResetConfirmText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset auction activity');
      setShowResetModal(false);
    } finally {
      setIsResetting(false);
    }
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

        {/* Bidding Settings Section */}
        <div className="space-y-6">
          <div className="border-b border-ironbound-grey-200 pb-4">
            <h4 className="text-lg font-semibold text-ironbound-grey-900 mb-2">Bidding Settings</h4>
            <p className="text-sm text-ironbound-grey-600">Control bidding options for this event</p>
          </div>

          <div className="flex items-center justify-between p-4 bg-ironbound-grey-50 rounded-xl border border-ironbound-grey-200">
            <div className="flex-1 pr-4">
              <p className="text-sm font-semibold text-ironbound-grey-900">Allow Pre-Bidding</p>
              <p className="text-xs text-ironbound-grey-500 mt-0.5">
                When enabled, registered users can set a maximum pre-bid on any lot before the auction goes live.
                Disable to prevent pre-bidding on this event.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, pre_bidding_enabled: !prev.pre_bidding_enabled }))}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                formData.pre_bidding_enabled
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-ironbound-grey-200 text-ironbound-grey-600 hover:bg-ironbound-grey-300'
              }`}
            >
              {formData.pre_bidding_enabled
                ? <><ToggleRight className="h-5 w-5" /> Pre-Bidding Open</>
                : <><ToggleLeft className="h-5 w-5" /> Pre-Bidding Closed</>
              }
            </button>
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
              Event Cover Image
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setImageUploading(true);
                setError('');
                try {
                  const url = await uploadEventImage(file, pendingEventIdRef.current);
                  setImagePreview(url);
                  setFormData(prev => ({ ...prev, main_image_url: url }));
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Image upload failed');
                } finally {
                  setImageUploading(false);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }
              }}
            />

            {imagePreview ? (
              <div className="relative w-full aspect-video max-h-64 rounded-xl overflow-hidden border border-ironbound-grey-200 bg-ironbound-grey-100">
                <img
                  src={imagePreview}
                  alt="Event cover preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center group">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={imageUploading}
                      className="bg-white text-ironbound-grey-900 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-ironbound-grey-50 transition-colors shadow"
                    >
                      <Upload className="h-4 w-4" />
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview('');
                        setFormData(prev => ({ ...prev, main_image_url: '' }));
                      }}
                      className="bg-white text-red-600 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-red-50 transition-colors shadow"
                    >
                      <X className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>
                {imageUploading && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                    <Loader className="h-8 w-8 animate-spin text-ironbound-orange-500" />
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={imageUploading}
                className="w-full border-2 border-dashed border-ironbound-grey-300 rounded-xl p-10 flex flex-col items-center justify-center gap-3 text-ironbound-grey-500 hover:border-ironbound-orange-400 hover:text-ironbound-orange-500 hover:bg-ironbound-orange-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {imageUploading ? (
                  <>
                    <Loader className="h-8 w-8 animate-spin" />
                    <span className="text-sm font-medium">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Image className="h-10 w-10" />
                    <div className="text-center">
                      <span className="text-sm font-medium block">Click to upload cover image</span>
                      <span className="text-xs mt-1 block">JPG, PNG, WebP or GIF — max 10MB</span>
                    </div>
                  </>
                )}
              </button>
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
        <div className="pt-8 border-t border-ironbound-grey-200 space-y-4">
          <div className="flex space-x-4">
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

          {event && (
            <div className="border-2 border-red-200 rounded-xl overflow-hidden">
              <div className="bg-red-50 px-5 py-3 flex items-center gap-2 border-b border-red-200">
                <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <span className="text-xs font-bold text-red-600 uppercase tracking-widest">Danger Zone</span>
              </div>
              <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white">
                <div>
                  <p className="text-sm font-semibold text-ironbound-grey-900">Reset All Auction Activity</p>
                  <p className="text-xs text-ironbound-grey-500 mt-1 leading-relaxed">
                    Clears all bidding history, lot results, pre-bids, and live session data.
                    Event settings, items, and images are <strong>not</strong> affected.
                  </p>
                  {resetSuccess && (
                    <p className="mt-2 text-xs text-green-700 font-semibold">Auction activity reset successfully.</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setShowResetModal(true); setResetConfirmText(''); setResetSuccess(false); }}
                  className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-red-400 text-red-600 font-semibold text-sm rounded-lg hover:bg-red-50 transition-colors"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Reset Auction Activity
                </button>
              </div>
            </div>
          )}
        </div>
      </form>

      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-7">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-ironbound-grey-900">Reset Auction Activity</h3>
                <p className="text-xs text-ironbound-grey-500">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-5 space-y-1.5 text-sm text-red-700">
              <p className="font-semibold">The following will be permanently deleted:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>All live auction sessions and state</li>
                <li>Complete bidding history log</li>
                <li>All lot results (sold, passed, etc.)</li>
                <li>All pre-bids placed by online bidders</li>
                <li>All lot published flags (lots will be unpublished)</li>
              </ul>
              <p className="font-semibold mt-2">Items, images, and event settings are NOT affected.</p>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-semibold text-ironbound-grey-700 mb-2">
                Type <span className="font-mono bg-ironbound-grey-100 px-1.5 py-0.5 rounded text-red-700">RESET</span> to confirm
              </label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={e => setResetConfirmText(e.target.value)}
                placeholder="RESET"
                autoFocus
                className="w-full px-4 py-3 border-2 border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-red-400 text-ironbound-grey-900 font-mono tracking-widest transition-colors bg-white"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowResetModal(false); setResetConfirmText(''); }}
                className="flex-1 px-4 py-2.5 border border-ironbound-grey-300 text-ironbound-grey-700 rounded-lg font-medium hover:bg-ironbound-grey-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={resetConfirmText !== 'RESET' || isResetting}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:bg-ironbound-grey-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isResetting ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Resetting...</>
                ) : (
                  'Reset All Activity'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}