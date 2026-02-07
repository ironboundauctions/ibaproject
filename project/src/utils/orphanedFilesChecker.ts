/**
 * Orphaned Files Checker for Auction FE RAID Account
 *
 * Checks for files that exist in RAID but have no database records,
 * or database records that point to non-existent files.
 *
 * ONLY checks files uploaded by auction FE (source_user_id IS NULL)
 * NEVER touches IronDrive picker files (source_user_id NOT NULL)
 */

import { supabase } from '../lib/supabase';

const SERVICE_USER_ID = 'e9478d39-cde3-4184-bf0b-0e198ef029d2';
const IRONDRIVE_API = 'https://raid.ibaproject.bid';

interface OrphanedFileReport {
  orphanedInRaid: Array<{
    file_key: string;
    reason: string;
  }>;
  orphanedInDatabase: Array<{
    file_key: string;
    item_id: string | null;
    reason: string;
  }>;
  unassignedFiles: Array<{
    file_key: string;
    reason: string;
  }>;
  summary: {
    totalRaidFiles: number;
    totalDbRecords: number;
    orphanedRaidCount: number;
    orphanedDbCount: number;
    unassignedCount: number;
    estimatedStorageWasted: string;
  };
}

export class OrphanedFilesChecker {
  /**
   * List all files in the auction FE's RAID account
   */
  private static async listRaidFiles(): Promise<string[]> {
    try {
      const response = await fetch(`${IRONDRIVE_API}/list-files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': SERVICE_USER_ID
        },
        body: JSON.stringify({
          userId: SERVICE_USER_ID,
          path: '' // Root path
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to list files: ${response.status}`);
      }

      const data = await response.json();

      // Extract file keys from the response
      // Assuming response format: { files: [{ filename: string, size: number, ... }] }
      const files = data.files || [];

      return files.map((f: any) => `${SERVICE_USER_ID}/${f.filename}`);
    } catch (error) {
      console.error('[ORPHAN CHECK] Error listing RAID files:', error);
      throw error;
    }
  }

  /**
   * Get all auction FE file records from database
   */
  private static async getDbFileRecords(): Promise<Array<{
    file_key: string;
    item_id: string;
    name: string;
    size: number;
    source_user_id: string | null;
  }>> {
    const { data, error } = await supabase
      .from('auction_files')
      .select('file_key, item_id, name, size, source_user_id')
      .is('source_user_id', null); // Only auction FE uploads

    if (error) {
      console.error('[ORPHAN CHECK] Error fetching database records:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Check if a file exists in RAID
   */
  private static async fileExistsInRaid(file_key: string): Promise<boolean> {
    try {
      const [, ...parts] = file_key.split('/');
      const filename = parts.join('/');

      const response = await fetch(
        `${IRONDRIVE_API}/files/${SERVICE_USER_ID}/${encodeURIComponent(filename)}`,
        {
          method: 'HEAD',
          headers: {
            'X-User-Id': SERVICE_USER_ID
          }
        }
      );

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if item exists for a file record
   */
  private static async itemExistsForFile(item_id: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('id')
      .eq('id', item_id)
      .maybeSingle();

    return !error && data !== null;
  }

  /**
   * Run complete orphaned files check
   */
  static async checkOrphanedFiles(options?: {
    verifyRaidFiles?: boolean; // If true, checks each DB record against RAID (slow)
    dryRun?: boolean;
  }): Promise<OrphanedFileReport> {
    console.log('[ORPHAN CHECK] Starting orphaned files check...');
    console.log('[ORPHAN CHECK] Options:', options);

    const verifyRaidFiles = options?.verifyRaidFiles ?? false;

    // Step 1: Get all files from RAID
    console.log('[ORPHAN CHECK] Fetching files from RAID...');
    let raidFiles: string[] = [];
    let totalRaidSize = 0;
    try {
      raidFiles = await this.listRaidFiles();
      console.log(`[ORPHAN CHECK] Found ${raidFiles.length} files in RAID`);
    } catch (error) {
      console.error('[ORPHAN CHECK] Failed to list RAID files:', error);
      // Continue with empty list - we'll still check database orphans
    }

    // Step 2: Get all database records
    console.log('[ORPHAN CHECK] Fetching database records...');
    const dbRecords = await this.getDbFileRecords();
    console.log(`[ORPHAN CHECK] Found ${dbRecords.length} database records`);

    // Step 3: Find RAID files with no database record
    console.log('[ORPHAN CHECK] Checking for orphaned RAID files...');
    const dbFileKeys = new Set(dbRecords.map(r => r.file_key));
    const orphanedInRaid = raidFiles
      .filter(fileKey => !dbFileKeys.has(fileKey))
      .map(fileKey => ({
        file_key: fileKey,
        reason: 'File exists in RAID but has no database record'
      }));

    console.log(`[ORPHAN CHECK] Found ${orphanedInRaid.length} orphaned RAID files`);

    // Step 4: Find database records with no item or missing files
    console.log('[ORPHAN CHECK] Checking for orphaned database records...');
    const orphanedInDatabase = [];
    const unassignedFiles = [];
    const raidFileSet = new Set(raidFiles);

    for (const record of dbRecords) {
      // Track files with null item_id separately - these were never assigned
      if (!record.item_id) {
        unassignedFiles.push({
          file_key: record.file_key,
          reason: 'File uploaded but never assigned to an inventory item'
        });
        continue;
      }

      const itemExists = await this.itemExistsForFile(record.item_id);

      if (!itemExists) {
        orphanedInDatabase.push({
          file_key: record.file_key,
          item_id: record.item_id,
          reason: 'Database record exists but item was deleted'
        });
        continue;
      }

      // Check if file exists in RAID (if we have the list, otherwise optionally verify)
      if (raidFiles.length > 0) {
        if (!raidFileSet.has(record.file_key)) {
          orphanedInDatabase.push({
            file_key: record.file_key,
            item_id: record.item_id,
            reason: 'Database record exists but file missing from RAID'
          });
        }
      } else if (verifyRaidFiles) {
        console.log(`[ORPHAN CHECK] Verifying file in RAID: ${record.file_key}`);
        const fileExists = await this.fileExistsInRaid(record.file_key);
        if (!fileExists) {
          orphanedInDatabase.push({
            file_key: record.file_key,
            item_id: record.item_id,
            reason: 'Database record exists but file missing from RAID'
          });
        }
      }
    }

    console.log(`[ORPHAN CHECK] Found ${orphanedInDatabase.length} orphaned database records`);
    console.log(`[ORPHAN CHECK] Found ${unassignedFiles.length} unassigned files`);

    // Calculate wasted storage from orphaned and unassigned files
    const orphanedSizes = dbRecords
      .filter(r =>
        orphanedInRaid.some(o => o.file_key === r.file_key) ||
        unassignedFiles.some(u => u.file_key === r.file_key)
      )
      .reduce((sum, r) => sum + (r.size || 0), 0);

    const report: OrphanedFileReport = {
      orphanedInRaid,
      orphanedInDatabase,
      unassignedFiles,
      summary: {
        totalRaidFiles: raidFiles.length,
        totalDbRecords: dbRecords.length,
        orphanedRaidCount: orphanedInRaid.length,
        orphanedDbCount: orphanedInDatabase.length,
        unassignedCount: unassignedFiles.length,
        estimatedStorageWasted: this.formatBytes(orphanedSizes)
      }
    };

    console.log('[ORPHAN CHECK] Check complete!');
    console.log('[ORPHAN CHECK] Summary:', report.summary);

    return report;
  }

  /**
   * Clean up orphaned files (DELETE from RAID)
   *
   * WARNING: This is destructive! Only use after reviewing the report.
   */
  static async cleanupOrphanedFiles(
    fileKeys: string[],
    confirmCallback?: (fileKey: string) => Promise<boolean>
  ): Promise<{
    deleted: string[];
    failed: Array<{ file_key: string; error: string }>;
  }> {
    console.log(`[ORPHAN CLEANUP] Starting cleanup of ${fileKeys.length} files...`);

    const deleted: string[] = [];
    const failed: Array<{ file_key: string; error: string }> = [];

    for (const file_key of fileKeys) {
      try {
        // Optional confirmation callback
        if (confirmCallback) {
          const confirmed = await confirmCallback(file_key);
          if (!confirmed) {
            console.log(`[ORPHAN CLEANUP] Skipped: ${file_key}`);
            continue;
          }
        }

        // Delete from RAID
        // file_key format: "e9478d39-cde3-4184-bf0b-0e198ef029d2/uploads/image.png"
        // Extract filename by removing userId prefix
        const [userId, ...pathParts] = file_key.split('/');
        const filename = pathParts.join('/');

        // Encode each path segment separately to preserve slashes
        const encodedFilename = filename.split('/').map(encodeURIComponent).join('/');

        const response = await fetch(
          `${IRONDRIVE_API}/files/${SERVICE_USER_ID}/${encodedFilename}`,
          {
            method: 'DELETE',
            headers: {
              'X-User-Id': SERVICE_USER_ID
            }
          }
        );

        if (response.ok) {
          deleted.push(file_key);
          console.log(`[ORPHAN CLEANUP] Deleted: ${file_key}`);
        } else {
          const error = await response.text();
          failed.push({ file_key, error: `HTTP ${response.status}: ${error}` });
          console.error(`[ORPHAN CLEANUP] Failed: ${file_key} - ${error}`);
        }
      } catch (error) {
        failed.push({
          file_key,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        console.error(`[ORPHAN CLEANUP] Error deleting ${file_key}:`, error);
      }
    }

    console.log(`[ORPHAN CLEANUP] Complete. Deleted: ${deleted.length}, Failed: ${failed.length}`);

    return { deleted, failed };
  }

  /**
   * Clean up orphaned database records
   */
  static async cleanupOrphanedDbRecords(
    records: Array<{ file_key: string; item_id: string | null }>
  ): Promise<{
    deleted: number;
    failed: Array<{ file_key: string; error: string }>;
  }> {
    console.log(`[ORPHAN DB CLEANUP] Starting cleanup of ${records.length} records...`);

    const failed: Array<{ file_key: string; error: string }> = [];
    let deleted = 0;

    for (const record of records) {
      try {
        // Build query with proper null handling
        let query = supabase
          .from('auction_files')
          .delete()
          .eq('file_key', record.file_key);

        // Handle null item_id properly - use .is() instead of .eq()
        if (record.item_id === null) {
          query = query.is('item_id', null);
        } else {
          query = query.eq('item_id', record.item_id);
        }

        const { error } = await query;

        if (error) {
          failed.push({ file_key: record.file_key, error: error.message });
        } else {
          deleted++;
          console.log(`[ORPHAN DB CLEANUP] Deleted record: ${record.file_key}`);
        }
      } catch (error) {
        failed.push({
          file_key: record.file_key,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`[ORPHAN DB CLEANUP] Complete. Deleted: ${deleted}, Failed: ${failed.length}`);

    return { deleted, failed };
  }

  /**
   * Generate human-readable report
   */
  static generateReport(report: OrphanedFileReport): string {
    let output = '';

    output += '='.repeat(80) + '\n';
    output += 'ORPHANED FILES REPORT - Auction FE RAID Account\n';
    output += '='.repeat(80) + '\n\n';

    output += 'SUMMARY:\n';
    output += '-'.repeat(80) + '\n';
    output += `Total files in RAID:         ${report.summary.totalRaidFiles}\n`;
    output += `Total database records:      ${report.summary.totalDbRecords}\n`;
    output += `Orphaned files (RAID):       ${report.summary.orphanedRaidCount}\n`;
    output += `Orphaned records (Database): ${report.summary.orphanedDbCount}\n`;
    output += `Unassigned files:            ${report.summary.unassignedCount}\n`;
    output += `Estimated storage wasted:    ${report.summary.estimatedStorageWasted}\n`;
    output += '\n';

    if (report.orphanedInRaid.length > 0) {
      output += 'ORPHANED FILES IN RAID:\n';
      output += '-'.repeat(80) + '\n';
      report.orphanedInRaid.forEach((item, i) => {
        output += `${i + 1}. ${item.file_key}\n`;
        output += `   Reason: ${item.reason}\n\n`;
      });
    } else {
      output += 'No orphaned files found in RAID.\n\n';
    }

    if (report.orphanedInDatabase.length > 0) {
      output += 'ORPHANED RECORDS IN DATABASE:\n';
      output += '-'.repeat(80) + '\n';
      report.orphanedInDatabase.forEach((item, i) => {
        output += `${i + 1}. ${item.file_key}\n`;
        output += `   Item ID: ${item.item_id}\n`;
        output += `   Reason: ${item.reason}\n\n`;
      });
    } else {
      output += 'No orphaned database records found.\n\n';
    }

    if (report.unassignedFiles.length > 0) {
      output += 'UNASSIGNED FILES:\n';
      output += '-'.repeat(80) + '\n';
      report.unassignedFiles.forEach((item, i) => {
        output += `${i + 1}. ${item.file_key}\n`;
        output += `   Reason: ${item.reason}\n\n`;
      });
    } else {
      output += 'No unassigned files found.\n\n';
    }

    output += '='.repeat(80) + '\n';
    output += 'END OF REPORT\n';
    output += '='.repeat(80) + '\n';

    return output;
  }

  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
