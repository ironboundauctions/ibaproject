import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { AuthService } from '../services/authService';
import { supabase } from '../lib/supabase';

interface PasswordResetProps {
  onComplete: () => void;
}

export default function PasswordReset({ onComplete }: PasswordResetProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [validToken, setValidToken] = useState(false);

  useEffect(() => {
    const checkToken = async () => {
      if (!supabase) {
        setError('Authentication service not configured');
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setValidToken(true);
      } else {
        setError('Invalid or expired reset link. Please request a new password reset.');
      }
    };

    checkToken();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validToken) {
      setError('Invalid or expired reset link');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      await AuthService.updatePassword(newPassword);
      setSuccess(true);

      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update password';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-ironbound-grey-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-ironbound-grey-900 mb-2">
            Password Updated!
          </h2>
          <p className="text-ironbound-grey-600 mb-6">
            Your password has been successfully updated. You can now sign in with your new password.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ironbound-grey-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-ironbound-grey-200">
          <div className="flex items-center space-x-3">
            <img
              src="/ironbound_primarylogog.png"
              alt="IronBound Auctions"
              className="h-8 w-auto"
            />
            <div>
              <h2 className="text-xl font-bold text-ironbound-grey-900">
                Reset Your Password
              </h2>
              <p className="text-sm text-ironbound-grey-600">
                Enter your new password below
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {validToken && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full pl-10 pr-12 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-ironbound-grey-900"
                    placeholder="Enter new password (min 8 characters)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-ironbound-grey-400 hover:text-ironbound-grey-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-ironbound-grey-900"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !validToken}
                className="w-full bg-ironbound-orange-500 hover:bg-ironbound-orange-600 disabled:bg-ironbound-grey-300 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  'Update Password'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
