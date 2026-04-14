import React, { useState, useEffect } from 'react';
import { Plus, Search, CreditCard as Edit, Trash2, Package, Image as ImageIcon, ArrowUpDown, Check, X, Upload, Gavel, Info } from 'lucide-react';
import { InventoryService, InventoryItem } from '../services/inventoryService';
import { ConsignorService } from '../services/consignerService';
import { Consignor } from '../types/consigner';
import InventoryItemFormNew from './InventoryItemFormNew';
import ImageGalleryModal from './ImageGalleryModal';
import BulkActions from './BulkActions';
import BulkUploadModal from './BulkUploadModal';
import AdvancedFilters, { FilterState } from './AdvancedFilters';
import AssignToEventModal from './AssignToEventModal';
import InventoryItemDetail from './InventoryItemDetail';
import { formatCurrency, EQUIPMENT_CATEGORIES } from '../utils/formatters';
import { supabase } from '../lib/supabase';

export default function GlobalInventoryManagement() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [consigners, setConsigners] = useState<Consignor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [editingDescriptionId, setEditingDescriptionId] = useState<string | null>(null);
  const [editedDescription, setEditedDescription] = useState<string>('');
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState<string>('');
  const [sortBy, setSortBy] = useState<'inventory_number' | 'title' | 'created_at' | 'consigner'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [fileCountsByItemId, setFileCountsByItemId] = useState<Record<string, number>>({});
  const [cdnThumbnailsByItemId, setCdnThumbnailsByItemId] = useState<Record<string, string>>({});
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>({
    categories: [],
    consignerIds: [],
    priceMin: '',
    priceMax: '',
    dateFrom: '',
    dateTo: ''
  });
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkUploadItemId, setBulkUploadItemId] = useState<string | null>(null);
  const [assignToEventItem, setAssignToEventItem] = useState<InventoryItem | null>(null);
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);
  const [eventNumbersByItemId, setEventNumbersByItemId] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [itemsData, consignersData] = await Promise.all([
        InventoryService.getAllItems(),
        ConsignorService.getConsignors()
      ]);
      setItems(itemsData);
      setConsigners(consignersData);

      if (itemsData.length > 0) {
        const itemIds = itemsData.map(item => item.id);
        const { data: assignmentRows } = await supabase
          .from('event_inventory_assignments')
          .select('inventory_id, auction_events(event_number)')
          .in('inventory_id', itemIds);

        if (assignmentRows) {
          const map: Record<string, string[]> = {};
          assignmentRows.forEach((row: any) => {
            const num = row.auction_events?.event_number;
            if (num) {
              if (!map[row.inventory_id]) map[row.inventory_id] = [];
              map[row.inventory_id].push(num);
            }
          });
          setEventNumbersByItemId(map);
        }
      }

      // Fetch file counts and thumbnails in a single query
      if (itemsData.length > 0) {
        const itemIds = itemsData.map(item => item.id);

        const { data: allFiles, error: filesError } = await supabase
          .from('auction_files')
          .select('item_id, cdn_url, variant, display_order, asset_group_id')
          .in('item_id', itemIds)
          .in('variant', ['source', 'thumb'])
          .eq('published_status', 'published')
          .is('detached_at', null)
          .order('display_order', { ascending: true });

        if (!filesError && allFiles) {
          const fileCounts: Record<string, number> = {};
          const thumbnails: Record<string, string> = {};

          // Create a map of item barcode asset group IDs for filtering
          const barcodeAssetGroupIds = new Map(
            itemsData.map(item => [item.id, item.barcode_asset_group_id]).filter(([_, id]) => id)
          );

          allFiles.forEach(file => {
            const barcodeAssetGroupId = barcodeAssetGroupIds.get(file.item_id);
            const isBarcode = barcodeAssetGroupId && file.asset_group_id === barcodeAssetGroupId;

            if (file.variant === 'source' && !isBarcode) {
              fileCounts[file.item_id] = (fileCounts[file.item_id] || 0) + 1;
            } else if (file.variant === 'thumb' && !thumbnails[file.item_id] && !isBarcode) {
              thumbnails[file.item_id] = file.cdn_url;
            }
          });

          setFileCountsByItemId(fileCounts);
          setCdnThumbnailsByItemId(thumbnails);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAndSortedItems = items
    .filter(item => {
      const matchesSearch =
        item.inventory_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

      const matchesCategory = advancedFilters.categories.length === 0 ||
        advancedFilters.categories.includes(item.category || '');

      const matchesConsigner = advancedFilters.consignerIds.length === 0 ||
        advancedFilters.consignerIds.includes(item.consigner_id || '');

      const matchesPriceMin = !advancedFilters.priceMin ||
        (item.reserve_price || 0) >= parseFloat(advancedFilters.priceMin);

      const matchesPriceMax = !advancedFilters.priceMax ||
        (item.reserve_price || 0) <= parseFloat(advancedFilters.priceMax);

      const matchesDateFrom = !advancedFilters.dateFrom ||
        new Date(item.created_at || 0) >= new Date(advancedFilters.dateFrom);

      const matchesDateTo = !advancedFilters.dateTo ||
        new Date(item.created_at || 0) <= new Date(advancedFilters.dateTo);

      return matchesSearch && matchesStatus && matchesCategory && matchesConsigner &&
             matchesPriceMin && matchesPriceMax && matchesDateFrom && matchesDateTo;
    })
    .sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'inventory_number':
          comparison = a.inventory_number.localeCompare(b.inventory_number);
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'created_at':
          comparison = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
          break;
        case 'consigner':
          const consignerA = getConsignorName(a.consigner_id);
          const consignerB = getConsignorName(b.consigner_id);
          comparison = consignerA.localeCompare(consignerB);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const handleCreateItem = () => {
    setSelectedItem(null);
    setShowForm(true);
  };

  const handleEditItem = (item: InventoryItem) => {
    setSelectedItem(item);
    setShowForm(true);
  };

  const handleDeleteItem = async (item: InventoryItem) => {
    try {
      const assignments = await InventoryService.getItemEventAssignments(item.id);

      if (assignments.length > 0) {
        const eventNames = assignments.map(a => a.event?.title || 'Unknown Event').join(', ');
        const confirmed = confirm(
          `Item ${item.inventory_number} is currently assigned to ${assignments.length} event${assignments.length > 1 ? 's' : ''}: ${eventNames}.\n\nDeleting this item will automatically remove it from those events. Do you want to continue?`
        );
        if (!confirmed) return;

        await InventoryService.removeAllEventAssignments(item.id);
      } else {
        if (!confirm(`Are you sure you want to delete item ${item.inventory_number}?`)) {
          return;
        }
      }

      await InventoryService.deleteItem(item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
      setEventNumbersByItemId(prev => { const next = { ...prev }; delete next[item.id]; return next; });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete item');
    }
  };

  const handleFormSubmit = async (itemData: any) => {
    try {
      let itemId: string;
      if (selectedItem) {
        const updatedItem = await InventoryService.updateItem(selectedItem.id, itemData);
        setItems(prev => prev.map(i => i.id === selectedItem.id ? updatedItem : i));
        itemId = selectedItem.id;
      } else {
        const newItem = await InventoryService.createItem(itemData);
        setItems(prev => [newItem, ...prev]);
        itemId = newItem.id;
      }

      return { id: itemId };
    } catch (error) {
      throw error;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'assigned': return 'bg-blue-100 text-blue-800';
      case 'sold': return 'bg-purple-100 text-purple-800';
      case 'returned': return 'bg-yellow-100 text-yellow-800';
      case 'withdrawn': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConsignorName = (consignerId?: string) => {
    if (!consignerId) return 'N/A';
    const consignor = consigners.find(c => c.id === consignerId);
    if (!consignor) return 'Unknown';
    const name = (consignor as any).name || consignor.full_name || 'Unknown';
    const customerNumber = consignor.customer_number;
    return `${name} (${customerNumber})`;
  };

  const handleImageClick = async (item: InventoryItem) => {
    try {
      const { data: files, error } = await supabase
        .from('auction_files')
        .select('cdn_url, mime_type, variant, asset_group_id')
        .eq('item_id', item.id)
        .eq('published_status', 'published')
        .is('detached_at', null)
        .in('variant', ['display', 'video'])
        .order('display_order', { ascending: true, nullsFirst: false });

      if (error) throw error;

      // Group files by asset_group_id to handle video + thumbnail pairs
      // Exclude barcode asset group
      const barcodeGroupId = item.barcode_asset_group_id;
      const assetGroups = new Map<string, any[]>();
      (files || []).forEach(file => {
        if (barcodeGroupId && file.asset_group_id === barcodeGroupId) return;
        const groupId = file.asset_group_id || file.cdn_url;
        if (!assetGroups.has(groupId)) {
          assetGroups.set(groupId, []);
        }
        assetGroups.get(groupId)!.push(file);
      });

      // For each group, prefer video over display variant
      const media: { url: string; isVideo: boolean }[] = [];
      assetGroups.forEach(groupFiles => {
        const videoFile = groupFiles.find(f => f.variant === 'video');
        if (videoFile) {
          // If there's a video, only show the video (not the thumbnail)
          media.push({ url: videoFile.cdn_url, isVideo: true });
        } else {
          // Otherwise show the display variant (image)
          const displayFile = groupFiles.find(f => f.variant === 'display');
          if (displayFile) {
            media.push({ url: displayFile.cdn_url, isVideo: false });
          }
        }
      });

      // Fallback to legacy image_url if no files found
      if (media.length === 0 && item.image_url) {
        media.push({ url: item.image_url, isVideo: false });
      }

      setGalleryImages(media as any);
      setShowGallery(true);
    } catch (err) {
      console.error('[MEDIA] Error loading media:', err);
    }
  };

  const handleSortChange = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
  };

  const toggleSelectItem = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredAndSortedItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredAndSortedItems.map(item => item.id)));
    }
  };

  const handleBulkDelete = async () => {
    try {
      const ids = Array.from(selectedItems);
      const assignmentChecks = await Promise.all(
        ids.map(id => InventoryService.getItemEventAssignments(id))
      );

      const assignedCount = assignmentChecks.filter(a => a.length > 0).length;

      if (assignedCount > 0) {
        const confirmed = confirm(
          `${assignedCount} of the ${ids.length} selected items are currently assigned to events.\n\nDeleting them will automatically remove those event assignments. Do you want to continue?`
        );
        if (!confirmed) return;

        await Promise.all(
          ids.map((id, i) => assignmentChecks[i].length > 0 ? InventoryService.removeAllEventAssignments(id) : Promise.resolve())
        );
      } else {
        if (!confirm(`Are you sure you want to delete ${selectedItems.size} items? This action cannot be undone.`)) {
          return;
        }
      }

      await Promise.all(ids.map(id => InventoryService.deleteItem(id)));
      setItems(prev => prev.filter(item => !selectedItems.has(item.id)));
      setEventNumbersByItemId(prev => { const next = { ...prev }; ids.forEach(id => delete next[id]); return next; });
      setSelectedItems(new Set());
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete items');
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (!confirm(`Change status of ${selectedItems.size} items to "${newStatus}"?`)) {
      return;
    }

    try {
      await Promise.all(
        Array.from(selectedItems).map(id =>
          InventoryService.updateItem(id, { status: newStatus })
        )
      );
      setItems(prev =>
        prev.map(item =>
          selectedItems.has(item.id) ? { ...item, status: newStatus } : item
        )
      );
      setSelectedItems(new Set());
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update items');
    }
  };

  const handleBulkExport = () => {
    const selectedItemsData = items.filter(item => selectedItems.has(item.id));
    const csv = convertToCSV(selectedItemsData);
    downloadCSV(csv, `inventory-export-${new Date().toISOString().split('T')[0]}.csv`);
    setSelectedItems(new Set());
  };

  const convertToCSV = (data: InventoryItem[]) => {
    const headers = ['Inventory Number', 'Title', 'Description', 'Category', 'Consignor', 'Reserve Price', 'Status', 'Image URL'];
    const rows = data.map(item => [
      item.inventory_number,
      item.title,
      item.description || '',
      item.category || '',
      getConsignorName(item.consigner_id),
      item.reserve_price?.toString() || '',
      item.status,
      item.image_url
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleDescriptionClick = (item: InventoryItem) => {
    setEditingDescriptionId(item.id);
    setEditedDescription(item.description || '');
  };

  const handleDescriptionSave = async (itemId: string) => {
    try {
      await InventoryService.updateItem(itemId, { description: editedDescription });
      setItems(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, description: editedDescription } : item
        )
      );
      setEditingDescriptionId(null);
      setEditedDescription('');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update description');
    }
  };

  const handleDescriptionCancel = () => {
    setEditingDescriptionId(null);
    setEditedDescription('');
  };

  const handleTitleSave = async (itemId: string) => {
    try {
      await InventoryService.updateItem(itemId, { title: editedTitle });
      setItems(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, title: editedTitle } : item
        )
      );
      setEditingTitleId(null);
      setEditedTitle('');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update title');
    }
  };

  const handleTitleCancel = () => {
    setEditingTitleId(null);
    setEditedTitle('');
  };

  if (detailItem) {
    return (
      <InventoryItemDetail
        item={detailItem}
        onBack={() => setDetailItem(null)}
        onItemUpdated={() => {
          fetchData();
          setDetailItem(prev => {
            if (!prev) return null;
            return items.find(i => i.id === prev.id) || prev;
          });
        }}
      />
    );
  }

  if (showForm) {
    return (
      <div>
        <div className="mb-6">
          <button
            onClick={() => {
              setShowForm(false);
              setSelectedItem(null);
            }}
            className="text-ironbound-orange-500 hover:text-ironbound-orange-600 font-medium"
          >
            ← Back to Inventory
          </button>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6">
        <InventoryItemFormNew
          item={selectedItem || undefined}
          consigners={consigners}
          onSubmit={handleFormSubmit}
          onCancel={async () => {
            setShowForm(false);
            setSelectedItem(null);
            // Small delay to ensure DB updates are complete
            await new Promise(resolve => setTimeout(resolve, 1000));
            await fetchData();
          }}
        />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-ironbound-grey-500">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Global Inventory</h2>
          <p className="text-ironbound-grey-300 mt-1">
            Manage all inventory items across all events
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBulkUpload(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            <Upload className="h-4 w-4" />
            <span>Bulk Upload</span>
          </button>
          <button
            onClick={handleCreateItem}
            className="bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      <AdvancedFilters
        categories={EQUIPMENT_CATEGORIES}
        consigners={consigners.map(c => ({ id: c.id, name: (c as any).name || c.full_name || 'Unknown' }))}
        onFilterChange={setAdvancedFilters}
      />

      <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by inventory number or title..."
              className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors bg-white text-ironbound-grey-900 placeholder-ironbound-grey-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors bg-white text-ironbound-grey-900"
          >
            <option value="all">All Status</option>
            <option value="available">Available</option>
            <option value="assigned">Assigned</option>
            <option value="sold">Sold</option>
            <option value="returned">Returned</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [newSortBy, newSortOrder] = e.target.value.split('-');
              setSortBy(newSortBy as typeof sortBy);
              setSortOrder(newSortOrder as 'asc' | 'desc');
            }}
            className="px-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors bg-white text-ironbound-grey-900"
          >
            <option value="created_at-desc">Newest First</option>
            <option value="created_at-asc">Oldest First</option>
            <option value="inventory_number-asc">Inventory # (A-Z)</option>
            <option value="inventory_number-desc">Inventory # (Z-A)</option>
            <option value="title-asc">Title (A-Z)</option>
            <option value="title-desc">Title (Z-A)</option>
            <option value="consigner-asc">Consignor (A-Z)</option>
            <option value="consigner-desc">Consignor (Z-A)</option>
          </select>
        </div>

        <div className="text-sm text-ironbound-grey-600">
          Showing {filteredAndSortedItems.length} of {items.length} items
        </div>
      </div>

      {filteredAndSortedItems.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <div className="bg-ironbound-grey-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Package className="h-8 w-8 text-ironbound-grey-400" />
          </div>
          <h3 className="text-lg font-semibold text-ironbound-grey-900 mb-2">
            {searchQuery ? 'No items found' : 'No items yet'}
          </h3>
          <p className="text-ironbound-grey-600 mb-4">
            {searchQuery
              ? 'Try adjusting your search criteria'
              : 'Start building your inventory by adding items'
            }
          </p>
          {!searchQuery && (
            <button
              onClick={handleCreateItem}
              className="bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Add First Item
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ironbound-grey-200">
              <thead className="bg-ironbound-grey-50">
                <tr>
                  <th className="px-3 py-3 text-left w-8">
                    <input
                      type="checkbox"
                      checked={selectedItems.size === filteredAndSortedItems.length && filteredAndSortedItems.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 text-ironbound-orange-500 focus:ring-ironbound-orange-500 border-ironbound-grey-300 rounded cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider w-14">
                    Item
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                    Inv #
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                    Item Name
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                    Consignor
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-ironbound-grey-200">
                {filteredAndSortedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-ironbound-grey-50 transition-colors">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => toggleSelectItem(item.id)}
                        className="h-4 w-4 text-ironbound-orange-500 focus:ring-ironbound-orange-500 border-ironbound-grey-300 rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="relative group">
                        <button
                          onClick={() => handleImageClick(item)}
                          className="relative h-10 w-10 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-ironbound-orange-500 transition-all"
                        >
                          {(() => {
                            const cdnUrl = cdnThumbnailsByItemId[item.id];
                            const imageUrl = cdnUrl || item.image_url;
                            return imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={item.title}
                                className="h-10 w-10 object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = 'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2';
                                }}
                              />
                            ) : (
                              <div className="h-10 w-10 bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                                Processing...
                              </div>
                            );
                          })()}
                          {(() => {
                            const fileCount = fileCountsByItemId[item.id] || 0;

                            if (fileCount > 0) {
                              return (
                                <div className="absolute bottom-0 right-0 bg-ironbound-orange-500 text-white text-xs px-1.5 py-0.5 rounded-tl font-medium">
                                  {fileCount}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </button>
                        <div className="absolute hidden group-hover:block bottom-full left-0 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-10">
                          Click to view gallery
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-mono text-sm text-ironbound-grey-900">#{item.inventory_number}</div>
                    </td>
                    <td className="px-3 py-3">
                      {editingTitleId === item.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editedTitle}
                            onChange={(e) => setEditedTitle(e.target.value)}
                            className="w-full px-3 py-2 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 text-sm text-ironbound-grey-900"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleTitleSave(item.id);
                              } else if (e.key === 'Escape') {
                                handleTitleCancel();
                              }
                            }}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleTitleSave(item.id)}
                              className="flex items-center gap-1 px-3 py-1 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white rounded-md text-xs font-medium transition-colors"
                            >
                              <Check className="h-3 w-3" />
                              Save
                            </button>
                            <button
                              onClick={handleTitleCancel}
                              className="flex items-center gap-1 px-3 py-1 bg-ironbound-grey-200 hover:bg-ironbound-grey-300 text-ironbound-grey-700 rounded-md text-xs font-medium transition-colors"
                            >
                              <X className="h-3 w-3" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => {
                            setEditingTitleId(item.id);
                            setEditedTitle(item.title);
                          }}
                          className="font-medium text-ironbound-grey-900 cursor-pointer hover:bg-ironbound-grey-50 px-2 py-1 rounded transition-colors"
                        >
                          {item.title}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-ironbound-grey-600 max-w-xs">
                      {editingDescriptionId === item.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editedDescription}
                            onChange={(e) => setEditedDescription(e.target.value)}
                            className="w-full px-3 py-2 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 text-sm"
                            rows={3}
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDescriptionSave(item.id)}
                              className="flex items-center gap-1 px-3 py-1 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white rounded-md text-xs font-medium transition-colors"
                            >
                              <Check className="h-3 w-3" />
                              Save
                            </button>
                            <button
                              onClick={handleDescriptionCancel}
                              className="flex items-center gap-1 px-3 py-1 bg-ironbound-grey-200 hover:bg-ironbound-grey-300 text-ironbound-grey-700 rounded-md text-xs font-medium transition-colors"
                            >
                              <X className="h-3 w-3" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => handleDescriptionClick(item)}
                          className="line-clamp-2 cursor-pointer hover:bg-ironbound-grey-50 p-2 rounded transition-colors"
                          title={item.description || 'Click to edit'}
                        >
                          {item.description || 'No description'}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-ironbound-grey-900">
                      {getConsignorName(item.consigner_id)}
                    </td>
                    <td className="px-3 py-3 text-sm text-ironbound-grey-900">
                      {item.category}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(item.status)}`}>
                          {item.status}
                        </span>
                        {eventNumbersByItemId[item.id]?.length > 0 && (
                          <span className="text-xs text-ironbound-grey-500 font-mono">
                            #{eventNumbersByItemId[item.id].join(', #')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {item.created_at ? (
                        <div className="text-xs">
                          <div className="font-medium text-ironbound-grey-700">
                            {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                          <div className="text-ironbound-grey-400 mt-0.5">
                            {new Date(item.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-ironbound-grey-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm space-x-2">
                      <button
                        onClick={() => setDetailItem(item)}
                        className="text-ironbound-grey-400 hover:text-ironbound-grey-700 transition-colors"
                        title="View Details"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setAssignToEventItem(item)}
                        className="text-ironbound-grey-500 hover:text-ironbound-orange-600 transition-colors"
                        title="Assign to Event"
                      >
                        <Gavel className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditItem(item)}
                        className="text-ironbound-orange-500 hover:text-ironbound-orange-600 transition-colors"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item)}
                        className="text-red-500 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showGallery && (
        <ImageGalleryModal
          images={galleryImages}
          initialIndex={0}
          onClose={() => setShowGallery(false)}
        />
      )}

      <BulkActions
        selectedCount={selectedItems.size}
        onClearSelection={() => setSelectedItems(new Set())}
        onBulkDelete={handleBulkDelete}
        onBulkExport={handleBulkExport}
        onBulkStatusChange={handleBulkStatusChange}
      />

      {showBulkUpload && (
        <BulkUploadModal
          isOpen={showBulkUpload}
          onClose={() => {
            setShowBulkUpload(false);
            setBulkUploadItemId(null);
          }}
          itemId={bulkUploadItemId || undefined}
          onSuccess={() => {
            fetchData();
          }}
        />
      )}

      {assignToEventItem && (
        <AssignToEventModal
          item={assignToEventItem}
          onClose={() => setAssignToEventItem(null)}
          onAssigned={async (eventId, eventTitle) => {
            setAssignToEventItem(null);
            setItems(prev =>
              prev.map(i =>
                i.id === assignToEventItem.id
                  ? { ...i, status: 'assigned_to_auction' }
                  : i
              )
            );
            const { data: eventRow } = await supabase
              .from('auction_events')
              .select('event_number')
              .eq('id', eventId)
              .maybeSingle();
            if (eventRow?.event_number) {
              setEventNumbersByItemId(prev => ({
                ...prev,
                [assignToEventItem.id]: [...(prev[assignToEventItem.id] || []).filter(n => n !== eventRow.event_number), eventRow.event_number],
              }));
            }
          }}
        />
      )}
    </div>
  );
}
