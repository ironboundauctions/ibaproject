import React, { useState } from 'react';
import { Trash2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CleanupResult {
  success: boolean;
  recordId: string;
  name: string;
  message: string;
}

export function OrphanedRecordsCleanup() {
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [orphanedRecords, setOrphanedRecords] = useState<any[]>([]);
  const [cleanupResults, setCleanupResults] = useState<CleanupResult[]>([]);

  const scanForOrphaned = async () => {
    try {
      setScanning(true);
      setOrphanedRecords([]);
      setCleanupResults([]);

      const { data, error } = await supabase
        .from('auction_files')
        .select('*')
        .not('detached_at', 'is', null)
        .or('bytes.is.null,cdn_url.is.null');

      if (error) throw error;

      const orphaned = (data || []).filter(record => {
        const hasNoSize = !record.bytes || record.bytes === 0;
        const hasNoCdnUrl = !record.cdn_url;
        const isDetached = !!record.detached_at;

        return isDetached && (hasNoSize || hasNoCdnUrl);
      });

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
      `⚠️ PERMANENT DELETION\n\n` +
      `This will permanently delete ${orphanedRecords.length} orphaned database record${orphanedRecords.length !== 1 ? 's' : ''}.\n\n` +
      `These records have no actual files in B2 (null bytes/URL), so only database entries will be removed.\n\n` +
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
            message: 'Successfully deleted orphaned record'
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
        <h2 className="text-xl font-semibold text-gray-900">Orphaned Records Cleanup</h2>
      </div>

      <div className="mb-6">
        <p className="text-sm text-gray-600 mb-4">
          This tool scans for database records that are marked as removed but have no file data (null bytes or no CDN URL).
          These records likely represent files that never made it to B2 or were already deleted but left behind database entries.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
          <p className="text-sm text-amber-900">
            <strong>Note:</strong> Since these records have no actual files in B2, deletion only removes database entries.
            No files will be deleted from B2 or IronDrive.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={scanForOrphaned}
            disabled={scanning || cleaning}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {scanning ? 'Scanning...' : 'Scan for Orphaned Records'}
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
                    Variant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CDN URL
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Detached At
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
                      <div className="text-xs text-gray-500">{record.id}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.variant}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`text-sm ${!record.bytes ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                        {formatFileSize(record.bytes)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {record.cdn_url ? (
                        <span className="text-xs text-gray-500 truncate block max-w-xs">
                          {record.cdn_url}
                        </span>
                      ) : (
                        <span className="text-sm text-red-600 font-semibold">null</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                        {record.published_status}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.detached_at ? new Date(record.detached_at).toLocaleDateString() : 'N/A'}
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
