import React, { useState } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface AuthModalProps {
  onClose: () => void;
}

export default function AuthModal({ onClose }: AuthModalProps) {
  const { login, register, isLoading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetMessage('');

    try {
      if (isPasswordReset) {
        // Handle password reset
        const { supabase } = await import('../lib/supabase');
        if (supabase) {
          const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
            redirectTo: `${window.location.origin}/#reset-password`
          });
          if (error) throw error;
          setResetMessage('Password reset email sent! Check your inbox.');
        } else {
          throw new Error('Database connection required for password reset');
        }
      } else if (isSignUp) {
        await register(formData.name, formData.email, formData.password);
        onClose();
      } else {
        await login(formData.email, formData.password);
        onClose();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';

      // Handle special confirmation required message
      if (errorMessage.startsWith('CONFIRMATION_REQUIRED:')) {
        const message = errorMessage.replace('CONFIRMATION_REQUIRED:', '');
        setResetMessage(message);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const resetForm = () => {
    setFormData({ name: '', email: '', password: '' });
    setError('');
    setResetMessage('');
  };

  const switchMode = (mode: 'signin' | 'signup' | 'reset') => {
    resetForm();
    setIsSignUp(mode === 'signup');
    setIsPasswordReset(mode === 'reset');
  };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-ironbound-grey-200">
          <div className="flex items-center space-x-3">
            <img 
              src="/ironbound_primarylogog.png" 
              alt="IronBound Auctions" 
              className="h-8 w-auto"
            />
            <div>
              <h2 className="text-xl font-bold text-ironbound-grey-900">
                {isPasswordReset ? 'Reset Password' : isSignUp ? 'Create Account' : 'Welcome Back'}
              </h2>
              <p className="text-sm text-ironbound-grey-600">
                {isPasswordReset ? 'Reset your password' : isSignUp ? 'Join IronBound Auctions' : 'Sign in to your account'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ironbound-grey-400 hover:text-ironbound-grey-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6">
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
            {isSignUp && !isPasswordReset && (
              <div>
                <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required={isSignUp}
                    className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-ironbound-grey-900"
                    placeholder="Enter your full name"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-ironbound-grey-900"
                  placeholder="Enter your email address"
                />
              </div>
            </div>

            {!isPasswordReset && (
              <div>
              <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-12 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-ironbound-grey-900"
                  placeholder="Enter your password"
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
            )}
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-ironbound-orange-500 hover:bg-ironbound-orange-600 disabled:bg-ironbound-grey-300 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                isPasswordReset ? 'Send Reset Email' : isSignUp ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            {isPasswordReset ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="text-ironbound-orange-500 hover:text-ironbound-orange-600 font-medium transition-colors"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-ironbound-grey-600">
                  {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                  <button
                    type="button"
                    onClick={() => switchMode(isSignUp ? 'signin' : 'signup')}
                    className="ml-1 text-ironbound-orange-500 hover:text-ironbound-orange-600 font-medium transition-colors"
                  >
                    {isSignUp ? 'Sign In' : 'Sign Up'}
                  </button>
                </p>
                {!isSignUp && (
                  <p className="text-sm text-ironbound-grey-600">
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