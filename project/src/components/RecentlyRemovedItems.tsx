import React, { useEffect, useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle, Package, Image as ImageIcon } from 'lucide-react';
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

export function RecentlyRemovedItems() {
  const [items, setItems] = useState<RemovedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const handlePermanentDelete = async (item: RemovedItem) => {
    const confirmMessage = `PERMANENT DELETION WARNING

This will permanently delete:
• Item: ${item.title}
• Inventory #: ${item.inventory_number}
• All attached files (${item.file_count} file${item.file_count !== 1 ? 's' : ''})
• From database and B2 storage

This action CANNOT be undone.

Type "DELETE" to confirm:`;

    const userInput = prompt(confirmMessage);

    if (userInput !== 'DELETE') {
      return;
    }

    try {
      // First, get all asset groups for this item
      const { data: assetGroups } = await supabase
        .from('auction_files')
        .select('asset_group_id')
        .eq('item_id', item.id)
        .eq('variant', 'source');

      const uniqueAssetGroups = new Set(assetGroups?.map(f => f.asset_group_id) || []);

      // CRITICAL: Detach all files first so the worker can delete them
      const { error: detachError } = await supabase
        .from('auction_files')
        .update({ detached_at: new Date().toISOString() })
        .eq('item_id', item.id)
        .is('detached_at', null);

      if (detachError) {
        console.error('[RecentlyRemovedItems] Error detaching files:', detachError);
        throw new Error('Failed to detach files before deletion');
      }

      // Delete each asset group from B2 via worker
      const workerUrl = import.meta.env.VITE_WORKER_URL;
      if (workerUrl && uniqueAssetGroups.size > 0) {
        for (const assetGroupId of uniqueAssetGroups) {
          try {
            const response = await fetch(`${workerUrl}/api/delete-asset-group`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ assetGroupId }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              console.error('[RecentlyRemovedItems] Worker deletion failed:', errorData);
              throw new Error(errorData.error || 'Worker deletion failed');
            }
          } catch (err) {
            console.error('[RecentlyRemovedItems] Failed to delete asset group from B2:', assetGroupId, err);
            throw err;
          }
        }
      }

      // Delete all auction_files records for this item
      const { error: filesError } = await supabase
        .from('auction_files')
        .delete()
        .eq('item_id', item.id);

      if (filesError) {
        console.error('[RecentlyRemovedItems] Error deleting file records:', filesError);
        throw filesError;
      }

      // Delete the item
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      alert('Item and all associated files permanently deleted from database and B2.');
      await fetchRemovedItems();
    } catch (err) {
      console.error('[RecentlyRemovedItems] Delete error:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete item');
    }
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

  return (
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
              <strong>Info:</strong> Items remain here until you permanently delete them. Click "Delete Now" to remove from database and B2 storage.
            </p>
          </div>

          <div className="space-y-2">
            {items.map((item) => {
              return (
                <div
                  key={item.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-4">
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
                      <div className="flex items-start justify-between gap-4">
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

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRestore(item)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                            title="Restore item to Global Inventory"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Restore
                          </button>

                          <button
                            onClick={() => handlePermanentDelete(item)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                            title="Permanently delete from database and B2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete Now
                          </button>
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
