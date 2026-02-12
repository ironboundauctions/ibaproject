import React, { useState } from 'react';
import { Upload, DollarSign, Tag, Image, FileText, Plus, Trash2, User, Phone, Mail, Eye, X } from 'lucide-react';
import { AuctionLot } from '../types/auction';
import { EQUIPMENT_CATEGORIES } from '../utils/formatters';

interface AdminLotFormProps {
  lot?: AuctionLot;
  onSubmit: (lotData: any) => Promise<void>;
  onCancel: () => void;
}

export default function AdminLotForm({ lot, onSubmit, onCancel }: AdminLotFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreview, setImagePreview] = useState<string>(lot?.image_url || '');
  const [formData, setFormData] = useState({
    lot_number: lot?.lot_number || '',
    title: lot?.title || '',
    description: lot?.description || '',
    category: lot?.category || '',
    starting_price: lot?.starting_price?.toString() || '',
    reserve_price: lot?.reserve_price?.toString() || '',
    has_reserve: lot?.has_reserve || false,
    image_url: lot?.image_url || '',
    condition_report: lot?.condition_report || '',
    estimated_value_low: lot?.estimated_value?.low?.toString() || '',
    estimated_value_high: lot?.estimated_value?.high?.toString() || '',
    consigner_name: lot?.consigner?.name || '',
    consigner_email: lot?.consigner?.email || '',
    consigner_phone: lot?.consigner?.phone || '',
    specifications: lot?.specifications ? Object.entries(lot.specifications).map(([key, value]) => ({ key, value })) : [{ key: '', value: '' }],
    additional_images: lot?.additional_images?.join('\n') || ''
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

      // Handle main image
      let mainImageUrl = formData.image_url;
      if (selectedFiles.length > 0) {
        mainImageUrl = URL.createObjectURL(selectedFiles[0]);
      }

      // Handle additional images
      let additionalImages: string[] = [];
      if (formData.additional_images) {
        additionalImages = formData.additional_images.split('\n').filter(url => url.trim());
      }
      // Add any additional uploaded files
      if (selectedFiles.length > 1) {
        const additionalFileUrls = selectedFiles.slice(1).map(file => URL.createObjectURL(file));
        additionalImages = [...additionalImages, ...additionalFileUrls];
      }

      const lotData = {
        lot_number: formData.lot_number,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        starting_price: parseFloat(formData.starting_price),
        reserve_price: formData.reserve_price ? parseFloat(formData.reserve_price) : undefined,
        has_reserve: formData.has_reserve,
        image_url: mainImageUrl || 'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2',
        condition_report: formData.condition_report || undefined,
        estimated_value: (formData.estimated_value_low && formData.estimated_value_high) ? {
          low: parseFloat(formData.estimated_value_low),
          high: parseFloat(formData.estimated_value_high)
        } : undefined,
        consigner: (formData.consigner_name) ? {
          name: formData.consigner_name,
          email: formData.consigner_email || undefined,
          phone: formData.consigner_phone || undefined
        } : undefined,
        specifications: Object.keys(specificationsObj).length > 0 ? specificationsObj : undefined,
        additional_images: additionalImages.length > 0 ? additionalImages : undefined
      };

      await onSubmit(lotData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save lot');
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

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (files: File[]) => {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    setSelectedFiles(prev => [...prev, ...imageFiles]);
    
    // Set preview for first image
    if (imageFiles.length > 0 && !imagePreview) {
      setImagePreview(URL.createObjectURL(imageFiles[0]));
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    if (index === 0 && selectedFiles.length > 1) {
      setImagePreview(URL.createObjectURL(selectedFiles[1]));
    } else if (index === 0) {
      setImagePreview(formData.image_url);
    }
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

  const generatePreview = () => {
    return {
      lot_number: formData.lot_number || 'Lot #',
      title: formData.title || 'Lot Title',
      description: formData.description || 'Lot description will appear here...',
      category: formData.category || 'Category',
      starting_price: parseFloat(formData.starting_price) || 0,
      image_url: imagePreview || formData.image_url || 'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=2',
      consigner: formData.consigner_name ? { name: formData.consigner_name } : undefined
    };
  };

  const previewData = generatePreview();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main Form */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-ironbound-grey-900">
              {lot ? 'Edit Lot' : 'Add New Lot'}
            </h3>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center space-x-2 text-ironbound-orange-500 hover:text-ironbound-orange-600 transition-colors"
            >
              <Eye className="h-4 w-4" />
              <span>{showPreview ? 'Hide Preview' : 'Show Preview'}</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Basic Information Section */}
            <div className="space-y-6">
              <div className="border-b border-ironbound-grey-200 pb-4">
                <h4 className="text-lg font-semibold text-ironbound-grey-900 mb-2">Basic Information</h4>
                <p className="text-sm text-ironbound-grey-600">Essential details about this lot</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    placeholder="e.g., 001, 002A, etc."
                  />
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

              <div>
                <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                  Item Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
                  placeholder="e.g., 2019 CAT 336 Hydraulic Excavator"
                />
              </div>

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
                  placeholder="Detailed description including condition, features, and any important details..."
                />
              </div>
            </div>

            {/* Images Section */}
            <div className="space-y-6">
              <div className="border-b border-ironbound-grey-200 pb-4">
                <h4 className="text-lg font-semibold text-ironbound-grey-900 mb-2">Images</h4>
                <p className="text-sm text-ironbound-grey-600">Upload or provide URLs for lot images</p>
              </div>

              {/* Drag & Drop Upload Area */}
              <div
                className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive 
                    ? 'border-ironbound-orange-500 bg-ironbound-orange-50' 
                    : 'border-ironbound-grey-300 hover:border-ironbound-orange-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="h-12 w-12 text-ironbound-grey-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-ironbound-grey-900 mb-2">
                  Drop images here or click to browse
                </p>
                <p className="text-sm text-ironbound-grey-600">
                  Supports JPG, PNG, GIF
                </p>
              </div>

              {/* Selected Files Preview */}
              {selectedFiles.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-ironbound-grey-200"
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      {index === 0 && (
                        <span className="absolute bottom-1 left-1 bg-ironbound-orange-500 text-white text-xs px-2 py-1 rounded">
                          Main
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* URL Input Alternative */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                    Main Image URL (Alternative)
                  </label>
                  <div className="relative">
                    <Image className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                    <input
                      type="url"
                      name="image_url"
                      value={formData.image_url}
                      onChange={(e) => {
                        handleInputChange(e);
                        setImagePreview(e.target.value);
                      }}
                      className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                    Additional Image URLs
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
            </div>

            {/* Pricing Section */}
            <div className="space-y-6">
              <div className="border-b border-ironbound-grey-200 pb-4">
                <h4 className="text-lg font-semibold text-ironbound-grey-900 mb-2">Pricing & Estimates</h4>
                <p className="text-sm text-ironbound-grey-600">Set starting prices and estimated values</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                    Est. Low Value
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                    <input
                      type="number"
                      name="estimated_value_low"
                      value={formData.estimated_value_low}
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
                    Est. High Value
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                    <input
                      type="number"
                      name="estimated_value_high"
                      value={formData.estimated_value_high}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="has_reserve"
                    checked={formData.has_reserve}
                    onChange={handleInputChange}
                    className="rounded border-ironbound-grey-300 text-ironbound-orange-500 focus:ring-ironbound-orange-500"
                  />
                  <span className="ml-2 text-sm text-ironbound-grey-700">This lot has a reserve price</span>
                </label>
              </div>
            </div>

            {/* Consigner Information */}
            <div className="space-y-6">
              <div className="border-b border-ironbound-grey-200 pb-4">
                <h4 className="text-lg font-semibold text-ironbound-grey-900 mb-2">Consigner Information</h4>
                <p className="text-sm text-ironbound-grey-600">Details about who consigned this item</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                    Consigner Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                    <input
                      type="text"
                      name="consigner_name"
                      value={formData.consigner_name}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
                      placeholder="Consigner name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                    <input
                      type="email"
                      name="consigner_email"
                      value={formData.consigner_email}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
                      placeholder="email@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                    Phone
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                    <input
                      type="tel"
                      name="consigner_phone"
                      value={formData.consigner_phone}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Specifications */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-ironbound-grey-200 pb-4">
                <div>
                  <h4 className="text-lg font-semibold text-ironbound-grey-900 mb-2">Specifications</h4>
                  <p className="text-sm text-ironbound-grey-600">Technical details and features</p>
                </div>
                <button
                  type="button"
                  onClick={addSpecification}
                  className="flex items-center space-x-1 text-ironbound-orange-500 hover:text-ironbound-orange-600 text-sm font-medium transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Spec</span>
                </button>
              </div>
              
              <div className="space-y-3">
                {formData.specifications.map((spec, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <input
                      type="text"
                      value={spec.key}
                      onChange={(e) => updateSpecification(index, 'key', e.target.value)}
                      placeholder="Feature name"
                      className="flex-1 px-3 py-2 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
                    />
                    <input
                      type="text"
                      value={spec.value}
                      onChange={(e) => updateSpecification(index, 'value', e.target.value)}
                      placeholder="Value/Description"
                      className="flex-1 px-3 py-2 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => removeSpecification(index)}
                      className="text-red-500 hover:text-red-700 transition-colors p-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Condition Report */}
            <div className="space-y-6">
              <div className="border-b border-ironbound-grey-200 pb-4">
                <h4 className="text-lg font-semibold text-ironbound-grey-900 mb-2">Condition Report</h4>
                <p className="text-sm text-ironbound-grey-600">Detailed assessment of item condition</p>
              </div>

              <div className="relative">
                <FileText className="absolute left-3 top-3 h-4 w-4 text-ironbound-grey-400" />
                <textarea
                  name="condition_report"
                  value={formData.condition_report}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors resize-none"
                  placeholder="Describe the current condition, any wear, damage, or notable features..."
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
                  lot ? 'Update Lot' : 'Add Lot'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Live Preview Sidebar */}
      <div className="lg:col-span-1">
        <div className="sticky top-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <h4 className="text-lg font-semibold text-ironbound-grey-900 mb-4">Live Preview</h4>
            
            {/* Preview Card */}
            <div className="border border-ironbound-grey-200 rounded-lg overflow-hidden">
              <div className="relative h-48">
                <img
                  src={previewData.image_url}
                  alt={previewData.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2">
                  <span className="bg-ironbound-orange-500 text-white px-2 py-1 rounded text-xs font-medium">
                    {previewData.lot_number}
                  </span>
                </div>
              </div>
              
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="bg-ironbound-grey-100 text-ironbound-grey-700 px-2 py-1 rounded text-xs font-medium">
                    {previewData.category}
                  </span>
                </div>

                <h5 className="font-bold text-ironbound-grey-900 mb-2 line-clamp-2">
                  {previewData.title}
                </h5>

                <p className="text-sm text-ironbound-grey-600 mb-3 line-clamp-3">
                  {previewData.description}
                </p>

                <div className="border-t border-ironbound-grey-200 pt-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-ironbound-grey-500">Starting Bid</p>
                      <p className="text-lg font-bold text-ironbound-orange-600">
                        ${previewData.starting_price.toLocaleString()}
                      </p>
                    </div>
                    {previewData.consigner && (
                      <div className="text-right">
                        <p className="text-xs text-ironbound-grey-500">Consigner</p>
                        <p className="text-sm font-medium text-ironbound-grey-900">
                          {previewData.consigner.name}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 text-xs text-ironbound-grey-500">
              This is how your lot will appear in the catalog
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}