import React, { useState, useRef, useEffect } from 'react';
import { X, User, Phone, Upload, Camera, Lock, Eye, EyeOff } from 'lucide-react';
import { ProfileService, UserProfile } from '../services/profileService';
import { createAvatarsBucket } from '../utils/createAvatarsBucket';
import { supabase } from '../lib/supabase';

interface EditProfileModalProps {
  profile: UserProfile;
  onClose: () => void;
  onSave: (updatedProfile: UserProfile) => void;
}

export default function EditProfileModal({ profile, onClose, onSave }: EditProfileModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState({
    full_name: profile.full_name || '',
    phone: profile.phone || '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    createAvatarsBucket();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        setError('File must be an image');
        return;
      }

      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    console.log('EditProfileModal - Starting profile update');
    console.log('Password fields:', {
      hasCurrent: !!passwordData.currentPassword,
      hasNew: !!passwordData.newPassword,
      hasConfirm: !!passwordData.confirmPassword
    });

    try {
      // Validate password if provided
      if (passwordData.currentPassword || passwordData.newPassword || passwordData.confirmPassword) {
        console.log('EditProfileModal - Validating password fields');
        if (!passwordData.currentPassword) {
          setError('Current password is required to change password');
          setIsLoading(false);
          return;
        }

        if (!passwordData.newPassword) {
          setError('New password is required');
          setIsLoading(false);
          return;
        }

        if (passwordData.newPassword !== passwordData.confirmPassword) {
          setError('Passwords do not match');
          setIsLoading(false);
          return;
        }

        if (passwordData.newPassword.length < 6) {
          setError('Password must be at least 6 characters');
          setIsLoading(false);
          return;
        }

        // Verify current password using edge function
        console.log('EditProfileModal - Verifying current password');
        const verifyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-password`;
        const verifyResponse = await fetch(verifyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: profile.email,
            password: passwordData.currentPassword,
          }),
        });

        const verifyResult = await verifyResponse.json();
        console.log('EditProfileModal - Password verification result:', verifyResult);

        if (!verifyResult.success || !verifyResult.valid) {
          setError('Current password is incorrect');
          setIsLoading(false);
          return;
        }
      }

      let avatarUrl = profile.avatar_url;

      if (avatarFile) {
        console.log('EditProfileModal - Uploading avatar');
        if (profile.avatar_url) {
          try {
            await ProfileService.deleteAvatar(profile.avatar_url);
          } catch (err) {
            console.error('Failed to delete old avatar:', err);
          }
        }

        avatarUrl = await ProfileService.uploadAvatar(profile.id, avatarFile);
        console.log('EditProfileModal - Avatar uploaded:', avatarUrl);
      }

      // Update profile first
      console.log('EditProfileModal - Updating profile in database');
      const updatedProfile = await ProfileService.updateProfile(profile.id, {
        full_name: formData.full_name,
        phone: formData.phone,
        avatar_url: avatarUrl,
      });
      console.log('EditProfileModal - Profile updated successfully');

      // Update password if provided
      if (passwordData.newPassword) {
        console.log('EditProfileModal - Updating password');
        try {
          // First, verify we have a valid session
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          console.log('EditProfileModal - Current session:', session ? 'exists' : 'missing');

          if (sessionError) {
            console.error('Session error:', sessionError);
            throw new Error('Session error. Please sign in again.');
          }

          if (!session) {
            console.error('No active session found');
            throw new Error('Your session has expired. Please sign in again.');
          }

          const { error: passwordError } = await supabase.auth.updateUser({
            password: passwordData.newPassword
          });

          if (passwordError) {
            console.error('Password update error:', passwordError);
            throw new Error(`Password update failed: ${passwordError.message}`);
          }

          console.log('EditProfileModal - Password updated successfully');
          setSuccessMessage('Profile and password updated successfully!');
        } catch (passwordErr) {
          console.error('Password change error:', passwordErr);
          throw passwordErr;
        }
      } else {
        console.log('EditProfileModal - No password change requested');
        setSuccessMessage('Profile updated successfully!');
      }

      onSave(updatedProfile);

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      if (errorMessage.includes('Bucket not found')) {
        setError('Storage bucket not configured. Please contact support.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-ironbound-grey-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-ironbound-grey-900">Edit Profile</h2>
          <button
            onClick={onClose}
            className="text-ironbound-grey-400 hover:text-ironbound-grey-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {successMessage}
            </div>
          )}

          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-ironbound-grey-100 border-4 border-ironbound-orange-100">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="h-16 w-16 text-ironbound-grey-400" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white p-2 rounded-full shadow-lg transition-colors"
              >
                <Camera className="h-5 w-5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <p className="text-sm text-ironbound-grey-500">
              Click the camera icon to upload a new photo (max 5MB)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Full Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                autoComplete="name"
                required
                className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
                placeholder="Enter your full name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                autoComplete="tel"
                className="w-full pl-10 pr-4 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          <div className="text-sm text-ironbound-grey-500">
            <p className="font-medium mb-1">Email: {profile.email}</p>
            <p className="text-xs">Contact support to change your email address</p>
          </div>

          <div className="border-t border-ironbound-grey-200 pt-6">
            <h3 className="text-sm font-semibold text-ironbound-grey-900 mb-4">Change Password</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    autoComplete="off"
                    data-form-type="other"
                    className="w-full pl-10 pr-12 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-ironbound-grey-400 hover:text-ironbound-grey-600"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ironbound-grey-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ironbound-grey-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    autoComplete="new-password"
                    data-form-type="other"
                    className="w-full pl-10 pr-12 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
                    placeholder="Enter new password (min 6 characters)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-ironbound-grey-400 hover:text-ironbound-grey-600"
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
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    autoComplete="new-password"
                    data-form-type="other"
                    className="w-full pl-10 pr-12 py-3 border border-ironbound-grey-300 rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-ironbound-orange-500 transition-colors text-gray-900 bg-white"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-ironbound-grey-400 hover:text-ironbound-grey-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <p className="text-xs text-ironbound-grey-500">
                Leave password fields empty if you don't want to change your password
              </p>
            </div>
          </div>

          <div className="flex space-x-4 pt-4 border-t border-ironbound-grey-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-ironbound-grey-300 text-ironbound-grey-700 rounded-lg hover:bg-ironbound-grey-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 disabled:bg-ironbound-grey-300 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
