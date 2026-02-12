import React from 'react';
import { Trash2, Download, Tag, X } from 'lucide-react';

interface BulkActionsProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkExport: () => void;
  onBulkStatusChange: (status: string) => void;
}

export default function BulkActions({
  selectedCount,
  onClearSelection,
  onBulkDelete,
  onBulkExport,
  onBulkStatusChange
}: BulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
      <div className="bg-white rounded-lg shadow-2xl border border-ironbound-grey-200 p-4 flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="bg-ironbound-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium">
            {selectedCount} selected
          </div>
          <button
            onClick={onClearSelection}
            className="p-1 hover:bg-ironbound-grey-100 rounded transition-colors"
            title="Clear selection"
          >
            <X className="h-4 w-4 text-ironbound-grey-600" />
          </button>
        </div>

        <div className="h-6 w-px bg-ironbound-grey-300"></div>

        <div className="flex items-center space-x-2">
          <select
            onChange={(e) => {
              if (e.target.value) {
                onBulkStatusChange(e.target.value);
                e.target.value = '';
              }
            }}
            className="px-3 py-2 border border-ironbound-grey-300 rounded-lg text-sm focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors"
            defaultValue=""
          >
            <option value="" disabled>Change Status</option>
            <option value="available">Available</option>
            <option value="assigned">Assigned</option>
            <option value="sold">Sold</option>
            <option value="returned">Returned</option>
            <option value="withdrawn">Withdrawn</option>
          </select>

          <button
            onClick={onBulkExport}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
            title="Export selected items"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>

          <button
            onClick={onBulkDelete}
            className="flex items-center space-x-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
            title="Delete selected items"
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
