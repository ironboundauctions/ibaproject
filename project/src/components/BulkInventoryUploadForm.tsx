import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, Image, AlertCircle, CheckCircle, CreditCard as Edit, Trash2, ArrowRight, ArrowLeft, Package, User, Eye, EyeOff } from 'lucide-react';
import { Consigner, InventoryItem } from '../types/consigner';
import { ConsignerService } from '../services/consignerService';
import { EQUIPMENT_CATEGORIES } from '../utils/formatters';
import { IronDriveService } from '../services/ironDriveService';

interface ProcessedItem {
  id: string;
  inventoryNumber: string;
  title: string;
  description: string;
  consignerCustomerNumber: string;
  category: string;
  condition: string;
  reservePrice: string;
  estimatedValueLow: string;
  estimatedValueHigh: string;
  images: File[];
  barcodeDetected: boolean;
  needsReview: boolean;
}

interface BulkInventoryUploadFormProps {
  eventId: string;
  consigners: Consigner[];
  onUploadComplete: (items: InventoryItem[]) => void;
  onCancel: () => void;
}

export default function BulkInventoryUploadForm({ eventId, consigners, onUploadComplete, onCancel }: BulkInventoryUploadFormProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processedItems, setProcessedItems] = useState<ProcessedItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'review' | 'complete'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  
  // Default values for batch processing
  const [defaultValues, setDefaultValues] = useState({
    consignerCustomerNumber: '',
    category: '',
    condition: 'Good',
    estimatedValueLow: '',
    estimatedValueHigh: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (files: File[]) => {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    setSelectedFiles(prev => [...prev, ...imageFiles]);
    setError('');
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Simulated barcode detection - in real implementation, this would use a barcode reading library
  const simulateBarcodeDetection = async (file: File): Promise<{ detected: boolean; number?: string }> => {
    return new Promise((resolve) => {
      // Simulate processing time
      setTimeout(() => {
        // For demo purposes, assume files with "barcode" or numbers in filename are barcodes
        const filename = file.name.toLowerCase();
        if (filename.includes('barcode') || filename.includes('sticker') || /\d{5,}/.test(filename)) {
          // Extract number from filename or generate one
          const match = filename.match(/(\d{5,})/);
          const number = match ? match[1] : `${eventId}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
          resolve({ detected: true, number });
        } else {
          resolve({ detected: false });
        }
      }, 100);
    });
  };

  const processImages = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select images to process');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const items: ProcessedItem[] = [];
      let currentItem: ProcessedItem | null = null;
      let itemCounter = 1;

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const barcodeResult = await simulateBarcodeDetection(file);

        if (barcodeResult.detected) {
          // Start new item
          if (currentItem) {
            items.push(currentItem);
          }

          currentItem = {
            id: `temp-${Date.now()}-${itemCounter}`,
            inventoryNumber: barcodeResult.number || `${eventId}${String(itemCounter).padStart(3, '0')}`,
            title: `Item ${itemCounter}`,
            description: `Inventory item ${itemCounter}`,
            consignerCustomerNumber: defaultValues.consignerCustomerNumber,
            category: defaultValues.category,
            condition: defaultValues.condition,
            reservePrice: '',
            estimatedValueLow: defaultValues.estimatedValueLow,
            estimatedValueHigh: defaultValues.estimatedValueHigh,
            images: [file],
            barcodeDetected: true,
            needsReview: false
          };
          itemCounter++;
        } else {
          // Add to current item or create orphaned item
          if (currentItem) {
            currentItem.images.push(file);
          } else {
            // Orphaned image - create item that needs review
            currentItem = {
              id: `temp-${Date.now()}-${itemCounter}`,
              inventoryNumber: `${eventId}${String(itemCounter).padStart(3, '0')}`,
              title: `Item ${itemCounter} (Needs Review)`,
              description: `Item created from orphaned images`,
              consignerCustomerNumber: defaultValues.consignerCustomerNumber,
              category: defaultValues.category,
              condition: defaultValues.condition,
              reservePrice: '',
              estimatedValueLow: defaultValues.estimatedValueLow,
              estimatedValueHigh: defaultValues.estimatedValueHigh,
              images: [file],
              barcodeDetected: false,
              needsReview: true
            };
            itemCounter++;
          }
        }
      }

      // Add the last item
      if (currentItem) {
        items.push(currentItem);
      }

      setProcessedItems(items);
      setCurrentStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process images');
    } finally {
      setIsProcessing(false);
    }
  };

  const updateProcessedItem = (index: number, updates: Partial<ProcessedItem>) => {
    setProcessedItems(prev => prev.map((item, i) => 
      i === index ? { ...item, ...updates, needsReview: false } : item
    ));
  };

  const removeProcessedItem = (index: number) => {
    setProcessedItems(prev => prev.filter((_, i) => i !== index));
  };

  const moveImageBetweenItems = (fromItemIndex: number, toItemIndex: number, imageIndex: number) => {
    setProcessedItems(prev => {
      const newItems = [...prev];
      const image = newItems[fromItemIndex].images[imageIndex];
      
      // Remove from source
      newItems[fromItemIndex].images.splice(imageIndex, 1);
      
      // Add to destination
      newItems[toItemIndex].images.push(image);
      
      return newItems;
    });
  };

  const finalizeUpload = async () => {
    setIsUploading(true);
    setError('');

    try {
      const createdItems: InventoryItem[] = [];

      for (const item of processedItems) {
        // Upload images to IronDrive in batches to avoid 413 errors
        let mainImage = '';
        let additionalImages: string[] = [];
        const errors: string[] = [];

        if (item.images.length > 0) {
          const BATCH_SIZE = 5; // Upload max 5 images at a time
          const batches: File[][] = [];

          for (let i = 0; i < item.images.length; i += BATCH_SIZE) {
            batches.push(item.images.slice(i, i + BATCH_SIZE));
          }

          console.log(`[RAID] Uploading ${item.images.length} images in ${batches.length} batches for ${item.inventoryNumber}`);

          for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            const isFirstBatch = batchIndex === 0;

            const uploadResult = await IronDriveService.uploadInventoryImages(
              batch,
              item.inventoryNumber,
              isFirstBatch ? 0 : -1 // First batch has main image, others don't
            );

            if (isFirstBatch) {
              mainImage = uploadResult.mainImageUrl;
              additionalImages = uploadResult.additionalImageUrls;
            } else {
              additionalImages = [...additionalImages, uploadResult.mainImageUrl, ...uploadResult.additionalImageUrls];
            }

            errors.push(...uploadResult.errors);
          }

          if (errors.length > 0) {
            console.warn(`Some images failed to upload for ${item.inventoryNumber}:`, errors);
            alert(`Some images failed to upload: ${errors.join(', ')}`);
          }
        }

        const itemData = {
          event_id: eventId,
          inventory_number: item.inventoryNumber,
          consigner_customer_number: item.consignerCustomerNumber,
          title: item.title,
          description: item.description,
          additional_description: '',
          reserve_price: item.reservePrice,
          category: item.category,
          condition: item.condition,
          estimated_value_low: item.estimatedValueLow,
          estimated_value_high: item.estimatedValueHigh,
          image_url: mainImage || 'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2',
          additional_images: additionalImages.join('\n'),
          specifications: []
        };

        const createdItem = await ConsignerService.createInventoryItem(itemData);
        createdItems.push(createdItem);
      }

      onUploadComplete(createdItems);
      setCurrentStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create items');
    } finally {
      setIsUploading(false);
    }
  };

  if (currentStep === 'complete') {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="text-center py-8">
          <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-ironbound-grey-900 mb-2">Upload Complete!</h3>
          <p className="text-ironbound-grey-600 mb-6">
            Successfully created {processedItems.length} inventory items
          </p>
          <button
            onClick={onCancel}
            className="bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Return to Inventory
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={onCancel}
            className="text-ironbound-grey-200 hover:text-ironbound-orange-500 mb-2 transition-colors"
          >
            ← Back to Inventory
          </button>
          <h2 className="text-2xl font-bold text-white">Bulk Upload Items</h2>
          <p className="text-ironbound-grey-200">Upload multiple images with barcode stickers</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-center space-x-8">
          <div className={`flex items-center space-x-2 ${currentStep === 'upload' ? 'text-ironbound-orange-500' : 'text-green-600'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'upload' ? 'bg-ironbound-orange-500 text-white' : 'bg-green-500 text-white'}`}>
              1
            </div>
            <span className="font-medium">Upload Images</span>
          </div>
          <ArrowRight className="h-4 w-4 text-ironbound-grey-400" />
          <div className={`flex items-center space-x-2 ${currentStep === 'review' ? 'text-ironbound-orange-500' : 'text-ironbound-grey-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'review' ? 'bg-ironbound-orange-500 text-white' : 'bg-ironbound-grey-300 text-ironbound-grey-600'}`}>
              2
            </div>
            <span className="font-medium">Review & Edit</span>
          </div>
          <ArrowRight className="h-4 w-4 text-ironbound-grey-400" />
          <div className="flex items-center space-x-2 text-ironbound-grey-400">
            <div className="w-8 h-8 rounded-full bg-ironbound-grey-300 text-ironbound-grey-600 flex items-center justify-center">
              3
            </div>
            <span className="font-medium">Complete</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {currentStep === 'upload' && (
        <div className="space-y-6">
          {/* Default Values */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-ironbound-grey-900 mb-4">Default Values for All Items</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                  Default Consigner
                </label>
                <select
                  value={defaultValues.consignerCustomerNumber}
                  onChange={(e) => setDefaultValues(prev => ({ ...prev, consignerCustomerNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
                >
                  <option value="">Select consigner</option>
                  {consigners.map((consigner) => (
                    <option key={consigner.id} value={consigner.customer_number}>
                      {consigner.customer_number} - {consigner.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                  Default Category
                </label>
                <select
                  value={defaultValues.category}
                  onChange={(e) => setDefaultValues(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
                >
                  <option value="">Select category</option>
                  {EQUIPMENT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                  Default Condition
                </label>
                <select
                  value={defaultValues.condition}
                  onChange={(e) => setDefaultValues(prev => ({ ...prev, condition: e.target.value }))}
                  className="w-full px-3 py-2 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
                >
                  <option value="Excellent">Excellent</option>
                  <option value="Very Good">Very Good</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                  <option value="For Parts">For Parts</option>
                </select>
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-ironbound-grey-900 mb-4">Upload Images</h3>
            
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
                ref={fileInputRef}
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
              <p className="text-sm text-ironbound-grey-600 mb-4">
                Upload images in order: barcode sticker first, then item photos
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                <h4 className="font-medium text-blue-900 mb-2">📸 Photo Guidelines:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Take a clear photo of the barcode sticker first</li>
                  <li>• Follow with photos of the actual item</li>
                  <li>• Next barcode sticker starts a new item</li>
                  <li>• Supported formats: JPG, PNG, GIF</li>
                </ul>
              </div>
            </div>

            {/* Selected Files Preview */}
            {selectedFiles.length > 0 && (
              <div className="mt-6">
                <h4 className="font-medium text-ironbound-grey-900 mb-3">
                  Selected Images ({selectedFiles.length})
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-ironbound-grey-200"
                      />
                      <button
                        onClick={() => removeFile(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="absolute bottom-1 left-1 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Process Button */}
            <div className="flex justify-end mt-6">
              <button
                onClick={processImages}
                disabled={selectedFiles.length === 0 || isProcessing}
                className="bg-ironbound-orange-500 hover:bg-ironbound-orange-600 disabled:bg-ironbound-grey-300 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Processing Images...</span>
                  </>
                ) : (
                  <>
                    <Package className="h-5 w-5" />
                    <span>Process Images</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {currentStep === 'review' && (
        <div className="space-y-6">
          {/* Review Header */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ironbound-grey-900">Review Processed Items</h3>
                <p className="text-sm text-ironbound-grey-600">
                  {processedItems.length} items created • {processedItems.filter(item => item.needsReview).length} need review
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setCurrentStep('upload')}
                  className="px-4 py-2 border border-ironbound-grey-300 text-ironbound-grey-700 rounded-lg hover:bg-ironbound-grey-50 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4 inline mr-2" />
                  Back to Upload
                </button>
                <button
                  onClick={finalizeUpload}
                  disabled={isUploading || processedItems.some(item => item.needsReview)}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-ironbound-grey-300 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                  {isUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Creating Items...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      <span>Create All Items</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-4">
            {processedItems.map((item, index) => (
              <div key={item.id} className={`bg-white rounded-xl shadow-md overflow-hidden ${item.needsReview ? 'border-2 border-yellow-300' : ''}`}>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <span className="bg-ironbound-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                        {item.inventoryNumber}
                      </span>
                      {item.barcodeDetected ? (
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                          Barcode Detected
                        </span>
                      ) : (
                        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium">
                          Manual Review Needed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedItemIndex(selectedItemIndex === index ? null : index)}
                        className="text-ironbound-orange-600 hover:text-ironbound-orange-900 transition-colors p-1"
                        title="Edit Item"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => removeProcessedItem(index)}
                        className="text-red-600 hover:text-red-900 transition-colors p-1"
                        title="Remove Item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Item Details */}
                    <div>
                      {selectedItemIndex === index ? (
                        <div className="space-y-4">
                          <input
                            type="text"
                            value={item.inventoryNumber}
                            onChange={(e) => updateProcessedItem(index, { inventoryNumber: e.target.value })}
                            className="w-full px-3 py-2 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
                            placeholder="Inventory Number"
                          />
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => updateProcessedItem(index, { title: e.target.value })}
                            className="w-full px-3 py-2 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
                            placeholder="Item Title"
                          />
                          <textarea
                            value={item.description}
                            onChange={(e) => updateProcessedItem(index, { description: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors resize-none text-gray-900 bg-white"
                            placeholder="Description"
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <select
                              value={item.consignerCustomerNumber}
                              onChange={(e) => updateProcessedItem(index, { consignerCustomerNumber: e.target.value })}
                              className="w-full px-3 py-2 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
                            >
                              <option value="">Select consigner</option>
                              {consigners.map((consigner) => (
                                <option key={consigner.id} value={consigner.customer_number}>
                                  {consigner.customer_number} - {consigner.full_name}
                                </option>
                              ))}
                            </select>
                            <select
                              value={item.category}
                              onChange={(e) => updateProcessedItem(index, { category: e.target.value })}
                              className="w-full px-3 py-2 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
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
                      ) : (
                        <div>
                          <h4 className="font-semibold text-ironbound-grey-900 mb-2">{item.title}</h4>
                          <p className="text-sm text-ironbound-grey-600 mb-3">{item.description}</p>
                          <div className="flex items-center space-x-4 text-sm text-ironbound-grey-600">
                            <span>Consigner: {consigners.find(c => c.customer_number === item.consignerCustomerNumber)?.full_name || 'Not selected'}</span>
                            <span>Category: {item.category || 'Not selected'}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Images */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-ironbound-grey-900">Images ({item.images.length})</h5>
                        <button
                          onClick={() => {
                            setShowImagePreview(true);
                            setPreviewImageIndex(0);
                            setSelectedItemIndex(index);
                          }}
                          className="text-ironbound-orange-600 hover:text-ironbound-orange-900 transition-colors text-sm flex items-center space-x-1"
                        >
                          <Eye className="h-4 w-4" />
                          <span>Preview</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {item.images.slice(0, 8).map((image, imgIndex) => (
                          <div key={imgIndex} className="relative group">
                            <img
                              src={URL.createObjectURL(image)}
                              alt={`Item ${index + 1} - Image ${imgIndex + 1}`}
                              className="w-full h-16 object-cover rounded border border-ironbound-grey-200"
                            />
                            <div className="absolute bottom-0 left-0 bg-black bg-opacity-75 text-white text-xs px-1 rounded-tr">
                              {imgIndex + 1}
                            </div>
                          </div>
                        ))}
                        {item.images.length > 8 && (
                          <div className="w-full h-16 bg-ironbound-grey-100 rounded border border-ironbound-grey-200 flex items-center justify-center">
                            <span className="text-xs text-ironbound-grey-600">+{item.images.length - 8}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {showImagePreview && selectedItemIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-ironbound-grey-200">
              <h3 className="text-lg font-semibold text-ironbound-grey-900">
                Item Images - {processedItems[selectedItemIndex].title}
              </h3>
              <button
                onClick={() => setShowImagePreview(false)}
                className="text-ironbound-grey-400 hover:text-ironbound-grey-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4">
              <img
                src={URL.createObjectURL(processedItems[selectedItemIndex].images[previewImageIndex])}
                alt={`Preview ${previewImageIndex + 1}`}
                className="max-w-full max-h-96 mx-auto object-contain"
              />
              <div className="flex items-center justify-center space-x-4 mt-4">
                <button
                  onClick={() => setPreviewImageIndex(Math.max(0, previewImageIndex - 1))}
                  disabled={previewImageIndex === 0}
                  className="px-3 py-2 border border-ironbound-grey-300 text-ironbound-grey-700 rounded-lg hover:bg-ironbound-grey-50 transition-colors disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-ironbound-grey-600">
                  {previewImageIndex + 1} of {processedItems[selectedItemIndex].images.length}
                </span>
                <button
                  onClick={() => setPreviewImageIndex(Math.min(processedItems[selectedItemIndex].images.length - 1, previewImageIndex + 1))}
                  disabled={previewImageIndex === processedItems[selectedItemIndex].images.length - 1}
                  className="px-3 py-2 border border-ironbound-grey-300 text-ironbound-grey-700 rounded-lg hover:bg-ironbound-grey-50 transition-colors disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}