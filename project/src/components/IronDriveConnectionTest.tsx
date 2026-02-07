import React, { useState } from 'react';
import { Wifi, WifiOff, AlertCircle, CheckCircle } from 'lucide-react';
import { IronDriveService } from '../services/ironDriveService';

interface IronDriveConnectionTestProps {
  onConnectionChange?: (connected: boolean) => void;
}

export default function IronDriveConnectionTest({ onConnectionChange }: IronDriveConnectionTestProps) {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const testConnection = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      const result = await IronDriveService.testConnection();
      setIsConnected(result.success);
      setMessage(result.message);
      onConnectionChange?.(result.success);
    } catch (error) {
      setIsConnected(false);
      setMessage('Connection test failed');
      onConnectionChange?.(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {isConnected === null ? (
            <Wifi className="h-6 w-6 text-ironbound-grey-400" />
          ) : isConnected ? (
            <CheckCircle className="h-6 w-6 text-green-600" />
          ) : (
            <WifiOff className="h-6 w-6 text-red-600" />
          )}
          <div>
            <h3 className="text-lg font-semibold text-ironbound-grey-900">RAID Storage Connection</h3>
            <p className="text-sm text-ironbound-grey-600">Direct connection to raid.ibaproject.bid</p>
          </div>
        </div>
        <button
          onClick={testConnection}
          disabled={isLoading}
          className="bg-ironbound-orange-500 hover:bg-ironbound-orange-600 disabled:bg-ironbound-grey-300 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Testing...</span>
            </>
          ) : (
            <>
              <Wifi className="h-4 w-4" />
              <span>Test Connection</span>
            </>
          )}
        </button>
      </div>

      {message && (
        <div className={`flex items-center space-x-2 p-3 rounded-lg ${
          isConnected 
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {isConnected ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span className="text-sm">{message}</span>
        </div>
      )}

      {isConnected && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-medium text-green-900 mb-2">✅ RAID Storage Active</h4>
          <ul className="text-sm text-green-800 space-y-1">
            <li>• Files uploaded directly to RAID server at raid.ibaproject.bid</li>
            <li>• Using service user: e9478d39-cde3-4184-bf0b-0e198ef029d2</li>
            <li>• File metadata stored in Supabase auction_files table</li>
            <li>• Download URLs cached for fast access</li>
            <li>• No cloud storage fees - uses your local RAID array</li>
          </ul>
        </div>
      )}

      {isConnected === false && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="font-medium text-red-900 mb-2">❌ Connection Failed</h4>
          <ul className="text-sm text-red-800 space-y-1">
            <li>• Check RAID server is online and accessible at raid.ibaproject.bid</li>
            <li>• Verify port forwarding is configured correctly</li>
            <li>• Ensure RAID API health endpoint is responding</li>
            <li>• Image uploads will be blocked until connection is restored</li>
          </ul>
          <div className="mt-3 pt-3 border-t border-red-300 space-y-1">
            <p className="text-xs text-red-700">
              <strong>RAID API:</strong> {import.meta.env.VITE_IRONDRIVE_API || 'Not configured'}
            </p>
            <p className="text-xs text-red-700">
              <strong>Service User ID:</strong> e9478d39-cde3-4184-bf0b-0e198ef029d2
            </p>
            <p className="text-xs text-red-700">
              <strong>Health Check:</strong> GET {import.meta.env.VITE_IRONDRIVE_API}/health
            </p>
          </div>
        </div>
      )}
    </div>
  );
}