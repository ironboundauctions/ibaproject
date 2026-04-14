import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Package, Calendar, Tag, User, DollarSign, FileText,
  Image as ImageIcon, Gavel, MapPin, Clock, Info, AlertCircle,
  ChevronRight, Plus, ExternalLink, Hash, Ruler, Weight,
  Factory, Wrench, Layers, Star, RefreshCw, CheckSquare
} from 'lucide-react';
import { InventoryService, InventoryItem } from '../services/inventoryService';
import { ConsignorService } from '../services/consignerService';
import { Consignor } from '../types/consigner';
import { supabase } from '../lib/supabase';
import AssignToEventModal from './AssignToEventModal';
import { formatCurrency } from '../utils/formatters';

interface Props {
  item: InventoryItem;
  onBack: () => void;
  onItemUpdated?: () => void;
}

interface EventAssignmentDetail {
  assignment_id: string;
  event_id: string;
  lot_number: string;
  sale_order: number;
  lot_notes: string;
  lot_starting_price: number | null;
  assigned_at: string;
  event: {
    id: string;
    title: string;
    start_date: string;
    end_date: string;
    status: string;
    location: string;
  };
}

interface MediaFile {
  id: string;
  cdn_url: string;
  mime_type: string;
  variant: string;
  asset_group_id: string;
  display_order: number;
  original_name?: string;
}

