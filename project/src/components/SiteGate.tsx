import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

const GATE_KEY = 'ib_site_unlocked';
const SITE_PASSCODE = 'ironbound2026';

interface SiteGateProps {
  children: React.ReactNode;
}

export default function SiteGate({ children }: SiteGateProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(GATE_KEY) === 'true') {
      setUnlocked(true);
    }
  }, []);

  const submit = () => {
    if (input === SITE_PASSCODE) {
      sessionStorage.setItem(GATE_KEY, 'true');
      setUnlocked(true);
    } else {
      setError(true);
      setShake(true);
      setInput('');
      setTimeout(() => setShake(false), 600);
      setTimeout(() => setError(false), 3000);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submit();
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen bg-ironbound-grey-950 flex items-center justify-center p-4">
      <div className={`w-full max-w-sm ${shake ? 'animate-shake' : ''}`}>
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-ironbound-orange-500/10 border border-ironbound-orange-500/20 flex items-center justify-center mb-5">
            <Lock className="h-7 w-7 text-ironbound-orange-400" />
          </div>
          <img
            src="/ironbound_primarylogog.png"
            alt="Ironbound"
            className="h-8 mb-4 opacity-80"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <h1 className="text-xl font-bold text-white mb-1">Preview Access</h1>
          <p className="text-sm text-ironbound-grey-400 text-center leading-relaxed">
            This site is under development.<br />Enter the preview passcode to continue.
          </p>
        </div>

        <div className="bg-ironbound-grey-900 border border-ironbound-grey-800 rounded-2xl p-6">
          <label className="block text-xs font-semibold text-ironbound-grey-400 uppercase tracking-wide mb-2">
            Passcode
          </label>
          <div className="relative mb-4">
            <input
              type={showPass ? 'text' : 'password'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Enter passcode"
              autoFocus
              className={`w-full bg-ironbound-grey-800 border rounded-xl px-4 py-3 pr-11 text-white placeholder-ironbound-grey-600 text-sm focus:outline-none focus:ring-2 transition-all ${
                error
                  ? 'border-red-500 focus:ring-red-500/30'
                  : 'border-ironbound-grey-700 focus:ring-ironbound-orange-500/30 focus:border-ironbound-orange-500'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ironbound-grey-500 hover:text-ironbound-grey-300 transition-colors"
            >
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs mb-4">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Incorrect passcode. Please try again.</span>
            </div>
          )}

          <button
            onClick={submit}
            className="w-full py-3 rounded-xl bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white font-semibold text-sm transition-colors"
          >
            Enter Site
          </button>
        </div>

        <p className="text-center text-xs text-ironbound-grey-600 mt-5">
          Ironbound Auction Platform &mdash; Internal Preview
        </p>
      </div>
    </div>
  );
}
