import React, { useState } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff, Phone, MapPin, Home, Building2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface AuthModalProps {
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
}

interface SignUpData {
  name: string;
  email: string;
  password: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip: string;
}

export default function AuthModal({ onClose, initialMode = 'signin' }: AuthModalProps) {
  const { login, register, isLoading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  const [signInData, setSignInData] = useState({ email: '', password: '' });
  const [signUpData, setSignUpData] = useState<SignUpData>({
    name: '',
    email: '',
    password: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetMessage('');

    try {
      if (isPasswordReset) {
        const { supabase } = await import('../lib/supabase');
        if (supabase) {
          const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
            redirectTo: `${window.location.origin}/#reset-password`
          });
          if (error) throw error;
          setResetMessage('Password reset email sent! Check your inbox.');
        } else {
          throw new Error('Database connection required for password reset');
        }
      } else if (isSignUp) {
        if (signUpData.password !== confirmPassword) {
          setError('Passwords do not match.');
          return;
        }
        await register(
          signUpData.name,
          signUpData.email,
          signUpData.password,
          {
            phone: signUpData.phone,
            address_line1: signUpData.address_line1,
            address_line2: signUpData.address_line2,
            city: signUpData.city,
            state: signUpData.state,
            zip: signUpData.zip,
          }
        );
        onClose();
      } else {
        await login(signInData.email, signInData.password);
        onClose();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';

      if (errorMessage.startsWith('CONFIRMATION_REQUIRED:')) {
        setResetMessage(errorMessage.replace('CONFIRMATION_REQUIRED:', ''));
        setError('');
        return;
      }

      if (errorMessage.includes('Email not confirmed')) {
        setError('Please check your email and click the confirmation link before signing in.');
      } else if (errorMessage.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.');
      } else {
        setError(errorMessage);
      }
    }
  };

  const switchMode = (mode: 'signin' | 'signup' | 'reset') => {
    setError('');
    setResetMessage('');
    setConfirmPassword('');
    setIsSignUp(mode === 'signup');
    setIsPasswordReset(mode === 'reset');
  };

  const inputClass = "w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-ironbound-grey-900 placeholder-ironbound-grey-400";
  const labelClass = "block text-sm font-medium text-ironbound-grey-700 mb-1.5";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-ironbound-grey-200 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <img
              src="/ironbound_primarylogog.png"
              alt="IronBound Auctions"
              className="h-8 w-auto"
            />
            <div>
              <h2 className="text-xl font-bold text-ironbound-grey-900">
                {isPasswordReset ? 'Reset Password' : isSignUp ? 'Create Bidder Account' : 'Welcome Back'}
              </h2>
              <p className="text-sm text-ironbound-grey-500">
                {isPasswordReset ? 'Enter your email to receive a reset link' : isSignUp ? 'Register to bid at IronBound Auctions' : 'Sign in to your account'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-ironbound-grey-400 hover:text-ironbound-grey-600 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="overflow-y-auto flex-1 p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          {resetMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {resetMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ── SIGN IN ── */}
            {!isSignUp && !isPasswordReset && (
              <>
                <div>
                  <label className={labelClass}>Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                    <input
                      type="email"
                      value={signInData.email}
                      onChange={e => setSignInData(p => ({ ...p, email: e.target.value }))}
                      required
                      className={inputClass}
                      placeholder="your@email.com"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={signInData.password}
                      onChange={e => setSignInData(p => ({ ...p, password: e.target.value }))}
                      required
                      className="w-full pl-10 pr-12 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-ironbound-grey-900"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ironbound-grey-400 hover:text-ironbound-grey-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── PASSWORD RESET ── */}
            {isPasswordReset && (
              <div>
                <label className={labelClass}>Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="your@email.com"
                  />
                </div>
              </div>
            )}

            {/* ── SIGN UP ── */}
            {isSignUp && (
              <>
                {/* Account section */}
                <div className="pb-1">
                  <p className="text-xs font-semibold text-ironbound-grey-400 uppercase tracking-wider mb-3">Account Info</p>
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Full Name <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                        <input
                          type="text"
                          value={signUpData.name}
                          onChange={e => setSignUpData(p => ({ ...p, name: e.target.value }))}
                          required
                          autoCapitalize="words"
                          autoComplete="name"
                          className={inputClass}
                          placeholder="First and last name"
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Email Address <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                        <input
                          type="email"
                          value={signUpData.email}
                          onChange={e => setSignUpData(p => ({ ...p, email: e.target.value }))}
                          required
                          className={inputClass}
                          placeholder="your@email.com"
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Password <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={signUpData.password}
                          onChange={e => setSignUpData(p => ({ ...p, password: e.target.value }))}
                          required
                          minLength={6}
                          className="w-full pl-10 pr-12 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-ironbound-grey-900"
                          placeholder="Min. 6 characters"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-ironbound-grey-400 hover:text-ironbound-grey-600 transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Confirm Password <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          required
                          className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-ironbound-grey-900 ${
                            confirmPassword && confirmPassword !== signUpData.password
                              ? 'border-red-400 bg-red-50'
                              : 'border-ironbound-grey-300'
                          }`}
                          placeholder="Re-enter your password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-ironbound-grey-400 hover:text-ironbound-grey-600 transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {confirmPassword && confirmPassword !== signUpData.password && (
                        <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>Phone Number <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                        <input
                          type="tel"
                          value={signUpData.phone}
                          onChange={e => setSignUpData(p => ({ ...p, phone: e.target.value }))}
                          required
                          autoComplete="tel"
                          className={inputClass}
                          placeholder="(555) 000-0000"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Address section */}
                <div className="border-t border-ironbound-grey-100 pt-4">
                  <p className="text-xs font-semibold text-ironbound-grey-400 uppercase tracking-wider mb-3">Billing / Mailing Address</p>
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Street Address <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Home className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                        <input
                          type="text"
                          value={signUpData.address_line1}
                          onChange={e => setSignUpData(p => ({ ...p, address_line1: e.target.value }))}
                          required
                          autoCapitalize="words"
                          autoComplete="address-line1"
                          className={inputClass}
                          placeholder="123 Main St"
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Apt / Suite / Unit <span className="text-ironbound-grey-400 font-normal">(optional)</span></label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                        <input
                          type="text"
                          value={signUpData.address_line2}
                          onChange={e => setSignUpData(p => ({ ...p, address_line2: e.target.value }))}
                          autoCapitalize="words"
                          autoComplete="address-line2"
                          className={inputClass}
                          placeholder="Apt 4B"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>City <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                          <input
                            type="text"
                            value={signUpData.city}
                            onChange={e => setSignUpData(p => ({ ...p, city: e.target.value }))}
                            required
                            autoCapitalize="words"
                            autoComplete="address-level2"
                            className={inputClass}
                            placeholder="City"
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>State <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                          <input
                            type="text"
                            value={signUpData.state}
                            onChange={e => setSignUpData(p => ({ ...p, state: e.target.value.toUpperCase() }))}
                            required
                            maxLength={2}
                            autoCapitalize="characters"
                            autoComplete="address-level1"
                            className={inputClass}
                            placeholder="TX"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>ZIP Code <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                          <input
                            type="text"
                            value={signUpData.zip}
                            onChange={e => setSignUpData(p => ({ ...p, zip: e.target.value }))}
                            required
                            className={inputClass}
                            placeholder="12345"
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Country</label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                          <input
                            type="text"
                            value="US"
                            readOnly
                            className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-200 rounded-lg bg-ironbound-grey-50 text-ironbound-grey-500 cursor-not-allowed"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-ironbound-orange-500 hover:bg-ironbound-orange-600 disabled:bg-ironbound-grey-300 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center mt-2"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                isPasswordReset ? 'Send Reset Email' : isSignUp ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>

          <div className="mt-5 text-center">
            {isPasswordReset ? (
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="text-ironbound-orange-500 hover:text-ironbound-orange-600 font-medium text-sm transition-colors"
              >
                Back to Sign In
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-ironbound-grey-600">
                  {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                  <button
                    type="button"
                    onClick={() => switchMode(isSignUp ? 'signin' : 'signup')}
                    className="ml-1 text-ironbound-orange-500 hover:text-ironbound-orange-600 font-medium transition-colors"
                  >
                    {isSignUp ? 'Sign In' : 'Register Free'}
                  </button>
                </p>
                {!isSignUp && (
                  <p className="text-sm">
                    <button
                      type="button"
                      onClick={() => switchMode('reset')}
                      className="text-ironbound-orange-500 hover:text-ironbound-orange-600 font-medium transition-colors"
                    >
                      Forgot your password?
                    </button>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
