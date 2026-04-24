import React, { useState } from 'react';
import { Trash2, AlertTriangle, CheckCircle, XCircle, Loader2, Database } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
  detached_at: string | null;
  issue: string;
  issueType: 'no_storage' | 'never_assigned' | 'item_gone' | 'stale_detached';
}

interface CleanupResult {
  success: boolean;
  recordId: string;
  name: string;
  message: string;
}

const STALE_HOURS = 24;

export function OrphanedRecordsCleanup() {
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [orphaned, setOrphaned] = useState<OrphanedRecord[]>([]);
  const [results, setResults] = useState<CleanupResult[]>([]);
  const [hasScanned, setHasScanned] = useState(false);

  const scan = async () => {
    setScanning(true);
    setOrphaned([]);
    setResults([]);

    try {
      const staleThreshold = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();

      const [filesResult, itemsResult] = await Promise.all([
        supabase
          .from('auction_files')
          .select('id, asset_group_id, variant, original_name, cdn_url, b2_key, bytes, item_id, created_at, detached_at')
          .lt('created_at', staleThreshold),
        supabase
          .from('inventory_items')
          .select('id'),
      ]);

      if (filesResult.error) throw filesResult.error;
      if (itemsResult.error) throw itemsResult.error;

      const allItemIds = new Set((itemsResult.data || []).map((i: any) => i.id));
      const found: OrphanedRecord[] = [];

      for (const f of filesResult.data || []) {
        let issue = '';
        let issueType: OrphanedRecord['issueType'] | null = null;

        if (!f.cdn_url && !f.b2_key && !f.detached_at) {
          issue = 'No storage URL — stale incomplete upload';
          issueType = 'no_storage';
        } else if (f.item_id === null && !f.detached_at) {
          issue = `No linked item after ${STALE_HOURS}h — upload was never completed`;
          issueType = 'never_assigned';
        } else if (f.item_id !== null && !allItemIds.has(f.item_id)) {
          issue = 'Linked item was permanently deleted from the system';
          issueType = 'item_gone';
        } else if (f.detached_at) {
          const detachedAge = Date.now() - new Date(f.detached_at).getTime();
          const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
          if (detachedAge > sevenDaysMs) {
            issue = 'Removed from item 7+ days ago — worker likely missed this deletion';
            issueType = 'stale_detached';
          }
        }

        if (issue && issueType) {
          found.push({
            id: f.id,
            asset_group_id: f.asset_group_id,
            variant: f.variant,
            original_name: f.original_name,
            cdn_url: f.cdn_url,
            b2_key: f.b2_key,
            bytes: f.bytes,
            item_id: f.item_id,
            created_at: f.created_at,
            detached_at: f.detached_at,
            issue,
            issueType,
          });
        }
      }

      setOrphaned(found);
      setHasScanned(true);
    } catch (err) {
      console.error('[DB Cleanup] Scan error:', err);
      alert(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const cleanup = async () => {
    if (!confirm(
      `PERMANENT DELETION\n\n` +
      `This removes ${orphaned.length} orphaned database record${orphaned.length !== 1 ? 's' : ''}.\n\n` +
      `Records with a B2 file attached will still have the file in B2 — run "B2 Bucket Cleanup" afterward to remove those.\n\n` +
      `This cannot be undone. Continue?`
    )) return;

    setCleaning(true);
    const out: CleanupResult[] = [];

    for (const record of orphaned) {
      try {
        const { error } = await supabase
          .from('auction_files')
          .delete()
          .eq('id', record.id);

        if (error) throw error;
        out.push({ success: true, recordId: record.id, name: record.original_name || 'Unknown', message: 'Deleted' });
      } catch (err) {
        out.push({
          success: false,
          recordId: record.id,
          name: record.original_name || 'Unknown',
          message: err instanceof Error ? err.message : 'Failed',
        });
      }
    }

    setResults(out);
    setCleaning(false);

    const ok = out.filter(r => r.success).length;
    alert(`Done. Deleted ${ok} of ${orphaned.length} records.`);
    await scan();
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const issueColor: Record<OrphanedRecord['issueType'], string> = {
    no_storage: 'text-gray-600',
    never_assigned: 'text-amber-700',
    item_gone: 'text-red-600',
    stale_detached: 'text-orange-600',
  };

  const counts = {
    no_storage: orphaned.filter(r => r.issueType === 'no_storage').length,
    never_assigned: orphaned.filter(r => r.issueType === 'never_assigned').length,
    item_gone: orphaned.filter(r => r.issueType === 'item_gone').length,
    stale_detached: orphaned.filter(r => r.issueType === 'stale_detached').length,
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-1">
        <Database className="w-5 h-5 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900">Database Records Cleanup</h2>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Finds <code className="bg-gray-100 px-1 rounded text-xs">auction_files</code> rows that no longer have a valid reason to exist. Only removes the database row — use B2 Bucket Cleanup afterward to remove the actual files from storage.
      </p>

      <div className="mb-5 grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
          <div className="font-semibold text-gray-700 mb-1">What this detects</div>
          <ul className="space-y-1 text-gray-600">
            <li>Records with no CDN URL and no B2 key (stale failed uploads, &gt;{STALE_HOURS}h old)</li>
            <li>Records with no linked item after {STALE_HOURS}h (upload was abandoned)</li>
            <li>Records whose linked item was permanently deleted</li>
            <li>Records detached from an item 7+ days ago that the worker never cleaned up</li>
          </ul>
        </div>
        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
          <div className="font-semibold text-amber-800 mb-1">What this does NOT touch</div>
          <ul className="space-y-1 text-amber-700">
            <li>Items in "Recently Removed" (soft-deleted) — their files are preserved for restore</li>
            <li>Files uploaded in the last {STALE_HOURS}h (may still be in progress)</li>
            <li>Actual B2 storage — only DB rows are removed here</li>
          </ul>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={scan}
          disabled={scanning || cleaning}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
        >
          {scanning && <Loader2 className="w-4 h-4 animate-spin" />}
          {scanning ? 'Scanning...' : 'Scan Database Records'}
        </button>

        {orphaned.length > 0 && (
          <button
            onClick={cleanup}
            disabled={scanning || cleaning}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {cleaning ? 'Deleting...' : `Delete ${orphaned.length} Record${orphaned.length !== 1 ? 's' : ''}`}
          </button>
        )}
      </div>

      {orphaned.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-3 flex-wrap">
            <h3 className="text-base font-semibold text-gray-900">
              {orphaned.length} Orphaned Record{orphaned.length !== 1 ? 's' : ''} Found
            </h3>
            <div className="flex gap-2 text-xs flex-wrap">
              {counts.item_gone > 0 && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full">{counts.item_gone} item deleted</span>}
              {counts.never_assigned > 0 && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">{counts.never_assigned} never assigned</span>}
              {counts.stale_detached > 0 && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">{counts.stale_detached} stale detached</span>}
              {counts.no_storage > 0 && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{counts.no_storage} no storage</span>}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">File</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Variant</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Issue</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orphaned.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 truncate max-w-xs">{r.original_name || 'Unknown'}</div>
                      <div className="text-xs text-gray-400 font-mono">{r.id.slice(0, 8)}…</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-mono">{r.variant}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${issueColor[r.issueType]}`}>{r.issue}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatBytes(r.bytes)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="mb-6 space-y-1">
          {results.map((r, i) => (
            <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${r.success ? 'bg-green-50' : 'bg-red-50'}`}>
              {r.success
                ? <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                : <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />}
              <span className={r.success ? 'text-green-800' : 'text-red-800'}>{r.name}</span>
              {!r.success && <span className="text-red-600 text-xs ml-auto">{r.message}</span>}
            </div>
          ))}
        </div>
      )}

      {hasScanned && orphaned.length === 0 && (
        <div className="text-center py-10">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No orphaned records found</p>
          <p className="text-sm text-gray-400 mt-1">Your database is clean</p>
        </div>
      )}
    </div>
  );
}
