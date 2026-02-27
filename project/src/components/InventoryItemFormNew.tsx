import React, { useState, useEffect } from 'react';
import { X, Upload, Loader, ExternalLink } from 'lucide-react';
import { InventoryItem, CreateInventoryItemData } from '../services/inventoryService';
import { Consigner } from '../types/consigner';
import { FileUploadService } from '../services/fileUploadService';
import { supabase } from '../lib/supabase';
import { EQUIPMENT_CATEGORIES } from '../utils/formatters';

interface Props {
  item?: InventoryItem | null;
  consigners: Consigner[];
  onSubmit: (data: CreateInventoryItemData) => Promise<any>;
  onCancel: () => void;
}

interface SelectedFile {
  id: string;
  file?: File;
  url?: string;
  backupUrl?: string;
  name: string;
  isVideo: boolean;
  type: 'pc' | 'irondrive';
  sourceKey?: string;
  mimeType?: string;
  uploadStatus?: 'pending' | 'uploading' | 'uploaded' | 'processing' | 'published' | 'error';
  assetGroupId?: string;
  errorMessage?: string;
}

function guessMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || '';
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    webm: 'video/webm'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

export default function InventoryItemFormNew({ item, consigners, onSubmit, onCancel }: Props) {
  const [itemId] = useState(() => item?.id || crypto.randomUUID());

  const [formData, setFormData] = useState({
    inventory_number: item?.inventory_number || '',
    title: item?.title || '',
    description: item?.description || '',
    category: item?.category || '',
    reserve_price: item?.reserve_price?.toString() || '',
    estimated_value_low: item?.estimated_value_low?.toString() || '',
    estimated_value_high: item?.estimated_value_high?.toString() || '',
    consigner_customer_number: '',
    condition: item?.condition || '',
    additional_description: item?.notes || ''
  });

  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [processingIronDriveFiles, setProcessingIronDriveFiles] = useState(false);

  useEffect(() => {
    if (item) {
      loadExistingFiles();
    }

    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== 'https://irondrive.ibaproject.bid') return;

      if (event.data.type === 'irondrive-selection' && event.data.files) {
        handleIronDriveSelection(event.data.files);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [item]);

  useEffect(() => {
    return () => {
      selectedFiles.forEach(file => {
        if (file?.url && file.file) {
          URL.revokeObjectURL(file.url);
        }
      });
    };
  }, [selectedFiles]);

  const handleIronDrivePickerClick = () => {
    const returnUrl = encodeURIComponent(window.location.origin);
    window.open(
      `https://irondrive.ibaproject.bid/picker?return_to=${returnUrl}`,
      'irondrivePicker',
      'width=1200,height=800'
    );
  };

  const loadExistingFiles = async () => {
    if (!item?.id) return;

    try {
      const { data: files, error } = await supabase
        .from('auction_files')
        .select('*')
        .eq('item_id', item.id)
        .in('variant', ['display', 'thumb', 'source'])
        .is('detached_at', null)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (files && files.length > 0) {
        const groupedByAsset = files.reduce((acc, file) => {
          if (!acc[file.asset_group_id]) {
            acc[file.asset_group_id] = [];
          }
          acc[file.asset_group_id].push(file);
          return acc;
        }, {} as Record<string, any[]>);

        const existing = Object.values(groupedByAsset).map(group => {
          const displayFile = group.find(f => f.variant === 'display');
          const thumbFile = group.find(f => f.variant === 'thumb');
          const sourceFile = group.find(f => f.variant === 'source');
          const primaryFile = displayFile || thumbFile || sourceFile || group[0];

          const previewUrl = displayFile?.cdn_url || thumbFile?.cdn_url;

          console.log('[LOAD] Building file object:', {
            assetGroupId: primaryFile.asset_group_id,
            displayCdnUrl: displayFile?.cdn_url,
            thumbCdnUrl: thumbFile?.cdn_url,
            sourceKey: sourceFile?.source_key,
            previewUrl,
            publishedStatus: primaryFile.published_status
          });

          return {
            id: primaryFile.asset_group_id,
            type: (sourceFile?.source_key ? 'irondrive' : 'pc') as 'pc' | 'irondrive',
            url: previewUrl,
            name: sourceFile?.original_name || primaryFile.original_name || 'file',
            isVideo: primaryFile.mime_type?.startsWith('video/') || false,
            sourceKey: sourceFile?.source_key,
            mimeType: primaryFile.mime_type,
            uploadStatus: (primaryFile.published_status === 'published' ? 'published' :
                         primaryFile.published_status === 'processing' ? 'processing' :
                         primaryFile.published_status === 'pending' ? 'processing' : 'uploaded') as any,
            assetGroupId: primaryFile.asset_group_id
          };
        });
        setSelectedFiles(existing);
      }
    } catch (error) {
      console.error('[FORM] Error loading files:', error);
    }
  };

  const handleIronDriveSelection = async (pickerFiles: any[]) => {
    console.log('[IRONDRIVE] Staging files for later submission:', pickerFiles);
    setProcessingIronDriveFiles(true);
    setError('');

    try {
      const fileRecords: SelectedFile[] = [];

      for (const file of pickerFiles) {
        const fileName = file.filename || file.name || file.source_key?.split('/').pop() || 'unknown';
        const assetGroupId = crypto.randomUUID();
        const mimeType = file.mime_type || file.mimeType || guessMimeType(fileName);

        console.log('[IRONDRIVE] Staging file:', {
          asset_group_id: assetGroupId,
          source_key: file.source_key,
          mime_type: mimeType,
          file_name: fileName
        });

        fileRecords.push({
          id: assetGroupId,
          type: 'irondrive' as const,
          url: '',
          name: fileName,
          isVideo: mimeType.startsWith('video/'),
          sourceKey: file.source_key,
          mimeType: mimeType,
          uploadStatus: 'pending' as const,
          assetGroupId
        });
      }

      setSelectedFiles(prev => [...prev, ...fileRecords]);
      console.log('[IRONDRIVE] Files staged, will be saved on form submission');
    } catch (err) {
      console.error('[IRONDRIVE] Error staging files:', err);
      setError('Failed to stage IronDrive files. Please try again.');
    } finally {
      setProcessingIronDriveFiles(false);
    }
  };

  const waitForCdnUrls = async (assetGroupIds: string[]): Promise<void> => {
    const maxAttempts = 60;
    let attempts = 0;
    const pendingIds = new Set(assetGroupIds);

    while (pendingIds.size > 0 && attempts < maxAttempts) {
      attempts++;
      console.log(`[POLL] Attempt ${attempts}/${maxAttempts}, checking ${pendingIds.size} files`);

      try {
        const { data: files, error } = await supabase
          .from('auction_files')
          .select('asset_group_id, cdn_url, published_status, variant')
          .in('asset_group_id', Array.from(pendingIds))
          .eq('variant', 'display');

        if (error) throw error;

        console.log('[POLL] Query result:', {
          filesFound: files?.length || 0,
          files: files?.map(f => ({
            asset_group_id: f.asset_group_id,
            has_cdn_url: !!f.cdn_url,
            published_status: f.published_status
          }))
        });

        for (const file of files || []) {
          if (file.cdn_url && file.published_status === 'published') {
            console.log('[POLL] File ready:', file.asset_group_id, file.cdn_url);
            pendingIds.delete(file.asset_group_id);

            setSelectedFiles(prev => prev.map(f =>
              f.assetGroupId === file.asset_group_id
                ? { ...f, url: file.cdn_url, uploadStatus: 'published' as const }
                : f
            ));
          }
        }

        if (pendingIds.size === 0) {
          console.log('[POLL] All files processed!');
          setProcessingIronDriveFiles(false);
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        console.error('[POLL] Error:', err);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (pendingIds.size > 0) {
      console.warn('[POLL] Max attempts reached, some files still pending');
      setProcessingIronDriveFiles(false);
      throw new Error('Some files are taking longer than expected to process');
    }

    setProcessingIronDriveFiles(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const files = Array.from(e.target.files);
    const mediaFiles = files.filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/')
    );

    const newFiles: SelectedFile[] = mediaFiles.map(file => ({
      id: `temp-${Date.now()}-${Math.random()}`,
      type: 'pc' as const,
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      isVideo: file.type.startsWith('video/'),
      uploadStatus: 'pending'
    }));

    setSelectedFiles(prev => [...prev, ...newFiles]);

    e.target.value = '';
  };

  const removeFile = async (id: string) => {
    setSelectedFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.url && file.file) {
        URL.revokeObjectURL(file.url);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const uploadPCFiles = async (filesToUpload: SelectedFile[], itemId: string) => {
    setUploadProgress({ current: 0, total: filesToUpload.length });

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];

      setSelectedFiles(prev => prev.map(f =>
        f.id === file.id ? { ...f, uploadStatus: 'uploading' as const } : f
      ));

      try {
        const result = await FileUploadService.uploadPCFileToWorker(file.file!, itemId);

        if (result.success && result.files.length > 0) {
          const displayFile = result.files.find(f => f.variant === 'display') || result.files[0];

          setSelectedFiles(prev => prev.map(f =>
            f.id === file.id ? {
              ...f,
              uploadStatus: 'published' as const,
              url: displayFile.cdn_url,
              assetGroupId: displayFile.id
            } : f
          ));
        } else {
          throw new Error(result.error || 'Upload failed');
        }
      } catch (error) {
        console.error(`[PC-UPLOAD] Error uploading ${file.name}:`, error);
        setSelectedFiles(prev => prev.map(f =>
          f.id === file.id ? {
            ...f,
            uploadStatus: 'error' as const,
            errorMessage: error instanceof Error ? error.message : 'Upload failed'
          } : f
        ));
      }

      setUploadProgress({ current: i + 1, total: filesToUpload.length });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSubmitProgress('Creating item...');

    try {
      const consigner = consigners.find(c => c.customer_number === formData.consigner_customer_number);

      const submitData: CreateInventoryItemData = {
        id: itemId,
        inventory_number: formData.inventory_number,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        starting_price: parseFloat(formData.reserve_price) || 0,
        reserve_price: parseFloat(formData.reserve_price) || undefined,
        estimated_value_low: parseFloat(formData.estimated_value_low) || undefined,
        estimated_value_high: parseFloat(formData.estimated_value_high) || undefined,
        image_url: 'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg',
        consigner_id: consigner?.id,
        condition: formData.condition,
        notes: formData.additional_description
      };

      const result = await onSubmit(submitData);
      const savedItemId = itemId;

      setSubmitProgress('Item created successfully!');

      const pendingIronDriveFiles = selectedFiles.filter(f => f.type === 'irondrive' && f.uploadStatus === 'pending');
      const pendingPCFiles = selectedFiles.filter(f => f.type === 'pc' && f.uploadStatus === 'pending');

      if (pendingPCFiles.length > 0) {
        setSubmitProgress(`Uploading ${pendingPCFiles.length} file${pendingPCFiles.length > 1 ? 's' : ''}...`);
        await uploadPCFiles(pendingPCFiles, savedItemId);
        setSubmitProgress('Files uploaded successfully!');
      }

      if (pendingIronDriveFiles.length > 0) {
        setSubmitProgress(`Processing ${pendingIronDriveFiles.length} IronDrive file${pendingIronDriveFiles.length > 1 ? 's' : ''}...`);

        for (const file of pendingIronDriveFiles) {
          const { error: dbError } = await supabase.from('auction_files').insert({
            item_id: savedItemId,
            asset_group_id: file.assetGroupId!,
            variant: 'source',
            source_key: file.sourceKey!,
            original_name: file.name,
            mime_type: file.mimeType!,
            published_status: 'pending'
          });

          if (dbError) {
            console.error('[IRONDRIVE] Error saving file:', dbError);
            throw new Error(`Failed to save IronDrive file: ${file.name}`);
          }
        }

        const assetGroupIds = pendingIronDriveFiles.map(f => f.assetGroupId!);
        await waitForCdnUrls(assetGroupIds);
        setSubmitProgress('IronDrive files processed!');
      }

      if (item?.id) {
        const { data: existingFiles } = await supabase
          .from('auction_files')
          .select('asset_group_id')
          .eq('item_id', item.id);

        if (existingFiles) {
          const currentAssetGroupIds = selectedFiles
            .filter(f => f.assetGroupId)
            .map(f => f.assetGroupId);

          const assetGroupsToDelete = existingFiles
            .map(f => f.asset_group_id)
            .filter(id => !currentAssetGroupIds.includes(id));

          if (assetGroupsToDelete.length > 0) {
            await supabase
              .from('auction_files')
              .update({ detached_at: new Date().toISOString() })
              .in('asset_group_id', assetGroupsToDelete);

            console.log('[FORM] Marked files as detached for cleanup');
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      onCancel();
    } catch (error) {
      console.error('[FORM] Submit error:', error);
      setError(error instanceof Error ? error.message : 'Failed to save item');
      setSubmitProgress('');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white mb-1">
            Inventory Number *
          </label>
          <input
            type="text"
            required
            value={formData.inventory_number}
            onChange={(e) => setFormData(prev => ({ ...prev, inventory_number: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-transparent text-gray-900 bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-1">
            Category
          </label>
          <select
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-transparent text-gray-900 bg-white"
          >
            <option value="">Select category...</option>
            {EQUIPMENT_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-1">
          Title
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-transparent text-gray-900 bg-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-1">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-transparent text-gray-900 bg-white"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-white mb-1">
            Reserve Price
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.reserve_price}
            onChange={(e) => setFormData(prev => ({ ...prev, reserve_price: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-transparent text-gray-900 bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-1">
            Est. Value (Low)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.estimated_value_low}
            onChange={(e) => setFormData(prev => ({ ...prev, estimated_value_low: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-transparent text-gray-900 bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-1">
            Est. Value (High)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.estimated_value_high}
            onChange={(e) => setFormData(prev => ({ ...prev, estimated_value_high: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-transparent text-gray-900 bg-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-2">
          Media Files
        </label>

        <div className="grid grid-cols-2 gap-4">
          {/* PC Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-ironbound-orange-400 transition-colors">
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <Upload className="w-10 h-10 text-gray-400 mb-2" />
              <span className="text-sm font-medium text-white mb-1">
                Upload from PC
              </span>
              <span className="text-xs text-gray-400">
                Select files from your computer
              </span>
            </label>
          </div>

          {/* IronDrive Picker */}
          <button
            type="button"
            onClick={handleIronDrivePickerClick}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-ironbound-orange-400 transition-colors"
          >
            <div className="flex flex-col items-center">
              <ExternalLink className="w-10 h-10 text-gray-400 mb-2" />
              <span className="text-sm font-medium text-white mb-1">
                Pick from IronDrive
              </span>
              <span className="text-xs text-gray-400">
                Select files from IronDrive storage
              </span>
            </div>
          </button>
        </div>

        {processingIronDriveFiles && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-blue-800">
              <Loader className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">Processing IronDrive files...</span>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Files are being optimized and prepared. The save button will enable once processing is complete.
            </p>
          </div>
        )}

        {selectedFiles.length > 0 && (
          <div className="mt-4">
            <div className="grid grid-cols-4 gap-4">
              {selectedFiles.map(file => {
                if (!file.url) {
                  console.log('[PREVIEW] File missing URL:', { id: file.id, name: file.name, type: file.type, sourceKey: file.sourceKey });
                }
                return (
                  <div key={file.id} className="relative group">
                    {file.url ? (
                      file.isVideo ? (
                        <video src={file.url} className="w-full h-24 object-cover rounded" />
                      ) : (
                        <img
                          src={file.url}
                          alt={file.name}
                          className="w-full h-24 object-cover rounded"
                        />
                      )
                    ) : (
                      <div className="w-full h-24 bg-gray-200 rounded flex flex-col items-center justify-center">
                        {file.uploadStatus === 'processing' ? (
                          <>
                            <Loader className="w-6 h-6 text-gray-500 animate-spin mb-1" />
                            <span className="text-xs text-gray-600">Processing...</span>
                          </>
                        ) : (
                          <span className="text-xs text-gray-500 truncate px-2">{file.name}</span>
                        )}
                      </div>
                    )}

                  {file.uploadStatus === 'pending' && (
                    <div className="absolute top-1 left-1 bg-yellow-500 text-white text-xs px-2 py-0.5 rounded">
                      Ready
                    </div>
                  )}
                  {file.uploadStatus === 'uploading' && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded flex items-center justify-center">
                      <Loader className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                  {file.uploadStatus === 'processing' && (
                    <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                      Processing...
                    </div>
                  )}
                  {file.uploadStatus === 'published' && (
                    <div className="absolute top-1 left-1 bg-green-500 text-white text-xs px-2 py-0.5 rounded">
                      ✓ Ready
                    </div>
                  )}
                  {file.uploadStatus === 'error' && (
                    <div className="absolute inset-0 bg-red-500 bg-opacity-75 rounded flex items-center justify-center">
                      <span className="text-white text-xs px-2 text-center">
                        {file.errorMessage || 'Error'}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => removeFile(file.id)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || processingIronDriveFiles || selectedFiles.some(f => f.uploadStatus === 'uploading' || f.uploadStatus === 'processing')}
          className="flex-1 bg-ironbound-orange-500 text-white px-4 py-2 rounded-lg hover:bg-ironbound-orange-600 disabled:opacity-50 flex flex-col items-center justify-center gap-1"
        >
          {isSubmitting ? (
            <>
              <div className="flex items-center gap-2">
                <Loader className="w-4 h-4 animate-spin" />
                <span>{submitProgress}</span>
              </div>
              {uploadProgress && (
                <div className="w-full max-w-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs">
                      {uploadProgress.current} of {uploadProgress.total}
                    </span>
                    <span className="text-xs">
                      {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-ironbound-orange-700 rounded-full h-1.5">
                    <div
                      className="bg-white h-1.5 rounded-full transition-all"
                      style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          ) : processingIronDriveFiles || selectedFiles.some(f => f.uploadStatus === 'uploading' || f.uploadStatus === 'processing') ? (
            <div className="flex items-center gap-2">
              <Loader className="w-4 h-4 animate-spin" />
              <span>Processing images...</span>
            </div>
          ) : (
            item ? 'Update Item' : 'Create Item'
          )}
        </button>
      </div>
    </form>
  );
}
