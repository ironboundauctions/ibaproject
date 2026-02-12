import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Package, User, DollarSign, Tag, FileText, Image, Plus, Trash2, Upload, X, Star, GripVertical, ExternalLink, Play } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { InventoryItem, Consigner, InventoryItemFormData } from '../types/consigner';
import { EQUIPMENT_CATEGORIES } from '../utils/formatters';
import { IronDriveService } from '../services/ironDriveService';
import ImageGalleryModal from './ImageGalleryModal';
import { supabase } from '../lib/supabase';

interface InventoryItemFormProps {
  item?: InventoryItem | any | null;
  eventId?: string;
  consigners: Consigner[];
  onSubmit: (itemData: any) => Promise<void>;
  onCancel: () => void;
  onSaveComplete?: () => Promise<void>;
}

export default function InventoryItemForm({ item, eventId = '', consigners, onSubmit, onCancel, onSaveComplete }: InventoryItemFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>(item?.image_url || '');
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<{ currentFile: number; totalFiles: number; percent: number; fileName: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [raidError, setRaidError] = useState<string>('');
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const [selectedImages, setSelectedImages] = useState<Array<{id: string, type: 'file' | 'irondrive', file?: File, url?: string, backupUrl?: string, name: string, isVideo?: boolean}>>([]);
  const [formData, setFormData] = useState<InventoryItemFormData>({
    inventory_number: item?.inventory_number || '',
    consigner_customer_number: item?.consigner_customer_number || '',
    title: item?.title || '',
    description: item?.description || '',
    additional_description: item?.additional_description || '',
    reserve_price: item?.reserve_price?.toString() || '',
    category: item?.category || '',
    condition: item?.condition || '',
    estimated_value_low: item?.estimated_value?.low?.toString() || '',
    estimated_value_high: item?.estimated_value?.high?.toString() || '',
    image_url: item?.image_url || '',
    additional_images: item?.additional_images?.join('\n') || '',
    specifications: item?.specifications ? Object.entries(item.specifications).map(([key, value]) => ({ key, value })) : [{ key: '', value: '' }]
  });

  // Load existing images and videos when editing an item
  useEffect(() => {
    const loadExistingMedia = async () => {
      if (item) {
        const existingImages: Array<{id: string, type: 'file' | 'irondrive', file?: File, url?: string, backupUrl?: string, name: string, isVideo?: boolean}> = [];

        // Add main image if exists
        if (item.image_url) {
          existingImages.push({
            id: `existing-main-${Date.now()}`,
            type: 'irondrive',
            url: item.image_url,
            name: 'Main Image',
            isVideo: false
          });
        }

        // Add additional images if they exist
        if (item.additional_images && Array.isArray(item.additional_images)) {
          item.additional_images.forEach((url: string, index: number) => {
            existingImages.push({
              id: `existing-img-${index}-${Date.now()}`,
              type: 'irondrive',
              url: url,
              name: `Image ${index + 2}`,
              isVideo: false
            });
          });
        }

        // Load videos from auction_files table
        try {
          const { data: videoFiles, error } = await supabase
            .from('auction_files')
            .select('*')
            .eq('item_id', item.id)
            .like('mime_type', 'video/%');

          if (!error && videoFiles && videoFiles.length > 0) {
            console.log('[VIDEO] Loaded existing videos:', videoFiles);
            videoFiles.forEach((video, index) => {
              existingImages.push({
                id: `existing-video-${video.id || index}-${Date.now()}`,
                type: 'irondrive',
                url: video.download_url,
                backupUrl: video.download_url_backup || undefined,
                name: video.name || `Video ${index + 1}`,
                isVideo: true
              });
            });
          } else if (error) {
            console.error('[VIDEO] Error loading existing videos:', error);
          }
        } catch (err) {
          console.error('[VIDEO] Exception loading videos:', err);
        }

        if (existingImages.length > 0) {
          setSelectedImages(existingImages);
          setMainImageIndex(0);
          setImagePreview(existingImages[0].url || '');
        }
      }
    };

    loadExistingMedia();
  }, [item?.id]); // Only run when item ID changes

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setRaidError('');
    setIsLoading(true);

    let uploadedFileKeys: string[] = [];

    try {
      let mainImageUrl = formData.image_url;
      let additionalImages: string[] = [];
      const videoFiles: Array<{url: string, fileName: string, backupUrl?: string}> = [];

      // Separate file uploads from IronDrive URLs and filter out videos from image arrays
      const filesToUpload = selectedImages.filter(img => img.type === 'file' && img.file).map(img => img.file!);
      const ironDriveUrls = selectedImages.filter(img => img.type === 'irondrive' && img.url).map(img => img.url!);

      // Create a mapping of file uploads to their position in selectedImages for correct URL assignment
      const fileUploadIndexMap = new Map<number, number>();
      let uploadIdx = 0;
      selectedImages.forEach((img, idx) => {
        if (img.type === 'file' && img.file) {
          fileUploadIndexMap.set(idx, uploadIdx);
          uploadIdx++;
        }
      });

      if (filesToUpload.length > 0 && formData.inventory_number) {
        setIsUploading(true);

        // Calculate which index in filesToUpload corresponds to mainImageIndex
        const filesBeforeMain = selectedImages.slice(0, mainImageIndex).filter(img => img.type === 'file').length;
        const mainFileIndex = selectedImages[mainImageIndex]?.type === 'file' ? filesBeforeMain : 0;

        const uploadResult = await IronDriveService.uploadInventoryImages(
          filesToUpload,
          formData.inventory_number,
          mainFileIndex,
          (progress) => {
            setUploadProgress(progress);
          }
        );

        if (uploadResult.errors.length > 0) {
          const raidNotAvailable = uploadResult.errors.some(err =>
            err.includes('not available') || err.includes('Health check failed')
          );

          if (raidNotAvailable) {
            setRaidError(uploadResult.errors[0]);
            setIsUploading(false);
            setIsLoading(false);
            return;
          }

          console.warn('Some images failed to upload:', uploadResult.errors);
        }

        // Merge uploaded URLs with IronDrive URLs in correct order
        // Build ALL uploaded URLs first (including videos)
        const allUploadedUrls = [uploadResult.mainImageUrl, ...uploadResult.additionalImageUrls];
        console.log('[DEBUG] Processing uploaded files. Total selectedImages:', selectedImages.length);
        console.log('[DEBUG] selectedImages:', selectedImages.map(img => ({ name: img.name, type: img.type, isVideo: img.isVideo })));
        console.log('[DEBUG] allUploadedUrls:', allUploadedUrls);

        const allUrls: string[] = [];
        let ironDriveIndex = 0;

        for (let i = 0; i < selectedImages.length; i++) {
          const image = selectedImages[i];
          let url = '';

          if (image.type === 'file') {
            // Get the correct URL from upload results using our mapping
            const fileUploadIdx = fileUploadIndexMap.get(i);
            if (fileUploadIdx !== undefined && fileUploadIdx < allUploadedUrls.length) {
              url = allUploadedUrls[fileUploadIdx] || '';
            }
            console.log('[DEBUG] File upload - index:', i, 'uploadIdx:', fileUploadIdx, 'url:', url, 'isVideo:', image.isVideo);
          } else if (image.type === 'irondrive') {
            url = ironDriveUrls[ironDriveIndex] || '';
            ironDriveIndex++;
          }

          if (url) {
            // If this is a video, add to videoFiles array instead of images
            // BUT: Only add if it's a NEW upload (type === 'file'), not existing videos
            if (image.isVideo) {
              console.log('[DEBUG] Found video. Type:', image.type, 'Name:', image.name);
              if (image.type === 'file') {
                // New video uploaded from PC
                console.log('[VIDEO] Adding new video to videoFiles:', { url, fileName: image.name });
                videoFiles.push({
                  url: url,
                  fileName: image.name,
                  backupUrl: image.backupUrl
                });
              } else {
                console.log('[DEBUG] Skipping existing video (already in DB)');
              }
              // If type === 'irondrive', it's already in DB, don't re-add
            } else {
              allUrls.push(url);
            }
          } else {
            console.log('[DEBUG] No URL for index:', i, 'name:', image.name);
          }
        }
        console.log('[DEBUG] Final videoFiles array:', videoFiles);
        console.log('[DEBUG] Final allUrls (images only):', allUrls);

        // Only set main/additional from non-video images
        const nonVideoImageIndices = selectedImages.map((img, idx) => !img.isVideo ? idx : -1).filter(idx => idx !== -1);
        const adjustedMainIndex = nonVideoImageIndices.indexOf(mainImageIndex);

        if (adjustedMainIndex !== -1 && allUrls.length > 0) {
          mainImageUrl = allUrls[adjustedMainIndex] || formData.image_url;
          additionalImages = allUrls.filter((url, idx) => idx !== adjustedMainIndex && url);
        } else if (allUrls.length > 0) {
          mainImageUrl = allUrls[0];
          additionalImages = allUrls.slice(1);
        }

        // Track uploaded file keys for cleanup if needed
        if (uploadResult.mainImageUrl) {
          const fileKey = uploadResult.mainImageUrl.split('/download/')[1];
          if (fileKey) uploadedFileKeys.push(fileKey);
        }
        uploadResult.additionalImageUrls.forEach(url => {
          const fileKey = url.split('/download/')[1];
          if (fileKey) uploadedFileKeys.push(fileKey);
        });
      } else if (ironDriveUrls.length > 0) {
        // Only IronDrive URLs, no uploads needed
        // Separate videos from images
        const imageUrls: string[] = [];
        for (let i = 0; i < selectedImages.length; i++) {
          const image = selectedImages[i];
          if (image.type === 'irondrive' && image.url) {
            if (image.isVideo) {
              // Existing videos are already in the database, don't re-add to videoFiles array
              // videoFiles is only for NEW uploads that need to be inserted
            } else {
              imageUrls.push(image.url);
            }
          }
        }

        if (imageUrls.length > 0) {
          mainImageUrl = imageUrls[0];
          additionalImages = imageUrls.slice(1);
        }
      } else {
        if (formData.additional_images) {
          additionalImages = formData.additional_images.split('\n').filter(url => url.trim());
        }
      }

      // Find consigner_id from customer number
      const consigner = consigners.find(c => c.customer_number === formData.consigner_customer_number);

      // Prepare submit data - convert to new format
      const submitData = {
        inventory_number: formData.inventory_number,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        starting_price: parseFloat(formData.reserve_price) || 0,
        reserve_price: parseFloat(formData.reserve_price) || undefined,
        estimated_value_low: parseFloat(formData.estimated_value_low) || undefined,
        estimated_value_high: parseFloat(formData.estimated_value_high) || undefined,
        image_url: mainImageUrl || formData.image_url || 'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2',
        additional_images: additionalImages,
        consigner_id: consigner?.id,
        condition: formData.condition,
        notes: formData.additional_description
      };

      const result = await onSubmit(submitData);

      // Get the item ID (either from existing item or newly created)
      const savedItemId = item?.id || result?.id;

      // After successful item save, sync auction_files records for all PC uploads (images + videos)
      if (savedItemId) {
        try {
          const currentUser = (await supabase.auth.getUser()).data.user;

          // Get all current file records for this item
          const { data: existingRecords } = await supabase
            .from('auction_files')
            .select('file_key, source_user_id')
            .eq('item_id', savedItemId);

          // Build set of file_keys that should exist after save
          // This should include ALL files currently in selectedImages (both new uploads and existing)
          const currentFileKeys = new Set<string>();

          // Add all files from selectedImages
          for (const image of selectedImages) {
            if (image.url) {
              const key = image.url.split('/download/')[1];
              if (key) currentFileKeys.add(key);
            }
          }

          // Also add newly uploaded videos
          for (const video of videoFiles) {
            const key = video.url.split('/download/')[1];
            if (key) currentFileKeys.add(key);
          }

          // And all image URLs
          const allImageUrls = [mainImageUrl, ...additionalImages].filter(url => url);
          for (const imageUrl of allImageUrls) {
            const key = imageUrl.split('/download/')[1];
            if (key) currentFileKeys.add(key);
          }

          // Delete records that are no longer in selectedImages
          const recordsToDelete = (existingRecords || []).filter(
            record => !currentFileKeys.has(record.file_key)
          );

          for (const record of recordsToDelete) {
            const { error: delError } = await supabase
              .from('auction_files')
              .delete()
              .eq('item_id', savedItemId)
              .eq('file_key', record.file_key);

            if (delError) {
              console.error(`[FILES] Failed to delete record for ${record.file_key}:`, delError);
            } else {
              console.log(`[FILES] Deleted removed file record: ${record.file_key}`);

              // If this was a PC upload (source_user_id is null), delete from RAID
              if (record.source_user_id === null) {
                try {
                  await IronDriveService.deleteFilePhysical(record.file_key);
                  console.log(`[FILES] Deleted PC upload from RAID: ${record.file_key}`);
                } catch (err) {
                  console.error(`[FILES] Failed to delete from RAID: ${record.file_key}`, err);
                }
              }
            }
          }

          // Now insert records for ALL PC-uploaded files (images + videos)
          // Check which files are already saved (from picker) vs need to be saved (from PC)
          const allFileKeys = [];

          // Collect all file keys from videos
          for (const video of videoFiles) {
            const fileKey = video.url.split('/download/')[1] || '';
            if (fileKey) allFileKeys.push(fileKey);
          }

          // Collect all file keys from images (reuse allImageUrls from above)
          for (const imageUrl of allImageUrls) {
            const fileKey = imageUrl.split('/download/')[1] || '';
            if (fileKey) allFileKeys.push(fileKey);
          }

          // Check which files already have records (from picker OR previous PC uploads)
          const { data: existingFileRecords } = await supabase
            .from('auction_files')
            .select('file_key')
            .eq('item_id', savedItemId)
            .in('file_key', allFileKeys);

          const existingFileKeys = new Set((existingFileRecords || []).map(f => f.file_key));

          const filesToSave = [];

          // Add video files (only NEW uploads that don't have records yet)
          for (const video of videoFiles) {
            const fileKey = video.url.split('/download/')[1] || '';
            if (fileKey && !existingFileKeys.has(fileKey)) {
              console.log('[FILES] Adding new video record:', video.fileName);
              filesToSave.push({
                item_id: savedItemId,
                storage_provider: 'raid',
                file_key: fileKey,
                download_url: video.url,
                download_url_backup: video.backupUrl || null,
                name: video.fileName,
                mime_type: 'video/mp4',
                size: 0,
                uploaded_by: currentUser?.id,
                source_user_id: null  // NULL = uploaded by auction FE from PC
              });
            } else if (fileKey) {
              console.log('[FILES] Skipping existing video record:', video.fileName);
            }
          }

          // Add image files (only NEW uploads that don't have records yet)
          for (const imageUrl of allImageUrls) {
            const fileKey = imageUrl.split('/download/')[1] || '';
            if (fileKey && !existingFileKeys.has(fileKey)) {
              const fileName = imageUrl.split('/').pop()?.split('?')[0] || 'image.jpg';
              console.log('[FILES] Adding new image record:', fileName);
              filesToSave.push({
                item_id: savedItemId,
                storage_provider: 'raid',
                file_key: fileKey,
                download_url: imageUrl,
                download_url_backup: null,
                name: fileName,
                mime_type: 'image/jpeg',
                size: 0,
                uploaded_by: currentUser?.id,
                source_user_id: null  // NULL = uploaded by auction FE from PC
              });
            }
          }

          if (filesToSave.length > 0) {
            console.log('[FILES] Inserting file records for PC uploads:', filesToSave.length);
            const { error: insertError } = await supabase
              .from('auction_files')
              .insert(filesToSave);

            if (insertError) {
              console.error('[FILES] Failed to save file records:', insertError);
            } else {
              console.log('[FILES] Saved', filesToSave.length, 'file records');
            }
          }
        } catch (err) {
          console.error('[FILES] Error syncing file records:', err);
        }

        // Trigger data refresh to update video counts in the UI
        if (onSaveComplete) {
          await onSaveComplete();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item');

      // Clean up uploaded files if inventory item creation failed
      if (uploadedFileKeys.length > 0) {
        console.log('[CLEANUP] Inventory creation failed, deleting uploaded files:', uploadedFileKeys);
        for (const fileKey of uploadedFileKeys) {
          try {
            await IronDriveService.deleteFile(fileKey);
            console.log(`[CLEANUP] Deleted orphaned file: ${fileKey}`);
          } catch (deleteErr) {
            console.error(`[CLEANUP] Failed to delete file ${fileKey}:`, deleteErr);
          }
        }
      }
    } finally {
      setIsLoading(false);
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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
    const mediaFiles = files.filter(file =>
      file.type.startsWith('image/') || file.type.startsWith('video/')
    );
    const newMedia = mediaFiles.map(file => ({
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'file' as const,
      file,
      name: file.name,
      isVideo: file.type.startsWith('video/')
    }));

    setSelectedImages(prev => [...prev, ...newMedia]);

    // Set preview for first image (skip videos for preview)
    if (mediaFiles.length > 0 && selectedImages.length === 0) {
      const firstImage = mediaFiles.find(f => f.type.startsWith('image/'));
      if (firstImage) {
        setImagePreview(URL.createObjectURL(firstImage));
        setMainImageIndex(mediaFiles.indexOf(firstImage));
      }
    }
  };

  const handleImageDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(selectedImages);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setSelectedImages(items);

    // Update main image index if it was moved
    if (result.source.index === mainImageIndex) {
      setMainImageIndex(result.destination.index);
    } else if (result.source.index < mainImageIndex && result.destination.index >= mainImageIndex) {
      setMainImageIndex(mainImageIndex - 1);
    } else if (result.source.index > mainImageIndex && result.destination.index <= mainImageIndex) {
      setMainImageIndex(mainImageIndex + 1);
    }

    // Update preview
    const mainImage = items[mainImageIndex];
    if (mainImage.type === 'file' && mainImage.file) {
      setImagePreview(URL.createObjectURL(mainImage.file));
    } else if (mainImage.type === 'irondrive' && mainImage.url) {
      setImagePreview(mainImage.url);
    }
  };

  const setAsMainImage = (index: number) => {
    setMainImageIndex(index);
    const image = selectedImages[index];
    if (image.type === 'file' && image.file) {
      setImagePreview(URL.createObjectURL(image.file));
    } else if (image.type === 'irondrive' && image.url) {
      setImagePreview(image.url);
    }
  };

  const removeFile = async (index: number) => {
    const image = selectedImages[index];

    // Remove from UI first
    const newImages = selectedImages.filter((_, i) => i !== index);
    setSelectedImages(newImages);

    // Adjust main image index
    if (index === mainImageIndex) {
      // If removing main image, set first remaining as main
      setMainImageIndex(0);
      if (newImages.length > 0) {
        const firstImage = newImages[0];
        if (firstImage.type === 'file' && firstImage.file) {
          setImagePreview(URL.createObjectURL(firstImage.file));
        } else if (firstImage.type === 'irondrive' && firstImage.url) {
          setImagePreview(firstImage.url);
        }
      } else {
        setImagePreview(formData.image_url);
      }
    } else if (index < mainImageIndex) {
      setMainImageIndex(mainImageIndex - 1);
    }

    // NOTE: We don't delete files from RAID immediately when X is clicked.
    // Files will be cleaned up when the form is saved (deleted records are removed,
    // and new uploads are synced). This prevents orphaning files if user cancels edit.
    // The database records will be refreshed on save based on selectedImages state.
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

  // IronDrive picker integration
  const handleIronDrivePickerClick = () => {
    const returnUrl = encodeURIComponent(window.location.origin);
    window.open(
      `https://irondrive.ibaproject.bid/picker?return_to=${returnUrl}`,
      'irondrivePicker',
      'width=1200,height=800'
    );
  };

  // Helper function to extract file_key from RAID URL
  const fileKeyFromRaidUrl = (raidUrl: string): string => {
    try {
      const u = new URL(raidUrl);
      const parts = u.pathname.split('/'); // ["", "download", "<userId>", "<storedFilename>"]
      const userId = parts[2];
      const storedFilename = decodeURIComponent(parts.slice(3).join('/')); // handle any subfolders/encoding
      return `${userId}/${storedFilename}`;
    } catch (err) {
      console.error('Error parsing RAID URL:', err);
      return '';
    }
  };

  // Listen for IronDrive file selection
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Security: verify message origin
      if (event.origin !== 'https://irondrive.ibaproject.bid') return;

      const { type, files } = event.data || {};
      if (type !== 'irondrive-selection' || !Array.isArray(files)) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('You must be logged in to add images from IronDrive');
          return;
        }

        // Add IronDrive files to unified selectedImages array
        const newImages = files.map(f => ({
          id: `irondrive-${f.raid_url}-${Date.now()}`,
          type: 'irondrive' as const,
          url: f.raid_url,
          backupUrl: f.bolt_url ?? null,
          name: f.filename,
          isVideo: f.mime_type?.startsWith('video/') ?? false
        }));

        setSelectedImages(prev => [...prev, ...newImages]);

        // Set first image as preview if no images selected yet (skip videos)
        if (selectedImages.length === 0 && newImages.length > 0) {
          const firstImage = newImages.find(img => !img.isVideo);
          if (firstImage) {
            setImagePreview(firstImage.url!);
            setMainImageIndex(newImages.indexOf(firstImage));
          }
        }

        // Insert into auction_files table if item exists
        for (const f of files) {
          const file_key = fileKeyFromRaidUrl(f.raid_url);

          if (item?.id) {
            const { error: insertError } = await supabase.from('auction_files').insert({
              storage_provider: 'raid',
              file_key,
              download_url: f.raid_url,
              download_url_backup: f.bolt_url ?? null,
              item_id: item.id,
              name: f.filename,
              mime_type: f.mime_type ?? null,
              size: f.size ?? null,
              uploaded_by: user.id,
              source_user_id: f.userId ?? null,
            });

            if (insertError) {
              console.error('Error inserting file record:', insertError);
            }
          }
        }
      } catch (err) {
        console.error('Error handling IronDrive selection:', err);
        setError('Failed to add images from IronDrive');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [item?.id, selectedImages.length]);

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-ironbound-grey-900">
            {item ? 'Edit Inventory Item' : 'Add New Inventory Item'}
          </h3>
          <p className="text-sm text-ironbound-grey-600">
            Event {eventId} - {item ? 'Update item details' : 'Create new item from barcode sticker'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {raidError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">RAID Storage Unavailable</h3>
                <p className="mt-1 text-sm text-red-700">{raidError}</p>
                <p className="mt-2 text-sm text-red-600">Images cannot be uploaded to storage. You can save the item without images and add them later.</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setRaidError('');
                      handleSubmit(new Event('submit') as any);
                    }}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors"
                  >
                    Retry Upload
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setRaidError('');
                      setSelectedFiles([]);
                      setImagePreview(formData.image_url);
                      setIsUploading(false);
                      setIsLoading(false);
                    }}
                    className="px-4 py-2 bg-ironbound-orange-500 text-white text-sm font-medium rounded hover:bg-ironbound-orange-600 transition-colors"
                  >
                    Save Without Images
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRaidError('');
                      setSelectedFiles([]);
                      setIsUploading(false);
                      setIsLoading(false);
                    }}
                    className="px-4 py-2 bg-white border border-red-300 text-red-700 text-sm font-medium rounded hover:bg-red-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Basic Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Inventory Number *
            </label>
            <div className="relative">
              <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
              <input
                type="text"
                name="inventory_number"
                value={formData.inventory_number}
                onChange={handleInputChange}
                required
                className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors font-mono text-lg text-ironbound-grey-900 bg-white"
                placeholder="e.g., 525001, ABC123, etc."
              />
            </div>
            <p className="text-xs text-ironbound-grey-500 mt-1">
              From barcode sticker or any format you prefer
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Consigner
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
              <select
                name="consigner_customer_number"
                value={formData.consigner_customer_number}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors appearance-none text-gray-900 bg-white"
              >
                <option value="">Unassigned</option>
                {consigners.map((consigner) => (
                  <option key={consigner.id} value={consigner.customer_number}>
                    {consigner.customer_number} - {consigner.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Item Name - Live Editable */}
        <div>
          <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
            Item Name *
          </label>
          <div
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => {
              const newValue = e.currentTarget.textContent || '';
              setFormData(prev => ({ ...prev, title: newValue }));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            className="w-full px-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white outline-none min-h-[48px]"
            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          >
            {formData.title || ''}
          </div>
          <p className="text-xs text-ironbound-grey-500 mt-1">
            Click to edit (e.g., 2019 CAT 336 Hydraulic Excavator)
          </p>
        </div>

        {/* Descriptions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              className="w-full px-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors resize-none text-gray-900 bg-white"
              placeholder="Main description of the item"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Additional Description
            </label>
            <textarea
              name="additional_description"
              value={formData.additional_description}
              onChange={handleInputChange}
              rows={4}
              className="w-full px-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors resize-none text-gray-900 bg-white"
              placeholder="Additional details, condition notes, etc."
            />
          </div>
        </div>

        {/* Category and Condition */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Category
            </label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors appearance-none text-gray-900 bg-white"
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

          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Condition
            </label>
            <select
              name="condition"
              value={formData.condition}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors appearance-none text-gray-900 bg-white"
            >
              <option value="">Select condition</option>
              <option value="Excellent">Excellent</option>
              <option value="Very Good">Very Good</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Poor">Poor</option>
              <option value="For Parts">For Parts</option>
            </select>
          </div>
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
                placeholder="0.00"
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
                className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
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
                className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Image Upload Section */}
        <div className="space-y-6">
          <div className="border-b border-ironbound-grey-200 pb-4">
            <h4 className="text-lg font-semibold text-ironbound-grey-900 mb-2">Item Images</h4>
            <p className="text-sm text-ironbound-grey-600">Upload images or provide URLs. First image will be the main image.</p>
          </div>

          {/* IronDrive Button */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleIronDrivePickerClick}
              className="inline-flex items-center gap-2 px-6 py-3 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white font-medium rounded-lg transition-colors shadow-sm"
            >
              <ExternalLink className="h-5 w-5" />
              Add Photos from IronDrive
            </button>
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
              accept="image/*,video/*"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="h-12 w-12 text-ironbound-grey-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-ironbound-grey-900 mb-2">
              Drop images here or click to browse
            </p>
            <p className="text-sm text-ironbound-grey-600">
              Supports JPG, PNG, GIF, MP4, MOV, and other video formats
            </p>
          </div>

          {/* Media Preview */}
          {selectedImages.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h5 className="font-medium text-ironbound-grey-900">
                  Media Files ({selectedImages.length})
                </h5>
                <p className="text-sm text-ironbound-grey-600">
                  Drag to reorder • Click star to set as main • Click to enlarge
                </p>
              </div>

              <DragDropContext onDragEnd={handleImageDragEnd}>
                <Droppable droppableId="images" direction="horizontal">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4"
                    >
                      {selectedImages.map((image, index) => {
                        const imgSrc = image.type === 'file' && image.file
                          ? URL.createObjectURL(image.file)
                          : image.url || '';

                        return (
                          <Draggable key={image.id} draggableId={image.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`relative group ${
                                  snapshot.isDragging ? 'z-50 rotate-3 scale-105' : ''
                                }`}
                              >
                                <div className={`relative rounded-lg overflow-visible border-2 transition-all ${
                                  index === mainImageIndex
                                    ? 'border-ironbound-orange-500 shadow-lg'
                                    : 'border-ironbound-grey-200 hover:border-ironbound-orange-300'
                                }`}>
                                  <div className="relative overflow-hidden rounded-lg">
                                    {image.isVideo ? (
                                      <video
                                        src={imgSrc}
                                        className="w-full h-24 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setModalImageIndex(index);
                                          setShowImageModal(true);
                                        }}
                                        onError={(e) => {
                                          // Fallback to backup URL for IronDrive videos
                                          if (image.type === 'irondrive' && image.backupUrl && e.currentTarget.src !== image.backupUrl) {
                                            e.currentTarget.src = image.backupUrl;
                                          }
                                        }}
                                      />
                                    ) : (
                                      <img
                                        src={imgSrc}
                                        alt={`${image.type === 'irondrive' ? 'IronDrive' : 'Upload'} ${index + 1}`}
                                        className="w-full h-24 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setModalImageIndex(index);
                                          setShowImageModal(true);
                                        }}
                                        onError={(e) => {
                                          // Fallback to backup URL for IronDrive images
                                          if (image.type === 'irondrive' && image.backupUrl && e.currentTarget.src !== image.backupUrl) {
                                            e.currentTarget.src = image.backupUrl;
                                          }
                                        }}
                                      />
                                    )}

                                    {/* Play icon overlay for videos */}
                                    {image.isVideo && (
                                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="bg-black bg-opacity-60 rounded-full p-2">
                                          <Play className="h-6 w-6 text-white fill-current" />
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Main Image Star - Top Left */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAsMainImage(index);
                                    }}
                                    className={`absolute top-1 left-1 p-1 rounded transition-all z-10 ${
                                      index === mainImageIndex
                                        ? 'bg-ironbound-orange-500 text-white'
                                        : 'bg-black bg-opacity-50 text-white opacity-0 group-hover:opacity-100 hover:bg-ironbound-orange-500'
                                    }`}
                                    title={index === mainImageIndex ? 'Main Image' : 'Set as Main Image'}
                                  >
                                    <Star className={`h-3 w-3 ${index === mainImageIndex ? 'fill-current' : ''}`} />
                                  </button>

                                  {/* Remove Button - Top Right */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeFile(index);
                                    }}
                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-20"
                                    title="Remove image"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>

                                  {/* Drag Handle - Bottom Right */}
                                  <div
                                    {...provided.dragHandleProps}
                                    className="absolute bottom-1 right-1 bg-black bg-opacity-50 text-white rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
                                  >
                                    <GripVertical className="h-3 w-3" />
                                  </div>

                                  {/* Image Number */}
                                  <div className="absolute bottom-1 left-1 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded z-10">
                                    {index + 1}
                                  </div>

                                  {/* Badges Container */}
                                  <div className="absolute top-1 left-10 flex gap-1 z-10">
                                    {/* Source Badge */}
                                    {image.type === 'irondrive' && (
                                      <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded font-medium">
                                        IronDrive
                                      </div>
                                    )}
                                    {/* Video Badge */}
                                    {image.isVideo && (
                                      <div className="bg-purple-500 text-white text-xs px-2 py-1 rounded font-medium">
                                        VIDEO
                                      </div>
                                    )}
                                  </div>

                                  {/* Main Badge */}
                                  {index === mainImageIndex && (
                                    <div className="absolute bottom-1 right-1 bg-ironbound-orange-500 text-white text-xs px-2 py-1 rounded font-medium z-10">
                                      MAIN
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              <div className="text-sm text-ironbound-grey-500 bg-ironbound-grey-50 p-3 rounded-lg">
                <strong>Main Image:</strong> {selectedImages[mainImageIndex]?.name || 'None selected'} •
                <strong> Additional Images:</strong> {selectedImages.length - 1}
              </div>
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
                  className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
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
                className="w-full px-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors resize-none text-gray-900 bg-white"
                placeholder="One URL per line"
              />
            </div>
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
                  className="flex-1 px-3 py-2 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
                />
                <input
                  type="text"
                  value={spec.value}
                  onChange={(e) => updateSpecification(index, 'value', e.target.value)}
                  placeholder="Value"
                  className="flex-1 px-3 py-2 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
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

        {/* Submit Buttons */}
        <div className="flex space-x-4 pt-6 border-t border-ironbound-grey-200">
          {isUploading && (
            <div className="flex-1 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="text-blue-800">Uploading images to IronDrive...</span>
            </div>
          )}
          <button
            type="button"
            onClick={onCancel}
            className={`${isUploading ? 'w-auto' : 'flex-1'} px-6 py-3 border border-ironbound-grey-300 text-ironbound-grey-700 rounded-lg hover:bg-ironbound-grey-50 transition-colors`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || isUploading}
            className={`${isUploading ? 'flex-[2]' : 'flex-1'} bg-ironbound-orange-500 hover:bg-ironbound-orange-600 disabled:bg-ironbound-grey-300 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center`}
          >
            {isLoading && !isUploading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : isUploading && uploadProgress ? (
              <div className="flex items-center space-x-3 w-full">
                <div className="flex-1">
                  <div className="text-xs font-medium mb-1 truncate">
                    Uploading {uploadProgress.currentFile}/{uploadProgress.totalFiles}: {uploadProgress.fileName}
                  </div>
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress.percent}%` }}
                    />
                  </div>
                </div>
                <div className="text-xs font-semibold min-w-[3rem] text-right">
                  {uploadProgress.percent}%
                </div>
              </div>
            ) : (
              item ? 'Update Item' : 'Create Item'
            )}
          </button>
        </div>
      </form>

      {/* Image Gallery Modal */}
      {showImageModal && (() => {
        const allMedia = [];

        if (selectedImages.length > 0) {
          allMedia.push(...selectedImages.map(img => {
            let url = '';
            if (img.type === 'file' && img.file) {
              url = URL.createObjectURL(img.file);
            } else if (img.type === 'irondrive' && img.url) {
              url = img.url;
            }
            return url ? { url, isVideo: img.isVideo || false } : null;
          }).filter(item => item !== null));
        } else {
          if (imagePreview) {
            allMedia.push({ url: imagePreview, isVideo: false });
          }
          if (item?.additional_images) {
            allMedia.push(...item.additional_images.map(url => ({ url, isVideo: false })));
          }
        }

        return (
          <ImageGalleryModal
            images={allMedia}
            initialIndex={modalImageIndex}
            onClose={() => setShowImageModal(false)}
          />
        );
      })()}
    </div>
  );
}