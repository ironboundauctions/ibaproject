import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Search, Package, CreditCard as Edit2, Trash2, Hash, StickyNote, DollarSign, GripVertical, ChevronDown, ChevronUp, X, Check, AlertCircle, ListOrdered, Lock, Unlock, Save, Images } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { InventoryService, InventoryItem, EventAssignment, CreateInventoryItemData } from '../services/inventoryService';
import { ConsignorService } from '../services/consignerService';
import { Consignor } from '../types/consigner';
import { formatCurrency } from '../utils/formatters';
import InventoryItemFormNew from './InventoryItemFormNew';
import ConfirmDialog from './ConfirmDialog';
import LotGalleryModal from './LotGalleryModal';

interface Props {
  eventId: string;
  eventTitle: string;
  onBack: () => void;
}

type EventItem = InventoryItem & EventAssignment;

interface LotEditState {
  lot_number: string;
  lot_notes: string;
  lot_starting_price: string;
}

function SortableRow({
  item,
  onEdit,
  onRemove,
  onSaveLot,
  onViewGallery,
  locked,
}: {
  item: EventItem;
  onEdit: (item: EventItem) => void;
  onRemove: (item: EventItem) => void;
  onSaveLot: (item: EventItem, fields: Partial<EventAssignment>) => Promise<void>;
  onViewGallery: (item: EventItem) => void;
  locked: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: locked });

  const [showLot, setShowLot] = useState(false);
  const [lotEdit, setLotEdit] = useState<LotEditState>({
    lot_number: item.lot_number,
    lot_notes: item.lot_notes,
    lot_starting_price: item.lot_starting_price !== null ? String(item.lot_starting_price) : '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLotEdit({
      lot_number: item.lot_number,
      lot_notes: item.lot_notes,
      lot_starting_price: item.lot_starting_price !== null ? String(item.lot_starting_price) : '',
    });
  }, [item.lot_number, item.lot_notes, item.lot_starting_price]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  const handleSaveLot = async () => {
    setSaving(true);
    try {
      const parsedPrice = lotEdit.lot_starting_price.trim() !== ''
        ? parseFloat(lotEdit.lot_starting_price)
        : null;
      await onSaveLot(item, {
        lot_number: lotEdit.lot_number.trim(),
        lot_notes: lotEdit.lot_notes,
        lot_starting_price: parsedPrice,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const effectivePrice = item.lot_starting_price !== null
    ? item.lot_starting_price
    : item.starting_price;

  return (
    <div ref={setNodeRef} style={style as React.CSSProperties} className="bg-white border border-ironbound-grey-200 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center p-4 gap-4">
        <button
          className={`flex-shrink-0 ${locked ? 'text-ironbound-grey-200 cursor-not-allowed' : 'text-ironbound-grey-300 hover:text-ironbound-grey-500 cursor-grab active:cursor-grabbing'}`}
          {...attributes}
          {...(locked ? {} : listeners)}
          disabled={locked}
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <div className="flex-shrink-0">
          {item.image_url ? (
            <button
              onClick={() => onViewGallery(item)}
              className="relative group block w-16 h-16 rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-ironbound-orange-500"
              title="View photos"
            >
              <img
                src={item.image_url}
                alt={item.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2';
                }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <Images className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ) : (
            <div className="w-16 h-16 rounded-lg bg-ironbound-grey-100 flex items-center justify-center">
              <Package className="h-6 w-6 text-ironbound-grey-400" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-ironbound-grey-900 truncate">{item.title}</p>
              <p className="text-sm text-ironbound-grey-500">#{item.inventory_number} &bull; {item.category}</p>
              {item.description && (
                <p className="text-sm text-ironbound-grey-500 truncate mt-0.5">{item.description}</p>
              )}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-right">
                <p className="text-xs text-ironbound-grey-400">Starting</p>
                <p className="font-semibold text-ironbound-grey-900">{formatCurrency(effectivePrice)}</p>
                {item.lot_starting_price !== null && (
                  <p className="text-xs text-ironbound-orange-500">Event override</p>
                )}
              </div>
              {item.lot_number ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-ironbound-orange-100 text-ironbound-orange-800">
                  {item.lot_number}
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-ironbound-grey-100 text-ironbound-grey-500 border border-dashed border-ironbound-grey-300">
                  No lot #
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => !locked && setShowLot(v => !v)}
            disabled={locked}
            className={`p-2 rounded-lg transition-colors text-sm font-medium flex items-center gap-1 ${
              locked
                ? 'text-ironbound-grey-300 cursor-not-allowed'
                : showLot
                  ? 'bg-ironbound-orange-100 text-ironbound-orange-700'
                  : 'text-ironbound-grey-500 hover:bg-ironbound-grey-100'
            }`}
            title={locked ? 'Unlock catalog to edit lot details' : 'Lot details'}
          >
            <Hash className="h-4 w-4" />
            {showLot ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => !locked && onEdit(item)}
            disabled={locked}
            className={`p-2 rounded-lg transition-colors ${locked ? 'text-ironbound-grey-300 cursor-not-allowed' : 'text-ironbound-grey-500 hover:bg-ironbound-grey-100 hover:text-ironbound-orange-600'}`}
            title={locked ? 'Unlock catalog to edit item' : 'Edit item (syncs to inventory)'}
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => !locked && onRemove(item)}
            disabled={locked}
            className={`p-2 rounded-lg transition-colors ${locked ? 'text-ironbound-grey-300 cursor-not-allowed' : 'text-ironbound-grey-500 hover:bg-red-50 hover:text-red-600'}`}
            title={locked ? 'Unlock catalog to remove item' : 'Remove from event'}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showLot && (
        <div className="border-t border-ironbound-grey-100 bg-ironbound-grey-50 px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-ironbound-orange-100 p-1.5 rounded-lg">
              <Hash className="h-4 w-4 text-ironbound-orange-600" />
            </div>
            <h4 className="font-semibold text-ironbound-grey-900 text-sm">Lot Details (Event Only)</h4>
            <span className="ml-auto text-xs text-ironbound-grey-400 bg-ironbound-grey-200 px-2 py-0.5 rounded-full">
              Not synced to inventory
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-ironbound-grey-700 mb-1.5 flex items-center gap-1">
                <Hash className="h-3.5 w-3.5 text-ironbound-grey-400" />
                Lot Number
              </label>
              <input
                type="text"
                value={lotEdit.lot_number}
                onChange={e => setLotEdit(p => ({ ...p, lot_number: e.target.value }))}
                className="w-full px-3 py-2 border border-ironbound-grey-300 rounded-lg text-sm text-ironbound-grey-900 focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 bg-white"
                placeholder="e.g. LOT-0001"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ironbound-grey-700 mb-1.5 flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5 text-ironbound-grey-400" />
                Starting Price Override
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ironbound-grey-400 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={lotEdit.lot_starting_price}
                  onChange={e => setLotEdit(p => ({ ...p, lot_starting_price: e.target.value }))}
                  className="w-full pl-7 pr-3 py-2 border border-ironbound-grey-300 rounded-lg text-sm text-ironbound-grey-900 focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 bg-white"
                  placeholder={`${effectivePrice} (inventory)`}
                />
              </div>
              <p className="text-xs text-ironbound-grey-400 mt-1">Leave blank to use inventory price</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-ironbound-grey-700 mb-1.5 flex items-center gap-1">
                <StickyNote className="h-3.5 w-3.5 text-ironbound-grey-400" />
                Lot Notes
              </label>
              <input
                type="text"
                value={lotEdit.lot_notes}
                onChange={e => setLotEdit(p => ({ ...p, lot_notes: e.target.value }))}
                className="w-full px-3 py-2 border border-ironbound-grey-300 rounded-lg text-sm text-ironbound-grey-900 focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 bg-white"
                placeholder="Auctioneer notes, ring notes..."
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSaveLot}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : saved ? (
                <Check className="h-4 w-4" />
              ) : null}
              {saved ? 'Saved' : 'Save Lot Details'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EventItemsPage({ eventId, eventTitle, onBack }: Props) {
  const [items, setItems] = useState<EventItem[]>([]);
  const [availableItems, setAvailableItems] = useState<InventoryItem[]>([]);
  const [consigners, setConsigners] = useState<Consignor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<EventItem | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [generatingLots, setGeneratingLots] = useState(false);
  const [showLotGenModal, setShowLotGenModal] = useState(false);
  const [lotGenStart, setLotGenStart] = useState('1');
  const [lotGenPrefix, setLotGenPrefix] = useState('');
  const [lotGenPadding, setLotGenPadding] = useState('3');
  const [locked, setLocked] = useState(false);
  const [hasUnsavedOrder, setHasUnsavedOrder] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{
    isOpen: boolean; title: string; message: string; confirmLabel: string;
    variant: 'danger' | 'warning' | 'info'; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', confirmLabel: 'OK', variant: 'danger', onConfirm: () => {} });
  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));
  const openDialog = (opts: Omit<typeof dialog, 'isOpen'>) => setDialog({ ...opts, isOpen: true });
  const [galleryItem, setGalleryItem] = useState<EventItem | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [assigned, allItems, cons] = await Promise.all([
        InventoryService.getItemsForEvent(eventId),
        InventoryService.getAllItemsForEventModal(),
        ConsignorService.getAllConsignors(),
      ]);
      setItems(assigned);
      const assignedIds = new Set(assigned.map(i => i.id));
      setAvailableItems(allItems.filter(i => !assignedIds.has(i.id)));
      setConsigners(cons);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items');
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const handleDragEnd = (event: DragEndEvent) => {
    if (locked) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);
    setHasUnsavedOrder(true);
  };

  const handleSaveOrder = async () => {
    setSavingOrder(true);
    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.assignment_id) {
          await InventoryService.updateEventAssignment(item.assignment_id, { sale_order: i + 1 });
        }
      }
      setHasUnsavedOrder(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save order');
    } finally {
      setSavingOrder(false);
    }
  };

  const handleSaveLot = async (item: EventItem, fields: Partial<EventAssignment>) => {
    if (!item.assignment_id) return;
    const updatedFields = { ...fields };
    if (fields.lot_number !== undefined) {
      const m = fields.lot_number.match(/(\d+)/g);
      updatedFields.sale_order = m ? parseInt(m[m.length - 1], 10) : 0;
    }
    await InventoryService.updateEventAssignment(item.assignment_id, updatedFields);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...updatedFields } : i));
  };

  const handleRemove = (item: EventItem) => {
    openDialog({
      title: 'Remove from Event',
      message: `Remove "${item.title}" from this event?`,
      confirmLabel: 'Remove',
      variant: 'warning',
      onConfirm: async () => {
        closeDialog();
        try {
          await InventoryService.unassignFromEvent(item.id, eventId);
          setItems(prev => prev.filter(i => i.id !== item.id));
        } catch (err) {
          openDialog({
            title: 'Error',
            message: err instanceof Error ? err.message : 'Failed to remove item',
            confirmLabel: 'OK',
            variant: 'danger',
            onConfirm: closeDialog,
          });
        }
      },
    });
  };

  const handleEditSubmit = async (data: CreateInventoryItemData) => {
    if (!editingItem) return;
    const updated = await InventoryService.updateItem(editingItem.id, data);
    setItems(prev => prev.map(i => {
      if (i.id !== editingItem.id) return i;
      return {
        ...i,
        ...updated,
        image_url: i.image_url || updated.image_url,
        lot_number: i.lot_number,
        lot_notes: i.lot_notes,
        lot_starting_price: i.lot_starting_price,
        assignment_id: i.assignment_id
      };
    }));
    setEditingItem(null);
  };

  const handleSaveEventFields = async (fields: { lot_number: string; lot_notes: string; lot_starting_price: number | null }) => {
    if (!editingItem?.assignment_id) return;
    await InventoryService.updateEventAssignment(editingItem.assignment_id, fields);
    setItems(prev => prev.map(i =>
      i.id === editingItem.id
        ? { ...i, lot_number: fields.lot_number, lot_notes: fields.lot_notes, lot_starting_price: fields.lot_starting_price }
        : i
    ));
  };

  const handleAddItems = async () => {
    if (selectedToAdd.size === 0) return;
    setAddingItem(true);
    try {
      const toAdd = Array.from(selectedToAdd);
      let nextOrder = items.length + 1;
      for (const itemId of toAdd) {
        await InventoryService.assignToEvent(
          itemId,
          eventId,
          nextOrder
        );
        nextOrder++;
      }
      setSelectedToAdd(new Set());
      setShowAddModal(false);
      setAddSearchQuery('');
      await load();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add items');
    } finally {
      setAddingItem(false);
    }
  };

  const buildLotNumber = (index: number, startNum: number, prefix: string, padding: number) => {
    const num = startNum + index;
    const padded = padding > 0 ? num.toString().padStart(padding, '0') : num.toString();
    return prefix ? `${prefix} ${padded}` : padded;
  };

  const lotGenPreview = () => {
    const start = parseInt(lotGenStart, 10);
    if (isNaN(start) || start < 0) return null;
    const pad = parseInt(lotGenPadding, 10);
    const padding = isNaN(pad) || pad < 0 ? 0 : pad;
    const first = buildLotNumber(0, start, lotGenPrefix, padding);
    const second = buildLotNumber(1, start, lotGenPrefix, padding);
    const third = buildLotNumber(2, start, lotGenPrefix, padding);
    return `${first}, ${second}, ${third}...`;
  };

  const handleGenerateLotNumbers = async () => {
    const start = parseInt(lotGenStart, 10);
    if (isNaN(start) || start < 0) {
      setError('Starting number must be a valid non-negative number');
      return;
    }
    const pad = parseInt(lotGenPadding, 10);
    const padding = isNaN(pad) || pad < 0 ? 0 : pad;
    setShowLotGenModal(false);
    setGeneratingLots(true);
    try {
      const sorted = [...items].sort((a, b) => (a.sale_order ?? 0) - (b.sale_order ?? 0));
      // Clear all lot numbers first to avoid unique constraint conflicts during reassignment
      for (const item of sorted) {
        if (item.assignment_id) {
          await InventoryService.updateEventAssignment(item.assignment_id, { lot_number: null as any });
        }
      }
      for (let i = 0; i < sorted.length; i++) {
        const item = sorted[i];
        const lotNumber = buildLotNumber(i, start, lotGenPrefix, padding);
        if (item.assignment_id) {
          await InventoryService.updateEventAssignment(item.assignment_id, { lot_number: lotNumber, sale_order: i + 1 });
        }
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate lot numbers');
    } finally {
      setGeneratingLots(false);
    }
  };

  const filteredItems = items.filter(item => {
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.inventory_number.toLowerCase().includes(q) ||
      item.lot_number.toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q)
    );
  });

  const filteredAvailable = availableItems.filter(item => {
    const q = addSearchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.inventory_number.toLowerCase().includes(q)
    );
  });

  if (editingItem) {
    return (
      <div className="space-y-6">
        <div>
          <button
            onClick={() => setEditingItem(null)}
            className="text-ironbound-orange-500 hover:text-ironbound-orange-600 font-medium mb-3 flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {eventTitle}
          </button>
          <h2 className="text-2xl font-bold text-white">Edit Item</h2>
          <p className="text-ironbound-grey-300 text-sm mt-1">
            Changes sync to inventory globally. Use the Lot Details section for event-specific fields.
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6">
          <InventoryItemFormNew
            item={editingItem}
            consigners={consigners}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditingItem(null)}
            eventContext={{
              eventId,
              eventTitle,
              assignmentId: editingItem.assignment_id,
              lotNumber: editingItem.lot_number || '',
              lotNotes: editingItem.lot_notes || '',
              lotStartingPrice: editingItem.lot_starting_price != null ? String(editingItem.lot_starting_price) : '',
              onSaveEventFields: handleSaveEventFields,
            }}
          />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-ironbound-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
    <ConfirmDialog
      isOpen={dialog.isOpen}
      title={dialog.title}
      message={dialog.message}
      confirmLabel={dialog.confirmLabel}
      variant={dialog.variant}
      onConfirm={dialog.onConfirm}
      onCancel={closeDialog}
    />
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="text-ironbound-orange-500 hover:text-ironbound-orange-600 font-medium mb-2 flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Events
          </button>
          <h2 className="text-2xl font-bold text-white">{eventTitle}</h2>
          <p className="text-ironbound-grey-300 mt-1 text-sm">
            {items.length} item{items.length !== 1 ? 's' : ''} &bull; Drag to arrange sale order &bull; Generate lot numbers when ready
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {hasUnsavedOrder && (
            <button
              onClick={handleSaveOrder}
              disabled={savingOrder}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"
            >
              {savingOrder ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {savingOrder ? 'Saving...' : 'Save Order'}
            </button>
          )}
          {items.length > 0 && (
            <button
              onClick={() => setShowLotGenModal(true)}
              disabled={generatingLots || locked}
              className="bg-white hover:bg-ironbound-grey-50 border border-ironbound-grey-300 text-ironbound-grey-800 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingLots ? (
                <div className="w-4 h-4 border-2 border-ironbound-grey-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <ListOrdered className="h-4 w-4" />
              )}
              Generate Lot Numbers
            </button>
          )}
          <button
            onClick={() => setLocked(v => !v)}
            className={`px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 border ${
              locked
                ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                : 'bg-white border-ironbound-grey-300 text-ironbound-grey-700 hover:bg-ironbound-grey-50'
            }`}
            title={locked ? 'Unlock catalog for editing' : 'Lock catalog to prevent changes'}
          >
            {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            {locked ? 'Locked' : 'Unlocked'}
          </button>
          <button
            onClick={() => !locked && setShowAddModal(true)}
            disabled={locked}
            className="bg-ironbound-orange-500 hover:bg-ironbound-orange-600 disabled:bg-ironbound-grey-300 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Items
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search lots by title, number, lot number..."
          className="w-full pl-10 pr-4 py-2.5 border border-ironbound-grey-300 rounded-xl bg-white text-ironbound-grey-900 focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 text-sm"
        />
      </div>

      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-ironbound-grey-200 p-16 text-center">
          <div className="bg-ironbound-grey-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Package className="h-8 w-8 text-ironbound-grey-400" />
          </div>
          <p className="text-ironbound-grey-600 font-medium mb-1">
            {searchQuery ? 'No lots match your search' : 'No items assigned to this event yet'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Add First Item
            </button>
          )}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filteredItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {filteredItems.map(item => (
                <SortableRow
                  key={item.id}
                  item={item}
                  onEdit={setEditingItem}
                  onRemove={handleRemove}
                  onSaveLot={handleSaveLot}
                  onViewGallery={setGalleryItem}
                  locked={locked}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {showLotGenModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-ironbound-grey-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-ironbound-grey-900">Generate Lot Numbers</h3>
                <p className="text-ironbound-grey-500 text-sm mt-0.5">Configure format and starting number</p>
              </div>
              <button onClick={() => setShowLotGenModal(false)} className="text-ironbound-grey-400 hover:text-ironbound-grey-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ironbound-grey-700 mb-1.5">Prefix (optional)</label>
                  <input
                    type="text"
                    value={lotGenPrefix}
                    onChange={e => setLotGenPrefix(e.target.value)}
                    placeholder="e.g. LOT- or A-"
                    className="w-full px-3 py-2 border border-ironbound-grey-300 rounded-lg text-sm text-ironbound-grey-900 focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ironbound-grey-700 mb-1.5">Starting Number</label>
                  <input
                    type="number"
                    min="0"
                    value={lotGenStart}
                    onChange={e => setLotGenStart(e.target.value)}
                    className="w-full px-3 py-2 border border-ironbound-grey-300 rounded-lg text-sm text-ironbound-grey-900 focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ironbound-grey-700 mb-1.5">
                  Zero Padding
                  <span className="ml-1 text-xs text-ironbound-grey-400 font-normal">(0 = no padding)</span>
                </label>
                <div className="flex gap-2">
                  {['0', '2', '3', '4'].map(p => (
                    <button
                      key={p}
                      onClick={() => setLotGenPadding(p)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        lotGenPadding === p
                          ? 'bg-ironbound-orange-500 border-ironbound-orange-500 text-white'
                          : 'bg-white border-ironbound-grey-300 text-ironbound-grey-700 hover:border-ironbound-grey-400'
                      }`}
                    >
                      {p === '0' ? 'None' : `${p} digits`}
                    </button>
                  ))}
                </div>
              </div>
              {lotGenPreview() && (
                <div className="bg-ironbound-grey-50 rounded-xl p-4 border border-ironbound-grey-200">
                  <p className="text-xs font-medium text-ironbound-grey-500 mb-1">Preview</p>
                  <p className="text-ironbound-grey-900 font-mono text-sm">{lotGenPreview()}</p>
                  <p className="text-xs text-ironbound-grey-400 mt-1">{items.length} lots will be generated</p>
                </div>
              )}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                This will overwrite all existing lot numbers for items in this event.
              </div>
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setShowLotGenModal(false)}
                className="flex-1 px-4 py-2.5 border border-ironbound-grey-300 rounded-lg text-sm font-medium text-ironbound-grey-700 hover:bg-ironbound-grey-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateLotNumbers}
                disabled={!lotGenStart || isNaN(parseInt(lotGenStart, 10))}
                className="flex-1 px-4 py-2.5 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <ListOrdered className="h-4 w-4" />
                Generate {items.length} Lot Numbers
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-ironbound-grey-200">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xl font-bold text-ironbound-grey-900">Add Items to Event</h3>
                <button
                  onClick={() => { setShowAddModal(false); setSelectedToAdd(new Set()); setAddSearchQuery(''); }}
                  className="text-ironbound-grey-400 hover:text-ironbound-grey-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-ironbound-grey-500 text-sm">Select items from your inventory to add as lots</p>
              <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                <input
                  type="text"
                  value={addSearchQuery}
                  onChange={e => setAddSearchQuery(e.target.value)}
                  placeholder="Search available inventory..."
                  className="w-full pl-10 pr-4 py-2.5 border border-ironbound-grey-300 rounded-xl text-ironbound-grey-900 focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 text-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {filteredAvailable.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-ironbound-grey-400 mx-auto mb-3" />
                  <p className="text-ironbound-grey-600">
                    {addSearchQuery ? 'No items match your search' : 'No available items in inventory'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAvailable.map(item => (
                    <label
                      key={item.id}
                      className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${
                        selectedToAdd.has(item.id)
                          ? 'border-ironbound-orange-500 bg-ironbound-orange-50'
                          : 'border-ironbound-grey-200 hover:border-ironbound-grey-300 hover:bg-ironbound-grey-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedToAdd.has(item.id)}
                        onChange={() => {
                          const next = new Set(selectedToAdd);
                          next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                          setSelectedToAdd(next);
                        }}
                        className="w-4 h-4 text-ironbound-orange-500 rounded focus:ring-ironbound-orange-500"
                      />
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="w-12 h-12 rounded-lg object-cover ml-3"
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2';
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-ironbound-grey-100 flex items-center justify-center ml-3">
                          <Package className="h-5 w-5 text-ironbound-grey-400" />
                        </div>
                      )}
                      <div className="ml-3 flex-1 min-w-0">
                        <p className="font-medium text-ironbound-grey-900 text-sm truncate">{item.title}</p>
                        <p className="text-xs text-ironbound-grey-500">#{item.inventory_number} &bull; {item.category}</p>
                      </div>
                      <div className="ml-3 text-right flex-shrink-0">
                        <p className="text-xs text-ironbound-grey-400">Starting</p>
                        <p className="font-semibold text-ironbound-grey-900 text-sm">{formatCurrency(item.starting_price)}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-ironbound-grey-200 flex items-center justify-between gap-3">
              <span className="text-sm text-ironbound-grey-600">
                {selectedToAdd.size} item{selectedToAdd.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowAddModal(false); setSelectedToAdd(new Set()); setAddSearchQuery(''); }}
                  className="px-4 py-2 border border-ironbound-grey-300 rounded-lg text-ironbound-grey-700 hover:bg-ironbound-grey-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddItems}
                  disabled={selectedToAdd.size === 0 || addingItem}
                  className="px-4 py-2 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 disabled:bg-ironbound-grey-300 text-white rounded-lg font-medium transition-colors text-sm flex items-center gap-2"
                >
                  {addingItem && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Add {selectedToAdd.size > 0 ? `(${selectedToAdd.size})` : ''} to Event
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

    {galleryItem && (
      <LotGalleryModal
        lot={{
          inventory_id: galleryItem.id,
          title: galleryItem.title,
          lot_number: galleryItem.lot_number || undefined,
          image_url: galleryItem.image_url,
          barcode_asset_group_id: null,
        }}
        onClose={() => setGalleryItem(null)}
      />
    )}
    </>
  );
}
