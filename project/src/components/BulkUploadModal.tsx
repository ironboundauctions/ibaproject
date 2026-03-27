import React, { useState, useRef } from 'react';
import { X, Upload, Loader2, CheckCircle2, AlertCircle, Trash2, Plus, GripVertical } from 'lucide-react';
import {
  bulkUploadService,
  type UploadedFileInfo,
  type GroupedItem,
  type GroupedFile,
  type AnalysisResults,
} from '../services/bulkUploadService';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type UploadStage = 'select' | 'uploading' | 'analyzing' | 'confirm' | 'processing' | 'complete';

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
  const [jobId, setJobId] = useState<string>('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [newGroupNumber, setNewGroupNumber] = useState<string>('');
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [selectedUngrouped, setSelectedUngrouped] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetModal = () => {
    setStage('select');
    setSelectedFiles([]);
    setUploadedFiles([]);
    setAnalysisResults({ grouped: [], ungrouped: [], errors: [] });
    setGroups([]);
    setUngrouped([]);
    setError('');
    setJobId('');
    setExpandedGroups(new Set());
    setNewGroupNumber('');
    setShowNewGroupInput(false);
    setSelectedUngrouped(new Set());
  };

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

  const handleUploadAndAnalyze = async () => {
    if (selectedFiles.length === 0) return;

    setStage('uploading');
    setError('');

    try {
      // Upload files to processing worker
      const uploaded = await bulkUploadService.uploadFiles(selectedFiles);
      setUploadedFiles(uploaded);

      setStage('analyzing');

      // Analyze for barcodes
      const analysis = await bulkUploadService.analyzeBatch(uploaded);
      setAnalysisResults(analysis);

      // Initialize groups and ungrouped from analysis
      setGroups(analysis.grouped);
      setUngrouped(analysis.ungrouped);

      // Create batch job
      const batchJobId = await bulkUploadService.createBatchJob(uploaded, analysis);
      setJobId(batchJobId);

      setStage('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
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

  const handleConfirm = async () => {
    if (groups.length === 0) {
      setError('No groups to process. Create at least one group with an inventory number.');
      return;
    }

    setStage('processing');
    setError('');

    try {
      // Delete ungrouped files from storage
      if (ungrouped.length > 0) {
        const ungroupedIds = ungrouped.map(f => f.assetGroupId);
        await bulkUploadService.deleteBatchFiles(ungroupedIds);
      }

      // Prepare groups with full file information
      const groupsWithFullInfo = groups.map(group => ({
        inv_number: group.inv_number,
        files: group.files.map(file => {
          const uploadedFile = uploadedFiles.find(u => u.assetGroupId === file.assetGroupId);
          return {
            fileName: file.fileName,
            assetGroupId: file.assetGroupId,
            cdnUrls: uploadedFile?.cdnUrls || {},
            fileSize: uploadedFile?.fileSize || 0,
            mimeType: uploadedFile?.mimeType || 'image/webp',
            width: uploadedFile?.width || 0,
            height: uploadedFile?.height || 0,
          };
        }),
      }));

      // Confirm batch and create inventory items
      const result = await bulkUploadService.confirmBatch(jobId, groupsWithFullInfo);

      if (result.errors.length > 0) {
        console.warn('Some items failed to create:', result.errors);
      }

      setStage('complete');
      setTimeout(() => {
        onSuccess();
        onClose();
        resetModal();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
      setStage('confirm');
    }
  };

  const handleCancel = async () => {
    if (uploadedFiles.length > 0) {
      const allAssetGroupIds = uploadedFiles.map(f => f.assetGroupId);
      await bulkUploadService.cancelBatch(jobId, allAssetGroupIds);
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
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {stage === 'select' && (
            <div className="space-y-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer"
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-700 mb-2">
                  Click to select images
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

              {selectedFiles.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">
                    Selected Files ({selectedFiles.length})
                  </h3>
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
                    onClick={handleUploadAndAnalyze}
                    className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Upload and Analyze {selectedFiles.length} Images
                  </button>
                </div>
              )}
            </div>
          )}

          {stage === 'uploading' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">Uploading images...</p>
              <p className="text-sm text-gray-500">Processing and uploading files to storage</p>
            </div>
          )}

          {stage === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">Scanning for barcodes...</p>
              <p className="text-sm text-gray-500">Detecting inventory numbers from images</p>
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
                  <p className="text-2xl font-bold text-gray-900">{uploadedFiles.length}</p>
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
                          {group.files.map((file) => (
                            <div key={file.assetGroupId} className="relative group">
                              <div className="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                                <p className="text-xs text-gray-500 text-center px-2">
                                  {file.fileName}
                                </p>
                              </div>
                              <button
                                onClick={() => handleRemoveFromGroup(groupIndex, file.assetGroupId)}
                                className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
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
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
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
                    {ungrouped.map((file) => (
                      <div
                        key={file.assetGroupId}
                        className={`relative group cursor-pointer ${
                          selectedUngrouped.has(file.assetGroupId) ? 'ring-2 ring-blue-500' : ''
                        }`}
                        onClick={() => toggleUngroupedSelected(file.assetGroupId)}
                      >
                        <div className="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                          <p className="text-xs text-gray-500 text-center px-2">
                            {file.fileName}
                          </p>
                        </div>
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
                    ))}
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
                  className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Create {groups.length} Inventory Item{groups.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}

          {stage === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">Creating inventory items...</p>
              <p className="text-sm text-gray-500">Linking files and creating database records</p>
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
