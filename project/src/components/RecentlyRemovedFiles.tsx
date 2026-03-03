import React, { useEffect, useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle, FileImage } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface RemovedFile {
  id: string;
  asset_group_id: string;
  original_name: string;
  variant: string;
  cdn_url: string | null;
  published_status: string;
  detached_at: string;
  item_id: string | null;
  mime_type: string;
  bytes: number;
  item_title: string | null;
  item_deleted: boolean;
}

export function RecentlyRemovedFiles() {
  const [files, setFiles] = useState<RemovedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRemovedFiles();
  }, []);

  const fetchRemovedFiles = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('auction_files')
        .select(`
          id,
          asset_group_id,
          original_name,
          variant,
          cdn_url,
          published_status,
          detached_at,
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
        .order('detached_at', { ascending: false });

      if (queryError) throw queryError;

      const formattedFiles: RemovedFile[] = (data || []).map((file: any) => ({
        id: file.id,
        asset_group_id: file.asset_group_id,
        original_name: file.original_name,
        variant: file.variant,
        cdn_url: file.cdn_url,
        published_status: file.published_status,
        detached_at: file.detached_at,
        item_id: file.item_id,
        mime_type: file.mime_type,
        bytes: file.bytes,
        item_title: file.inventory_items?.title || null,
        item_deleted: !!file.inventory_items?.deleted_at
      }));

      setFiles(formattedFiles);
    } catch (err) {
      console.error('[RecentlyRemovedFiles] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load removed files');
    } finally {
      setLoading(false);
    }
  };

  const calculateDaysRemaining = (detachedAt: string): number => {
    const detached = new Date(detachedAt);
    const deletionDate = new Date(detached);
    deletionDate.setDate(deletionDate.getDate() + 30);

    const now = new Date();
    const diffMs = deletionDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
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
    if (file.item_deleted) {
      alert('Cannot restore this file because the original item has been deleted.');
      return;
    }

    if (!confirm(`Restore "${file.original_name}" back to "${file.item_title}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('auction_files')
        .update({ detached_at: null })
        .eq('asset_group_id', file.asset_group_id);

      if (error) throw error;

      await fetchRemovedFiles();
    } catch (err) {
      console.error('[RecentlyRemovedFiles] Restore error:', err);
      alert(err instanceof Error ? err.message : 'Failed to restore file');
    }
  };

  const handlePermanentDelete = async (file: RemovedFile) => {
    const confirmMessage = `PERMANENT DELETION WARNING

This will permanently delete:
• ${file.original_name}
• All variants (thumb, display, source)
• From database and B2 storage

This action CANNOT be undone.

Type "DELETE" to confirm:`;

    const userInput = prompt(confirmMessage);

    if (userInput !== 'DELETE') {
      return;
    }

    try {
      const { error } = await supabase
        .from('auction_files')
        .delete()
        .eq('asset_group_id', file.asset_group_id);

      if (error) throw error;

      alert('File permanently deleted. B2 cleanup will occur automatically.');
      await fetchRemovedFiles();
    } catch (err) {
      console.error('[RecentlyRemovedFiles] Delete error:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete file');
    }
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
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <Trash2 className="w-5 h-5 text-gray-600" />
        <h2 className="text-xl font-semibold text-gray-900">Recently Removed Files</h2>
      </div>

      {files.length === 0 ? (
        <p className="text-gray-600">No recently removed files</p>
      ) : (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              Files are automatically deleted after 30 days. You can restore them during this period.
            </p>
          </div>

          <div className="space-y-2">
            {files.map((file) => {
              const daysRemaining = calculateDaysRemaining(file.detached_at);
              const isUrgent = daysRemaining <= 7;
              const canRestore = !file.item_deleted;

              return (
                <div
                  key={file.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-4">
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
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">
                            {file.original_name}
                          </h3>

                          <div className="mt-1 space-y-1">
                            <p className="text-sm text-gray-600">
                              From: {file.item_title ? (
                                <span className={file.item_deleted ? 'text-red-600 line-through' : ''}>
                                  {file.item_title}
                                  {file.item_deleted && ' (deleted)'}
                                </span>
                              ) : (
                                <span className="italic text-gray-400">Unknown item</span>
                              )}
                            </p>

                            <p className="text-sm text-gray-500">
                              Removed: {formatDate(file.detached_at)} • {formatFileSize(file.bytes)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span
                              className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${
                                isUrgent
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
                            </span>
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
                              title={canRestore ? 'Restore file' : 'Cannot restore - original item deleted'}
                            >
                              <RotateCcw className="w-4 h-4" />
                              Restore
                            </button>

                            <button
                              onClick={() => handlePermanentDelete(file)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                              title="Permanently delete file"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete Now
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
