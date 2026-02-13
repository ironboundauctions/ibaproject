import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Package, Image as ImageIcon, ArrowUpDown, Check, X } from 'lucide-react';
import { InventoryService, InventoryItem } from '../services/inventoryService';
import { ConsignerService } from '../services/consignerService';
import { Consigner } from '../types/consigner';
import InventoryItemForm from './InventoryItemForm';
import ImageGalleryModal from './ImageGalleryModal';
import BulkActions from './BulkActions';
import AdvancedFilters, { FilterState } from './AdvancedFilters';
import { formatCurrency, EQUIPMENT_CATEGORIES } from '../utils/formatters';
import { supabase } from '../lib/supabase';

export default function GlobalInventoryManagement() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [consigners, setConsigners] = useState<Consigner[]>([]);
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
  const [videoCountsByItemId, setVideoCountsByItemId] = useState<Record<string, number>>({});
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>({
    categories: [],
    consignerIds: [],
    priceMin: '',
    priceMax: '',
    dateFrom: '',
    dateTo: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [itemsData, consignersData] = await Promise.all([
        InventoryService.getAllItems(),
        ConsignerService.getConsigners()
      ]);
      setItems(itemsData);
      setConsigners(consignersData);

      // Fetch video counts for all items
      if (itemsData.length > 0) {
        const itemIds = itemsData.map(item => item.id);
        const { data: videoCounts, error } = await supabase
          .from('auction_files')
          .select('item_id')
          .in('item_id', itemIds)
          .like('mime_type', 'video/%');

        if (!error && videoCounts) {
          const counts: Record<string, number> = {};
          videoCounts.forEach(record => {
            counts[record.item_id] = (counts[record.item_id] || 0) + 1;
          });
          setVideoCountsByItemId(counts);
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
          const consignerA = getConsignerName(a.consigner_id);
          const consignerB = getConsignerName(b.consigner_id);
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
    if (!confirm(`Are you sure you want to delete item ${item.inventory_number}?`)) {
      return;
    }

    try {
      await InventoryService.deleteItem(item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
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
      setShowForm(false);
      setSelectedItem(null);

      // Refresh data to update video counts and ensure consistency
      await fetchData();

      // Return the item ID so the form can save file metadata
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

  const getConsignerName = (consignerId?: string) => {
    if (!consignerId) return 'N/A';
    const consigner = consigners.find(c => c.id === consignerId);
    if (!consigner) return 'Unknown';
    const name = (consigner as any).name || consigner.full_name || 'Unknown';
    const customerNumber = consigner.customer_number;
    return `${name} (${customerNumber})`;
  };

  const handleImageClick = async (item: InventoryItem) => {
    const allMedia: Array<{url: string, isVideo?: boolean}> = [];

    // Add main image
    if (item.image_url) {
      allMedia.push({ url: item.image_url, isVideo: false });
    }

    // Add additional images
    if (item.additional_images && item.additional_images.length > 0) {
      item.additional_images.forEach(url => {
        allMedia.push({ url, isVideo: false });
      });
    }

    // Load videos from auction_files table
    try {
      const { data: videoFiles, error } = await supabase
        .from('auction_files')
        .select('cdn_url, download_url, download_url_backup, mime_type, publish_status')
        .eq('item_id', item.id)
        .like('mime_type', 'video/%');

      if (!error && videoFiles && videoFiles.length > 0) {
        console.log('[VIDEO] Loading videos for gallery:', videoFiles);
        videoFiles.forEach(video => {
          const videoUrl = (video.cdn_url && video.publish_status === 'published')
            ? video.cdn_url
            : video.download_url;
          allMedia.push({
            url: videoUrl,
            isVideo: true
          });
        });
      }
    } catch (err) {
      console.error('[VIDEO] Error loading videos for gallery:', err);
    }

    setGalleryImages(allMedia as any);
    setShowGallery(true);
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
    if (!confirm(`Are you sure you want to delete ${selectedItems.size} items? This action cannot be undone.`)) {
      return;
    }

    try {
      await Promise.all(Array.from(selectedItems).map(id => InventoryService.deleteItem(id)));
      setItems(prev => prev.filter(item => !selectedItems.has(item.id)));
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
    const headers = ['Inventory Number', 'Title', 'Description', 'Category', 'Consigner', 'Reserve Price', 'Status', 'Image URL'];
    const rows = data.map(item => [
      item.inventory_number,
      item.title,
      item.description || '',
      item.category || '',
      getConsignerName(item.consigner_id),
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
        <InventoryItemForm
          item={selectedItem || undefined}
          eventId=""
          consigners={consigners}
          onSubmit={handleFormSubmit}
          onSaveComplete={fetchData}
          onCancel={() => {
            setShowForm(false);
            setSelectedItem(null);
          }}
        />
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
        <button
          onClick={handleCreateItem}
          className="bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Item</span>
        </button>
      </div>

      <AdvancedFilters
        categories={EQUIPMENT_CATEGORIES}
        consigners={consigners.map(c => ({ id: c.id, name: c.name || c.full_name || 'Unknown' }))}
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
              className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
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
            className="px-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
          >
            <option value="created_at-desc">Newest First</option>
            <option value="created_at-asc">Oldest First</option>
            <option value="inventory_number-asc">Inventory # (A-Z)</option>
            <option value="inventory_number-desc">Inventory # (Z-A)</option>
            <option value="title-asc">Title (A-Z)</option>
            <option value="title-desc">Title (Z-A)</option>
            <option value="consigner-asc">Consigner (A-Z)</option>
            <option value="consigner-desc">Consigner (Z-A)</option>
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
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedItems.size === filteredAndSortedItems.length && filteredAndSortedItems.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 text-ironbound-orange-500 focus:ring-ironbound-orange-500 border-ironbound-grey-300 rounded cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                    Inventory Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                    Item Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                    Consigner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ironbound-grey-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-ironbound-grey-200">
                {filteredAndSortedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-ironbound-grey-50 transition-colors">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => toggleSelectItem(item.id)}
                        className="h-4 w-4 text-ironbound-orange-500 focus:ring-ironbound-orange-500 border-ironbound-grey-300 rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative group">
                        <button
                          onClick={() => handleImageClick(item)}
                          className="relative h-12 w-12 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-ironbound-orange-500 transition-all"
                        >
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="h-12 w-12 object-cover"
                            onError={(e) => {
                              e.currentTarget.src = 'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2';
                            }}
                          />
                          {(() => {
                            const mainImageCount = item.image_url ? 1 : 0;
                            const additionalImagesCount = item.additional_images?.length || 0;
                            const videoCount = videoCountsByItemId[item.id] || 0;
                            const totalMediaCount = mainImageCount + additionalImagesCount + videoCount;

                            if (totalMediaCount > 0) {
                              return (
                                <div className="absolute bottom-0 right-0 bg-ironbound-orange-500 text-white text-xs px-1.5 py-0.5 rounded-tl font-medium">
                                  {totalMediaCount}
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
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm text-ironbound-grey-900">#{item.inventory_number}</div>
                    </td>
                    <td className="px-6 py-4">
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
                    <td className="px-6 py-4 text-sm text-ironbound-grey-600 max-w-xs">
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
                    <td className="px-6 py-4 text-sm text-ironbound-grey-900">
                      {getConsignerName(item.consigner_id)}
                    </td>
                    <td className="px-6 py-4 text-sm text-ironbound-grey-900">
                      {item.category}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm space-x-2">
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
    </div>
  );
}
