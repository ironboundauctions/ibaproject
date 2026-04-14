import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Plus, Trash2, Package, Search,
  Eye, EyeOff, CheckSquare, Square, ChevronDown,
} from 'lucide-react';
import { InventoryService, InventoryItem } from '../services/inventoryService';
import { PreBidService } from '../services/preBidService';
import { formatCurrency } from '../utils/formatters';

interface AssignedItem extends InventoryItem {
  assignment_id?: string;
  lot_number: string;
  sale_order: number;
  lot_notes: string;
  lot_starting_price: number | null;
  lot_published?: boolean;
}

interface EventInventoryManagerProps {
  eventId: string;
  eventTitle: string;
  onBack: () => void;
}

export default function EventInventoryManager({ eventId, eventTitle, onBack }: EventInventoryManagerProps) {
  const [assignedItems, setAssignedItems] = useState<AssignedItem[]>([]);
  const [availableItems, setAvailableItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedForAdd, setSelectedForAdd] = useState<Set<string>>(new Set());
  const [selectedLots, setSelectedLots] = useState<Set<string>>(new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => { fetchItems(); }, [eventId]);

  const fetchItems = async () => {
    try {
      const [assigned, available] = await Promise.all([
        InventoryService.getItemsForEvent(eventId),
        InventoryService.getAvailableItems(),
      ]);
      setAssignedItems(assigned as AssignedItem[]);
      setAvailableItems(available);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnassignItem = async (inventoryId: string) => {
    if (!confirm('Remove this item from the event?')) return;
    try {
      await InventoryService.unassignFromEvent(inventoryId, eventId);
      await fetchItems();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to remove item');
    }
  };

  const handleAssignItems = async () => {
    if (selectedForAdd.size === 0) return;
    try {
      const itemsToAssign = Array.from(selectedForAdd);
      let lotNumber = assignedItems.length + 1;
      for (const itemId of itemsToAssign) {
        await InventoryService.assignToEvent(
          itemId, eventId,
          `LOT ${lotNumber}`,
          lotNumber,
        );
        lotNumber++;
      }
      setSelectedForAdd(new Set());
      setShowAddModal(false);
      setSearchQuery('');
      await fetchItems();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to assign items');
    }
  };

  const handleTogglePublish = async (item: AssignedItem) => {
    if (!item.assignment_id) return;
    setTogglingId(item.assignment_id);
    try {
      const next = !(item.lot_published !== false);
      await PreBidService.setLotPublished(item.assignment_id, next);
      setAssignedItems(prev =>
        prev.map(i => i.assignment_id === item.assignment_id ? { ...i, lot_published: next } : i)
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setTogglingId(null);
    }
  };

  const handleBulkPublish = async (publish: boolean) => {
    setBulkMenuOpen(false);
    const ids = selectedLots.size > 0
      ? Array.from(selectedLots)
      : assignedItems.map(i => i.assignment_id!).filter(Boolean);
    if (ids.length === 0) return;
    try {
      if (selectedLots.size === 0) {
        await PreBidService.setAllLotsPublished(eventId, publish);
        setAssignedItems(prev => prev.map(i => ({ ...i, lot_published: publish })));
      } else {
        await PreBidService.setSelectedLotsPublished(ids, publish);
        setAssignedItems(prev =>
          prev.map(i => ids.includes(i.assignment_id!) ? { ...i, lot_published: publish } : i)
        );
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to bulk update');
    }
  };

  const toggleLotSelection = (assignmentId: string) => {
    setSelectedLots(prev => {
      const next = new Set(prev);
      next.has(assignmentId) ? next.delete(assignmentId) : next.add(assignmentId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLots.size === assignedItems.length) {
      setSelectedLots(new Set());
    } else {
      setSelectedLots(new Set(assignedItems.map(i => i.assignment_id!).filter(Boolean)));
    }
  };

  const filteredAvailable = availableItems.filter(item =>
    item.inventory_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const publishedCount = assignedItems.filter(i => i.lot_published !== false).length;
  const unpublishedCount = assignedItems.length - publishedCount;
  const allSelected = selectedLots.size > 0 && selectedLots.size === assignedItems.length;
  const someSelected = selectedLots.size > 0 && selectedLots.size < assignedItems.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ironbound-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={onBack}
            className="text-ironbound-orange-500 hover:text-ironbound-orange-600 font-medium mb-2 flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Events</span>
          </button>
          <h2 className="text-2xl font-bold text-white">{eventTitle}</h2>
          <p className="text-ironbound-grey-300 mt-1">
            Manage inventory lots for this event
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Items</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-lg font-semibold text-ironbound-grey-900">
              Catalog Lots ({assignedItems.length})
            </h3>
            {assignedItems.length > 0 && (
              <p className="text-xs text-ironbound-grey-400 mt-0.5">
                <span className="text-green-600 font-medium">{publishedCount} published</span>
                {unpublishedCount > 0 && (
                  <span className="text-ironbound-grey-400"> · {unpublishedCount} hidden</span>
                )}
              </p>
            )}
          </div>

          {assignedItems.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-sm text-ironbound-grey-600 hover:text-ironbound-grey-900 px-3 py-1.5 border border-ironbound-grey-200 rounded-lg hover:bg-ironbound-grey-50 transition-colors"
              >
                {allSelected ? (
                  <CheckSquare className="h-4 w-4 text-ironbound-orange-500" />
                ) : someSelected ? (
                  <CheckSquare className="h-4 w-4 text-ironbound-grey-400" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                {selectedLots.size > 0 ? `${selectedLots.size} selected` : 'Select all'}
              </button>

              <div className="relative">
                <button
                  onClick={() => setBulkMenuOpen(v => !v)}
                  className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 border border-ironbound-grey-200 rounded-lg hover:bg-ironbound-grey-50 transition-colors text-ironbound-grey-700"
                >
                  Bulk Actions
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {bulkMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setBulkMenuOpen(false)} />
                    <div className="absolute right-0 mt-1 w-52 bg-white border border-ironbound-grey-200 rounded-xl shadow-lg z-20 overflow-hidden">
                      <button
                        onClick={() => handleBulkPublish(true)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-ironbound-grey-800 hover:bg-ironbound-grey-50 transition-colors text-left"
                      >
                        <Eye className="h-4 w-4 text-green-600" />
                        {selectedLots.size > 0 ? `Publish selected (${selectedLots.size})` : 'Publish all lots'}
                      </button>
                      <button
                        onClick={() => handleBulkPublish(false)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-ironbound-grey-800 hover:bg-ironbound-grey-50 transition-colors text-left"
                      >
                        <EyeOff className="h-4 w-4 text-ironbound-grey-400" />
                        {selectedLots.size > 0 ? `Unpublish selected (${selectedLots.size})` : 'Unpublish all lots'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {assignedItems.length === 0 ? (
          <div className="text-center py-10">
            <div className="bg-ironbound-grey-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Package className="h-8 w-8 text-ironbound-grey-400" />
            </div>
            <p className="text-ironbound-grey-600 mb-4">No items assigned to this event yet</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Add First Item
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {assignedItems.map((item: AssignedItem) => {
              const isPublished = item.lot_published !== false;
              const isSelected = item.assignment_id ? selectedLots.has(item.assignment_id) : false;
              const isToggling = togglingId === item.assignment_id;

              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 border rounded-xl transition-colors ${
                    isSelected
                      ? 'border-ironbound-orange-400 bg-ironbound-orange-50'
                      : isPublished
                        ? 'border-ironbound-grey-200 hover:border-ironbound-grey-300'
                        : 'border-dashed border-ironbound-grey-300 bg-ironbound-grey-50'
                  }`}
                >
                  <button
                    onClick={() => item.assignment_id && toggleLotSelection(item.assignment_id)}
                    className="flex-shrink-0 text-ironbound-grey-400 hover:text-ironbound-orange-500 transition-colors"
                  >
                    {isSelected
                      ? <CheckSquare className="h-5 w-5 text-ironbound-orange-500" />
                      : <Square className="h-5 w-5" />
                    }
                  </button>

                  <div className="flex-shrink-0">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className={`w-14 h-14 rounded-lg object-cover ${!isPublished ? 'opacity-50' : ''}`}
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&dpr=1';
                        }}
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-ironbound-grey-200 flex items-center justify-center">
                        <Package className="h-5 w-5 text-ironbound-grey-400" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className={`font-medium text-sm truncate ${isPublished ? 'text-ironbound-grey-900' : 'text-ironbound-grey-400'}`}>
                      {item.title}
                    </div>
                    <div className="text-xs text-ironbound-grey-400 mt-0.5">
                      #{item.inventory_number} · <span className="font-medium text-ironbound-grey-600">{item.lot_number}</span>
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs text-ironbound-grey-400">Starting</div>
                    <div className={`text-sm font-semibold ${isPublished ? 'text-ironbound-grey-900' : 'text-ironbound-grey-400'}`}>
                      {item.lot_starting_price != null
                        ? formatCurrency(item.lot_starting_price)
                        : formatCurrency(item.starting_price)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleTogglePublish(item)}
                      disabled={isToggling}
                      title={isPublished ? 'Click to hide from public catalog' : 'Click to publish to catalog'}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        isPublished
                          ? 'bg-green-50 border border-green-200 text-green-700 hover:bg-green-100'
                          : 'bg-ironbound-grey-100 border border-ironbound-grey-200 text-ironbound-grey-500 hover:bg-ironbound-grey-200'
                      } ${isToggling ? 'opacity-50 cursor-wait' : ''}`}
                    >
                      {isPublished
                        ? <><Eye className="h-3 w-3" /> Published</>
                        : <><EyeOff className="h-3 w-3" /> Hidden</>
                      }
                    </button>

                    <button
                      onClick={() => handleUnassignItem(item.id)}
                      className="text-ironbound-grey-300 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                      title="Remove from event"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-ironbound-grey-200">
              <h3 className="text-xl font-bold text-ironbound-grey-900 mb-1">Add Items to Event</h3>
              <p className="text-ironbound-grey-500 text-sm">Select cataloged items to add as lots</p>
              <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search inventory..."
                  className="w-full pl-10 pr-4 py-2.5 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 text-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {filteredAvailable.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-ironbound-grey-400 mx-auto mb-3" />
                  <p className="text-ironbound-grey-600">
                    {searchQuery ? 'No items found' : 'No available items in inventory'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAvailable.map((item) => (
                    <label
                      key={item.id}
                      className={`flex items-center p-3 border rounded-xl cursor-pointer transition-colors ${
                        selectedForAdd.has(item.id)
                          ? 'border-ironbound-orange-500 bg-ironbound-orange-50'
                          : 'border-ironbound-grey-200 hover:border-ironbound-grey-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedForAdd.has(item.id)}
                        onChange={() => {
                          const next = new Set(selectedForAdd);
                          next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                          setSelectedForAdd(next);
                        }}
                        className="w-4 h-4 text-ironbound-orange-500 rounded focus:ring-ironbound-orange-500"
                      />
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.title} className="w-12 h-12 rounded-lg object-cover ml-3"
                          onError={(e) => { e.currentTarget.src = 'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&dpr=1'; }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-ironbound-grey-100 flex items-center justify-center ml-3">
                          <Package className="h-5 w-5 text-ironbound-grey-400" />
                        </div>
                      )}
                      <div className="ml-3 flex-1 min-w-0">
                        <div className="font-medium text-ironbound-grey-900 text-sm truncate">{item.title}</div>
                        <div className="text-xs text-ironbound-grey-400">#{item.inventory_number} · {item.category}</div>
                      </div>
                      <div className="text-right ml-3">
                        <div className="text-xs text-ironbound-grey-400">Starting</div>
                        <div className="font-semibold text-ironbound-grey-900 text-sm">{formatCurrency(item.starting_price)}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-ironbound-grey-200 flex justify-between items-center">
              <div className="text-sm text-ironbound-grey-500">
                {selectedForAdd.size} item{selectedForAdd.size !== 1 ? 's' : ''} selected
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowAddModal(false); setSelectedForAdd(new Set()); setSearchQuery(''); }}
                  className="px-4 py-2 border border-ironbound-grey-300 rounded-lg text-ironbound-grey-700 hover:bg-ironbound-grey-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignItems}
                  disabled={selectedForAdd.size === 0}
                  className="px-4 py-2 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 disabled:opacity-40 text-white rounded-lg font-medium transition-colors text-sm"
                >
                  Add {selectedForAdd.size > 0 ? `(${selectedForAdd.size})` : ''} Items
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
