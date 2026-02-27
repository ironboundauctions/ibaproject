import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PublishJob {
  id: string;
  file_id: string;
  asset_group_id: string;
  status: string;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface JobStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export default function PublishJobsMonitor() {
  const [jobs, setJobs] = useState<PublishJob[]>([]);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const [jobsResult, statsResult] = await Promise.all([
        supabase
          .from('publish_jobs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('publish_jobs')
          .select('status')
      ]);

      if (jobsResult.error) throw jobsResult.error;
      setJobs(jobsResult.data || []);

      if (!statsResult.error && statsResult.data) {
        const counts = statsResult.data.reduce((acc, job) => {
          acc[job.status] = (acc[job.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        setStats({
          total: statsResult.data.length,
          pending: counts.pending || 0,
          processing: counts.processing || 0,
          completed: counts.completed || 0,
          failed: counts.failed || 0
        });
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'processing': return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'pending': return <Clock className="w-5 h-5 text-yellow-500" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Media Publishing Jobs</h2>
          <p className="text-gray-400 mt-1">Monitor the status of image processing jobs</p>
        </div>
        <button
          onClick={fetchJobs}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-ironbound-orange-500 text-white rounded hover:bg-ironbound-orange-600 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Total Jobs</div>
            <div className="text-3xl font-bold text-white mt-1">{stats.total}</div>
          </div>
          <div className="bg-yellow-900/30 rounded-lg p-4">
            <div className="text-yellow-400 text-sm">Pending</div>
            <div className="text-3xl font-bold text-yellow-300 mt-1">{stats.pending}</div>
          </div>
          <div className="bg-blue-900/30 rounded-lg p-4">
            <div className="text-blue-400 text-sm">Processing</div>
            <div className="text-3xl font-bold text-blue-300 mt-1">{stats.processing}</div>
          </div>
          <div className="bg-green-900/30 rounded-lg p-4">
            <div className="text-green-400 text-sm">Completed</div>
            <div className="text-3xl font-bold text-green-300 mt-1">{stats.completed}</div>
          </div>
          <div className="bg-red-900/30 rounded-lg p-4">
            <div className="text-red-400 text-sm">Failed</div>
            <div className="text-3xl font-bold text-red-300 mt-1">{stats.failed}</div>
          </div>
        </div>
      )}

      {/* Recent Jobs Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Recent Jobs (Last 20)</h3>
        </div>
        {jobs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400">No jobs found</p>
            <p className="text-gray-500 text-sm mt-1">Jobs will appear here when images are uploaded from IronDrive</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Asset Group</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Retries</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {jobs.map(job => (
                  <tr key={job.id} className="hover:bg-gray-700/30">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.status)}
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${getStatusColor(job.status)}`}>
                          {job.status.toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-300 font-mono">{job.asset_group_id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-400">
                        {new Date(job.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {job.retry_count > 0 && (
                        <span className="text-sm text-orange-400">{job.retry_count}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {job.error_message && (
                        <div className="text-sm text-red-400 max-w-md truncate" title={job.error_message}>
                          {job.error_message}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Worker Status Help */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-blue-300 font-semibold mb-1">Worker Status</h4>
            <p className="text-blue-200 text-sm">
              Jobs stuck in "pending" means the worker isn't running. Jobs in "processing" for a long time may indicate worker issues.
              Check Railway logs if jobs aren't completing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
