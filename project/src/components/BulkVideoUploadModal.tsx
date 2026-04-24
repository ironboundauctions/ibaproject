import React, { useState, useRef, useCallback } from 'react';
import { X, Film, Upload, CheckCircle, AlertCircle, Search, CreditCard as Edit2, Check, SkipForward, Loader2 } from 'lucide-react';
import { InventoryItem } from '../services/inventoryService';
import { FileUploadService } from '../services/fileUploadService';

interface BulkVideoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  items: InventoryItem[];
}

type MatchStatus = 'matched' | 'unmatched' | 'skipped';
type UploadStatus = 'idle' | 'uploading' | 'done' | 'error';

interface VideoRow {
  id: string;
  file: File;
  filename: string;
  matchedItem: InventoryItem | null;
  matchStatus: MatchStatus;
  uploadStatus: UploadStatus;
  uploadProgress: number;
  errorMessage: string | null;
  isEditing: boolean;
  editQuery: string;
}

type ModalStep = 'select' | 'review' | 'uploading' | 'complete';

function matchInventoryNumber(invNumber: string, filename: string): boolean {
  const escaped = invNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?<![a-zA-Z0-9])${escaped}(?![a-zA-Z0-9])`, 'i');
  return regex.test(filename);
}

function findMatch(filename: string, items: InventoryItem[]): InventoryItem | null {
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
  for (const item of items) {
    if (item.inventory_number && matchInventoryNumber(item.inventory_number, nameWithoutExt)) {
      return item;
    }
  }
  return null;
}

export default function BulkVideoUploadModal({ isOpen, onClose, onSuccess, items }: BulkVideoUploadModalProps) {
  const [step, setStep] = useState<ModalStep>('select');
  const [rows, setRows] = useState<VideoRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback((files: FileList | File[]) => {
    const videoFiles = Array.from(files).filter(f => f.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm|m4v|wmv)$/i.test(f.name));
    if (videoFiles.length === 0) return;

    const newRows: VideoRow[] = videoFiles.map(file => {
      const matched = findMatch(file.name, items);
      return {
        id: crypto.randomUUID(),
        file,
        filename: file.name,
        matchedItem: matched,
        matchStatus: matched ? 'matched' : 'unmatched',
        uploadStatus: 'idle',
        uploadProgress: 0,
        errorMessage: null,
        isEditing: false,
        editQuery: '',
      };
    });

    setRows(newRows);
    setStep('review');
  }, [items]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const toggleSkip = (id: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      if (r.matchStatus === 'skipped') {
        return { ...r, matchStatus: r.matchedItem ? 'matched' : 'unmatched' };
      }
      return { ...r, matchStatus: 'skipped' };
    }));
  };

  const startEdit = (id: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, isEditing: true, editQuery: r.matchedItem?.inventory_number || '' } : r));
  };

  const cancelEdit = (id: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, isEditing: false, editQuery: '' } : r));
  };

  const setEditQuery = (id: string, query: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, editQuery: query } : r));
  };

  const assignItem = (rowId: string, item: InventoryItem) => {
    setRows(prev => prev.map(r => r.id === rowId
      ? { ...r, matchedItem: item, matchStatus: 'matched', isEditing: false, editQuery: '' }
      : r
    ));
  };

  const getEditSuggestions = (query: string): InventoryItem[] => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return items.filter(item =>
      (item.inventory_number?.toLowerCase().includes(q) || item.title?.toLowerCase().includes(q))
    ).slice(0, 8);
  };

  const handleUpload = async () => {
    const toUpload = rows.filter(r => r.matchStatus === 'matched' && r.matchedItem && r.uploadStatus === 'idle');
    if (toUpload.length === 0) return;

    setStep('uploading');

    for (const row of toUpload) {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, uploadStatus: 'uploading', uploadProgress: 0 } : r));

      try {
        const result = await FileUploadService.uploadPCFileToWorker(
          row.file,
          row.matchedItem!.id,
          (progress) => {
            setRows(prev => prev.map(r => r.id === row.id ? { ...r, uploadProgress: progress } : r));
          }
        );

        if (!result.success) {
          throw new Error(result.error || 'Upload failed');
        }

        setRows(prev => prev.map(r => r.id === row.id ? { ...r, uploadStatus: 'done', uploadProgress: 100 } : r));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, uploadStatus: 'error', errorMessage: msg } : r));
      }
    }

    setStep('complete');
    onSuccess();
  };

  const matchedCount = rows.filter(r => r.matchStatus === 'matched').length;
  const skippedCount = rows.filter(r => r.matchStatus === 'skipped').length;
  const unmatchedCount = rows.filter(r => r.matchStatus === 'unmatched').length;
  const doneCount = rows.filter(r => r.uploadStatus === 'done').length;
  const errorCount = rows.filter(r => r.uploadStatus === 'error').length;

  const handleClose = () => {
    setStep('select');
    setRows([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Film className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Bulk Video Upload</h2>
              <p className="text-xs text-gray-500">
                {step === 'select' && 'Select video files named with inventory numbers'}
                {step === 'review' && `${rows.length} video${rows.length !== 1 ? 's' : ''} selected — review before uploading`}
                {step === 'uploading' && 'Uploading videos...'}
                {step === 'complete' && 'Upload complete'}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Step: Select */}
          {step === 'select' && (
            <div className="p-6">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                  isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }`}
              >
                <Film className={`h-12 w-12 mx-auto mb-3 transition-colors ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
                <p className="text-lg font-semibold text-gray-700 mb-1">Drop videos here or click to browse</p>
                <p className="text-sm text-gray-500">MP4, MOV, AVI, MKV, WebM — files must contain the inventory number in the filename</p>
                <p className="text-xs text-gray-400 mt-3">Example: <span className="font-mono bg-gray-100 px-1 rounded">ABC123_front.mp4</span> matches item with inventory number <span className="font-mono bg-gray-100 px-1 rounded">ABC123</span></p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,.mp4,.mov,.avi,.mkv,.webm,.m4v,.wmv"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          )}

          {/* Step: Review */}
          {(step === 'review' || step === 'uploading' || step === 'complete') && (
            <div className="divide-y divide-gray-100">
              {rows.map(row => (
                <ReviewRow
                  key={row.id}
                  row={row}
                  items={items}
                  onToggleSkip={toggleSkip}
                  onStartEdit={startEdit}
                  onCancelEdit={cancelEdit}
                  onSetEditQuery={setEditQuery}
                  onAssignItem={assignItem}
                  getEditSuggestions={getEditSuggestions}
                  isLocked={step === 'uploading' || step === 'complete'}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          {step === 'review' && (
            <div className="flex items-center justify-between">
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-700"><CheckCircle className="h-4 w-4" />{matchedCount} matched</span>
                {unmatchedCount > 0 && <span className="flex items-center gap-1 text-amber-600"><AlertCircle className="h-4 w-4" />{unmatchedCount} unmatched</span>}
                {skippedCount > 0 && <span className="flex items-center gap-1 text-gray-500"><SkipForward className="h-4 w-4" />{skippedCount} skipped</span>}
              </div>
              <div className="flex gap-3">
                <button onClick={handleClose} className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors">Cancel</button>
                <button
                  onClick={handleUpload}
                  disabled={matchedCount === 0}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload {matchedCount} Video{matchedCount !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}

          {step === 'uploading' && (
            <div className="flex items-center justify-center gap-3 text-blue-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-medium">Uploading {doneCount + 1} of {matchedCount}...</span>
            </div>
          )}

          {step === 'complete' && (
            <div className="flex items-center justify-between">
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-700 font-medium"><CheckCircle className="h-4 w-4" />{doneCount} uploaded</span>
                {errorCount > 0 && <span className="flex items-center gap-1 text-red-600 font-medium"><AlertCircle className="h-4 w-4" />{errorCount} failed</span>}
                {skippedCount > 0 && <span className="flex items-center gap-1 text-gray-500"><SkipForward className="h-4 w-4" />{skippedCount} skipped</span>}
              </div>
              <button onClick={handleClose} className="px-5 py-2 bg-gray-800 hover:bg-gray-900 text-white font-medium rounded-lg transition-colors">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ReviewRowProps {
  row: VideoRow;
  items: InventoryItem[];
  onToggleSkip: (id: string) => void;
  onStartEdit: (id: string) => void;
  onCancelEdit: (id: string) => void;
  onSetEditQuery: (id: string, query: string) => void;
  onAssignItem: (rowId: string, item: InventoryItem) => void;
  getEditSuggestions: (query: string) => InventoryItem[];
  isLocked: boolean;
}

function ReviewRow({ row, onToggleSkip, onStartEdit, onCancelEdit, onSetEditQuery, onAssignItem, getEditSuggestions, isLocked }: ReviewRowProps) {
  const suggestions = row.isEditing ? getEditSuggestions(row.editQuery) : [];

  const statusBg = row.uploadStatus === 'done'
    ? 'bg-green-50'
    : row.uploadStatus === 'error'
    ? 'bg-red-50'
    : row.matchStatus === 'skipped'
    ? 'bg-gray-50'
    : row.matchStatus === 'unmatched'
    ? 'bg-amber-50'
    : '';

  return (
    <div className={`px-6 py-4 transition-colors ${statusBg}`}>
      <div className="flex items-start gap-4">
        {/* File icon */}
        <div className="mt-0.5 flex-shrink-0">
          {row.uploadStatus === 'done' && <CheckCircle className="h-5 w-5 text-green-500" />}
          {row.uploadStatus === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
          {row.uploadStatus === 'uploading' && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
          {row.uploadStatus === 'idle' && (
            <Film className={`h-5 w-5 ${row.matchStatus === 'skipped' ? 'text-gray-300' : row.matchStatus === 'unmatched' ? 'text-amber-400' : 'text-blue-400'}`} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-mono font-medium truncate ${row.matchStatus === 'skipped' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
            {row.filename}
          </p>

          {/* Match status */}
          {!row.isEditing && (
            <div className="mt-1 flex items-center gap-2">
              {row.matchStatus === 'matched' && row.matchedItem && (
                <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium">
                  <Check className="h-3 w-3" />
                  {row.matchedItem.inventory_number} — {row.matchedItem.title || 'Untitled'}
                </span>
              )}
              {row.matchStatus === 'unmatched' && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-medium">
                  <AlertCircle className="h-3 w-3" />
                  No match found
                </span>
              )}
              {row.matchStatus === 'skipped' && (
                <span className="text-xs text-gray-400 italic">Skipped</span>
              )}
            </div>
          )}

          {/* Upload progress */}
          {row.uploadStatus === 'uploading' && (
            <div className="mt-2 h-1.5 bg-blue-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${row.uploadProgress}%` }} />
            </div>
          )}

          {/* Error message */}
          {row.uploadStatus === 'error' && row.errorMessage && (
            <p className="mt-1 text-xs text-red-600">{row.errorMessage}</p>
          )}

          {/* Inline edit */}
          {row.isEditing && (
            <div className="mt-2 relative">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    autoFocus
                    type="text"
                    value={row.editQuery}
                    onChange={e => onSetEditQuery(row.id, e.target.value)}
                    placeholder="Search by inventory # or title..."
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <button onClick={() => onCancelEdit(row.id)} className="text-gray-400 hover:text-gray-600 p-1 rounded">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-8 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {suggestions.map(item => (
                    <button
                      key={item.id}
                      onClick={() => onAssignItem(row.id, item)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2 text-sm transition-colors"
                    >
                      <span className="font-mono text-blue-700 font-medium text-xs bg-blue-100 px-1.5 py-0.5 rounded">{item.inventory_number}</span>
                      <span className="text-gray-700 truncate">{item.title || 'Untitled'}</span>
                    </button>
                  ))}
                </div>
              )}
              {row.editQuery.trim() && suggestions.length === 0 && (
                <div className="absolute top-full left-0 right-8 mt-1 bg-white border border-gray-200 rounded-lg shadow-sm z-10 px-3 py-2 text-sm text-gray-500">
                  No items found
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isLocked && row.uploadStatus === 'idle' && !row.isEditing && (
          <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
            <button
              onClick={() => onStartEdit(row.id)}
              title="Reassign to a different item"
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onToggleSkip(row.id)}
              title={row.matchStatus === 'skipped' ? 'Un-skip' : 'Skip this file'}
              className={`p-1.5 rounded-lg transition-colors ${row.matchStatus === 'skipped' ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
            >
              <SkipForward className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
