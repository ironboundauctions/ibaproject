import React, { useState, useEffect } from 'react';
import { X, Upload, Loader, ExternalLink, Play, GripVertical, ScanBarcode, Search } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { InventoryItem, CreateInventoryItemData } from '../services/inventoryService';
import { Consigner } from '../types/consigner';
import { FileUploadService } from '../services/fileUploadService';
import { IronDriveService } from '../services/ironDriveService';
import { supabase } from '../lib/supabase';
import { EQUIPMENT_CATEGORIES } from '../utils/formatters';
import ImageGalleryModal from './ImageGalleryModal';
import { BarcodeScanner } from '../utils/barcodeScanner';

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
  sourceKey?: string;
  mimeType?: string;
  uploadStatus?: 'pending' | 'uploading' | 'uploaded' | 'processing' | 'published' | 'error';
  assetGroupId?: string;
  errorMessage?: string;
  displayOrder?: number;
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

interface SortableFileItemProps {
  file: SelectedFile;
  onRemove: (id: string) => void;
  onImageClick: (file: SelectedFile) => void;
  onVideoClick: (file: SelectedFile) => void;
}

function SortableFileItem({ file, onRemove, onImageClick, onVideoClick }: SortableFileItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group w-32 select-none ${isDragging ? 'z-50' : ''}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute bottom-1 left-1 z-40 bg-gray-800 bg-opacity-90 text-white rounded p-1 cursor-grab active:cursor-grabbing hover:bg-gray-700"
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {file.url ? (
        file.isVideo ? (
          <div
            className="relative w-32 h-24 bg-gray-900 rounded flex items-center justify-center group cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onVideoClick(file);
            }}
          >
            <Play className="w-8 h-8 text-white opacity-70 group-hover:opacity-100 transition-opacity absolute z-10 pointer-events-none" />
            <video
              src={file.url}
              className="absolute inset-0 w-full h-full object-cover rounded opacity-40 pointer-events-none"
              muted
              draggable={false}
            />
          </div>
        ) : (
          <div
            className="w-32 h-24 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onImageClick(file);
            }}
          >
            <img
              src={file.url}
              alt={file.name}
              draggable={false}
              className="w-full h-full object-cover rounded select-none pointer-events-none"
            />
          </div>
        )
      ) : (
        <div className="w-32 h-24 bg-gray-200 rounded flex flex-col items-center justify-center">
          {file.uploadStatus === 'processing' ? (
            <>
              <Loader className="w-6 h-6 text-gray-500 animate-spin mb-1" />
              <span className="text-xs text-gray-600">Processing...</span>
            </>
          ) : file.isVideo ? (
            <>
              <Play className="w-6 h-6 text-gray-500 mb-1" />
              <span className="text-xs text-gray-500 truncate px-2">{file.name}</span>
            </>
          ) : (
            <span className="text-xs text-gray-500 truncate px-2">{file.name}</span>
          )}
        </div>
      )}

      {file.uploadStatus === 'pending' && (
        <div className="absolute top-1 left-1 bg-yellow-500 text-white text-xs px-2 py-0.5 rounded z-10">
          Ready
        </div>
      )}
      {file.uploadStatus === 'uploading' && (
        <div className="absolute inset-0 bg-black bg-opacity-50 rounded flex items-center justify-center z-10">
          <Loader className="w-6 h-6 text-white animate-spin" />
        </div>
      )}
      {file.uploadStatus === 'processing' && (
        <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs px-2 py-0.5 rounded z-10">
          Processing...
        </div>
      )}
      {file.uploadStatus === 'published' && (
        <div className="absolute top-1 left-1 bg-green-500 text-white text-xs px-2 py-0.5 rounded z-10">
          ✓ Ready
        </div>
      )}
      {file.uploadStatus === 'error' && (
        <div className="absolute inset-0 bg-red-500 bg-opacity-75 rounded flex items-center justify-center z-10">
          <span className="text-white text-xs px-2 text-center">
            {file.errorMessage || 'Error'}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(file.id);
        }}
        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-auto"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function InventoryItemFormNew({ item, consigners, onSubmit, onCancel }: Props) {
  const [itemId] = useState(() => item?.id || crypto.randomUUID());
  const [originalAssetGroupIds] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState(() => {
    const consigner = item?.consigner_id
      ? consigners.find(c => c.id === item.consigner_id)
      : undefined;

    return {
      inventory_number: item?.inventory_number || '',
      title: item?.title || '',
      description: item?.description || '',
      category: item?.category || '',
      reserve_price: item?.reserve_price?.toString() || '',
      estimated_value_low: item?.estimated_value_low?.toString() || '',
      estimated_value_high: item?.estimated_value_high?.toString() || '',
      consigner_customer_number: consigner?.customer_number || '',
      condition: item?.condition || '',
      additional_description: item?.notes || ''
    };
  });

  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [processingIronDriveFiles, setProcessingIronDriveFiles] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<Array<{ url: string; isVideo: boolean }>>([]);
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);
  const [barcodeImage, setBarcodeImage] = useState<{
    file?: File;
    url?: string;
    assetGroupId?: string;
    uploadStatus?: 'pending' | 'uploading' | 'uploaded' | 'processing' | 'published' | 'error';
  } | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (item) {
      loadExistingFiles();
      loadBarcodeImage();
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
  }, []);

  const handleIronDrivePickerClick = () => {
    const returnUrl = encodeURIComponent(window.location.origin);
    window.open(
      `https://irondrive.ibaproject.bid/picker?return_to=${returnUrl}`,
      'irondrivePicker',
      'width=1200,height=800'
    );
  };

  const loadBarcodeImage = async () => {
    if (!item?.id) return;

    try {
      const { data: itemData, error } = await supabase
        .from('inventory_items')
        .select('barcode_image_url, barcode_asset_group_id')
        .eq('id', item.id)
        .single();

      if (error) throw error;

      if (itemData?.barcode_image_url) {
        setBarcodeImage({
          url: itemData.barcode_image_url,
          assetGroupId: itemData.barcode_asset_group_id || undefined,
          uploadStatus: 'published'
        });
      }
    } catch (error) {
      console.error('[FORM] Error loading barcode image:', error);
    }
  };

  const loadExistingFiles = async () => {
    if (!item?.id) return;

    try {
      const { data: files, error } = await supabase
        .from('auction_files')
        .select('*')
        .eq('item_id', item.id)
        .in('variant', ['display', 'thumb', 'source', 'video'])
        .is('detached_at', null)
        .order('display_order', { ascending: true })
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
          const videoFile = group.find(f => f.variant === 'video');
          const sourceFile = group.find(f => f.variant === 'source');
          const primaryFile = displayFile || videoFile || thumbFile || sourceFile || group[0];

          // Determine if this is a video by checking if videoFile variant exists or source mime type
          const isVideo = !!videoFile || sourceFile?.mime_type?.startsWith('video/') || false;

          // For videos, use video.mp4 URL, otherwise use display/thumb
          const previewUrl = isVideo ? (videoFile?.cdn_url || thumbFile?.cdn_url) : (displayFile?.cdn_url || thumbFile?.cdn_url);

          console.log('[LOAD] Building file object:', {
            assetGroupId: primaryFile.asset_group_id,
            displayCdnUrl: displayFile?.cdn_url,
            videoCdnUrl: videoFile?.cdn_url,
            thumbCdnUrl: thumbFile?.cdn_url,
            sourceKey: sourceFile?.source_key,
            previewUrl,
            isVideo,
            publishedStatus: primaryFile.published_status
          });

          originalAssetGroupIds.add(primaryFile.asset_group_id);

          return {
            id: primaryFile.asset_group_id,
            url: previewUrl,
            name: sourceFile?.original_name || primaryFile.original_name || 'file',
            isVideo,
            sourceKey: sourceFile?.source_key,
            mimeType: sourceFile?.mime_type || primaryFile.mime_type,
            uploadStatus: (primaryFile.published_status === 'published' ? 'published' :
                         primaryFile.published_status === 'processing' ? 'processing' :
                         primaryFile.published_status === 'pending' ? 'processing' : 'uploaded') as any,
            assetGroupId: primaryFile.asset_group_id,
            displayOrder: primaryFile.display_order || 0
          };
        });
        console.log('[LOAD] Original asset group IDs:', Array.from(originalAssetGroupIds));
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
          .select('asset_group_id, cdn_url, published_status, variant, mime_type')
          .in('asset_group_id', Array.from(pendingIds))
          .in('variant', ['display', 'video']);

        if (error) throw error;

        console.log('[POLL] Query result:', {
          filesFound: files?.length || 0,
          files: files?.map(f => ({
            asset_group_id: f.asset_group_id,
            variant: f.variant,
            has_cdn_url: !!f.cdn_url,
            published_status: f.published_status
          }))
        });

        for (const file of files || []) {
          if (file.cdn_url && file.published_status === 'published') {
            console.log('[POLL] File ready:', file.asset_group_id, file.variant, file.cdn_url);
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
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      isVideo: file.type.startsWith('video/'),
      uploadStatus: 'pending'
    }));

    setSelectedFiles(prev => [...prev, ...newFiles]);

    e.target.value = '';
  };

  const handleBarcodeImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) {
      setError('Barcode must be an image file');
      return;
    }

    setBarcodeImage({
      file,
      url: URL.createObjectURL(file),
      uploadStatus: 'pending'
    });

    e.target.value = '';
  };

  const removeBarcodeImage = async () => {
    if (!barcodeImage) return;

    // If already uploaded to B2, delete it
    if (barcodeImage.assetGroupId && item?.id) {
      try {
        await IronDriveService.deleteFile(barcodeImage.assetGroupId, item.id);
        console.log('[BARCODE] Deleted from B2:', barcodeImage.assetGroupId);
      } catch (err) {
        console.error('[BARCODE] Error deleting from B2:', err);
      }
    }

    // Clean up local object URL if exists
    if (barcodeImage.url && barcodeImage.file) {
      URL.revokeObjectURL(barcodeImage.url);
    }

    setBarcodeImage(null);
  };

  const handleScanBarcode = async () => {
    if (!barcodeImage?.file && !barcodeImage?.url) {
      setError('Please upload a barcode image first');
      return;
    }

    setIsScanning(true);
    setError('');

    try {
      let barcodeText: string | null = null;

      if (barcodeImage.file) {
        barcodeText = await BarcodeScanner.scanFile(barcodeImage.file);
      } else if (barcodeImage.url) {
        barcodeText = await BarcodeScanner.scanUrl(barcodeImage.url);
      }

      if (barcodeText) {
        setFormData(prev => ({ ...prev, inventory_number: barcodeText }));
        console.log('[BARCODE] Scanned and filled:', barcodeText);
        setError(''); // Clear any previous errors
      } else {
        setError('No barcode detected. Try: 1) Better lighting, 2) Closer/clearer photo, 3) Different angle, or 4) Enter manually.');
      }
    } catch (err) {
      console.error('[BARCODE] Scan error:', err);
      setError('Failed to scan barcode. Please try again or enter manually.');
    } finally {
      setIsScanning(false);
    }
  };

  const removeFile = async (id: string) => {
    const fileToRemove = selectedFiles.find(f => f.id === id);

    // If file has assetGroupId, it's already uploaded - mark as detached in database
    if (fileToRemove?.assetGroupId) {
      try {
        const result = await IronDriveService.deleteFile(fileToRemove.assetGroupId, item?.id);
        if (!result.success) {
          alert(`Failed to remove file: ${result.error}`);
          return;
        }
      } catch (error) {
        console.error('[RemoveFile] Error:', error);
        alert('Failed to remove file from database');
        return;
      }
    }

    // Remove from local state
    setSelectedFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.url && file.file) {
        URL.revokeObjectURL(file.url);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setSelectedFiles((files) => {
      const oldIndex = files.findIndex((f) => f.id === active.id);
      const newIndex = files.findIndex((f) => f.id === over.id);

      return arrayMove(files, oldIndex, newIndex);
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
        const result = await FileUploadService.uploadPCFileToWorker(file.file!, itemId) as any;

        if (result.success && result.files.length > 0) {
          const displayFile = result.files.find((f: any) => f.variant === 'display') || result.files[0];
          const assetGroupId = result.asset_group_id;

          console.log('[PC-UPLOAD] Upload successful:', {
            tempId: file.id,
            assetGroupId,
            cdnUrl: displayFile.cdn_url
          });

          setSelectedFiles(prev => prev.map(f =>
            f.id === file.id ? {
              ...f,
              uploadStatus: 'published' as const,
              url: displayFile.cdn_url,
              assetGroupId: assetGroupId
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

      let barcodeImageUrl = '';
      let barcodeAssetGroupId = barcodeImage?.assetGroupId;

      // Upload barcode image to B2 via worker if there's a new one
      if (barcodeImage?.file && barcodeImage.uploadStatus === 'pending') {
        setSubmitProgress('Uploading barcode image...');
        setBarcodeImage(prev => prev ? { ...prev, uploadStatus: 'uploading' } : null);

        try {
          // Upload to B2 with 'barcode' variant for dedicated storage
          const uploadResult = await IronDriveService.uploadFile(
            barcodeImage.file,
            itemId,
            'barcode', // Special variant for barcode images
            1 // Display order 1 (only one barcode per item)
          );

          if (!uploadResult.success || !uploadResult.assetGroupId) {
            throw new Error('Failed to upload barcode image');
          }

          barcodeAssetGroupId = uploadResult.assetGroupId;

          // Set CDN URL - worker will process and create thumb variant
          barcodeImageUrl = uploadResult.cdnUrl || '';

          setBarcodeImage(prev => prev ? {
            ...prev,
            uploadStatus: 'published',
            url: barcodeImageUrl,
            assetGroupId: barcodeAssetGroupId
          } : null);

          console.log('[BARCODE] Uploaded to B2:', { assetGroupId: barcodeAssetGroupId, url: barcodeImageUrl });
        } catch (err) {
          console.error('[BARCODE-UPLOAD] Error:', err);
          setBarcodeImage(prev => prev ? { ...prev, uploadStatus: 'error' } : null);
          throw new Error('Failed to upload barcode image');
        }
      } else if (barcodeImage?.url) {
        barcodeImageUrl = barcodeImage.url;
      }

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
        image_url: '',
        consigner_id: consigner?.id,
        condition: formData.condition,
        notes: formData.additional_description,
        barcode_image_url: barcodeImageUrl || undefined,
        barcode_asset_group_id: barcodeAssetGroupId || undefined
      };

      const result = await onSubmit(submitData);
      const savedItemId = itemId;

      setSubmitProgress('Item created successfully!');

      // Infer type from data: IronDrive files have sourceKey, PC files have file object
      const pendingIronDriveFiles = selectedFiles.filter(f => f.uploadStatus === 'pending' && f.sourceKey);
      const pendingPCFiles = selectedFiles.filter(f => f.uploadStatus === 'pending' && f.file);

      if (pendingPCFiles.length > 0) {
        setSubmitProgress(`Uploading ${pendingPCFiles.length} file${pendingPCFiles.length > 1 ? 's' : ''}...`);
        await uploadPCFiles(pendingPCFiles, savedItemId);
        setSubmitProgress('Files uploaded successfully!');
      }

      if (pendingIronDriveFiles.length > 0) {
        setSubmitProgress(`Processing ${pendingIronDriveFiles.length} IronDrive file${pendingIronDriveFiles.length > 1 ? 's' : ''}...`);

        for (let i = 0; i < pendingIronDriveFiles.length; i++) {
          const file = pendingIronDriveFiles[i];
          const displayOrder = selectedFiles.findIndex(f => f.id === file.id);

          const { error: dbError } = await supabase.from('auction_files').insert({
            item_id: savedItemId,
            asset_group_id: file.assetGroupId!,
            variant: 'source',
            source_key: file.sourceKey!,
            original_name: file.name,
            mime_type: file.mimeType!,
            published_status: 'pending',
            display_order: displayOrder
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

      if (item?.id && originalAssetGroupIds.size > 0) {
        const currentAssetGroupIds = new Set(
          selectedFiles
            .filter(f => f.assetGroupId)
            .map(f => f.assetGroupId!)
        );

        const assetGroupsToDetach = Array.from(originalAssetGroupIds).filter(
          id => !currentAssetGroupIds.has(id)
        );

        console.log('[CLEANUP] Original files when form loaded:', Array.from(originalAssetGroupIds));
        console.log('[CLEANUP] Current files in form:', Array.from(currentAssetGroupIds));
        console.log('[CLEANUP] Files removed by user:', assetGroupsToDetach);

        if (assetGroupsToDetach.length > 0) {
          const { data, error } = await supabase
            .from('auction_files')
            .update({ detached_at: new Date().toISOString() })
            .eq('item_id', item.id)
            .in('asset_group_id', assetGroupsToDetach);

          if (error) {
            console.error('[FORM] Error marking files as detached:', error);
            throw new Error(`Failed to mark files as removed: ${error.message}`);
          }

          console.log('[FORM] Marked removed files as detached for cleanup:', assetGroupsToDetach);
        }
      }

      // Update display_order for all existing files
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        if (file.assetGroupId) {
          // Update each variant separately to avoid any issues
          const { error } = await supabase.rpc('update_display_order', {
            p_item_id: savedItemId,
            p_asset_group_id: file.assetGroupId,
            p_display_order: i
          });

          if (error) {
            console.error('[FORM] Error updating display_order:', error);
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
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Quick Save Button at Top */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting || processingIronDriveFiles || selectedFiles.some(f => f.uploadStatus === 'uploading' || f.uploadStatus === 'processing')}
          className="bg-ironbound-orange-500 text-white px-4 py-1.5 rounded-lg hover:bg-ironbound-orange-600 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader className="w-3 h-3 animate-spin" />
              <span>Saving...</span>
            </>
          ) : processingIronDriveFiles || selectedFiles.some(f => f.uploadStatus === 'uploading' || f.uploadStatus === 'processing') ? (
            <>
              <Loader className="w-3 h-3 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>{item ? 'Update Item' : 'Save Item'}</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
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

        <div className="col-span-2">
          <label className="block text-sm font-medium text-white mb-1">
            Barcode/Inventory Sticker
          </label>
          <div className="flex gap-2">
            {!barcodeImage ? (
              <>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBarcodeImageSelect}
                  className="hidden"
                  id="barcode-upload"
                />
                <label
                  htmlFor="barcode-upload"
                  className="flex-1 cursor-pointer flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-gray-400 rounded-lg hover:border-ironbound-orange-400 transition-colors bg-gray-800"
                >
                  <ScanBarcode className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-300">Upload Barcode Image</span>
                </label>
              </>
            ) : (
              <>
                <div className="flex-1 relative group">
                  <img
                    src={barcodeImage.url}
                    alt="Barcode"
                    className="w-full h-[42px] object-contain rounded-lg bg-white"
                  />
                  {barcodeImage.uploadStatus === 'uploading' && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                      <Loader className="w-4 h-4 text-white animate-spin" />
                    </div>
                  )}
                  {barcodeImage.uploadStatus === 'published' && (
                    <div className="absolute top-0.5 right-0.5 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded">
                      ✓
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={removeBarcodeImage}
                    className="absolute top-0.5 left-0.5 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleScanBarcode}
                  disabled={isScanning}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                >
                  {isScanning ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Scanning...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Scan</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-1">
            Consigner
          </label>
          <select
            value={formData.consigner_customer_number}
            onChange={(e) => setFormData(prev => ({ ...prev, consigner_customer_number: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-transparent text-gray-900 bg-white"
          >
            <option value="">Select consigner...</option>
            {consigners.map(consigner => (
              <option key={consigner.id} value={consigner.customer_number}>
                {consigner.customer_number} - {consigner.first_name} {consigner.last_name}
              </option>
            ))}
          </select>
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
            <p className="text-xs text-gray-400 mb-2">Drag to reorder images</p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={selectedFiles.map(f => f.id)}
                strategy={horizontalListSortingStrategy}
              >
                <div className="flex flex-wrap gap-4">
                  {selectedFiles.map((file) => (
                    <SortableFileItem
                      key={file.id}
                      file={file}
                      onRemove={removeFile}
                      onImageClick={(file) => {
                        const publishedFiles = selectedFiles
                          .filter(f => f.url && f.uploadStatus === 'published')
                          .map(f => ({ url: f.url!, isVideo: f.isVideo }));
                        const clickedIndex = publishedFiles.findIndex(f => f.url === file.url);
                        setGalleryImages(publishedFiles);
                        setGalleryInitialIndex(clickedIndex >= 0 ? clickedIndex : 0);
                        setShowGallery(true);
                      }}
                      onVideoClick={(file) => {
                        const video = document.createElement('video');
                        video.src = file.url!;
                        video.controls = true;
                        video.style.maxWidth = '90vw';
                        video.style.maxHeight = '90vh';
                        const modal = document.createElement('div');
                        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;z-index:9999;';
                        modal.onclick = () => modal.remove();
                        modal.appendChild(video);
                        document.body.appendChild(modal);
                        video.play();
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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

    {showGallery && (
      <ImageGalleryModal
        images={galleryImages}
        initialIndex={galleryInitialIndex}
        onClose={() => setShowGallery(false)}
      />
    )}
    </>
  );
}
