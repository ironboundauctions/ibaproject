import React, { useState, useEffect } from 'react';
import { X, ScrollText, ChevronDown, ChevronUp } from 'lucide-react';
import { LiveClerkService, HistoryLogEntry } from '../services/liveClerkService';
import { supabase } from '../lib/supabase';

interface Session {
  id: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

interface AuctionLogsModalProps {
  eventId: string;
  eventTitle: string;
  onClose: () => void;
}

const ENTRY_COLORS: Record<string, string> = {
  auction_start: 'text-green-600',
  auction_pause: 'text-yellow-600',
  auction_resume: 'text-green-600',
  auction_end: 'text-red-600',
  lot_start: 'text-blue-600',
  lot_sold: 'text-orange-600',
  lot_passed: 'text-gray-500',
  bid_posted: 'text-gray-600',
  message_sent: 'text-cyan-600',
  system: 'text-gray-400',
};

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatSessionDate(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AuctionLogsModal({ eventId, eventTitle, onClose }: AuctionLogsModalProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionLogs, setSessionLogs] = useState<Record<string, HistoryLogEntry[]>>({});
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [loadingSession, setLoadingSession] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, [eventId]);

  const loadSessions = async () => {
    try {
      const { data, error } = await supabase!
        .from('live_auction_sessions')
        .select('id, status, started_at, ended_at, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSessions((data || []) as Session[]);

      if (data && data.length > 0) {
        setExpandedSessions(new Set([data[0].id]));
        await loadLogsForSession(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLogsForSession = async (sessionId: string) => {
    if (sessionLogs[sessionId]) return;
    setLoadingSession(sessionId);
    try {
      const logs = await LiveClerkService.getHistoryLog(sessionId);
      setSessionLogs(prev => ({ ...prev, [sessionId]: logs }));
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoadingSession(null);
    }
  };

  const toggleSession = async (sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
    await loadLogsForSession(sessionId);
  };

  const statusColor = (status: string) => {
    if (status === 'running') return 'bg-green-100 text-green-700';
    if (status === 'paused') return 'bg-yellow-100 text-yellow-700';
    if (status === 'ended') return 'bg-gray-100 text-gray-600';
    return 'bg-blue-100 text-blue-700';
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-gray-100 rounded-lg p-2">
              <ScrollText className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Auction Logs</h2>
              <p className="text-sm text-gray-500">{eventTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors rounded-lg p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3">
          {isLoading ? (
            <div className="text-center py-12 text-gray-400">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <ScrollText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No auction sessions recorded yet.</p>
            </div>
          ) : (
            sessions.map((session, idx) => {
              const isExpanded = expandedSessions.has(session.id);
              const logs = sessionLogs[session.id] || [];
              const isLoadingThis = loadingSession === session.id;

              return (
                <div key={session.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleSession(session.id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700">
                        Session {sessions.length - idx}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(session.status)}`}>
                        {session.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {session.started_at
                          ? formatSessionDate(session.started_at)
                          : formatSessionDate(session.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      {!isLoadingThis && logs.length > 0 && (
                        <span className="text-xs">{logs.length} entries</span>
                      )}
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="bg-gray-950 font-mono text-xs p-3 max-h-72 overflow-y-auto">
                      {isLoadingThis ? (
                        <p className="text-gray-500 italic">Loading logs...</p>
                      ) : logs.length === 0 ? (
                        <p className="text-gray-600 italic">No log entries for this session.</p>
                      ) : (
                        <div className="space-y-0.5">
                          {logs.map(entry => (
                            <div key={entry.id} className="leading-relaxed">
                              <span className="text-gray-600 mr-1.5">[{formatTime(entry.created_at)}]</span>
                              <span className={ENTRY_COLORS[entry.entry_type] || 'text-gray-300'}>{entry.message}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
