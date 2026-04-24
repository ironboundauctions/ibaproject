import React, { useState, useEffect } from 'react';
import { X, Gavel, Check, AlertCircle, Calendar, MapPin, Package } from 'lucide-react';
import { InventoryService, InventoryItem } from '../services/inventoryService';
import { EventService } from '../services/eventService';
import { supabase } from '../lib/supabase';

interface Props {
  item?: InventoryItem;
  items?: InventoryItem[];
  onClose: () => void;
  onAssigned: (eventId: string, eventTitle: string) => void;
}

export default function AssignToEventModal({ item, items, onClose, onAssigned }: Props) {
  const allItems: InventoryItem[] = items ?? (item ? [item] : []);
  const isMulti = allItems.length > 1;

  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyAssigned, setAlreadyAssigned] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const [allEvents, assignments] = await Promise.all([
        EventService.getAllEvents(),
        fetchItemAssignments(),
      ]);
      const activeEvents = allEvents.filter(e => e.status !== 'completed' && e.status !== 'cancelled');
      setEvents(activeEvents);
      setAlreadyAssigned(assignments);
    } catch {
      setError('Failed to load events');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchItemAssignments = async (): Promise<Set<string>> => {
    if (allItems.length === 0) return new Set();
    if (!isMulti) {
      const { data } = await supabase
        .from('event_inventory_assignments')
        .select('event_id')
        .eq('inventory_id', allItems[0].id);
      return new Set((data || []).map((r: any) => r.event_id));
    }
    const { data } = await supabase
      .from('event_inventory_assignments')
      .select('event_id')
      .in('inventory_id', allItems.map(i => i.id));
    const counts: Record<string, number> = {};
    (data || []).forEach((r: any) => {
      counts[r.event_id] = (counts[r.event_id] || 0) + 1;
    });
    return new Set(Object.keys(counts).filter(id => counts[id] === allItems.length));
  };

  const getEventAssignedCount = async (eventId: string): Promise<number> => {
    const { count } = await supabase
      .from('event_inventory_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);
    return count || 0;
  };

  const getAlreadyAssignedToEvent = async (eventId: string): Promise<Set<string>> => {
    const { data } = await supabase
      .from('event_inventory_assignments')
      .select('inventory_id')
      .eq('event_id', eventId)
      .in('inventory_id', allItems.map(i => i.id));
    return new Set((data || []).map((r: any) => r.inventory_id));
  };

  const handleAssign = async () => {
    if (!selectedEventId) return;
    setIsSaving(true);
    setError(null);
    try {
      const alreadyInEvent = await getAlreadyAssignedToEvent(selectedEventId);
      const toAssign = allItems.filter(i => !alreadyInEvent.has(i.id));
      if (toAssign.length === 0) {
        setError('All selected items are already assigned to this event.');
        return;
      }
      let baseCount = await getEventAssignedCount(selectedEventId);
      setProgress({ done: 0, total: toAssign.length });
      for (let idx = 0; idx < toAssign.length; idx++) {
        await InventoryService.assignToEvent(toAssign[idx].id, selectedEventId, baseCount + idx + 1);
        setProgress({ done: idx + 1, total: toAssign.length });
      }
      const event = events.find(e => e.id === selectedEventId);
      onAssigned(selectedEventId, event?.title || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign items');
    } finally {
      setIsSaving(false);
      setProgress(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'published': return 'bg-blue-100 text-blue-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="p-6 border-b border-ironbound-grey-200">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="bg-ironbound-orange-100 p-2 rounded-lg">
                <Gavel className="h-5 w-5 text-ironbound-orange-600" />
              </div>
              <h3 className="text-lg font-bold text-ironbound-grey-900">Assign to Event</h3>
            </div>
            <button
              onClick={onClose}
              className="text-ironbound-grey-400 hover:text-ironbound-grey-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {isMulti ? (
            <div className="mt-2 ml-11 flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-ironbound-orange-50 border border-ironbound-orange-200 rounded-lg px-3 py-1.5">
                <Package className="h-4 w-4 text-ironbound-orange-600 flex-shrink-0" />
                <span className="text-sm font-semibold text-ironbound-orange-700">{allItems.length} items selected</span>
              </div>
            </div>
          ) : (
            <p className="text-ironbound-grey-500 text-sm mt-2 ml-11">
              <span className="font-medium text-ironbound-grey-700">{allItems[0]?.title}</span>
              <span className="text-ironbound-grey-400"> &bull; #{allItems[0]?.inventory_number}</span>
            </p>
          )}
        </div>

        {isMulti && (
          <div className="px-6 pt-4 max-h-28 overflow-y-auto">
            <div className="flex flex-wrap gap-1.5">
              {allItems.map(i => (
                <span key={i.id} className="inline-flex items-center gap-1 bg-ironbound-grey-100 text-ironbound-grey-700 text-xs px-2 py-1 rounded-full">
                  #{i.inventory_number}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-4 border-ironbound-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8">
              <Gavel className="h-12 w-12 text-ironbound-grey-300 mx-auto mb-3" />
              <p className="text-ironbound-grey-600 font-medium">No active events</p>
              <p className="text-ironbound-grey-400 text-sm mt-1">Create an event first from the Events tab</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {events.map(event => {
                const isAssigned = alreadyAssigned.has(event.id);
                const isSelected = selectedEventId === event.id;
                return (
                  <button
                    key={event.id}
                    onClick={() => !isAssigned && setSelectedEventId(isSelected ? '' : event.id)}
                    disabled={isAssigned}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      isAssigned
                        ? 'border-ironbound-grey-200 bg-ironbound-grey-50 opacity-60 cursor-not-allowed'
                        : isSelected
                        ? 'border-ironbound-orange-500 bg-ironbound-orange-50'
                        : 'border-ironbound-grey-200 hover:border-ironbound-grey-300 hover:bg-ironbound-grey-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-ironbound-grey-900 text-sm truncate">{event.title}</p>
                          <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}>
                            {event.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-ironbound-grey-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(event.start_date)}
                          </span>
                          {event.location && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              {event.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {isAssigned ? (
                          <span className="text-xs text-ironbound-grey-400 bg-ironbound-grey-200 px-2 py-1 rounded-full">
                            {isMulti ? 'All assigned' : 'Already added'}
                          </span>
                        ) : isSelected ? (
                          <div className="w-5 h-5 bg-ironbound-orange-500 rounded-full flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 border-2 border-ironbound-grey-300 rounded-full" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {progress && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-ironbound-grey-600 mb-1">
                <span>Assigning items...</span>
                <span>{progress.done} / {progress.total}</span>
              </div>
              <div className="h-2 bg-ironbound-grey-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-ironbound-orange-500 transition-all duration-300"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-ironbound-grey-300 rounded-lg text-ironbound-grey-700 hover:bg-ironbound-grey-50 transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedEventId || isSaving}
            className="px-4 py-2 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 disabled:bg-ironbound-grey-300 text-white rounded-lg font-medium transition-colors text-sm flex items-center gap-2"
          >
            {isSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {isMulti ? `Assign ${allItems.length} Items` : 'Assign to Event'}
          </button>
        </div>
      </div>
    </div>
  );
}
