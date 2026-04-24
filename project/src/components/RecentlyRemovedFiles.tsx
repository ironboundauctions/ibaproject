import React, { useEffect, useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle, FileImage } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ConfirmDialog from './ConfirmDialog';

interface RemovedFile {
  id: string;
  asset_group_id: string;
  original_name: string;
  variant: string;
  cdn_url: string | null;
  published_status: string;
  detached_at: string | null;
  item_id: string | null;
  mime_type: string;
  bytes: number;
  item_title: string | null;
  item_deleted: boolean;
  is_abandoned: boolean;
  created_at: string;
}

interface DialogState {
  isOpen: boolean;
  title: string;
  message: string;
  detail?: string;
  confirmLabel: string;
  variant: 'danger' | 'warning' | 'info' | 'success' | 'restore';
  alertOnly?: boolean;
  onConfirm: () => void;
}

export function RecentlyRemovedFiles() {
  const [files, setFiles] = useState<RemovedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'OK',
    variant: 'danger',
    onConfirm: () => {},
  });

  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));
  const openDialog = (opts: Omit<DialogState, 'isOpen'>) => setDialog({ ...opts, isOpen: true });

  useEffect(() => {
    fetchRemovedFiles();
  }, []);

  const fetchRemovedFiles = async () => {
    try {
      setLoading(true);
      setError(null);

      const [detachedResult, abandonedResult] = await Promise.all([
        supabase
          .from('auction_files')
          .select(`
            id,
            asset_group_id,
            original_name,
            variant,
            cdn_url,
            published_status,
            detached_at,
            created_at,
            item_id,
            mime_type,
            bytes,
            inventory_items (
              title,
              deleted_at
            )
          `)
          .not('detached_at', 'is', null)
          .eq('variant', 'thumb')
          .order('detached_at', { ascending: false }),

        supabase
          .from('auction_files')
          .select(`
            id,
            asset_group_id,
            original_name,
            variant,
            cdn_url,
            published_status,
            detached_at,
            created_at,
            item_id,
            mime_type,
            bytes
          `)
          .is('item_id', null)
          .is('detached_at', null)
          .eq('variant', 'thumb')
          .lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false }),
      ]);

      if (detachedResult.error) throw detachedResult.error;
      if (abandonedResult.error) throw abandonedResult.error;

      const detachedFiles: RemovedFile[] = (detachedResult.data || [])
        .map((file: any) => ({
          id: file.id,
          asset_group_id: file.asset_group_id,
          original_name: file.original_name,
          variant: file.variant,
          cdn_url: file.cdn_url,
          published_status: file.published_status,
          detached_at: file.detached_at,
          created_at: file.created_at,
          item_id: file.item_id,
          mime_type: file.mime_type,
          bytes: file.bytes,
          item_title: file.inventory_items?.title || null,
          item_deleted: !!file.inventory_items?.deleted_at,
          is_abandoned: false,
        }))
        .filter(file => !file.item_deleted);

      const abandonedFiles: RemovedFile[] = (abandonedResult.data || [])
        .map((file: any) => ({
          id: file.id,
          asset_group_id: file.asset_group_id,
          original_name: file.original_name,
          variant: file.variant,
          cdn_url: file.cdn_url,
          published_status: file.published_status,
          detached_at: null,
          created_at: file.created_at,
          item_id: null,
          mime_type: file.mime_type,
          bytes: file.bytes,
          item_title: null,
          item_deleted: false,
          is_abandoned: true,
        }));

      setFiles([...detachedFiles, ...abandonedFiles]);
    } catch (err) {
      console.error('[RecentlyRemovedFiles] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load removed files');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const handleRestore = async (file: RemovedFile) => {
    if (file.is_abandoned) {
      openDialog({
        title: 'Cannot Restore File',
        message: 'This file was uploaded but never linked to an inventory item.',
        detail: 'Abandoned uploads cannot be restored. You can delete it permanently to free up storage.',
        confirmLabel: 'OK',
        variant: 'warning',
        alertOnly: true,
        onConfirm: closeDialog,
      });
      return;
    }

    if (file.item_deleted) {
      openDialog({
        title: 'Cannot Restore File',
        message: 'This file cannot be restored because the original item has been deleted.',
        detail: 'Restore the item first from Recently Removed Items, then you can restore this file.',
        confirmLabel: 'OK',
        variant: 'warning',
        alertOnly: true,
        onConfirm: closeDialog,
      });
      return;
    }

    openDialog({
      title: 'Restore File',
      message: `Restore "${file.original_name}" back to "${file.item_title}"?`,
      confirmLabel: 'Restore',
      variant: 'restore',
      onConfirm: async () => {
        closeDialog();
        try {
          const { error } = await supabase
            .from('auction_files')
            .update({ detached_at: null })
            .eq('asset_group_id', file.asset_group_id);

          if (error) throw error;

          openDialog({
            title: 'File Restored',
            message: `"${file.original_name}" has been restored successfully.`,
            confirmLabel: 'OK',
            variant: 'success',
            alertOnly: true,
            onConfirm: async () => {
              closeDialog();
              await fetchRemovedFiles();
            },
          });
        } catch (err) {
          console.error('[RecentlyRemovedFiles] Restore error:', err);
          openDialog({
            title: 'Restore Failed',
            message: err instanceof Error ? err.message : 'Failed to restore file',
            confirmLabel: 'OK',
            variant: 'danger',
            alertOnly: true,
            onConfirm: closeDialog,
          });
        }
      },
    });
  };

  const handlePermanentDelete = async (assetGroupIds: string[]) => {
    const fileCount = assetGroupIds.length;

    openDialog({
      title: 'Permanently Delete Files',
      message: `Permanently delete ${fileCount} file${fileCount > 1 ? 's' : ''}?`,
      detail: 'This will delete all variants (thumb, display, source, video) from the database and B2 storage. This action CANNOT be undone.',
      confirmLabel: fileCount > 1 ? `Delete ${fileCount} Files` : 'Delete Permanently',
      variant: 'danger',
      onConfirm: async () => {
        closeDialog();
        try {
          const workerUrl = import.meta.env.VITE_WORKER_URL;
          if (!workerUrl) throw new Error('Worker URL not configured');

          let totalDeleted = 0;
          const errors: string[] = [];

          for (const assetGroupId of assetGroupIds) {
            try {
              const response = await fetch(`${workerUrl}/api/delete-asset-group`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assetGroupId }),
              });

              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Delete request failed');
              }

              const result = await response.json();
              totalDeleted += result.deletedCount || 0;
            } catch (err) {
              errors.push(`Failed to delete ${assetGroupId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
          }

          setSelectedFiles(new Set());
          await fetchRemovedFiles();

          if (errors.length > 0) {
            openDialog({
              title: 'Deletion Complete With Errors',
              message: `Deleted ${totalDeleted} file(s), but ${errors.length} error(s) occurred.`,
              detail: errors.join('\n'),
              confirmLabel: 'OK',
              variant: 'warning',
              alertOnly: true,
              onConfirm: closeDialog,
            });
          } else {
            openDialog({
              title: 'Deletion Complete',
              message: `Successfully deleted ${totalDeleted} file(s) from B2 and database.`,
              confirmLabel: 'OK',
              variant: 'success',
              alertOnly: true,
              onConfirm: closeDialog,
            });
          }
        } catch (err) {
          console.error('[RecentlyRemovedFiles] Delete error:', err);
          openDialog({
            title: 'Deletion Failed',
            message: err instanceof Error ? err.message : 'Failed to delete files',
            confirmLabel: 'OK',
            variant: 'danger',
            alertOnly: true,
            onConfirm: closeDialog,
          });
        }
      },
    });
  };

  const toggleFileSelection = (assetGroupId: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(assetGroupId)) {
      newSelection.delete(assetGroupId);
    } else {
      newSelection.add(assetGroupId);
    }
    setSelectedFiles(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map(f => f.asset_group_id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedFiles.size === 0) {
      openDialog({
        title: 'No Files Selected',
        message: 'Please select at least one file to delete.',
        confirmLabel: 'OK',
        variant: 'info',
        alertOnly: true,
        onConfirm: closeDialog,
      });
      return;
    }
    handlePermanentDelete(Array.from(selectedFiles));
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900">Recently Removed Files</h2>
        </div>
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h2 className="text-xl font-semibold text-gray-900">Recently Removed Files</h2>
        </div>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <>
      <ConfirmDialog
        isOpen={dialog.isOpen}
        title={dialog.title}
        message={dialog.message}
        detail={dialog.detail}
        confirmLabel={dialog.confirmLabel}
        variant={dialog.variant}
        alertOnly={dialog.alertOnly}
        onConfirm={dialog.onConfirm}
        onCancel={closeDialog}
      />

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900">Recently Removed Files</h2>
        </div>

        {files.length === 0 ? (
          <p className="text-gray-600">No removed files. Files detached from items will appear here.</p>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Info:</strong> Files remain here until you permanently delete them. Select files and click "Delete Selected" to remove from database and B2 storage.
              </p>
            </div>

            <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFiles.size === files.length && files.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  {selectedFiles.size === files.length && files.length > 0 ? 'Deselect All' : 'Select All'}
                  {selectedFiles.size > 0 && ` (${selectedFiles.size} selected)`}
                </span>
              </label>

              {selectedFiles.size > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Selected ({selectedFiles.size})
                </button>
              )}
            </div>

            <div className="space-y-2">
              {files.map((file) => {
                const canRestore = !file.item_deleted && !file.is_abandoned;
                const isSelected = selectedFiles.has(file.asset_group_id);

                return (
                  <div
                    key={file.id}
                    className={`border rounded-lg p-4 transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleFileSelection(file.asset_group_id)}
                          className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />

                        <div className="flex-shrink-0">
                          {file.cdn_url && file.published_status === 'published' ? (
                            <img
                              src={file.cdn_url}
                              alt={file.original_name}
                              className="w-16 h-16 object-cover rounded border border-gray-200"
                            />
                          ) : (
                            <div className="w-16 h-16 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                              <FileImage className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900 truncate">
                              {file.original_name}
                            </h3>
                            {file.is_abandoned && (
                              <span className="flex-shrink-0 text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                Abandoned Upload
                              </span>
                            )}
                          </div>

                          <div className="mt-1 space-y-1">
                            {!file.is_abandoned && (
                              <p className="text-sm text-gray-600">
                                From: {file.item_title ? (
                                  <span className={file.item_deleted ? 'text-red-600 line-through' : ''}>
                                    {file.item_title}
                                    {file.item_deleted && ' (item removed)'}
                                  </span>
                                ) : (
                                  <span className="italic text-gray-400">Unknown item</span>
                                )}
                              </p>
                            )}
                            {file.is_abandoned && (
                              <p className="text-sm text-gray-500 italic">
                                Uploaded but never linked to an item
                              </p>
                            )}

                            <p className="text-sm text-gray-500">
                              {file.is_abandoned ? 'Uploaded' : 'Removed'}: {formatDate(file.detached_at || file.created_at)} • {formatFileSize(file.bytes)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRestore(file)}
                          disabled={!canRestore}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors ${
                            canRestore
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          }`}
                          title={canRestore ? 'Restore file to item' : 'Cannot restore - item was removed'}
                        >
                          <RotateCcw className="w-4 h-4" />
                          Restore
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
