import React, { useState, useRef, useCallback } from 'react';
import { Plus, Trash2, Check, X } from 'lucide-react';
import { BidIncrement } from '../../services/liveClerkService';
import { formatCurrency } from '../../utils/formatters';

interface BidIncrementLadderProps {
  increments: BidIncrement[];
  selectedIncrement: number | null;
  onIncrementClick: (amount: number) => void;
  onIncrementDoubleClick: (amount: number) => void;
  onSaveIncrements: (amounts: number[]) => void;
  horizontal?: boolean;
}

export default function BidIncrementLadder({
  increments,
  selectedIncrement,
  onIncrementClick,
  onIncrementDoubleClick,
  onSaveIncrements,
  horizontal = false,
}: BidIncrementLadderProps) {
  const [editing, setEditing] = useState(false);
  const [editAmounts, setEditAmounts] = useState<number[]>([]);
  const [newAmount, setNewAmount] = useState('');

  const clickTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const pendingDouble = useRef<Record<number, boolean>>({});

  const handleClick = useCallback((amount: number) => {
    if (selectedIncrement === amount) {
      onIncrementDoubleClick(amount);
      return;
    }

    if (clickTimers.current[amount]) {
      clearTimeout(clickTimers.current[amount]);
      delete clickTimers.current[amount];
      pendingDouble.current[amount] = false;
      onIncrementDoubleClick(amount);
      return;
    }

    onIncrementClick(amount);
    pendingDouble.current[amount] = true;

    clickTimers.current[amount] = setTimeout(() => {
      delete clickTimers.current[amount];
      pendingDouble.current[amount] = false;
    }, 300);
  }, [onIncrementClick, onIncrementDoubleClick, selectedIncrement]);

  const startEdit = () => {
    setEditAmounts(increments.map(i => i.amount));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setNewAmount('');
  };

  const saveEdit = () => {
    const sorted = [...editAmounts].sort((a, b) => a - b);
    onSaveIncrements(sorted);
    setEditing(false);
    setNewAmount('');
  };

  const removeAmount = (index: number) => {
    setEditAmounts(prev => prev.filter((_, i) => i !== index));
  };

  const addAmount = () => {
    const val = parseFloat(newAmount);
    if (!isNaN(val) && val > 0) {
      setEditAmounts(prev => [...prev, val]);
      setNewAmount('');
    }
  };

  if (horizontal) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-ironbound-grey-300 uppercase tracking-wider">Increments</span>
          {!editing ? (
            <button onClick={startEdit} className="text-xs text-ironbound-orange-400 hover:text-ironbound-orange-300 transition-colors">
              Edit
            </button>
          ) : (
            <div className="flex gap-1">
              <button onClick={saveEdit} className="p-0.5 text-green-400 hover:text-green-300">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={cancelEdit} className="p-0.5 text-red-400 hover:text-red-300">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {!editing ? (
          <div
            className="grid gap-1.5 flex-1 content-start"
            style={{
              gridTemplateColumns: `repeat(${Math.min(increments.length, 6)}, 1fr)`,
            }}
          >
            {increments.map(inc => {
              const isSelected = selectedIncrement === inc.amount;
              return (
                <button
                  key={inc.id}
                  onClick={() => handleClick(inc.amount)}
                  className={`px-1 py-2 rounded-lg text-sm font-bold transition-colors select-none text-center truncate ${
                    isSelected
                      ? 'bg-ironbound-orange-500 text-white ring-2 ring-ironbound-orange-300/50 shadow-lg'
                      : 'bg-ironbound-grey-700 text-ironbound-grey-200 hover:bg-ironbound-grey-600 hover:text-white'
                  }`}
                >
                  {formatCurrency(inc.amount)}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 flex-1 content-start">
            {editAmounts.map((amt, i) => (
              <div key={i} className="flex items-center gap-1 bg-ironbound-grey-800 rounded px-2 py-1">
                <span className="text-sm text-ironbound-grey-200">{formatCurrency(amt)}</span>
                <button onClick={() => removeAmount(i)} className="text-red-400 hover:text-red-300 p-0.5">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {editing && (
          <div className="mt-2 flex gap-1 max-w-xs">
            <input
              type="number"
              value={newAmount}
              onChange={e => setNewAmount(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addAmount()}
              placeholder="Amount"
              className="flex-1 min-w-0 px-2 py-1 text-xs bg-ironbound-grey-800 border border-ironbound-grey-600 rounded text-white placeholder-ironbound-grey-500 focus:outline-none focus:border-ironbound-orange-500"
            />
            <button
              onClick={addAmount}
              className="p-1 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white rounded transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {!editing && selectedIncrement != null && (
          <div className="mt-2 pt-2 border-t border-ironbound-grey-700 flex items-center gap-3">
            <span className="text-xs text-ironbound-grey-400">Selected:</span>
            <span className="text-sm font-bold text-ironbound-orange-400">{formatCurrency(selectedIncrement)}</span>
            <span className="text-xs text-ironbound-grey-500">1 click = set ask &nbsp;·&nbsp; 2 clicks = post bid</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-ironbound-grey-300 uppercase tracking-wider">Increments</span>
        {!editing ? (
          <button onClick={startEdit} className="text-xs text-ironbound-orange-400 hover:text-ironbound-orange-300 transition-colors">
            Edit
          </button>
        ) : (
          <div className="flex gap-1">
            <button onClick={saveEdit} className="p-0.5 text-green-400 hover:text-green-300">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={cancelEdit} className="p-0.5 text-red-400 hover:text-red-300">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
        {!editing
          ? increments.map(inc => {
              const isSelected = selectedIncrement === inc.amount;
              return (
                <button
                  key={inc.id}
                  onClick={() => handleClick(inc.amount)}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm font-semibold transition-all select-none ${
                    isSelected
                      ? 'bg-ironbound-orange-500 text-white ring-2 ring-ironbound-orange-300/50 shadow-md'
                      : 'text-ironbound-grey-200 hover:bg-ironbound-grey-700 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{formatCurrency(inc.amount)}</span>
                    {isSelected && (
                      <span className="text-xs opacity-70 font-normal">tap again = bid</span>
                    )}
                  </div>
                </button>
              );
            })
          : editAmounts.map((amt, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="flex-1 text-sm text-ironbound-grey-200 px-2 py-1 bg-ironbound-grey-800 rounded">
                  {formatCurrency(amt)}
                </span>
                <button onClick={() => removeAmount(i)} className="text-red-400 hover:text-red-300 p-0.5">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))
        }
      </div>

      {editing && (
        <div className="mt-2 flex gap-1">
          <input
            type="number"
            value={newAmount}
            onChange={e => setNewAmount(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addAmount()}
            placeholder="Amount"
            className="flex-1 min-w-0 px-2 py-1 text-xs bg-ironbound-grey-800 border border-ironbound-grey-600 rounded text-white placeholder-ironbound-grey-500 focus:outline-none focus:border-ironbound-orange-500"
          />
          <button
            onClick={addAmount}
            className="p-1 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white rounded transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {!editing && (
        <div className="mt-3 pt-3 border-t border-ironbound-grey-700">
          <div className="text-xs text-ironbound-grey-400 mb-1">Selected</div>
          <div className="text-sm font-bold text-ironbound-orange-400">
            {selectedIncrement != null ? formatCurrency(selectedIncrement) : '—'}
          </div>
          <div className="text-xs text-ironbound-grey-500 mt-1 leading-snug">
            1 click = set ask<br/>2 clicks = post bid
          </div>
        </div>
      )}
    </div>
  );
}
