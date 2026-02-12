import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Package, Search, DollarSign } from 'lucide-react';
import { InventoryService, InventoryItem } from '../services/inventoryService';
import { formatCurrency } from '../utils/formatters';

interface EventInventoryManagerProps {
  eventId: string;
  eventTitle: string;
  onBack: () => void;
}

export default function EventInventoryManager({ eventId, eventTitle, onBack }: EventInventoryManagerProps) {
  const [assignedItems, setAssignedItems] = useState<InventoryItem[]>([]);
  const [availableItems, setAvailableItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchItems();
  }, [eventId]);

  const fetchItems = async () => {
    try {
      const [assigned, available] = await Promise.all([
        InventoryService.getItemsForEvent(eventId),
        InventoryService.getAvailableItems()
      ]);
      setAssignedItems(assigned);
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
    if (selectedItems.size === 0) return;

    try {
      const itemsToAssign = Array.from(selectedItems);
      let lotNumber = assignedItems.length + 1;

      for (const itemId of itemsToAssign) {
        await InventoryService.assignToEvent(
          itemId,
          eventId,
          `LOT-${lotNumber.toString().padStart(4, '0')}`,
          lotNumber
        );
        lotNumber++;
      }

      setSelectedItems(new Set());
      setShowAddModal(false);
      await fetchItems();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to assign items');
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

  const filteredAvailable = availableItems.filter(item =>
    item.inventory_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-ironbound-grey-500">Loading...</div>
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
            Manage inventory items for this event
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
        <h3 className="text-lg font-semibold text-ironbound-grey-900 mb-4">
          Assigned Items ({assignedItems.length})
        </h3>

        {assignedItems.length === 0 ? (
          <div className="text-center py-8">
            <div className="bg-ironbound-grey-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Package className="h-8 w-8 text-ironbound-grey-400" />
            </div>
            <p className="text-ironbound-grey-600 mb-4">
              No items assigned to this event yet
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Add First Item
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {assignedItems.map((item: any) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 border border-ironbound-grey-200 rounded-lg hover:border-ironbound-orange-300 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-16 h-16 rounded-lg object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2';
                    }}
                  />
                  <div>
                    <div className="font-medium text-ironbound-grey-900">{item.title}</div>
                    <div className="text-sm text-ironbound-grey-500">
                      #{item.inventory_number} • {item.lot_number}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm text-ironbound-grey-500">Starting Price</div>
                    <div className="font-semibold text-ironbound-grey-900">
                      {formatCurrency(item.starting_price)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnassignItem(item.id)}
                    className="text-red-500 hover:text-red-600 transition-colors p-2"
                    title="Remove from event"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-ironbound-grey-200">
              <h3 className="text-xl font-bold text-ironbound-grey-900 mb-2">
                Add Items to Event
              </h3>
              <p className="text-ironbound-grey-600">
                Select items from your inventory to add to this event
              </p>
              <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search inventory..."
                  className="w-full pl-10 pr-4 py-2 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500"
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
                      className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedItems.has(item.id)
                          ? 'border-ironbound-orange-500 bg-ironbound-orange-50'
                          : 'border-ironbound-grey-200 hover:border-ironbound-grey-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => toggleItemSelection(item.id)}
                        className="w-5 h-5 text-ironbound-orange-500 rounded focus:ring-ironbound-orange-500"
                      />
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-12 h-12 rounded-lg object-cover ml-4"
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2';
                        }}
                      />
                      <div className="ml-4 flex-1">
                        <div className="font-medium text-ironbound-grey-900">{item.title}</div>
                        <div className="text-sm text-ironbound-grey-500">
                          #{item.inventory_number} • {item.category}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-ironbound-grey-500">Starting</div>
                        <div className="font-semibold text-ironbound-grey-900">
                          {formatCurrency(item.starting_price)}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-ironbound-grey-200 flex justify-between items-center">
              <div className="text-sm text-ironbound-grey-600">
                {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedItems(new Set());
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 border border-ironbound-grey-300 rounded-lg text-ironbound-grey-700 hover:bg-ironbound-grey-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignItems}
                  disabled={selectedItems.size === 0}
                  className="px-4 py-2 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 disabled:bg-ironbound-grey-300 text-white rounded-lg font-medium transition-colors"
                >
                  Add {selectedItems.size > 0 ? `(${selectedItems.size})` : ''} Items
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
