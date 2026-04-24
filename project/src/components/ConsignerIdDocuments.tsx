import React, { useState, useEffect, useRef } from 'react';
import {
  Paperclip,
  Upload,
  Trash2,
  Eye,
  Download,
  X,
  FileText,
  Image,
  Loader,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  ConsignerDocument,
  ConsignerDocumentService,
  isImageType,
} from '../services/consignerDocumentService';

interface Props {
  consignerId: string;
}

interface LightboxState {
  docs: ConsignerDocument[];
  index: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DownloadConfirmModal({
  doc,
  onConfirm,
  onCancel,
}: {
  doc: ConsignerDocument;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Download className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Download Document</h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{doc.file_name}</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          Are you sure you want to download{' '}
          <span className="font-medium text-gray-800">
            {doc.document_label || doc.file_name}
          </span>
          ?
        </p>
        <div className="flex space-x-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}

function ImageLightbox({
  state,
  onClose,
  onChange,
}: {
  state: LightboxState;
  onClose: () => void;
  onChange: (index: number) => void;
}) {
  const doc = state.docs[state.index];
  const hasMultiple = state.docs.length > 1;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && state.index > 0) onChange(state.index - 1);
      if (e.key === 'ArrowRight' && state.index < state.docs.length - 1) onChange(state.index + 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [state, onClose, onChange]);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = doc.file_url;
    a.download = doc.file_name;
    a.target = '_blank';
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between w-full mb-3 px-1">
          <div>
            <p className="text-white font-medium text-sm truncate max-w-xs">
              {doc.document_label || doc.file_name}
            </p>
            {hasMultiple && (
              <p className="text-gray-400 text-xs mt-0.5">
                {state.index + 1} of {state.docs.length}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative w-full flex items-center justify-center">
          {hasMultiple && state.index > 0 && (
            <button
              onClick={() => onChange(state.index - 1)}
              className="absolute left-0 z-10 p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <img
            src={doc.file_url}
            alt={doc.document_label || doc.file_name}
            className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl"
          />
          {hasMultiple && state.index < state.docs.length - 1 && (
            <button
              onClick={() => onChange(state.index + 1)}
              className="absolute right-0 z-10 p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConsignerIdDocuments({ consignerId }: Props) {
  const [docs, setDocs] = useState<ConsignerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [downloadConfirm, setDownloadConfirm] = useState<ConsignerDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, [consignerId]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await ConsignerDocumentService.getDocuments(consignerId);
      setDocs(data);
    } catch (err) {
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError('');
    try {
      const label = labelInput.trim();
      for (const file of Array.from(files)) {
        const doc = await ConsignerDocumentService.uploadDocument(consignerId, file, label);
        setDocs((prev) => [...prev, doc]);
      }
      setLabelInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(doc: ConsignerDocument) {
    setDeletingId(doc.id);
    setError('');
    try {
      await ConsignerDocumentService.deleteDocument(doc);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      setError('Failed to delete document');
    } finally {
      setDeletingId(null);
    }
  }

  function openImage(doc: ConsignerDocument) {
    const imageDocs = docs.filter((d) => d.is_image);
    const index = imageDocs.findIndex((d) => d.id === doc.id);
    setLightbox({ docs: imageDocs, index: Math.max(0, index) });
  }

  function triggerDownload(doc: ConsignerDocument) {
    const a = document.createElement('a');
    a.href = doc.file_url;
    a.download = doc.file_name;
    a.target = '_blank';
    a.click();
    setDownloadConfirm(null);
  }

  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Paperclip className="h-4 w-4 text-ironbound-grey-500" />
        <h4 className="text-sm font-semibold text-ironbound-grey-800">ID Documents</h4>
        {docs.length > 0 && (
          <span className="text-xs bg-ironbound-grey-100 text-ironbound-grey-600 px-2 py-0.5 rounded-full">
            {docs.length}
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <input
          type="text"
          value={labelInput}
          onChange={(e) => setLabelInput(e.target.value)}
          placeholder="Label (optional) e.g. Driver's License, Passport"
          className="w-full px-3 py-2 border border-ironbound-grey-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
        />

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all
            ${dragOver
              ? 'border-ironbound-orange-400 bg-ironbound-orange-50'
              : 'border-ironbound-grey-300 hover:border-ironbound-orange-300 hover:bg-ironbound-grey-50'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          {uploading ? (
            <div className="flex items-center justify-center space-x-2 text-ironbound-grey-600">
              <Loader className="h-4 w-4 animate-spin" />
              <span className="text-sm">Uploading...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-2 text-ironbound-grey-500">
              <Upload className="h-4 w-4" />
              <span className="text-sm">
                Drop files here or <span className="text-ironbound-orange-500 font-medium">browse</span>
              </span>
            </div>
          )}
          <p className="text-xs text-ironbound-grey-400 mt-1">Images, PDFs, Word docs accepted</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader className="h-5 w-5 animate-spin text-ironbound-grey-400" />
        </div>
      ) : docs.length === 0 ? (
        <p className="text-xs text-ironbound-grey-400 text-center py-4">No documents attached yet</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center space-x-3 p-3 bg-ironbound-grey-50 border border-ironbound-grey-200 rounded-lg group"
            >
              <div className="flex-shrink-0">
                {doc.is_image ? (
                  <div className="w-10 h-10 rounded-md overflow-hidden border border-ironbound-grey-200 bg-white">
                    <img
                      src={doc.file_url}
                      alt={doc.file_name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-500" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {doc.document_label || doc.file_name}
                </p>
                <p className="text-xs text-ironbound-grey-400 truncate">
                  {doc.document_label ? doc.file_name + ' · ' : ''}
                  {formatBytes(doc.file_size)}
                </p>
              </div>

              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {doc.is_image ? (
                  <button
                    onClick={() => openImage(doc)}
                    title="View"
                    className="p-1.5 text-ironbound-grey-500 hover:text-ironbound-grey-800 hover:bg-white rounded-md transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => setDownloadConfirm(doc)}
                    title="Download"
                    className="p-1.5 text-ironbound-grey-500 hover:text-blue-600 hover:bg-white rounded-md transition-colors"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                )}
                {doc.is_image && (
                  <button
                    onClick={() => setDownloadConfirm(doc)}
                    title="Download"
                    className="p-1.5 text-ironbound-grey-500 hover:text-blue-600 hover:bg-white rounded-md transition-colors"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(doc)}
                  disabled={deletingId === doc.id}
                  title="Delete"
                  className="p-1.5 text-ironbound-grey-400 hover:text-red-600 hover:bg-white rounded-md transition-colors"
                >
                  {deletingId === doc.id ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {lightbox && (
        <ImageLightbox
          state={lightbox}
          onClose={() => setLightbox(null)}
          onChange={(index) => setLightbox((prev) => prev ? { ...prev, index } : null)}
        />
      )}

      {downloadConfirm && (
        <DownloadConfirmModal
          doc={downloadConfirm}
          onConfirm={() => triggerDownload(downloadConfirm)}
          onCancel={() => setDownloadConfirm(null)}
        />
      )}
    </div>
  );
}
