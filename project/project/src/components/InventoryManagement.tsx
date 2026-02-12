import React, { useState, useEffect } from 'react';
import { Plus, Search, CreditCard as Edit, Trash2, Package, Upload, ChevronDown } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { InventoryItem, Consigner } from '../types/consigner';
import { ConsignerService } from '../services/consignerService';
import { Auction } from '../types/auction';
import InventoryItemForm from './InventoryItemForm';
import BulkInventoryUploadForm from './BulkInventoryUploadForm';
import { formatCurrency } from '../utils/formatters';

interface InventoryManagementProps {
  selectedEvent: Auction;
  onBack: () => void;
}

export default function InventoryManagement({ selectedEvent, onBack }: InventoryManagementProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [consigners, setConsigners] = useState<Consigner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isCreatingLots, setIsCreatingLots] = useState(false);
  const [showBulkUploadForm, setShowBulkUploadForm] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [itemsData, consignersData] = await Promise.all([
          ConsignerService.getInventoryItemsForEvent(selectedEvent.id),
          ConsignerService.getConsigners()
        ]);
        setItems(itemsData);
        setConsigners(consignersData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedEvent.id]);

  const filteredItems = items.filter(item =>
    item.inventory_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.consigner_customer_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      await ConsignerService.deleteInventoryItem(item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete item');
    }
  };

  const handleFormSubmit = async (itemData: any) => {
    try {
      if (selectedItem) {
        const updatedItem = await ConsignerService.updateInventoryItem(selectedItem.id, itemData);
        setItems(prev => prev.map(i => i.id === selectedItem.id ? updatedItem : i));
      } else {
        const newItem = await ConsignerService.createInventoryItem(itemData);
        setItems(prev => [newItem, ...prev]);
      }
      setShowForm(false);
      setSelectedItem(null);
    } catch (error) {
      throw error; // Let the form handle the error display
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const newItems = Array.from(filteredItems);
    const [reorderedItem] = newItems.splice(result.source.index, 1);
    newItems.splice(result.destination.index, 0, reorderedItem);

    // Update local state immediately for better UX
    const reorderedIds = newItems.map(item => item.id);
    setItems(prev => {
      const updated = [...prev];
      reorderedIds.forEach((id, index) => {
        const itemIndex = updated.findIndex(item => item.id === id);
        if (itemIndex !== -1) {
          updated[itemIndex] = { ...updated[itemIndex], sale_order: index + 1 };
        }
      });
      return updated;
    });

    try {
      await ConsignerService.updateItemsOrder(selectedEvent.id, reorderedIds);
    } catch (error) {
      console.error('Error updating item order:', error);
      // Revert on error
      const itemsData = await ConsignerService.getInventoryItemsForEvent(selectedEvent.id);
      setItems(itemsData);
    }
  };

  const handleCreateLots = async () => {
    if (!confirm(`Create lot numbers for all ${items.length} items in sale order?`)) {
      return;
    }

    setIsCreatingLots(true);
    try {
      await ConsignerService.createLotsForEvent(selectedEvent.id);
      const updatedItems = await ConsignerService.getInventoryItemsForEvent(selectedEvent.id);
      setItems(updatedItems);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create lots');
    } finally {
      setIsCreatingLots(false);
    }
  };

  const getConsignerName = (customerNumber: string) => {
    const consigner = consigners.find(c => c.customer_number === customerNumber);
    return consigner ? consigner.full_name : customerNumber;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ironbound-orange-500 mx-auto mb-4"></div>
          <p className="text-ironbound-grey-500">Loading inventory...</p>
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <InventoryItemForm
        item={selectedItem}
        eventId={selectedEvent.id}
        consigners={consigners}
        onSubmit={handleFormSubmit}
        onCancel={() => {
          setShowForm(false);
          setSelectedItem(null);
        }}
      />
    );
  }

  if (showBulkUploadForm) {
    return (
      <BulkInventoryUploadForm
        eventId={selectedEvent.id}
        consigners={consigners}
        onUploadComplete={(newItems) => {
          setItems(prev => [...newItems, ...prev]);
          setShowBulkUploadForm(false);
        }}
        onCancel={() => setShowBulkUploadForm(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={onBack}
            className="text-ironbound-grey-200 hover:text-ironbound-orange-500 mb-2 transition-colors"
          >
            ← Back to Events
          </button>
          <h2 className="text-2xl font-bold text-white">Event {selectedEvent.id} Inventory</h2>
          <p className="text-ironbound-grey-200">{selectedEvent.title}</p>
        </div>
        <div className="flex items-center space-x-3">
          {items.length > 0 && !items.some(item => item.lot_number) && (
            <button
              onClick={handleCreateLots}
              disabled={isCreatingLots}
              className="bg-green-600 hover:bg-green-700 disabled:bg-ironbound-grey-300 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {isCreatingLots ? 'Creating...' : 'Create Lots'}
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setShowAddDropdown(!showAddDropdown)}
              className="bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Items</span>
              <ChevronDown className="h-4 w-4" />
            </button>
            
            {showAddDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-ironbound-grey-200 py-1 z-50">
                <button
                  onClick={() => {
                    handleCreateItem();
                    setShowAddDropdown(false);
                  }}
                  className="flex items-center space-x-2 w-full px-4 py-2 text-left text-ironbound-grey-700 hover:bg-ironbound-grey-50 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Manually</span>
                </button>
                <button
                  onClick={() => {
                    setShowBulkUploadForm(true);
                    setShowAddDropdown(false);
                  }}
                  className="flex items-center space-x-2 w-full px-4 py-2 text-left text-ironbound-grey-700 hover:bg-ironbound-grey-50 transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  <span>Bulk Upload</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by inventory number, title, or consigner..."
            className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
          />
        </div>
      </div>

      {/* Items List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-ironbound-grey-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Package className="h-8 w-8 text-ironbound-grey-400" />
            </div>
            <h3 className="text-lg font-semibold text-ironbound-grey-900 mb-2">
              {searchQuery ? 'No items found' : 'No items yet'}
            </h3>
            <p className="text-ironbound-grey-600 mb-4">
              {searchQuery 
                ? 'Try adjusting your search criteria'
                : 'Start by adding items to this event'
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
          <div className="p-6">
            <div className="mb-4 text-sm text-ironbound-grey-600">
              Drag and drop items to organize sale order. Items will be assigned lot numbers based on this order.
            </div>
            
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="items">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                    {filteredItems.map((item, index) => (
                      <Draggable key={item.id} draggableId={item.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`border border-ironbound-grey-200 rounded-lg p-4 transition-all ${
                              snapshot.isDragging ? 'shadow-lg bg-ironbound-grey-50' : 'hover:shadow-md'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div className="text-center">
                                  <div className="text-xs text-ironbound-grey-500">Order</div>
                                  <div className="text-lg font-bold text-ironbound-orange-600">
                                    {item.sale_order || index + 1}
                                  </div>
                                </div>
                                
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3 mb-2">
                                    <span className="bg-ironbound-orange-500 text-white px-2 py-1 rounded text-sm font-bold">
                                      {item.inventory_number}
                                    </span>
                                    {item.lot_number && (
                                      <span className="bg-green-500 text-white px-2 py-1 rounded text-sm font-bold">
                                        {item.lot_number}
                                      </span>
                                    )}
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                      item.status === 'cataloged'
                                        ? 'bg-blue-100 text-blue-800'
                                        : item.status === 'assigned_to_auction'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-ironbound-grey-100 text-ironbound-grey-800'
                                    }`}>
                                      {item.status.replace('_', ' ')}
                                    </span>
                                  </div>

                                  <h4
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={async (e) => {
                                      const newTitle = e.currentTarget.textContent || '';
                                      if (newTitle !== item.title && newTitle.trim()) {
                                        try {
                                          await ConsignerService.updateInventoryItem(item.id, { title: newTitle });
                                          setItems(prev => prev.map(i =>
                                            i.id === item.id ? { ...i, title: newTitle } : i
                                          ));
                                        } catch (error) {
                                          console.error('Error updating title:', error);
                                          e.currentTarget.textContent = item.title;
                                        }
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        e.currentTarget.blur();
                                      }
                                    }}
                                    className="font-semibold text-ironbound-grey-900 mb-1 outline-none focus:ring-2 focus:ring-ironbound-orange-500 rounded px-1 -mx-1 cursor-text"
                                  >
                                    {item.title}
                                  </h4>

                                  <div className="flex items-center space-x-4 text-sm text-ironbound-grey-600">
                                    <span>Consigner: {getConsignerName(item.consigner_customer_number)}</span>
                                    {item.reserve_price && (
                                      <span>Reserve: {formatCurrency(item.reserve_price)}</span>
                                    )}
                                    {item.category && (
                                      <span>Category: {item.category}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleEditItem(item)}
                                  className="text-ironbound-orange-600 hover:text-ironbound-orange-900 transition-colors p-1"
                                  title="Edit Item"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item)}
                                  className="text-red-600 hover:text-red-900 transition-colors p-1"
                                  title="Delete Item"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        )}
      </div>
    </div>
  );
}