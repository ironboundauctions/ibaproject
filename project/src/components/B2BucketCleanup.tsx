import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Trash2, RefreshCw, Cloud, Database } from 'lucide-react';

interface OrphanedFile {
  key: string;
  size: number;
  lastModified: string;
}

interface CleanupReport {
  totalB2Files: number;
  totalDbAssetGroups: number;
  orphanedFiles: OrphanedFile[];
  estimatedWastedSpace: number;
  scanDuration: number;
}

export function B2BucketCleanup() {
  const [isScanning, setIsScanning] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [report, setReport] = useState<CleanupReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cleanupResult, setCleanupResult] = useState<{ deleted: number; failed: number } | null>(null);

  const handleScan = async () => {
    setIsScanning(true);
    setError(null);
    setReport(null);
    setCleanupResult(null);

    try {
      const workerUrl = import.meta.env.VITE_WORKER_URL;
      if (!workerUrl) {
        throw new Error('Worker URL not configured');
      }

      const response = await fetch(`${workerUrl}/api/scan-orphaned-b2-files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Scan failed');
      }

      const result = await response.json();
      setReport(result);
    } catch (err) {
      console.error('[B2BucketCleanup] Scan error:', err);
      setError(err instanceof Error ? err.message : 'Failed to scan B2 bucket');
    } finally {
      setIsScanning(false);
    }
  };

  const handleCleanup = async () => {
    if (!report || report.orphanedFiles.length === 0) return;

    if (!confirm(
      `This will DELETE ${report.orphanedFiles.length} orphaned files from B2 permanently!\n\n` +
      `Total space to free: ${formatBytes(report.estimatedWastedSpace)}\n\n` +
      `Are you sure you want to continue?`
    )) {
      return;
    }

    setIsCleaning(true);
    setError(null);

    try {
      const workerUrl = import.meta.env.VITE_WORKER_URL;
      if (!workerUrl) {
        throw new Error('Worker URL not configured');
      }

      const response = await fetch(`${workerUrl}/api/cleanup-orphaned-b2-files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileKeys: report.orphanedFiles.map(f => f.key),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Cleanup failed');
      }

      const result = await response.json();
      setCleanupResult({
        deleted: result.deleted || 0,
        failed: result.failed || 0,
      });

      // Re-scan after cleanup
      await handleScan();
    } catch (err) {
      console.error('[B2BucketCleanup] Cleanup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to cleanup B2 files');
    } finally {
      setIsCleaning(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900">
            B2 Bucket Cleanup
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Scan and remove orphaned files in Backblaze B2 that are no longer in the database
          </p>
        </div>
      </div>

      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="font-semibold text-sm text-blue-900 mb-2">About This Tool</h4>
        <p className="text-xs text-blue-800 leading-relaxed">
          This tool scans your B2 bucket for files that no longer have corresponding records in the database.
          This can happen when database records are deleted but files remain in storage. The scanner compares
          all asset group IDs in B2 against the auction_files table to identify orphaned files.
        </p>
      </div>

      <div className="flex space-x-3 mb-6">
        <button
          onClick={handleScan}
          disabled={isScanning || isCleaning}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {isScanning ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Scanning B2...</span>
            </>
          ) : (
            <>
              <Cloud className="h-4 w-4" />
              <span>Scan B2 Bucket</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-900">Error</h4>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {cleanupResult && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-green-900">Cleanup Complete</h4>
              <p className="text-sm text-green-700 mt-1">
                Deleted: {cleanupResult.deleted} files
                {cleanupResult.failed > 0 && (
                  <span className="text-red-600"> • Failed: {cleanupResult.failed}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {report && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <Cloud className="h-4 w-4 text-blue-600" />
                <div className="text-xs text-blue-700 font-medium">B2 Asset Groups</div>
              </div>
              <div className="text-2xl font-bold text-blue-900">
                {report.totalB2Files}
              </div>
            </div>

            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-1">
                <Database className="h-4 w-4 text-green-600" />
                <div className="text-xs text-green-700 font-medium">DB Asset Groups</div>
              </div>
              <div className="text-2xl font-bold text-green-900">
                {report.totalDbAssetGroups}
              </div>
            </div>

            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <div className="text-xs text-orange-700 font-medium">Orphaned Files</div>
              </div>
              <div className="text-2xl font-bold text-orange-900">
                {report.orphanedFiles.length}
              </div>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-1">
                <Trash2 className="h-4 w-4 text-purple-600" />
                <div className="text-xs text-purple-700 font-medium">Wasted Space</div>
              </div>
              <div className="text-2xl font-bold text-purple-900">
                {formatBytes(report.estimatedWastedSpace)}
              </div>
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-700">
              Scan completed in <strong>{(report.scanDuration / 1000).toFixed(2)}s</strong>
            </p>
          </div>

          {report.orphanedFiles.length > 0 ? (
            <div className="border border-orange-200 rounded-lg overflow-hidden">
              <div className="bg-orange-50 px-4 py-3 border-b border-orange-200 flex items-center justify-between">
                <h4 className="font-semibold text-orange-900">
                  Orphaned Files in B2 ({report.orphanedFiles.length})
                </h4>
                <button
                  onClick={handleCleanup}
                  disabled={isCleaning}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:bg-gray-400 flex items-center space-x-2"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>{isCleaning ? 'Deleting...' : 'Delete All Orphaned Files'}</span>
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-orange-100 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-orange-900">
                        File Key
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-orange-900">
                        Size
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-orange-900">
                        Last Modified
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orange-100">
                    {report.orphanedFiles.map((file, i) => (
                      <tr key={i} className="hover:bg-orange-50">
                        <td className="px-4 py-2 font-mono text-xs text-gray-700">
                          {file.key}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-600">
                          {formatBytes(file.size)}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-600">
                          {formatDate(file.lastModified)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-green-900 mb-2">
                No Orphaned Files Found!
              </h4>
              <p className="text-sm text-green-700">
                All files in B2 have corresponding records in the database. Your storage is clean!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
