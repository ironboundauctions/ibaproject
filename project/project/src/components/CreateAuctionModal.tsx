import React, { useState, useEffect } from 'react';
import { X, Tag, Image as ImageIcon, Star, Trash2, User } from 'lucide-react';
import { AuctionService } from '../services/auctionService';
import { IronDriveService } from '../services/ironDriveService';
import { ConsignerService } from '../services/consignerService';
import { Auction } from '../types/auction';
import { Consigner } from '../types/consigner';
import { EQUIPMENT_CATEGORIES } from '../utils/formatters';

interface CreateAuctionModalProps {
  onClose: () => void;
  onAuctionCreated: (auction: Auction) => void;
  isModal?: boolean;
}

interface ImageFile {
  file: File;
  preview: string;
}

export default function CreateAuctionModal({ onClose, onAuctionCreated, isModal = true }: CreateAuctionModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadDetails, setUploadDetails] = useState({ current: 0, total: 0, size: '' });
  const [consigners, setConsigners] = useState<Consigner[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    inventory_number: '',
    consigner_id: 'unconsigned'
  });
  const [selectedImages, setSelectedImages] = useState<ImageFile[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState(0);

  useEffect(() => {
    const loadConsigners = async () => {
      const allConsigners = ConsignerService.getConsigners();
      setConsigners(allConsigners);
    };
    loadConsigners();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setUploadProgress('');

    try {
      let mainImageUrl = '';
      let additionalImageUrls: string[] = [];

      if (selectedImages.length > 0) {
        setIsUploading(true);
        const inventoryNumber = formData.inventory_number || `ITEM-${Date.now()}`;
        const files = selectedImages.map(img => img.file);
        const totalSize = files.reduce((sum, f) => sum + f.size, 0);
        const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);

        setUploadDetails({ current: 0, total: files.length, size: totalSizeMB });
        setUploadProgress('Preparing images for upload...');

        const uploadPromise = IronDriveService.uploadInventoryImages(
          files,
          inventoryNumber,
          primaryImageIndex
        );

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Upload timeout - IronDrive may be unavailable')), 15000)
        );

        try {
          setUploadProgress('Uploading images to IronDrive...');
          const uploadResult = await Promise.race([uploadPromise, timeoutPromise]);

          if (uploadResult.errors.length > 0) {
            console.warn('Upload warnings:', uploadResult.errors);
            if (!uploadResult.mainImageUrl) {
              throw new Error(`Image upload failed: ${uploadResult.errors.join(', ')}`);
            }
          }

          mainImageUrl = uploadResult.mainImageUrl;
          additionalImageUrls = uploadResult.additionalImageUrls;
          setUploadProgress('Images uploaded successfully!');
        } catch (uploadError) {
          console.error('IronDrive upload failed:', uploadError);
          setError(`Warning: ${uploadError instanceof Error ? uploadError.message : 'Image upload failed'}. Item will be created without images. You can add images later.`);
          setIsUploading(false);
          setUploadDetails({ current: 0, total: 0, size: '' });
        }
      }

      setUploadProgress('Creating auction item...');

      const auctionData = {
        title: formData.title,
        description: formData.description,
        starting_price: 1,
        category: formData.category,
        image_url: mainImageUrl || 'https://images.pexels.com/photos/4386431/pexels-photo-4386431.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2',
        lot_number: formData.inventory_number,
        additional_images: additionalImageUrls,
        consigner_id: formData.consigner_id === 'unconsigned' ? null : formData.consigner_id
      };

      const newAuction = await AuctionService.createAuction(auctionData);
      setUploadProgress('');
      onAuctionCreated(newAuction);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create auction');
      setUploadProgress('');
    } finally {
      setIsLoading(false);
      setIsUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    const newImages: ImageFile[] = files.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));

    setSelectedImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => {
      const newImages = prev.filter((_, i) => i !== index);

      if (primaryImageIndex === index) {
        setPrimaryImageIndex(0);
      } else if (primaryImageIndex > index) {
        setPrimaryImageIndex(primaryImageIndex - 1);
      }

      return newImages;
    });
  };

  const setPrimaryImage = (index: number) => {
    setPrimaryImageIndex(index);
  };

  return (
    <div className={isModal ? "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" : ""}>
      <div className={isModal ? "bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" : "w-full"}>
        {isModal && <div className="flex items-center justify-between p-6 border-b border-ironbound-grey-200">
          <div className="flex items-center space-x-3">
            <img
              src="/ironbound_primarylogog.png"
              alt="IronBound Auctions"
              className="h-8 w-auto"
            />
            <div>
              <h2 className="text-xl font-bold text-ironbound-grey-900">Create New Auction</h2>
              <p className="text-sm text-ironbound-grey-600">List an individual item for auction</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ironbound-grey-400 hover:text-ironbound-grey-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>}

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {uploadProgress && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between text-blue-700 text-sm mb-2">
                <span>{uploadProgress}</span>
                {uploadDetails.total > 0 && (
                  <span className="font-medium">
                    {uploadDetails.total} {uploadDetails.total === 1 ? 'file' : 'files'} ({uploadDetails.size} MB)
                  </span>
                )}
              </div>
              {isUploading && uploadDetails.total > 0 && (
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full transition-all duration-300 animate-pulse" style={{ width: '100%' }} />
                </div>
              )}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                Inventory Number
              </label>
              <input
                type="text"
                name="inventory_number"
                value={formData.inventory_number}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-ironbound-grey-900"
                placeholder="e.g., ITEM-12345 (auto-generated if left empty)"
              />
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
                className="w-full px-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-ironbound-grey-900"
                placeholder="Enter a descriptive title for your item"
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
                className="w-full px-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors resize-none text-ironbound-grey-900"
                placeholder="Provide detailed information about your item including condition, history, and any special features"
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
                  className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors appearance-none text-ironbound-grey-900"
                >
                  <option value="">Select a category</option>
                  {EQUIPMENT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                Consigner
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                <select
                  name="consigner_id"
                  value={formData.consigner_id}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors appearance-none text-ironbound-grey-900"
                >
                  <option value="unconsigned">Unconsigned</option>
                  {consigners.map((consigner) => (
                    <option key={consigner.id} value={consigner.id}>
                      {consigner.customer_number} - {consigner.full_name}
                      {consigner.company ? ` (${consigner.company})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                Item Images
              </label>

              <div className="border-2 border-dashed border-ironbound-grey-300 rounded-lg p-6 text-center hover:border-ironbound-orange-500 transition-colors">
                <ImageIcon className="h-12 w-12 text-ironbound-grey-400 mx-auto mb-3" />
                <label className="cursor-pointer">
                  <span className="text-ironbound-orange-600 hover:text-ironbound-orange-700 font-medium">
                    Click to upload images
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-ironbound-grey-500 mt-2">
                  Upload multiple images. Click the star to set the primary image.
                </p>
              </div>

              {selectedImages.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-ironbound-grey-700 mb-3">
                    Selected Images ({selectedImages.length})
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    {selectedImages.map((image, index) => (
                      <div
                        key={index}
                        className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                          index === primaryImageIndex
                            ? 'border-ironbound-orange-500 ring-2 ring-ironbound-orange-200'
                            : 'border-ironbound-grey-300'
                        }`}
                      >
                        <img
                          src={image.preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-32 object-cover"
                        />

                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPrimaryImage(index)}
                            className={`opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-full ${
                              index === primaryImageIndex
                                ? 'bg-ironbound-orange-500 text-white'
                                : 'bg-white text-ironbound-grey-700 hover:bg-ironbound-orange-500 hover:text-white'
                            }`}
                            title="Set as primary image"
                          >
                            <Star className="h-4 w-4" fill={index === primaryImageIndex ? 'currentColor' : 'none'} />
                          </button>

                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white p-2 rounded-full"
                            title="Remove image"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {index === primaryImageIndex && (
                          <div className="absolute top-2 left-2">
                            <span className="bg-ironbound-orange-500 text-white text-xs font-bold px-2 py-1 rounded">
                              PRIMARY
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex space-x-4 mt-8">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading || isUploading}
              className="flex-1 px-6 py-3 border border-ironbound-grey-300 text-ironbound-grey-700 rounded-lg hover:bg-ironbound-grey-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || isUploading}
              className="flex-1 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 disabled:bg-ironbound-grey-300 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
            >
              {isLoading || isUploading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                'Create Item'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
