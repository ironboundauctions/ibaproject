import React from 'react';
import { Gavel, SkipBack, SkipForward } from 'lucide-react';
import { SessionStatus } from '../../services/liveClerkService';

interface LotResultControlsProps {
  sessionStatus: SessionStatus;
  onFloorPriority: () => void;
  onAbsenteePriority: () => void;
  onSold: () => void;
  onConditional: () => void;
  onFail: () => void;
  onPass: () => void;
  onUndo: () => void;
  onPauseLot: () => void;
  onOnce: () => void;
  onPrevLot: () => void;
  onNextLot: () => void;
}

export default function LotResultControls({
  sessionStatus,
  onFloorPriority,
  onAbsenteePriority,
  onSold,
  onConditional,
  onFail,
  onPass,
  onUndo,
  onPauseLot,
  onOnce,
  onPrevLot,
  onNextLot,
}: LotResultControlsProps) {
  const isRunning = sessionStatus === 'running';
  const isPaused = sessionStatus === 'paused';
  const isActive = isRunning || isPaused;
  const isEnded = sessionStatus === 'ended';

  if (isEnded) return null;

  return (
    <div className="flex flex-col gap-1 h-full">
      <div className="grid grid-cols-2 gap-1">
        <button
          onClick={onFloorPriority}
          disabled={!isRunning}
          className="py-1 px-2 bg-ironbound-grey-700 hover:bg-ironbound-grey-600 disabled:opacity-30 disabled:cursor-not-allowed text-ironbound-grey-200 text-xs font-semibold rounded transition-colors"
        >
          Floor Priority
        </button>
        <button
          onClick={onAbsenteePriority}
          disabled={!isRunning}
          className="py-1 px-2 bg-ironbound-grey-700 hover:bg-ironbound-grey-600 disabled:opacity-30 disabled:cursor-not-allowed text-ironbound-grey-200 text-xs font-semibold rounded transition-colors"
        >
          Absentee Priority
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1 flex-1">
        <button
          onClick={onSold}
          disabled={!isRunning}
          className="py-1 px-2 bg-green-700 hover:bg-green-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-bold rounded transition-colors flex items-center justify-center gap-1.5"
        >
          <Gavel className="h-4 w-4" />
          Sold
        </button>
        <button
          onClick={onConditional}
          disabled={!isRunning}
          className="py-1 px-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-bold rounded transition-colors"
        >
          Conditional
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1 flex-1">
        <button
          onClick={onFail}
          disabled={!isRunning}
          className="py-1 px-2 bg-red-700 hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-bold rounded transition-colors"
        >
          Fail
        </button>
        <button
          onClick={onPass}
          disabled={!isRunning}
          className="py-1 px-2 bg-ironbound-orange-600 hover:bg-ironbound-orange-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-bold rounded transition-colors"
        >
          Pass
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1">
        <button
          onClick={onUndo}
          disabled={!isActive}
          className="py-1 px-1 bg-ironbound-grey-700 hover:bg-ironbound-grey-600 disabled:opacity-30 disabled:cursor-not-allowed text-ironbound-grey-200 text-xs font-semibold rounded transition-colors"
        >
          Undo
        </button>
        <button
          onClick={onPauseLot}
          disabled={!isRunning}
          className="py-1 px-1 bg-ironbound-grey-700 hover:bg-ironbound-grey-600 disabled:opacity-30 disabled:cursor-not-allowed text-ironbound-grey-200 text-xs font-semibold rounded transition-colors"
        >
          Pause Lot
        </button>
        <button
          onClick={onOnce}
          disabled={!isRunning}
          className="py-1 px-1 bg-ironbound-grey-700 hover:bg-ironbound-grey-600 disabled:opacity-30 disabled:cursor-not-allowed text-ironbound-grey-200 text-xs font-semibold rounded transition-colors"
        >
          Once
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1">
        <button
          onClick={onPrevLot}
          disabled={!isActive}
          className="py-1 px-2 bg-ironbound-grey-700 hover:bg-ironbound-grey-600 disabled:opacity-30 disabled:cursor-not-allowed text-ironbound-grey-200 text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1"
        >
          <SkipBack className="h-3 w-3" />
          Prev
        </button>
        <button
          onClick={onNextLot}
          disabled={!isActive}
          className="py-1 px-2 bg-ironbound-grey-700 hover:bg-ironbound-grey-600 disabled:opacity-30 disabled:cursor-not-allowed text-ironbound-grey-200 text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1"
        >
          Next
          <SkipForward className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
