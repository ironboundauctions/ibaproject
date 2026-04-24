import React, { useState, useEffect } from 'react';
import { User, Building, Mail, MapPin, Hash, Phone } from 'lucide-react';
import { Consignor, ConsignorFormData } from '../types/consigner';
import { ConsignorService } from '../services/consignerService';
import ConsignerIdDocuments from './ConsignerIdDocuments';

interface ConsignorFormProps {
  consignor?: Consignor | null;
  onSubmit: (consignorData: ConsignorFormData) => Promise<void>;
  onCancel: () => void;
}

export default function ConsignorForm({ consignor, onSubmit, onCancel }: ConsignorFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [nextAvailable, setNextAvailable] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<ConsignorFormData>({
    customer_number: consignor?.customer_number || '',
    full_name: consignor?.full_name || '',
    nickname: consignor?.nickname || '',
    company: consignor?.company || '',
    address: consignor?.address || '',
    email: consignor?.email || '',
    phone: consignor?.phone || '',
  });

  useEffect(() => {
    if (!consignor) {
      ConsignorService.generateCustomerNumber().then(generatedNumber => {
        setNextAvailable(generatedNumber);
        if (!formData.customer_number) {
          setFormData(prev => ({ ...prev, customer_number: generatedNumber }));
        }
      }).catch(err => {
        console.error('Failed to generate customer number:', err);
      });
    }
  }, [consignor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const validation = ConsignorService.validateCustomerNumber(formData.customer_number, consignor?.id);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save consignor');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhone = (raw: string): string => {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    if (digits.length === 0) return '';
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setFormData(prev => ({ ...prev, phone: formatPhone(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const generateNewCustomerNumber = async () => {
    if (nextAvailable) {
      setFormData(prev => ({ ...prev, customer_number: nextAvailable }));
      return;
    }
    setIsGenerating(true);
    setError('');
    try {
      const newNumber = await ConsignorService.generateCustomerNumber();
      setNextAvailable(newNumber);
      setFormData(prev => ({ ...prev, customer_number: newNumber }));
    } catch (err) {
      console.error('Failed to generate customer number:', err);
      setError('Failed to generate an available customer number');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-ironbound-grey-900">
            {consignor ? 'Edit Consignor' : 'Add New Consignor'}
          </h3>
          <p className="text-sm text-ironbound-grey-600">
            {consignor ? 'Update consignor information' : 'Create a new consignor profile'}
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
            {!consignor && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-ironbound-grey-400 font-mono">
                  {nextAvailable ? (
                    <>Next: <span className="font-semibold text-ironbound-orange-600">{nextAvailable}</span></>
                  ) : (
                    <span className="italic">Loading...</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={generateNewCustomerNumber}
                  disabled={isGenerating}
                  className="px-4 py-2.5 border border-ironbound-grey-300 text-ironbound-grey-700 rounded-lg hover:bg-ironbound-grey-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap flex items-center gap-2 text-sm"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-ironbound-grey-500"></div>
                      Finding...
                    </>
                  ) : (
                    'Use Next Available'
                  )}
                </button>
              </div>
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

        {/* ID Documents */}
        <div className="pt-4 border-t border-ironbound-grey-200">
          {consignor?.id ? (
            <ConsignerIdDocuments consignerId={consignor.id} />
          ) : (
            <p className="text-xs text-ironbound-grey-400 italic">
              Save the consignor first to attach ID documents.
            </p>
          )}
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
              consignor ? 'Update Consignor' : 'Create Consignor'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
