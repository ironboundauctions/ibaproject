import React, { useState } from 'react';
import { Trash2, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CleanupResult {
  success: boolean;
  recordId: string;
  name: string;
  message: string;
}

interface OrphanedRecord {
  id: string;
  asset_group_id: string;
  variant: string;
  original_name: string;
  cdn_url: string | null;
  b2_key: string | null;
  bytes: number | null;
  item_id: string | null;
  created_at: string;
  issue: string;
}

const STALE_THRESHOLD_HOURS = 24;

export function OrphanedRecordsCleanup() {
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [orphanedRecords, setOrphanedRecords] = useState<OrphanedRecord[]>([]);
  const [cleanupResults, setCleanupResults] = useState<CleanupResult[]>([]);

  const scanForOrphaned = async () => {
    try {
      setScanning(true);
      setOrphanedRecords([]);
      setCleanupResults([]);

      const { data, error } = await supabase
        .from('auction_files')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Load all active inventory item IDs for fast lookup
      const { data: activeItems, error: itemsError } = await supabase
        .from('inventory_items')
        .select('id')
        .is('deleted_at', null);

      if (itemsError) throw itemsError;

      const activeItemIds = new Set((activeItems || []).map(i => i.id));

      const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000);
      const orphaned: OrphanedRecord[] = [];

      for (const record of data || []) {
        const createdAt = new Date(record.created_at);
        const isOld = createdAt < staleThreshold;
        let issue = '';

        if (!record.cdn_url && !record.b2_key) {
          // Only flag if record is old enough that it can't be mid-upload
          if (isOld) {
            issue = 'No CDN URL or B2 key (stale record)';
          }
        } else if (record.item_id === null) {
          // item_id = NULL is used legitimately during bulk/IronDrive upload workflows
          // Only flag as orphaned if the record is old (upload workflow long since finished)
          if (isOld) {
            issue = 'No item_id after 24h (never assigned to inventory)';
          }
        } else if (!activeItemIds.has(record.item_id)) {
          // item_id is set but points to a non-existent or soft-deleted item
          // Note: if ON DELETE CASCADE is active this shouldn't happen, but guard anyway
          if (isOld) {
            issue = 'item_id references deleted or missing inventory item';
          }
        }

        if (issue) {
          orphaned.push({
            id: record.id,
            asset_group_id: record.asset_group_id,
            variant: record.variant,
            original_name: record.original_name,
            cdn_url: record.cdn_url,
            b2_key: record.b2_key,
            bytes: record.bytes,
            item_id: record.item_id,
            created_at: record.created_at,
            issue
          });
        }
      }

      setOrphanedRecords(orphaned);
    } catch (err) {
      console.error('Error scanning for orphaned records:', err);
      alert(err instanceof Error ? err.message : 'Failed to scan for orphaned records');
    } finally {
      setScanning(false);
    }
  };

  const cleanupOrphaned = async () => {
    if (!confirm(
      `PERMANENT DELETION\n\n` +
      `This will permanently delete ${orphanedRecords.length} orphaned database record${orphanedRecords.length !== 1 ? 's' : ''}.\n\n` +
      `Only records older than ${STALE_THRESHOLD_HOURS} hours with no valid inventory item are included.\n` +
      `If B2 files exist for these records, they will NOT be deleted (use B2 Bucket Cleanup for that).\n\n` +
      `This action CANNOT be undone.\n\n` +
      `Continue?`
    )) {
      return;
    }

    try {
      setCleaning(true);
      const results: CleanupResult[] = [];

      for (const record of orphanedRecords) {
        try {
          const { error } = await supabase
            .from('auction_files')
            .delete()
            .eq('id', record.id);

          if (error) throw error;

          results.push({
            success: true,
            recordId: record.id,
            name: record.original_name || 'Unknown',
            message: `Deleted: ${record.issue}`
          });
        } catch (err) {
          results.push({
            success: false,
            recordId: record.id,
            name: record.original_name || 'Unknown',
            message: err instanceof Error ? err.message : 'Failed to delete'
          });
        }
      }

      setCleanupResults(results);

      const successCount = results.filter(r => r.success).length;
      alert(`Cleanup complete. Successfully deleted ${successCount} of ${orphanedRecords.length} records.`);

      await scanForOrphaned();
    } catch (err) {
      console.error('Error during cleanup:', err);
      alert(err instanceof Error ? err.message : 'Failed to cleanup orphaned records');
    } finally {
      setCleaning(false);
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return 'null B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-orange-600" />
        <h2 className="text-xl font-semibold text-gray-900">Database Records Cleanup</h2>
      </div>

      <div className="mb-6">
        <p className="text-sm text-gray-600 mb-4">
          Scans for database records that are genuinely orphaned. Records must be older than {STALE_THRESHOLD_HOURS} hours to be flagged — this prevents false positives from in-progress uploads.
        </p>
        <ul className="text-sm text-gray-600 mb-4 ml-6 list-disc space-y-1">
          <li>Records with no CDN URL or B2 key (stale, older than {STALE_THRESHOLD_HOURS}h)</li>
          <li>Records with NULL item_id that are older than {STALE_THRESHOLD_HOURS}h (never assigned)</li>
          <li>Records whose item_id points to a deleted or missing inventory item</li>
        </ul>

        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
          <p className="text-sm text-amber-900">
            <strong>Note:</strong> This only removes database entries. If B2 files exist, use "B2 Bucket Cleanup" to delete them from storage.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
          <p className="text-sm text-blue-900">
            <strong>Safe by design:</strong> Records with NULL item_id that are recent (less than {STALE_THRESHOLD_HOURS}h old) are intentionally skipped — the IronDrive bulk upload workflow creates file records before inventory items exist, so these are legitimate work-in-progress records.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={scanForOrphaned}
            disabled={scanning || cleaning}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
          >
            {scanning && <Loader2 className="w-4 h-4 animate-spin" />}
            {scanning ? 'Scanning Database...' : 'Scan Database Records'}
          </button>

          {orphanedRecords.length > 0 && (
            <button
              onClick={cleanupOrphaned}
              disabled={scanning || cleaning}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {cleaning ? 'Deleting...' : `Permanently Delete ${orphanedRecords.length} Record${orphanedRecords.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>

      {orphanedRecords.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Found {orphanedRecords.length} Orphaned Record{orphanedRecords.length !== 1 ? 's' : ''}
          </h3>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    File Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Asset Group
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Variant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Issue
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orphanedRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {record.original_name || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-500">{record.id.substring(0, 8)}...</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-xs text-gray-500 font-mono">
                        {record.asset_group_id.substring(0, 8)}...
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                        {record.variant}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-red-600 font-semibold">
                        {record.issue}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {record.item_id ? (
                        <span className="text-xs text-gray-500 font-mono">
                          {record.item_id.substring(0, 8)}...
                        </span>
                      ) : (
                        <span className="text-sm text-red-600 font-semibold">NULL</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatFileSize(record.bytes)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(record.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {cleanupResults.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Cleanup Results</h3>

          <div className="space-y-2">
            {cleanupResults.map((result, index) => (
              <div
                key={index}
                className={`flex items-start gap-2 p-3 rounded ${
                  result.success ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className={`text-sm font-medium ${result.success ? 'text-green-900' : 'text-red-900'}`}>
                    {result.name}
                  </div>
                  <div className={`text-xs ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                    {result.message}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-md">
            <p className="text-sm text-blue-900">
              <strong>Summary:</strong> {cleanupResults.filter(r => r.success).length} successful, {cleanupResults.filter(r => !r.success).length} failed
            </p>
          </div>
        </div>
      )}

      {orphanedRecords.length === 0 && !scanning && (
        <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <p className="text-gray-600">No orphaned records found. Your database is clean!</p>
        </div>
      )}
    </div>
  );
}
