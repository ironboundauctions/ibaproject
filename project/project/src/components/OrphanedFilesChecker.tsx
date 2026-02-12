import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Download, Trash2, RefreshCw } from 'lucide-react';
import { OrphanedFilesChecker } from '../utils/orphanedFilesChecker';

export default function OrphanedFilesCheckerUI() {
  const [isChecking, setIsChecking] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState('');
  const [cleanupResult, setCleanupResult] = useState<any>(null);
  const [verifyRaidFiles, setVerifyRaidFiles] = useState(false);

  const handleCheck = async () => {
    setIsChecking(true);
    setError('');
    setReport(null);
    setCleanupResult(null);

    try {
      const result = await OrphanedFilesChecker.checkOrphanedFiles({
        verifyRaidFiles,
        dryRun: true
      });
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check orphaned files');
    } finally {
      setIsChecking(false);
    }
  };

  const handleCleanupRaidFiles = async () => {
    if (!report || report.orphanedInRaid.length === 0) return;

    if (!confirm(
      `This will DELETE ${report.orphanedInRaid.length} files from RAID permanently!\n\n` +
      `Are you sure you want to continue?`
    )) {
      return;
    }

    setIsCleaning(true);
    setError('');

    try {
      const fileKeys = report.orphanedInRaid.map((f: any) => f.file_key);
      const result = await OrphanedFilesChecker.cleanupOrphanedFiles(fileKeys);
      setCleanupResult(result);

      // Re-run check after cleanup
      await handleCheck();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cleanup files');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleCleanupDbRecords = async () => {
    if (!report || report.orphanedInDatabase.length === 0) return;

    if (!confirm(
      `This will DELETE ${report.orphanedInDatabase.length} database records permanently!\n\n` +
      `Are you sure you want to continue?`
    )) {
      return;
    }

    setIsCleaning(true);
    setError('');

    try {
      const records = report.orphanedInDatabase.map((r: any) => ({
        file_key: r.file_key,
        item_id: r.item_id
      }));
      const result = await OrphanedFilesChecker.cleanupOrphanedDbRecords(records);
      setCleanupResult(result);

      // Re-run check after cleanup
      await handleCheck();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cleanup database records');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleDownloadReport = () => {
    if (!report) return;

    const reportText = OrphanedFilesChecker.generateReport(report);
    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orphaned-files-report-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-ironbound-grey-900">
            Orphaned Files Checker
          </h3>
          <p className="text-sm text-ironbound-grey-600 mt-1">
            Check for files in RAID with no database records, and vice versa
          </p>
        </div>
      </div>

      {/* Options */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="font-semibold text-sm text-blue-900 mb-3">Check Options</h4>
        <label className="flex items-start space-x-3">
          <input
            type="checkbox"
            checked={verifyRaidFiles}
            onChange={(e) => setVerifyRaidFiles(e.target.checked)}
            className="mt-1"
          />
          <div>
            <span className="text-sm text-blue-900 font-medium">
              Verify each database record against RAID
            </span>
            <p className="text-xs text-blue-700 mt-1">
              Checks if files referenced in database actually exist in RAID. This is slower but more thorough.
            </p>
          </div>
        </label>
      </div>

      {/* Actions */}
      <div className="flex space-x-3 mb-6">
        <button
          onClick={handleCheck}
          disabled={isChecking || isCleaning}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {isChecking ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Checking...</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              <span>Run Check</span>
            </>
          )}
        </button>

        {report && (
          <button
            onClick={handleDownloadReport}
            className="px-4 py-2 bg-ironbound-grey-600 text-white rounded-lg hover:bg-ironbound-grey-700 flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Download Report</span>
          </button>
        )}
      </div>

      {/* Error Display */}
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

      {/* Cleanup Result */}
      {cleanupResult && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-green-900">Cleanup Complete</h4>
              <p className="text-sm text-green-700 mt-1">
                Deleted: {cleanupResult.deleted?.length || cleanupResult.deleted || 0}
                {cleanupResult.failed?.length > 0 && (
                  <span className="text-red-600">
                    {' '}• Failed: {cleanupResult.failed.length}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Report Display */}
      {report && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-900">
                {report.summary.totalRaidFiles}
              </div>
              <div className="text-xs text-blue-700 mt-1">Total RAID Files</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-900">
                {report.summary.totalDbRecords}
              </div>
              <div className="text-xs text-green-700 mt-1">DB Records</div>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="text-2xl font-bold text-orange-900">
                {report.summary.orphanedRaidCount}
              </div>
              <div className="text-xs text-orange-700 mt-1">Orphaned in RAID</div>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="text-2xl font-bold text-red-900">
                {report.summary.orphanedDbCount}
              </div>
              <div className="text-xs text-red-700 mt-1">Orphaned in DB</div>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-900">
                {report.summary.unassignedCount}
              </div>
              <div className="text-xs text-yellow-700 mt-1">Unassigned Files</div>
            </div>
          </div>

          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-sm text-purple-900">
              <strong>Estimated Storage Wasted:</strong> {report.summary.estimatedStorageWasted}
            </div>
          </div>

          {/* Orphaned Files in RAID */}
          {report.orphanedInRaid.length > 0 && (
            <div className="border border-orange-200 rounded-lg overflow-hidden">
              <div className="bg-orange-50 px-4 py-3 border-b border-orange-200 flex items-center justify-between">
                <h4 className="font-semibold text-orange-900">
                  Orphaned Files in RAID ({report.orphanedInRaid.length})
                </h4>
                <button
                  onClick={handleCleanupRaidFiles}
                  disabled={isCleaning}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:bg-gray-400 flex items-center space-x-2"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>{isCleaning ? 'Cleaning...' : 'Delete All'}</span>
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
                        Reason
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orange-100">
                    {report.orphanedInRaid.map((item: any, i: number) => (
                      <tr key={i} className="hover:bg-orange-50">
                        <td className="px-4 py-2 font-mono text-xs text-ironbound-grey-700">
                          {item.file_key}
                        </td>
                        <td className="px-4 py-2 text-xs text-ironbound-grey-600">
                          {item.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Orphaned Database Records */}
          {report.orphanedInDatabase.length > 0 && (
            <div className="border border-red-200 rounded-lg overflow-hidden">
              <div className="bg-red-50 px-4 py-3 border-b border-red-200 flex items-center justify-between">
                <h4 className="font-semibold text-red-900">
                  Orphaned Database Records ({report.orphanedInDatabase.length})
                </h4>
                <button
                  onClick={handleCleanupDbRecords}
                  disabled={isCleaning}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:bg-gray-400 flex items-center space-x-2"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>{isCleaning ? 'Cleaning...' : 'Delete All'}</span>
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-red-100 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-red-900">
                        File Key
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-red-900">
                        Item ID
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-red-900">
                        Reason
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                    {report.orphanedInDatabase.map((item: any, i: number) => (
                      <tr key={i} className="hover:bg-red-50">
                        <td className="px-4 py-2 font-mono text-xs text-ironbound-grey-700">
                          {item.file_key}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-ironbound-grey-600">
                          {item.item_id}
                        </td>
                        <td className="px-4 py-2 text-xs text-ironbound-grey-600">
                          {item.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Unassigned Files */}
          {report.unassignedFiles && report.unassignedFiles.length > 0 && (
            <div className="border border-yellow-200 rounded-lg overflow-hidden">
              <div className="bg-yellow-50 px-4 py-3 border-b border-yellow-200 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-yellow-900">
                    Unassigned Files ({report.unassignedFiles.length})
                  </h4>
                  <p className="text-xs text-yellow-700 mt-1">
                    Files uploaded but never assigned to inventory items. Safe to delete if you're starting fresh.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (!confirm(
                      `This will DELETE ${report.unassignedFiles.length} unassigned file records permanently!\n\n` +
                      `Are you sure you want to continue?`
                    )) return;

                    setIsCleaning(true);
                    const records = report.unassignedFiles.map((r: any) => ({
                      file_key: r.file_key,
                      item_id: null
                    }));
                    OrphanedFilesChecker.cleanupOrphanedDbRecords(records)
                      .then((result) => {
                        setCleanupResult(result);
                        handleCheck();
                      })
                      .catch((err) => setError(err.message))
                      .finally(() => setIsCleaning(false));
                  }}
                  disabled={isCleaning}
                  className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 disabled:bg-gray-400 flex items-center space-x-2"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>{isCleaning ? 'Cleaning...' : 'Delete All'}</span>
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-yellow-100 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-yellow-900">
                        File Key
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-yellow-900">
                        Reason
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-yellow-100">
                    {report.unassignedFiles.map((item: any, i: number) => (
                      <tr key={i} className="hover:bg-yellow-50">
                        <td className="px-4 py-2 font-mono text-xs text-ironbound-grey-700">
                          {item.file_key}
                        </td>
                        <td className="px-4 py-2 text-xs text-ironbound-grey-600">
                          {item.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* No Issues Found */}
          {report.orphanedInRaid.length === 0 && report.orphanedInDatabase.length === 0 && report.unassignedFiles.length === 0 && (
            <div className="p-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-green-900 mb-2">
                No Orphaned Files Found!
              </h4>
              <p className="text-sm text-green-700">
                All files in RAID have corresponding database records, and all database records have valid items.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