export default function InventoryItemDetail({ item: initialItem, onBack, onItemUpdated }: Props) {
  const [item, setItem] = useState<InventoryItem>(initialItem);
  const [assignments, setAssignments] = useState<EventAssignmentDetail[]>([]);
  const [consignor, setConsignor] = useState<Consignor | null>(null);
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedMediaUrl, setSelectedMediaUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [assignmentData, allConsigners, mediaData] = await Promise.all([
        InventoryService.getItemEventAssignments(item.id),
        item.consigner_id ? ConsignorService.getAllConsignors() : Promise.resolve([]),
        supabase
          .from('auction_files')
          .select('id, cdn_url, mime_type, variant, asset_group_id, display_order, original_name')
          .eq('item_id', item.id)
          .is('detached_at', null)
          .eq('published_status', 'published')
          .in('variant', ['source', 'display', 'thumb', 'video'])
          .order('display_order', { ascending: true }),
      ]);

      setAssignments(assignmentData);

      if (item.consigner_id) {
        const found = (allConsigners as Consignor[]).find(c => c.id === item.consigner_id);
        setConsignor(found || null);
      }

      const files = mediaData.data || [];
      // Deduplicate by asset group - prefer display > thumb for images, video if available
      const groupMap = new Map<string, MediaFile>();
      for (const f of files) {
        const key = f.asset_group_id || f.id;
        const existing = groupMap.get(key);
        if (!existing) { groupMap.set(key, f); continue; }
        const preferOrder = ['video', 'display', 'thumb', 'source'];
        if (preferOrder.indexOf(f.variant) < preferOrder.indexOf(existing.variant)) {
          groupMap.set(key, f);
        }
      }
      // Filter out barcode asset group
      const filtered = Array.from(groupMap.values()).filter(
        f => f.asset_group_id !== item.barcode_asset_group_id
      );
      setMedia(filtered);
    } catch (err) {
      console.error('Error loading item detail:', err);
    } finally {
      setIsLoading(false);
    }
  }, [item.id, item.consigner_id, item.barcode_asset_group_id]);

  useEffect(() => { load(); }, [load]);

  const getEventStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700 border-green-200';
      case 'published': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'completed': return 'bg-ironbound-grey-100 text-ironbound-grey-600 border-ironbound-grey-200';
      case 'live': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  };

  const getItemStatusColor = (status: string) => {
    switch (status) {
      case 'cataloged': return 'bg-ironbound-grey-100 text-ironbound-grey-700';
      case 'assigned_to_auction': return 'bg-blue-100 text-blue-700';
      case 'live': return 'bg-red-100 text-red-700';
      case 'sold': return 'bg-green-100 text-green-700';
      case 'paid': return 'bg-emerald-100 text-emerald-700';
      case 'picked_up': return 'bg-teal-100 text-teal-700';
      case 'returned': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-ironbound-grey-100 text-ironbound-grey-600';
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    });

  const consignorName = consignor
    ? ((consignor as any).name || consignor.full_name || 'Unknown')
    : (item.consigner_id ? 'Loading...' : 'No consignor');

  const thumbnail = media.find(m => m.variant === 'thumb' || m.variant === 'display')?.cdn_url || item.image_url;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-ironbound-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-ironbound-orange-500 hover:text-ironbound-orange-600 font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Inventory
        </button>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">{item.title}</h2>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getItemStatusColor(item.status)}`}>
              {item.status.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-ironbound-grey-300 mt-1 font-mono">#{item.inventory_number}</p>
        </div>
        <button
          onClick={() => setShowAssignModal(true)}
          className="flex items-center gap-2 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
        >
          <Plus className="h-4 w-4" />
          Assign to Event
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Media + Quick Facts */}
        <div className="lg:col-span-1 space-y-4">
          {/* Primary image */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={item.title}
                className="w-full aspect-square object-cover cursor-pointer hover:opacity-95 transition-opacity"
                onClick={() => setSelectedMediaUrl(thumbnail)}
                onError={(e) => {
                  e.currentTarget.src = 'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2';
                }}
              />
            ) : (
              <div className="aspect-square bg-ironbound-grey-100 flex flex-col items-center justify-center">
                <ImageIcon className="h-12 w-12 text-ironbound-grey-300" />
                <p className="text-ironbound-grey-400 text-sm mt-2">No image</p>
              </div>
            )}
          </div>

          {/* Media grid */}
          {media.length > 1 && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-xs font-semibold text-ironbound-grey-500 uppercase tracking-wider mb-3">
                All Media ({media.length})
              </p>
              <div className="grid grid-cols-4 gap-2">
                {media.map(file => (
                  <button
                    key={file.id}
                    onClick={() => setSelectedMediaUrl(file.cdn_url)}
                    className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-ironbound-orange-400 transition-all"
                  >
                    {file.mime_type?.startsWith('video/') ? (
                      <div className="w-full h-full bg-ironbound-grey-100 flex items-center justify-center">
                        <span className="text-xs text-ironbound-grey-500">Video</span>
                      </div>
                    ) : (
                      <img src={file.cdn_url} alt="" className="w-full h-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick facts */}
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-ironbound-grey-500 uppercase tracking-wider">Quick Facts</p>
            <div className="space-y-2.5">
              <QuickFact icon={<Tag className="h-3.5 w-3.5" />} label="Category" value={item.category} />
              <QuickFact icon={<DollarSign className="h-3.5 w-3.5" />} label="Starting Price" value={item.starting_price ? formatCurrency(item.starting_price) : 'Not set'} />
              {item.reserve_price && (
                <QuickFact icon={<Star className="h-3.5 w-3.5" />} label="Reserve" value={formatCurrency(item.reserve_price)} />
              )}
              {(item.estimated_value_low || item.estimated_value_high) && (
                <QuickFact
                  icon={<DollarSign className="h-3.5 w-3.5" />}
                  label="Est. Value"
                  value={`${item.estimated_value_low ? formatCurrency(item.estimated_value_low) : '?'} – ${item.estimated_value_high ? formatCurrency(item.estimated_value_high) : '?'}`}
                />
              )}
              <QuickFact icon={<User className="h-3.5 w-3.5" />} label="Consignor" value={consignorName} />
              {item.condition && <QuickFact icon={<Wrench className="h-3.5 w-3.5" />} label="Condition" value={item.condition} />}
              <QuickFact
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Added"
                value={item.created_at ? formatDateTime(item.created_at) : '—'}
              />
              <QuickFact
                icon={<RefreshCw className="h-3.5 w-3.5" />}
                label="Updated"
                value={item.updated_at ? formatDateTime(item.updated_at) : '—'}
              />
              {typeof item.has_title === 'boolean' && (
                <QuickFact
                  icon={<CheckSquare className="h-3.5 w-3.5" />}
                  label="Has Title"
                  value={item.has_title ? 'Yes' : 'No'}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right: Details + Event history */}
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-ironbound-grey-500" />
              <h3 className="font-semibold text-ironbound-grey-900">Description</h3>
            </div>
            <p className="text-ironbound-grey-700 leading-relaxed whitespace-pre-wrap">
              {item.description || <span className="text-ironbound-grey-400 italic">No description provided</span>}
            </p>
          </div>

          {/* Specifications */}
          {(item.manufacturer || item.year_made || item.dimensions || item.weight || item.notes) && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Info className="h-4 w-4 text-ironbound-grey-500" />
                <h3 className="font-semibold text-ironbound-grey-900">Specifications</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {item.manufacturer && <SpecRow icon={<Factory className="h-3.5 w-3.5" />} label="Manufacturer" value={item.manufacturer} />}
                {item.year_made && <SpecRow icon={<Calendar className="h-3.5 w-3.5" />} label="Year Made" value={item.year_made} />}
                {item.dimensions && <SpecRow icon={<Ruler className="h-3.5 w-3.5" />} label="Dimensions" value={item.dimensions} />}
                {item.weight && <SpecRow icon={<Weight className="h-3.5 w-3.5" />} label="Weight" value={item.weight} />}
              </div>
              {item.notes && (
                <div className="mt-3 pt-3 border-t border-ironbound-grey-100">
                  <p className="text-xs font-medium text-ironbound-grey-500 mb-1.5">Internal Notes</p>
                  <p className="text-sm text-ironbound-grey-700 whitespace-pre-wrap">{item.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Documents */}
          {item.document_urls && item.document_urls.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-ironbound-grey-500" />
                <h3 className="font-semibold text-ironbound-grey-900">Documents ({item.document_urls.length})</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.document_urls.map((doc, i) => (
                  <a
                    key={i}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-ironbound-grey-50 border border-ironbound-grey-200 rounded-lg text-sm text-ironbound-grey-700 hover:bg-ironbound-grey-100 transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5 text-ironbound-grey-400" />
                    Document {i + 1}
                    <ExternalLink className="h-3 w-3 text-ironbound-grey-400" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Event Assignments */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Gavel className="h-4 w-4 text-ironbound-grey-500" />
                <h3 className="font-semibold text-ironbound-grey-900">Event History</h3>
                <span className="bg-ironbound-grey-100 text-ironbound-grey-600 text-xs px-2 py-0.5 rounded-full font-medium">
                  {assignments.length}
                </span>
              </div>
              <button
                onClick={() => setShowAssignModal(true)}
                className="flex items-center gap-1.5 text-xs text-ironbound-orange-500 hover:text-ironbound-orange-600 font-medium transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add to Event
              </button>
            </div>

            {assignments.length === 0 ? (
              <div className="text-center py-8 bg-ironbound-grey-50 rounded-xl border-2 border-dashed border-ironbound-grey-200">
                <Gavel className="h-8 w-8 text-ironbound-grey-300 mx-auto mb-2" />
                <p className="text-ironbound-grey-500 text-sm font-medium">Not assigned to any event yet</p>
                <p className="text-ironbound-grey-400 text-xs mt-0.5">Use the button above to assign this item to an event</p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignments.map(a => (
                  <div
                    key={a.assignment_id}
                    className="border border-ironbound-grey-200 rounded-xl p-4 hover:border-ironbound-grey-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-ironbound-grey-900 text-sm">{a.event.title}</h4>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getEventStatusColor(a.event.status)}`}>
                            {a.event.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-ironbound-grey-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(a.event.start_date)}
                            {a.event.end_date && a.event.end_date !== a.event.start_date && (
                              <> – {formatDate(a.event.end_date)}</>
                            )}
                          </span>
                          {a.event.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {a.event.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <EventDetailCell label="Lot #" value={a.lot_number} icon={<Hash className="h-3 w-3" />} />
                      <EventDetailCell label="Sale Order" value={`#${a.sale_order}`} icon={<Layers className="h-3 w-3" />} />
                      <EventDetailCell
                        label="Starting Price"
                        value={a.lot_starting_price != null
                          ? formatCurrency(a.lot_starting_price)
                          : `${formatCurrency(item.starting_price)} (inventory)`
                        }
                        icon={<DollarSign className="h-3 w-3" />}
                      />
                      <EventDetailCell
                        label="Assigned"
                        value={formatDate(a.assigned_at)}
                        icon={<Clock className="h-3 w-3" />}
                      />
                    </div>

                    {a.lot_notes && (
                      <div className="mt-3 pt-3 border-t border-ironbound-grey-100">
                        <p className="text-xs font-medium text-ironbound-grey-500 mb-1">Lot Notes</p>
                        <p className="text-sm text-ironbound-grey-700">{a.lot_notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {selectedMediaUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedMediaUrl(null)}
        >
          <img
            src={selectedMediaUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setSelectedMediaUrl(null)}
            className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-80 transition-all"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {showAssignModal && (
        <AssignToEventModal
          item={item}
          onClose={() => setShowAssignModal(false)}
          onAssigned={async (eventId, eventTitle) => {
            setShowAssignModal(false);
            setItem(prev => ({ ...prev, status: 'assigned_to_auction' }));
            await load();
            onItemUpdated?.();
          }}
        />
      )}
    </div>
  );
}

function QuickFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-ironbound-grey-400 mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-ironbound-grey-400">{label}</p>
        <p className="text-sm font-medium text-ironbound-grey-800 truncate">{value}</p>
      </div>
    </div>
  );
}

function SpecRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-ironbound-grey-50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-ironbound-grey-400">{icon}</span>
        <p className="text-xs text-ironbound-grey-500">{label}</p>
      </div>
      <p className="text-sm font-medium text-ironbound-grey-800">{value}</p>
    </div>
  );
}

function EventDetailCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-ironbound-grey-50 rounded-lg px-3 py-2">
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-ironbound-grey-400">{icon}</span>
        <p className="text-xs text-ironbound-grey-500">{label}</p>
      </div>
      <p className="text-xs font-semibold text-ironbound-grey-800 truncate">{value}</p>
    </div>
  );
}
