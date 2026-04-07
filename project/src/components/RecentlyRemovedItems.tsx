import React, { useEffect, useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle, Package, Image as ImageIcon, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface RemovedItem {
  id: string;
  inventory_number: string;
  title: string;
  category: string;
  status: string;
  deleted_at: string;
  file_count: number;
  thumbnail_url: string | null;
}

interface DeletionProgress {
  itemId: string;
  itemTitle: string;
  status: 'pending' | 'deleting_files' | 'deleting_item' | 'completed' | 'failed';
  filesDeleted: number;
  totalFiles: number;
  error?: string;
}

export function RecentlyRemovedItems() {
  const [items, setItems] = useState<RemovedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [deletionProgress, setDeletionProgress] = useState<DeletionProgress[]>([]);
  const [showProgressModal, setShowProgressModal] = useState(false);

  useEffect(() => {
    fetchRemovedItems();
  }, []);

  const fetchRemovedItems = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('inventory_items')
        .select(`
          id,
          inventory_number,
          title,
          category,
          status,
          deleted_at
        `)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (queryError) throw queryError;

      const itemsWithFiles = await Promise.all(
        (data || []).map(async (item) => {
          // Get first thumb for display
          const { data: files } = await supabase
            .from('auction_files')
            .select('cdn_url, published_status, detached_at')
            .eq('item_id', item.id)
            .eq('variant', 'thumb')
            .is('detached_at', null)
            .limit(1)
            .maybeSingle();

          // Count unique asset groups (ALL files, including detached ones)
          // When item is deleted, show total file count including individually-removed files
          const { data: assetGroups } = await supabase
            .from('auction_files')
            .select('asset_group_id')
            .eq('item_id', item.id)
            .eq('variant', 'source');

          const uniqueAssetGroups = new Set(assetGroups?.map(f => f.asset_group_id) || []);

          return {
            ...item,
            file_count: uniqueAssetGroups.size,
            thumbnail_url: files?.published_status === 'published' ? files.cdn_url : null
          };
        })
      );

      setItems(itemsWithFiles);
    } catch (err) {
      console.error('[RecentlyRemovedItems] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load removed items');
    } finally {
      setLoading(false);
    }
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

  const handleRestore = async (item: RemovedItem) => {
    if (!confirm(`Restore item "${item.title}"?\n\nThis will restore the item to Global Inventory with its attached files.\n\nNote: Files that were individually removed before item deletion will NOT be restored.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('inventory_items')
        .update({ deleted_at: null })
        .eq('id', item.id);

      if (error) throw error;

      alert('Item restored successfully!');
      await fetchRemovedItems();
    } catch (err) {
      console.error('[RecentlyRemovedItems] Restore error:', err);
      alert(err instanceof Error ? err.message : 'Failed to restore item');
    }
  };

  const handlePermanentDelete = async (itemIds: string[]) => {
    const itemCount = itemIds.length;
    const selectedItemsData = items.filter(item => itemIds.includes(item.id));
    const totalFiles = selectedItemsData.reduce((sum, item) => sum + item.file_count, 0);

    if (!confirm(`Are you sure you want to permanently delete ${itemCount} item${itemCount > 1 ? 's' : ''} and ${totalFiles} file${totalFiles !== 1 ? 's' : ''}?\n\nThis action CANNOT be undone.`)) {
      return;
    }

    // Initialize progress tracking
    const initialProgress: DeletionProgress[] = selectedItemsData.map(item => ({
      itemId: item.id,
      itemTitle: item.title,
      status: 'pending',
      filesDeleted: 0,
      totalFiles: item.file_count
    }));

    setDeletionProgress(initialProgress);
    setShowProgressModal(true);

    try {
      let deletedItems = 0;
      let deletedFiles = 0;
      const errors: string[] = [];

      for (let i = 0; i < itemIds.length; i++) {
        const itemId = itemIds[i];

        try {
          // Update status to deleting_files
          setDeletionProgress(prev => prev.map(p =>
            p.itemId === itemId ? { ...p, status: 'deleting_files' } : p
          ));

          const { data: assetGroups } = await supabase
            .from('auction_files')
            .select('asset_group_id')
            .eq('item_id', itemId)
            .eq('variant', 'source');

          const uniqueAssetGroups = new Set(assetGroups?.map(f => f.asset_group_id) || []);

          const { error: detachError } = await supabase
            .from('auction_files')
            .update({ detached_at: new Date().toISOString() })
            .eq('item_id', itemId)
            .is('detached_at', null);

          if (detachError) {
            throw new Error('Failed to detach files before deletion');
          }

          const workerUrl = import.meta.env.VITE_WORKER_URL;
          if (workerUrl && uniqueAssetGroups.size > 0) {
            let fileCount = 0;
            for (const assetGroupId of uniqueAssetGroups) {
              try {
                const response = await fetch(`${workerUrl}/api/delete-asset-group`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ assetGroupId }),
                });

                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.error || 'Worker deletion failed');
                }

                fileCount++;
                deletedFiles++;

                // Update progress for each file deleted
                setDeletionProgress(prev => prev.map(p =>
                  p.itemId === itemId ? { ...p, filesDeleted: fileCount } : p
                ));
              } catch (err) {
                console.error('[RecentlyRemovedItems] Failed to delete asset group from B2:', assetGroupId, err);
                throw err;
              }
            }
          }

          // Update status to deleting_item
          setDeletionProgress(prev => prev.map(p =>
            p.itemId === itemId ? { ...p, status: 'deleting_item' } : p
          ));

          const { error } = await supabase
            .from('inventory_items')
            .delete()
            .eq('id', itemId);

          if (error) throw error;

          deletedItems++;

          // Update status to completed
          setDeletionProgress(prev => prev.map(p =>
            p.itemId === itemId ? { ...p, status: 'completed' } : p
          ));
        } catch (err) {
          const item = items.find(i => i.id === itemId);
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`Failed to delete "${item?.title || itemId}": ${errorMsg}`);

          // Update status to failed
          setDeletionProgress(prev => prev.map(p =>
            p.itemId === itemId ? { ...p, status: 'failed', error: errorMsg } : p
          ));
        }
      }

      // Wait a moment before closing to let users see completion
      setTimeout(async () => {
        setShowProgressModal(false);
        setSelectedItems(new Set());
        await fetchRemovedItems();

        if (errors.length > 0) {
          alert(`Deleted ${deletedItems} item(s) and ${deletedFiles} file(s) with ${errors.length} error(s):\n\n${errors.join('\n')}`);
        } else {
          alert(`Successfully deleted ${deletedItems} item(s) and ${deletedFiles} file(s) from database and B2.`);
        }
      }, 1500);
    } catch (err) {
      console.error('[RecentlyRemovedItems] Delete error:', err);
      setShowProgressModal(false);
      alert(err instanceof Error ? err.message : 'Failed to delete items');
    }
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(i => i.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedItems.size === 0) {
      alert('Please select at least one item to delete');
      return;
    }
    handlePermanentDelete(Array.from(selectedItems));
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900">Recently Removed Items</h2>
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
          <h2 className="text-xl font-semibold text-gray-900">Recently Removed Items</h2>
        </div>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  const getStatusIcon = (status: DeletionProgress['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
      case 'deleting_files':
      case 'deleting_item':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getStatusText = (progress: DeletionProgress) => {
    switch (progress.status) {
      case 'pending':
        return 'Waiting...';
      case 'deleting_files':
        return `Deleting files (${progress.filesDeleted}/${progress.totalFiles})...`;
      case 'deleting_item':
        return 'Deleting item record...';
      case 'completed':
        return 'Completed';
      case 'failed':
        return `Failed: ${progress.error}`;
    }
  };

  const allCompleted = deletionProgress.length > 0 && deletionProgress.every(p => p.status === 'completed' || p.status === 'failed');

  return (
    <>
      {showProgressModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Trash2 className="w-6 h-6 text-red-600" />
                <h2 className="text-xl font-semibold text-gray-900">Deleting Items</h2>
              </div>
              {allCompleted && (
                <button
                  onClick={() => setShowProgressModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {deletionProgress.map((progress) => (
                  <div
                    key={progress.itemId}
                    className={`border rounded-lg p-4 ${
                      progress.status === 'failed'
                        ? 'border-red-200 bg-red-50'
                        : progress.status === 'completed'
                        ? 'border-green-200 bg-green-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getStatusIcon(progress.status)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">
                          {progress.itemTitle}
                        </h3>
                        <p className={`text-sm mt-1 ${
                          progress.status === 'failed' ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {getStatusText(progress)}
                        </p>

                        {progress.status === 'deleting_files' && progress.totalFiles > 0 && (
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{
                                  width: `${(progress.filesDeleted / progress.totalFiles) * 100}%`
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {allCompleted && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      Completed: {deletionProgress.filter(p => p.status === 'completed').length} / {deletionProgress.length}
                      {deletionProgress.some(p => p.status === 'failed') && (
                        <span className="text-red-600 ml-2">
                          ({deletionProgress.filter(p => p.status === 'failed').length} failed)
                        </span>
                      )}
                    </p>
                    <button
                      onClick={() => setShowProgressModal(false)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900">Recently Removed Items</h2>
        </div>

      {items.length === 0 ? (
        <p className="text-gray-600">No removed items. Items removed from Global Inventory will appear here.</p>
      ) : (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Info:</strong> Items remain here until you permanently delete them. Select items and click "Delete Selected" to remove from database and B2 storage.
            </p>
          </div>

          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedItems.size === items.length && items.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                {selectedItems.size === items.length && items.length > 0 ? 'Deselect All' : 'Select All'}
                {selectedItems.size > 0 && ` (${selectedItems.size} selected)`}
              </span>
            </label>

            {selectedItems.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected ({selectedItems.size})
              </button>
            )}
          </div>

          <div className="space-y-2">
            {items.map((item) => {
              const isSelected = selectedItems.has(item.id);

              return (
                <div
                  key={item.id}
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
                        onChange={() => toggleItemSelection(item.id)}
                        className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />

                      <div className="flex-shrink-0">
                        {item.thumbnail_url ? (
                          <img
                            src={item.thumbnail_url}
                            alt={item.title}
                            className="w-16 h-16 object-cover rounded border border-gray-200"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">
                          {item.title}
                        </h3>

                        <div className="mt-1 space-y-1">
                          <p className="text-sm text-gray-600">
                            Inventory #: {item.inventory_number} • {item.category}
                          </p>

                          <p className="text-sm text-gray-500">
                            {item.file_count} file{item.file_count !== 1 ? 's' : ''} • Removed: {formatDate(item.deleted_at)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRestore(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        title="Restore item to Global Inventory"
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
