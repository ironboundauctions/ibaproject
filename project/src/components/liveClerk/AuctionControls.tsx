import React from 'react';
import { Play, Pause, Square, RotateCcw } from 'lucide-react';
import { SessionStatus } from '../../services/liveClerkService';

interface AuctionControlsProps {
  sessionStatus: SessionStatus;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onResetBidding: () => void;
  autoStartNext: boolean;
  onAutoStartNextChange: (val: boolean) => void;
  enterFloorPrice: boolean;
  onEnterFloorPriceChange: (val: boolean) => void;
  postWithOneClick: boolean;
  onPostWithOneClickChange: (val: boolean) => void;
  decrement: boolean;
  onDecrementChange: (val: boolean) => void;
}

export default function AuctionControls({
  sessionStatus,
  onStart,
  onPause,
  onResume,
  onStop,
  onResetBidding,
  autoStartNext,
  onAutoStartNextChange,
  enterFloorPrice,
  onEnterFloorPriceChange,
  postWithOneClick,
  onPostWithOneClickChange,
  decrement,
  onDecrementChange,
}: AuctionControlsProps) {
  const isIdle = sessionStatus === 'idle';
  const isRunning = sessionStatus === 'running';
  const isPaused = sessionStatus === 'paused';
  const isEnded = sessionStatus === 'ended';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {isIdle && (
          <button
            onClick={onStart}
            className="flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded-lg transition-colors"
          >
            <Play className="h-4 w-4" />
            Start Auction
          </button>
        )}
        {isRunning && (
          <>
            <button
              onClick={onPause}
              className="flex items-center justify-center gap-2 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-sm rounded-lg transition-colors"
            >
              <Pause className="h-4 w-4" />
              Pause
            </button>
            <button
              onClick={onStop}
              className="flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-lg transition-colors"
            >
              <Square className="h-4 w-4" />
              Stop
            </button>
          </>
        )}
        {isPaused && (
          <>
            <button
              onClick={onResume}
              className="flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded-lg transition-colors"
            >
              <Play className="h-4 w-4" />
              Resume
            </button>
            <button
              onClick={onStop}
              className="flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-lg transition-colors"
            >
              <Square className="h-4 w-4" />
              Stop
            </button>
          </>
        )}
        {isEnded && (
          <div className="flex items-center justify-center py-2.5 bg-ironbound-grey-700 text-ironbound-grey-400 font-bold text-sm rounded-lg">
            Auction Ended
          </div>
        )}
      </div>

      <button
        onClick={onResetBidding}
        disabled={sessionStatus === 'idle' || sessionStatus === 'ended'}
        className="flex items-center justify-center gap-2 py-2 w-full bg-ironbound-grey-700 hover:bg-ironbound-grey-600 disabled:opacity-40 disabled:cursor-not-allowed text-ironbound-grey-200 hover:text-white font-semibold text-xs rounded-lg transition-colors border border-ironbound-grey-600"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reset Bidding
      </button>

      <div className="pt-2 border-t border-ironbound-grey-700 space-y-1.5">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoStartNext}
            onChange={e => onAutoStartNextChange(e.target.checked)}
            className="w-3.5 h-3.5 accent-ironbound-orange-500 cursor-pointer"
          />
          <span className="text-xs text-ironbound-grey-300">Auto start next lot</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enterFloorPrice}
            onChange={e => onEnterFloorPriceChange(e.target.checked)}
            className="w-3.5 h-3.5 accent-ironbound-orange-500 cursor-pointer"
          />
          <span className="text-xs text-ironbound-grey-300">Enter floor price</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={postWithOneClick}
            onChange={e => onPostWithOneClickChange(e.target.checked)}
            className="w-3.5 h-3.5 accent-ironbound-orange-500 cursor-pointer"
          />
          <span className="text-xs text-ironbound-grey-300">Post with 1 click</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={decrement}
            onChange={e => onDecrementChange(e.target.checked)}
            className="w-3.5 h-3.5 accent-ironbound-orange-500 cursor-pointer"
          />
          <span className="text-xs text-ironbound-grey-300">Decrement</span>
        </label>
      </div>
    </div>
  );
}
