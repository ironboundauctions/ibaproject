import React, { useState } from 'react';
import { Shield, User, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { AuthService } from '../services/authService';

interface FirstAdminSetupProps {
  onAdminCreated: () => void;
}

export default function FirstAdminSetup({ onAdminCreated }: FirstAdminSetupProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);

    try {
      console.log('Creating admin user...');
      const result = await AuthService.createFirstAdmin(formData.email, formData.password, formData.name);
      console.log('Admin user created successfully', result);

      // Wait a bit for auth state to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if we got a session (user is auto-logged in) or needs confirmation
      if (result) {
        setSuccess(true);
        setIsLoading(false);
        // Wait 2 seconds to show success message, then reload
        setTimeout(() => {
          onAdminCreated();
        }, 2000);
      } else {
        // No session means email confirmation is required
        setSuccess(true);
        setNeedsConfirmation(true);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Admin creation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create admin user';

      if (errorMessage.includes('email confirmation')) {
        setSuccess(true);
        setNeedsConfirmation(true);
      } else {
        setError(errorMessage);
      }
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen bg-ironbound-grey-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="p-6 border-b border-ironbound-grey-200">
          <div className="flex items-center space-x-3 mb-4">
            <img
              src="/ironbound_primarylogog.png"
              alt="IronBound Auctions"
              className="h-8 w-auto"
            />
            <div>
              <h2 className="text-xl font-bold text-ironbound-grey-900">Setup Admin Account</h2>
              <p className="text-sm text-ironbound-grey-600">Create the first administrator</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-900">First Time Setup</span>
            </div>
            <p className="text-sm text-blue-800">
              This will create the first administrator account for your auction platform.
              This account will have full system access.
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {success && needsConfirmation && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Mail className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-green-900">Account Created!</span>
              </div>
              <p className="text-sm text-green-800 mb-3">
                Your admin account has been created successfully.
              </p>
              <div className="bg-white border border-green-300 rounded p-3 mb-3">
                <p className="text-sm font-medium text-green-900 mb-2">Email Confirmation Required</p>
                <p className="text-sm text-green-800">
                  Please check your email inbox at <strong>{formData.email}</strong> and click the confirmation link to activate your account.
                </p>
              </div>
              <p className="text-xs text-green-700">
                After confirming your email, return to this page and sign in with your credentials.
              </p>
            </div>
          )}

          {success && !needsConfirmation && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-green-900">Success!</span>
              </div>
              <p className="text-sm text-green-800">
                Admin account created successfully. Redirecting to dashboard...
              </p>
              <div className="mt-3 flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
              </div>
            </div>
          )}

          {!success && <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
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
                  required
                  className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-ironbound-grey-900"
                  placeholder="Enter your full name"
                />
              </div>
            </div>

            {/* Email */}
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

            {/* Password */}
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
                  minLength={6}
                  className="w-full pl-10 pr-12 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-ironbound-grey-900"
                  placeholder="Enter a secure password"
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

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-ironbound-grey-900"
                  placeholder="Confirm your password"
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-ironbound-orange-500 hover:bg-ironbound-orange-600 disabled:bg-ironbound-grey-300 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                'Create Admin Account'
              )}
            </button>
          </form>}

          {!success && <div className="mt-6 text-center">
            <p className="text-xs text-ironbound-grey-500">
              This account will have full administrative privileges including user management,
              auction creation, and system configuration.
            </p>
          </div>}
        </div>
      </div>
    </div>
  );
}