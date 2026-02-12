import React, { useEffect, useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface RemovedFile {
  id: string;
  name: string;
  asset_group_id: string;
  deleted_at: string;
  item_id: string | null;
  mime_type: string;
  size: number;
  thumb_url: string | null;
  display_url: string | null;
}

export function RecentlyRemovedFiles() {
  const [removedFiles, setRemovedFiles] = useState<RemovedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRemovedFiles();
  }, []);

  const fetchRemovedFiles = async () => {
    try {
      setLoading(true);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('auction_files')
        .select('*')
        .not('deleted_at', 'is', null)
        .gte('deleted_at', thirtyDaysAgo.toISOString())
        .order('deleted_at', { ascending: false });

      if (error) throw error;

      setRemovedFiles(data || []);
    } catch (err) {
      console.error('Error fetching removed files:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch removed files');
    } finally {
      setLoading(false);
    }
  };

  const calculateDaysRemaining = (deletedAt: string): number => {
    const deleted = new Date(deletedAt);
    const now = new Date();
    const thirtyDaysLater = new Date(deleted);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    const diffMs = thirtyDaysLater.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  };

  const handleRestore = async (fileId: string) => {
    try {
      const { error } = await supabase
        .from('auction_files')
        .update({ deleted_at: null })
        .eq('id', fileId);

      if (error) throw error;

      await fetchRemovedFiles();
    } catch (err) {
      console.error('Error restoring file:', err);
      alert(err instanceof Error ? err.message : 'Failed to restore file');
    }
  };

  const handleDeleteNow = async (fileId: string) => {
    if (!confirm('Are you sure you want to permanently delete this file? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('auction_files')
        .delete()
        .eq('id', fileId);

      if (error) throw error;

      await fetchRemovedFiles();
    } catch (err) {
      console.error('Error deleting file:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete file');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900">Recently Removed Files</h2>
        </div>
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h2 className="text-xl font-semibold text-gray-900">Recently Removed Files</h2>
        </div>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <Trash2 className="w-5 h-5 text-gray-600" />
        <h2 className="text-xl font-semibold text-gray-900">Recently Removed Files</h2>
      </div>

      {removedFiles.length === 0 ? (
        <p className="text-gray-600">No recently removed files</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Files are kept for 30 days after removal. You can restore them during this period.
          </p>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    File
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Preview
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Days Remaining
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {removedFiles.map((file) => {
                  const daysRemaining = calculateDaysRemaining(file.deleted_at);
                  const isUrgent = daysRemaining <= 7;

                  return (
                    <tr key={file.id}>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{file.name}</div>
                        <div className="text-sm text-gray-500">{file.mime_type}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {file.thumb_url ? (
                          <img
                            src={file.thumb_url}
                            alt={file.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                            <span className="text-xs text-gray-400">No preview</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatFileSize(file.size)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            isUrgent
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRestore(file.id)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Restore
                          </button>
                          <button
                            onClick={() => handleDeleteNow(file.id)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete Now
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
