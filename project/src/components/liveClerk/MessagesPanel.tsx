import React, { useState } from 'react';
import { Send, Trash2 } from 'lucide-react';

interface MessagesPanelProps {
  title: string;
  placeholder?: string;
  onSend?: (message: string, preset?: string) => void;
  disabled?: boolean;
  presets?: string[];
}

export default function MessagesPanel({ title, placeholder = 'Type a message...', onSend, disabled, presets }: MessagesPanelProps) {
  const [message, setMessage] = useState('');
  const [log, setLog] = useState<string[]>([]);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setLog(prev => [...prev, trimmed]);
    onSend?.(trimmed);
    setMessage('');
  };

  const handlePreset = (preset: string) => {
    setLog(prev => [...prev, preset]);
    onSend?.(preset, preset);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
        <span className="text-xs font-semibold text-ironbound-grey-300 uppercase tracking-wider">{title}</span>
        <button
          onClick={() => setLog([])}
          className="flex items-center gap-1 text-xs text-ironbound-grey-500 hover:text-red-400 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 bg-ironbound-grey-950 rounded border border-ironbound-grey-700 p-2 font-mono text-xs space-y-0.5 mb-2">
        {log.length === 0 ? (
          <p className="text-ironbound-grey-600 italic">No messages yet...</p>
        ) : (
          log.map((msg, i) => (
            <div key={i} className="text-ironbound-grey-300 leading-relaxed">{msg}</div>
          ))
        )}
      </div>

      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2 flex-shrink-0">
          {presets.map(preset => (
            <button
              key={preset}
              onClick={() => handlePreset(preset)}
              disabled={disabled}
              className="px-2 py-0.5 text-xs bg-ironbound-grey-700 hover:bg-ironbound-grey-600 text-ironbound-grey-200 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {preset}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-1.5 flex-shrink-0">
        <input
          type="text"
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !disabled && handleSend()}
          placeholder={disabled ? 'Auction not running' : placeholder}
          disabled={disabled}
          className="flex-1 min-w-0 px-2 py-1.5 text-xs bg-ironbound-grey-800 border border-ironbound-grey-600 rounded text-white placeholder-ironbound-grey-600 focus:outline-none focus:border-ironbound-orange-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          className="px-2.5 py-1.5 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
