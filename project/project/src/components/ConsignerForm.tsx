import React, { useState, useEffect } from 'react';
import { User, Building, Mail, MapPin, Hash, Phone } from 'lucide-react';
import { Consigner, ConsignerFormData } from '../types/consigner';
import { ConsignerService } from '../services/consignerService';

interface ConsignerFormProps {
  consigner?: Consigner | null;
  onSubmit: (consignerData: ConsignerFormData) => Promise<void>;
  onCancel: () => void;
}

export default function ConsignerForm({ consigner, onSubmit, onCancel }: ConsignerFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<ConsignerFormData>({
    customer_number: consigner?.customer_number || '',
    full_name: consigner?.full_name || '',
    nickname: consigner?.nickname || '',
    company: consigner?.company || '',
    address: consigner?.address || '',
    email: consigner?.email || '',
    phone: consigner?.phone || '',
  });

  // Generate customer number on mount if creating new consigner
  useEffect(() => {
    if (!consigner && !formData.customer_number) {
      ConsignerService.generateCustomerNumber().then(generatedNumber => {
        setFormData(prev => ({ ...prev, customer_number: generatedNumber }));
      }).catch(err => {
        console.error('Failed to generate customer number:', err);
        setError('Failed to generate customer number');
      });
    }
  }, [consigner, formData.customer_number]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Validate customer number format
      const validation = ConsignerService.validateCustomerNumber(formData.customer_number, consigner?.id);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save consigner');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const generateNewCustomerNumber = async () => {
    try {
      const newNumber = await ConsignerService.generateCustomerNumber();
      setFormData(prev => ({ ...prev, customer_number: newNumber }));
    } catch (err) {
      console.error('Failed to generate customer number:', err);
      setError('Failed to generate customer number');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-ironbound-grey-900">
            {consigner ? 'Edit Consigner' : 'Add New Consigner'}
          </h3>
          <p className="text-sm text-ironbound-grey-600">
            {consigner ? 'Update consigner information' : 'Create a new consigner profile'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Customer Number */}
        <div>
          <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
            Customer Number *
          </label>
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
              <input
                type="text"
                name="customer_number"
                value={formData.customer_number}
                onChange={handleInputChange}
                required
                maxLength={5}
                pattern="[A-Z]\d{4}"
                className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors font-mono text-lg text-gray-900 bg-white"
                placeholder="A0001"
              />
            </div>
            {!consigner && (
              <button
                type="button"
                onClick={generateNewCustomerNumber}
                className="px-4 py-3 border border-ironbound-grey-300 text-ironbound-grey-700 rounded-lg hover:bg-ironbound-grey-50 transition-colors whitespace-nowrap"
              >
                Generate New
              </button>
            )}
          </div>
          <p className="text-xs text-ironbound-grey-500 mt-1">
            Format: One letter followed by 4 digits (e.g., A0001, B0002)
          </p>
        </div>

        {/* Full Name */}
        <div>
          <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
            Full Name *
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleInputChange}
              required
              className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
              placeholder="Enter full name"
            />
          </div>
        </div>

        {/* Nickname */}
        <div>
          <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
            Nickname
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
            <input
              type="text"
              name="nickname"
              value={formData.nickname}
              onChange={handleInputChange}
              className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
              placeholder="Preferred name or nickname (optional)"
            />
          </div>
        </div>

        {/* Company */}
        <div>
          <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
            Company
          </label>
          <div className="relative">
            <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
            <input
              type="text"
              name="company"
              value={formData.company}
              onChange={handleInputChange}
              className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
              placeholder="Company name (optional)"
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
            Address *
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 h-4 w-4 text-ironbound-grey-400" />
            <textarea
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              required
              rows={3}
              className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors resize-none text-gray-900 bg-white"
              placeholder="Full address including city, state, and zip code"
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
            Phone Number *
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              required
              className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
              placeholder="(555) 123-4567"
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
              placeholder="email@example.com"
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
              consigner ? 'Update Consigner' : 'Create Consigner'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}