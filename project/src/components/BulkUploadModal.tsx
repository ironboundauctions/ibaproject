import React, { useState, useRef, useEffect } from 'react';
import { generateUUID } from '../utils/formatters';
import { X, Upload, Loader2, CheckCircle2, AlertCircle, Trash2, Plus, GripVertical, ExternalLink } from 'lucide-react';
import {
  bulkUploadService,
  type UploadedFileInfo,
  type GroupedItem,
  type GroupedFile,
  type AnalysisResults,
} from '../services/bulkUploadService';
import { supabase } from '../lib/supabase';

/* REVERT POINT 2: If reverting to worker-based scanning, restore these imports:
 * import { ImageReducer, type ReducedImage } from '../utils/imageReduction';
 * import { Zap } from 'lucide-react'; // Add Zap back to icon imports above
 */

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type UploadStage = 'select' | 'analyzing' | 'uploading' | 'confirm' | 'processing' | 'complete';

/* REVERT POINT 2: If reverting to worker-based scanning, restore 'reducing' stage:
 * type UploadStage = 'select' | 'reducing' | 'uploading' | 'analyzing' | 'confirm' | 'processing' | 'complete';
 */

export default function BulkUploadModal({ isOpen, onClose, onSuccess }: BulkUploadModalProps) {
  const [stage, setStage] = useState<UploadStage>('select');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileInfo[]>([]);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults>({
    grouped: [],
    ungrouped: [],
    errors: [],
  });
  const [groups, setGroups] = useState<GroupedItem[]>([]);
  const [ungrouped, setUngrouped] = useState<GroupedFile[]>([]);
  const [error, setError] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<Array<{ inv_number: string; error: string; isInRecentlyRemoved?: boolean }>>([]);
  const [jobId, setJobId] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [analysisProgress, setAnalysisProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [newGroupNumber, setNewGroupNumber] = useState<string>('');
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [selectedUngrouped, setSelectedUngrouped] = useState<Set<string>>(new Set());
  const [sourceMode, setSourceMode] = useState<'pc' | 'irondrive'>('pc');
  const [ironDriveFiles, setIronDriveFiles] = useState<Array<{ source_key: string; mime_type: string; filename: string; assetGroupId: string }>>([]);
  const [processingIronDrive, setProcessingIronDrive] = useState(false);

  /* REVERT POINT 2: If reverting to worker-based scanning, restore these states:
   * const [fileMap, setFileMap] = useState<Map<string, File>>(new Map());
   * const [reductionProgress, setReductionProgress] = useState<{ current: number; total: number; currentFile: string }>({
   *   current: 0,
   *   total: 0,
   *   currentFile: ''
   * });
   * const [reductionStats, setReductionStats] = useState<{ originalTotal: number; reducedTotal: number; savingsPercent: number } | null>(null);
   */

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedFilesRef = useRef<UploadedFileInfo[]>([]);
  const jobIdRef = useRef<string>('');
  const stageRef = useRef<UploadStage>('select');

  useEffect(() => { uploadedFilesRef.current = uploadedFiles; }, [uploadedFiles]);
  useEffect(() => { jobIdRef.current = jobId; }, [jobId]);
  useEffect(() => { stageRef.current = stage; }, [stage]);

  useEffect(() => {
    const handleUnload = () => {
      const files = uploadedFilesRef.current;
      const currentStage = stageRef.current;

      if (files.length === 0 || currentStage === 'complete') return;

      const assetGroupIds = files.map(f => f.assetGroupId);
      const workerUrl = (import.meta.env.VITE_WORKER_URL || '').replace(/\/$/, '');

      if (workerUrl && assetGroupIds.length > 0) {
        navigator.sendBeacon(
          `${workerUrl}/api/delete-batch-files`,
          new Blob([JSON.stringify({ assetGroupIds })], { type: 'application/json' })
        );
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  const resetModal = () => {
    setStage('select');
    setSelectedFiles([]);
    setUploadedFiles([]);
    setAnalysisResults({ grouped: [], ungrouped: [], errors: [] });
    setGroups([]);
    setUngrouped([]);
    setError('');
    setValidationErrors([]);
    setJobId('');
    setUploadProgress({ current: 0, total: 0 });
    setAnalysisProgress({ current: 0, total: 0 });
    setExpandedGroups(new Set());
    setNewGroupNumber('');
    setShowNewGroupInput(false);
    setSelectedUngrouped(new Set());
    setSourceMode('pc');
    setIronDriveFiles([]);
    setProcessingIronDrive(false);
  };

  /* REVERT POINT 2: If reverting to worker-based scanning, add these back to resetModal:
   * setFileMap(new Map());
   * setReductionProgress({ current: 0, total: 0, currentFile: '' });
   * setReductionStats(null);
   */

  useEffect(() => {
    if (!isOpen) return;

    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== 'https://irondrive.ibaproject.bid') return;

      if (event.data.type === 'irondrive-selection' && event.data.files) {
        handleIronDriveSelection(event.data.files);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));

    if (imageFiles.length !== files.length) {
      setError('Some files were skipped - only images are allowed');
    } else {
      setError('');
    }

    setSelectedFiles(imageFiles);
  };

  const handleIronDrivePickerClick = () => {
    const returnUrl = encodeURIComponent(window.location.origin);
    window.open(
      `https://irondrive.ibaproject.bid/picker?return_to=${returnUrl}`,
      'irondrivePicker',
      'width=1200,height=800'
    );
  };

  const guessMimeType = (filename: string): string => {
    const ext = filename.toLowerCase().split('.').pop() || '';
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
      tiff: 'image/tiff', tif: 'image/tiff', heic: 'image/heic',
      heif: 'image/heif', avif: 'image/avif',
    };
    return mimeTypes[ext] || 'image/jpeg';
  };

  const handleIronDriveSelection = (pickerFiles: any[]) => {
    console.log('[IRONDRIVE] Received files for bulk upload:', pickerFiles);
    setError('');

    const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif', 'heic', 'heif', 'avif'];

    const imageFiles = pickerFiles.filter(f => {
      const mimeType = f.mime_type || f.mimeType || '';
      if (mimeType.startsWith('image/')) return true;
      const name = f.filename || f.name || f.source_key || '';
      const ext = name.split('.').pop()?.toLowerCase() || '';
      return IMAGE_EXTENSIONS.includes(ext);
    });

    if (imageFiles.length !== pickerFiles.length) {
      setError(`Some files were skipped - only images are allowed. Selected ${imageFiles.length} of ${pickerFiles.length} files.`);
    }

    if (imageFiles.length === 0) return;

    const staged = imageFiles.map(f => {
      const fileName = f.filename || f.name || f.source_key?.split('/').pop() || 'unknown';
      const mimeType = f.mime_type || f.mimeType || guessMimeType(fileName);
      return {
        source_key: f.source_key,
        mime_type: mimeType,
        filename: fileName,
        assetGroupId: generateUUID(),
      };
    });

    console.log('[IRONDRIVE] Staged', staged.length, 'files (metadata only, no download)');
    setIronDriveFiles(staged);
  };

  const handleAnalyze = async () => {
    const hasFiles = sourceMode === 'irondrive' ? ironDriveFiles.length > 0 : selectedFiles.length > 0;
    if (!hasFiles) return;

    setError('');

    try {
      let analysis: AnalysisResults;

      if (sourceMode === 'irondrive') {
        // Step 1: Upload IronDrive files via worker (RAID → B2, no barcode scan)
        setStage('uploading');
        const sourceKeys = ironDriveFiles.map(f => f.source_key);
        const uploaded = await bulkUploadService.uploadIronDriveFiles(
          sourceKeys,
          (current, total) => setUploadProgress({ current, total })
        );
        setUploadedFiles(uploaded);

        // Persist to DB immediately so cleanup can find these B2 files if user closes window
        const batchJobId = await bulkUploadService.createBatchJob(
          ironDriveFiles.map(f => new File([], f.filename, { type: f.mime_type })),
          { grouped: [], ungrouped: [], errors: [] }
        );
        setJobId(batchJobId);
        await bulkUploadService.persistUploadedFiles(batchJobId, uploaded);

        // Step 2: Scan barcodes in browser from CDN source URLs (same as PC flow)
        setStage('analyzing');
        setAnalysisProgress({ current: 0, total: uploaded.length });

        analysis = await bulkUploadService.scanIronDriveUploads(
          uploaded,
          (current, total) => setAnalysisProgress({ current, total })
        );

        setAnalysisResults(analysis);
        setGroups(analysis.grouped);
        setUngrouped(analysis.ungrouped);

        await bulkUploadService.updateBatchAnalysis(
          batchJobId,
          uploaded.map(u => new File([], u.fileName, { type: u.mimeType })),
          analysis
        );

        if (analysis.grouped.length > 0) {
          const inventoryNumbers = analysis.grouped.map(g => g.inv_number);
          const { data: existingItems } = await supabase
            .from('inventory_items')
            .select('inventory_number, deleted_at')
            .in('inventory_number', inventoryNumbers);

          if (existingItems && existingItems.length > 0) {
            const conflicts = existingItems.map(item => ({
              inv_number: item.inventory_number,
              error: item.deleted_at
                ? 'Item exists in Recently Removed - restore or permanently delete it first'
                : 'Inventory number already exists',
              isInRecentlyRemoved: !!item.deleted_at,
            }));
            setValidationErrors(conflicts);
            const recentlyRemovedCount = conflicts.filter(c => c.isInRecentlyRemoved).length;
            const activeCount = conflicts.length - recentlyRemovedCount;
            let errorMsg = '';
            if (recentlyRemovedCount > 0 && activeCount > 0) {
              errorMsg = `${recentlyRemovedCount} item(s) exist in Recently Removed and ${activeCount} item(s) already exist as active inventory.`;
            } else if (recentlyRemovedCount > 0) {
              errorMsg = `${recentlyRemovedCount} item(s) exist in Recently Removed section. Please restore or permanently delete them first.`;
            } else {
              errorMsg = `${activeCount} inventory number(s) already exist.`;
            }
            setError(errorMsg);
          }
        }

        setStage('confirm');
        return;
      }

      // BROWSER-SIDE SCANNING: Scan barcodes directly in browser
      setStage('analyzing');

      analysis = await bulkUploadService.analyzeBatch(selectedFiles, (current, total) => {
        setAnalysisProgress({ current, total });
      });

      setAnalysisResults(analysis);
      setGroups(analysis.grouped);
      setUngrouped(analysis.ungrouped);

      const batchJobId = await bulkUploadService.createBatchJob(selectedFiles, analysis);
      setJobId(batchJobId);

      /* REVERT POINT 2: If reverting to worker-based scanning, replace the above code with:
       *
       * setStage('reducing');
       *
       * const reducedImages = await ImageReducer.reduceImagesForAnalysis(
       *   selectedFiles,
       *   (progress) => setReductionProgress(progress)
       * );
       *
       * const stats = ImageReducer.calculateSavings(reducedImages);
       * setReductionStats(stats);
       *
       * const reducedFiles = reducedImages.map(r => r.reducedFile);
       * const originalFileMap = new Map<string, File>();
       * reducedImages.forEach(r => {
       *   originalFileMap.set(r.reducedFile.name, r.originalFile);
       * });
       *
       * setStage('analyzing');
       *
       * const analysis = await bulkUploadService.analyzeBatch(reducedFiles, (current, total) => {
       *   setAnalysisProgress({ current, total });
       * });
       * setAnalysisResults(analysis);
       * setFileMap(originalFileMap);
       *
       * setGroups(analysis.grouped);
       * setUngrouped(analysis.ungrouped);
       *
       * const batchJobId = await bulkUploadService.createBatchJob(selectedFiles, analysis);
       * setJobId(batchJobId);
       */

      // Check for conflicts with existing inventory numbers (including Recently Removed)
      if (analysis.grouped.length > 0) {
        const inventoryNumbers = analysis.grouped.map(g => g.inv_number);
        const { data: existingItems } = await supabase
          .from('inventory_items')
          .select('inventory_number, deleted_at')
          .in('inventory_number', inventoryNumbers);

        if (existingItems && existingItems.length > 0) {
          const conflicts = existingItems.map(item => ({
            inv_number: item.inventory_number,
            error: item.deleted_at
              ? 'Item exists in Recently Removed - restore or permanently delete it first'
              : 'Inventory number already exists',
            isInRecentlyRemoved: !!item.deleted_at,
          }));

          setValidationErrors(conflicts);
          const recentlyRemovedCount = conflicts.filter(c => c.isInRecentlyRemoved).length;
          const activeCount = conflicts.length - recentlyRemovedCount;

          let errorMsg = '';
          if (recentlyRemovedCount > 0 && activeCount > 0) {
            errorMsg = `${recentlyRemovedCount} item(s) exist in Recently Removed and ${activeCount} item(s) already exist as active inventory.`;
          } else if (recentlyRemovedCount > 0) {
            errorMsg = `${recentlyRemovedCount} item(s) exist in Recently Removed section. Please restore or permanently delete them first.`;
          } else {
            errorMsg = `${activeCount} inventory number(s) already exist.`;
          }
          setError(errorMsg);
        }
      }

      setStage('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setStage('select');
    }
  };

  const handleMoveToGroup = (file: GroupedFile, targetGroupIndex: number) => {
    // Remove from ungrouped
    setUngrouped(prev => prev.filter(f => f.assetGroupId !== file.assetGroupId));

    // Add to target group
    setGroups(prev => {
      const updated = [...prev];
      updated[targetGroupIndex].files.push(file);
      return updated;
    });
  };

  const handleRemoveFromGroup = (groupIndex: number, fileAssetGroupId: string) => {
    // Remove from group
    const file = groups[groupIndex].files.find(f => f.assetGroupId === fileAssetGroupId);
    if (!file) return;

    setGroups(prev => {
      const updated = [...prev];
      updated[groupIndex].files = updated[groupIndex].files.filter(
        f => f.assetGroupId !== fileAssetGroupId
      );
      return updated;
    });

    // Add to ungrouped
    setUngrouped(prev => [...prev, file]);
  };

  const handleCreateGroupFromSelected = () => {
    if (!newGroupNumber.trim() || selectedUngrouped.size === 0) return;

    const filesToMove = ungrouped.filter(f => selectedUngrouped.has(f.assetGroupId));

    setGroups(prev => [
      ...prev,
      {
        inv_number: newGroupNumber.trim(),
        files: filesToMove,
      },
    ]);

    setUngrouped(prev => prev.filter(f => !selectedUngrouped.has(f.assetGroupId)));
    setSelectedUngrouped(new Set());
    setNewGroupNumber('');
    setShowNewGroupInput(false);
  };

  const handleDeleteGroup = (groupIndex: number) => {
    if (!confirm(`Delete group "${groups[groupIndex].inv_number}"? Files will be moved to ungrouped.`)) {
      return;
    }

    const groupFiles = groups[groupIndex].files;
    setUngrouped(prev => [...prev, ...groupFiles]);
    setGroups(prev => prev.filter((_, i) => i !== groupIndex));
  };

  const handleDeleteUngrouped = (assetGroupId: string) => {
    setUngrouped(prev => prev.filter(f => f.assetGroupId !== assetGroupId));
  };

  const handleRemoveGroupFromBatch = (inv_number: string) => {
    // Completely remove a group and its files from the batch (no moving to ungrouped)
    setGroups(prev => prev.filter(g => g.inv_number !== inv_number));

    // Also remove from validation errors
    setValidationErrors(prev => prev.filter(e => e.inv_number !== inv_number));

    // Clear general error if no more conflicts
    setValidationErrors(prev => {
      if (prev.length === 1 && prev[0].inv_number === inv_number) {
        setError('');
      }
      return prev.filter(e => e.inv_number !== inv_number);
    });
  };

  const handlePermanentlyDeleteFromDB = async (inv_number: string) => {
    if (!confirm(`Permanently delete "${inv_number}" from the database? This cannot be undone.`)) {
      return;
    }

    try {
      // Permanently delete the item from the database
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('inventory_number', inv_number)
        .not('deleted_at', 'is', null); // Only delete soft-deleted items

      if (error) throw error;

      // Remove from validation errors
      setValidationErrors(prev => prev.filter(e => e.inv_number !== inv_number));

      // Clear general error if no more conflicts
      if (validationErrors.length === 1) {
        setError('');
      }

      // Show success message briefly
      const originalError = error;
      setError(`Successfully deleted ${inv_number} from database. You can now proceed.`);
      setTimeout(() => {
        if (validationErrors.filter(e => e.inv_number !== inv_number).length === 0) {
          setError('');
        }
      }, 3000);
    } catch (err) {
      setError(`Failed to delete ${inv_number}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleConfirm = async () => {
    if (groups.length === 0) {
      setError('No groups to process. Create at least one group with an inventory number.');
      return;
    }

    setStage('uploading');
    setError('');

    try {
      let uploaded: UploadedFileInfo[];

      if (sourceMode === 'irondrive') {
        // Files were already uploaded to B2 during the analyze phase
        // uploadedFiles state already has the correct CDN URLs and assetGroupIds
        uploaded = uploadedFiles;

        // Update groups to use the real assetGroupIds from the uploaded files
        const fileNameToAssetGroupId = new Map(uploaded.map(f => [f.fileName, f.assetGroupId]));
        const groupsWithRealIds = groups.map(group => ({
          ...group,
          files: group.files.map(file => ({
            ...file,
            assetGroupId: fileNameToAssetGroupId.get(file.fileName) || file.assetGroupId,
          })),
        }));

        setStage('processing');
        setProcessingProgress({ current: 0, total: groups.length });

        // Confirm batch - files are already in B2, just create inventory items and link
        const result = await bulkUploadService.confirmBatch(jobId, uploaded, groupsWithRealIds, true, (current, total) => setProcessingProgress({ current, total }));

        if (result.errors.length > 0) {
          console.error('[BULK-UPLOAD] Some items failed to create:', result.errors);
          setValidationErrors(result.errors);
          setError(`${result.created.length} item(s) created successfully, but ${result.errors.length} failed`);
          setStage('confirm');
          return;
        }

        console.log('[BULK-UPLOAD] IronDrive batch complete:', result.created.length);
        setStage('complete');
        setTimeout(() => {
          onSuccess();
          onClose();
          resetModal();
        }, 2000);
        return;
      } else {
        // PC Upload flow
        // STEP 2: Get confirmed files to upload (only files in groups)
        const confirmedFileNames = new Set<string>();
        groups.forEach(group => {
          group.files.forEach(file => {
            confirmedFileNames.add(file.fileName);
          });
        });

        // Map file names to actual File objects from selectedFiles
        const fileNameToFile = new Map(selectedFiles.map(f => [f.name, f]));
        const filesToUpload = Array.from(confirmedFileNames)
          .map(name => fileNameToFile.get(name))
          .filter((f): f is File => f !== undefined);

        /* REVERT POINT 2: If reverting to worker-based scanning, restore fileMap usage:
         * const filesToUpload = Array.from(confirmedFileNames)
         *   .map(name => fileMap.get(name))
         *   .filter((f): f is File => f !== undefined);
         */

        // STEP 3: Upload confirmed files to B2
        uploaded = await bulkUploadService.uploadConfirmedFiles(
          filesToUpload,
          (current, total) => setUploadProgress({ current, total })
        );
        setUploadedFiles(uploaded);

        // Map uploaded files by fileName to get real asset group IDs
        const fileNameToAssetGroupId = new Map(
          uploaded.map(f => [f.fileName, f.assetGroupId])
        );

        // Update groups to use real asset group IDs (not temp IDs)
        const groupsWithRealIds = groups.map(group => ({
          ...group,
          files: group.files.map(file => ({
            ...file,
            assetGroupId: fileNameToAssetGroupId.get(file.fileName) || file.assetGroupId,
          })),
        }));

        setStage('processing');
        setProcessingProgress({ current: 0, total: groups.length });

        // STEP 4: Confirm batch and create inventory items (PC flow)
        const result = await bulkUploadService.confirmBatch(jobId, uploaded, groupsWithRealIds, false, (current, total) => setProcessingProgress({ current, total }));

        if (result.errors.length > 0) {
          console.error('[BULK-UPLOAD] Some items failed to create:', result.errors);
          result.errors.forEach(err => {
            console.error('[BULK-UPLOAD] Error for', err.inv_number, ':', err.error);
          });

          // Store detailed errors for user action
          setValidationErrors(result.errors);

          // Check if any errors are due to Recently Removed items
          const recentlyRemovedCount = result.errors.filter(e => e.isInRecentlyRemoved).length;
          if (recentlyRemovedCount > 0) {
            setError(`${result.created.length} item(s) created. ${recentlyRemovedCount} item(s) exist in Recently Removed section. Please restore or permanently delete them first.`);
          } else {
            const errorSummary = result.errors.map(e => `${e.inv_number}: ${e.error}`).join('\n');
            setError(`${result.created.length} item(s) created successfully, but ${result.errors.length} failed:\n${errorSummary}`);
          }
          setStage('confirm');
          return;
        }

        console.log('[BULK-UPLOAD] Batch complete:', {
          created: result.created.length,
          errors: result.errors.length
        });

        setStage('complete');
        setTimeout(() => {
          onSuccess();
          onClose();
          resetModal();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
      setStage('confirm');
    }
  };

  const handleCancel = async () => {
    if (jobId || uploadedFiles.length > 0) {
      await bulkUploadService.cancelBatch(jobId, uploadedFiles);
    }
    onClose();
    resetModal();
  };

  const toggleGroupExpanded = (invNumber: string) => {
    setExpandedGroups(prev => {
      const updated = new Set(prev);
      if (updated.has(invNumber)) {
        updated.delete(invNumber);
      } else {
        updated.add(invNumber);
      }
      return updated;
    });
  };

  const toggleUngroupedSelected = (assetGroupId: string) => {
    setSelectedUngrouped(prev => {
      const updated = new Set(prev);
      if (updated.has(assetGroupId)) {
        updated.delete(assetGroupId);
      } else {
        updated.add(assetGroupId);
      }
      return updated;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Bulk Inventory Upload</h2>
          <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-800 font-medium mb-2">{error}</p>

                  {validationErrors.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {validationErrors.map((err) => (
                        <div key={err.inv_number} className="bg-white border border-red-200 rounded p-3">
                          <div className="flex flex-col gap-3">
                            <div>
                              <p className="font-semibold text-gray-900">{err.inv_number}</p>
                              <p className="text-sm text-gray-600">{err.error}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {err.isInRecentlyRemoved && (
                                <button
                                  onClick={() => handlePermanentlyDeleteFromDB(err.inv_number)}
                                  className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 whitespace-nowrap flex items-center gap-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Permanently Delete from DB
                                </button>
                              )}
                              <button
                                onClick={() => handleRemoveGroupFromBatch(err.inv_number)}
                                className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 whitespace-nowrap"
                              >
                                Remove from This Batch
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <p className="text-sm text-gray-600 mt-2">
                        You can permanently delete conflicting items from the database, or just remove them from this batch and proceed with the others.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {stage === 'select' && (
            <div className="space-y-6">
              {/* Source Selection Toggle */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Select Source:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSourceMode('pc')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      sourceMode === 'pc'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    <Upload className="w-4 h-4 inline-block mr-2" />
                    PC Upload
                  </button>
                  <button
                    onClick={() => setSourceMode('irondrive')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      sourceMode === 'irondrive'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    <ExternalLink className="w-4 h-4 inline-block mr-2" />
                    IronDrive
                  </button>
                </div>
              </div>

              {/* PC Upload Area */}
              {sourceMode === 'pc' && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-700 mb-2">
                    Click to select images from your computer
                  </p>
                  <p className="text-sm text-gray-500">
                    Upload images with barcodes for automatic grouping by inventory number
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              )}

              {/* IronDrive Picker Area */}
              {sourceMode === 'irondrive' && (
                <div
                  onClick={handleIronDrivePickerClick}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-700 mb-2">
                    Click to select images from IronDrive
                  </p>
                  <p className="text-sm text-gray-500">
                    Select files already uploaded to IronDrive for automatic grouping
                  </p>
                </div>
              )}

              {sourceMode === 'pc' && selectedFiles.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">
                      Selected Files ({selectedFiles.length})
                    </h3>
                    <button
                      onClick={handleAnalyze}
                      className="bg-blue-600 text-white py-2 px-5 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
                    >
                      Analyze {selectedFiles.length} Images
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <p className="text-white text-sm text-center px-2 truncate">
                            {file.name}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleAnalyze}
                    className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Analyze {selectedFiles.length} Images
                  </button>
                </div>
              )}

              {sourceMode === 'irondrive' && ironDriveFiles.length > 0 && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                    <ExternalLink className="w-10 h-10 text-blue-500 mx-auto mb-3" />
                    <p className="text-2xl font-bold text-blue-900 mb-1">{ironDriveFiles.length}</p>
                    <p className="text-blue-700 font-medium">
                      image{ironDriveFiles.length !== 1 ? 's' : ''} selected from IronDrive
                    </p>
                    <p className="text-sm text-blue-500 mt-2">
                      Files will be uploaded to storage, then barcodes scanned in your browser
                    </p>
                  </div>
                  <button
                    onClick={handleAnalyze}
                    className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Process {ironDriveFiles.length} IronDrive Images
                  </button>
                </div>
              )}
            </div>
          )}

          {stage === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-16 px-8">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-6">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-1">Scanning for barcodes</p>
              <p className="text-sm text-gray-500 mb-8">
                {sourceMode === 'irondrive' ? 'Reading uploaded images for barcode data...' : 'Reading each image for barcode data'}
              </p>
              <div className="w-full max-w-sm">
                <div className="flex justify-between text-sm font-medium mb-2">
                  <span className="text-gray-600">Progress</span>
                  <span className="text-blue-600">
                    {analysisProgress.total > 0 ? `${analysisProgress.current} / ${analysisProgress.total}` : 'Starting...'}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                    style={{ width: analysisProgress.total > 0 ? `${(analysisProgress.current / analysisProgress.total) * 100}%` : '0%' }}
                  />
                </div>
                {analysisProgress.total > 0 && (
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    {Math.round((analysisProgress.current / analysisProgress.total) * 100)}% complete
                  </p>
                )}
              </div>
            </div>
          )}

          {/* REVERT POINT 2: If reverting to worker-based scanning, restore reduction stage UI:
          {stage === 'reducing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Zap className="w-12 h-12 text-yellow-600 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">Optimizing images...</p>
              <p className="text-sm text-gray-500 mb-4">
                {reductionProgress.current} of {reductionProgress.total} images optimized
              </p>
              <div className="w-full max-w-md bg-gray-200 rounded-full h-2">
                <div
                  className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(reductionProgress.current / reductionProgress.total) * 100}%` }}
                />
              </div>
              {reductionProgress.currentFile && (
                <p className="text-xs text-gray-400 mt-2">{reductionProgress.currentFile}</p>
              )}
            </div>
          )}

          And change analyzing stage back to show reduction stats
          */}

          {stage === 'uploading' && (
            <div className="flex flex-col items-center justify-center py-16 px-8">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-6">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-1">
                {sourceMode === 'irondrive' ? 'Transferring from IronDrive' : 'Uploading files to storage'}
              </p>
              <p className="text-sm text-gray-500 mb-8">
                {sourceMode === 'irondrive' ? 'Downloading, converting, and uploading to storage...' : 'Sending files to secure storage...'}
              </p>
              <div className="w-full max-w-sm">
                {(() => {
                  const total = uploadProgress.total > 0 ? uploadProgress.total : ironDriveFiles.length;
                  const current = uploadProgress.current;
                  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
                  return (
                    <>
                      <div className="flex justify-between text-sm font-medium mb-2">
                        <span className="text-gray-600">Files uploaded</span>
                        <span className="text-blue-600">{current} / {total}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                          style={{ width: total > 0 ? `${pct}%` : '0%' }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-2 text-center">{pct}% complete</p>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {stage === 'confirm' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 font-medium mb-2">Review and Organize Files</p>
                <p className="text-sm text-blue-600">
                  Files are grouped by detected barcode. Drag files between groups, create new groups, or remove unwanted files.
                </p>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Files</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {sourceMode === 'irondrive' ? ironDriveFiles.length : selectedFiles.length}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-600">Grouped</p>
                  <p className="text-2xl font-bold text-green-900">
                    {groups.reduce((sum, g) => sum + g.files.length, 0)}
                  </p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-sm text-yellow-600">Ungrouped</p>
                  <p className="text-2xl font-bold text-yellow-900">{ungrouped.length}</p>
                </div>
              </div>

              {/* Grouped Items */}
              {groups.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Grouped Items ({groups.length})</h3>
                  {groups.map((group, groupIndex) => (
                    <div key={groupIndex} className="border border-gray-200 rounded-lg">
                      <div
                        className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer"
                        onClick={() => toggleGroupExpanded(group.inv_number)}
                      >
                        <div className="flex items-center gap-3">
                          <GripVertical className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900">
                              Inventory #{group.inv_number}
                            </p>
                            <p className="text-sm text-gray-500">
                              {group.files.length} file{group.files.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGroup(groupIndex);
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>

                      {expandedGroups.has(group.inv_number) && (
                        <div className="p-4 grid grid-cols-4 gap-4">
                          {group.files.map((file) => {
                            const originalFile = selectedFiles.find(f => f.name === file.fileName);
                            const uploadedFile = uploadedFiles.find(f => f.assetGroupId === file.assetGroupId || f.fileName === file.fileName);
                            const thumbSrc = originalFile
                              ? URL.createObjectURL(originalFile)
                              : uploadedFile?.cdnUrls?.thumb;
                            return (
                              <div key={file.assetGroupId} className="relative group">
                                {thumbSrc ? (
                                  <img
                                    src={thumbSrc}
                                    alt={file.fileName}
                                    className="w-full h-24 object-cover rounded-lg"
                                  />
                                ) : (
                                  <div className="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                                    <p className="text-xs text-gray-500 text-center px-2">
                                      {file.fileName}
                                    </p>
                                  </div>
                                )}
                                <button
                                  onClick={() => handleRemoveFromGroup(groupIndex, file.assetGroupId)}
                                  className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Ungrouped Files */}
              {ungrouped.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Ungrouped Files ({ungrouped.length})</h3>
                    <div className="flex gap-2">
                      {selectedUngrouped.size > 0 && (
                        <button
                          onClick={() => setShowNewGroupInput(true)}
                          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                        >
                          <Plus className="w-4 h-4" />
                          Create Group ({selectedUngrouped.size})
                        </button>
                      )}
                    </div>
                  </div>

                  {showNewGroupInput && (
                    <div className="flex gap-2 p-4 bg-blue-50 rounded-lg">
                      <input
                        type="text"
                        value={newGroupNumber}
                        onChange={(e) => setNewGroupNumber(e.target.value)}
                        placeholder="Enter inventory number"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white placeholder-gray-400"
                      />
                      <button
                        onClick={handleCreateGroupFromSelected}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Create
                      </button>
                      <button
                        onClick={() => {
                          setShowNewGroupInput(false);
                          setNewGroupNumber('');
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-4 gap-4">
                    {ungrouped.map((file) => {
                      const originalFile = selectedFiles.find(f => f.name === file.fileName);
                      const uploadedFile = uploadedFiles.find(f => f.assetGroupId === file.assetGroupId || f.fileName === file.fileName);
                      const thumbSrc = originalFile
                        ? URL.createObjectURL(originalFile)
                        : uploadedFile?.cdnUrls?.thumb;
                      return (
                        <div
                          key={file.assetGroupId}
                          className={`relative group cursor-pointer ${
                            selectedUngrouped.has(file.assetGroupId) ? 'ring-2 ring-blue-500' : ''
                          }`}
                          onClick={() => toggleUngroupedSelected(file.assetGroupId)}
                        >
                          {thumbSrc ? (
                            <img
                              src={thumbSrc}
                              alt={file.fileName}
                              className="w-full h-24 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                              <p className="text-xs text-gray-500 text-center px-2">
                                {file.fileName}
                              </p>
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteUngrouped(file.assetGroupId);
                            }}
                            className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Errors */}
              {analysisResults.errors.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-red-900">Errors ({analysisResults.errors.length})</h3>
                  {analysisResults.errors.map((err, index) => (
                    <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">
                        <span className="font-medium">{err.fileName}:</span> {err.error}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-4 pt-4 border-t">
                <button
                  onClick={handleCancel}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={validationErrors.length > 0}
                  className={`flex-1 py-3 px-6 rounded-lg font-medium transition-colors ${
                    validationErrors.length > 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {validationErrors.length > 0
                    ? 'Fix Conflicts First'
                    : `Create ${groups.length} Inventory Item${groups.length !== 1 ? 's' : ''}`
                  }
                </button>
              </div>
            </div>
          )}

          {stage === 'processing' && (
            <div className="flex flex-col items-center justify-center py-16 px-8">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-6">
                <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-1">Creating inventory items</p>
              <p className="text-sm text-gray-500 mb-8">Linking files and saving to database</p>
              <div className="w-full max-w-sm">
                {processingProgress.total > 0 ? (
                  <>
                    <div className="flex justify-between text-sm font-medium mb-2">
                      <span className="text-gray-600">Items created</span>
                      <span className="text-green-600">{processingProgress.current} / {processingProgress.total}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-green-600 h-3 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${(processingProgress.current / processingProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-2 text-center">
                      {Math.round((processingProgress.current / processingProgress.total) * 100)}% complete
                    </p>
                  </>
                ) : (
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div className="bg-green-600 h-3 rounded-full w-1/3 animate-pulse" />
                  </div>
                )}
              </div>
            </div>
          )}

          {stage === 'complete' && (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="w-12 h-12 text-green-600 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">Upload Complete!</p>
              <p className="text-sm text-gray-500">
                Successfully created {groups.length} inventory item{groups.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
