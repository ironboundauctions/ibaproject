import React, { useState, useEffect } from 'react';
import { User, Mail, Calendar, Trophy, TrendingUp, Phone } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ProfileService, UserProfile as UserProfileType } from '../services/profileService';
import EditProfileModal from './EditProfileModal';

export default function UserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfileType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  console.log('UserProfile - user data:', user);

  useEffect(() => {
    if (user?.id) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const profileData = await ProfileService.getProfile(user.id);
      setProfile(profileData);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileUpdate = (updatedProfile: UserProfileType) => {
    setProfile(updatedProfile);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-ironbound-grey-500 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white">Please sign in to view your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ironbound-grey-500">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-ironbound-grey-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-4">
            <img 
              src="/ironbound_primarylogog.png" 
              alt="IronBound Auctions" 
              className="h-8 w-auto"
            />
            <h1 className="text-2xl font-bold text-ironbound-grey-900">User Profile</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="text-center">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ironbound-orange-500"></div>
                  </div>
                ) : (
                  <>
                    <div className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-ironbound-orange-100 overflow-hidden bg-ironbound-grey-100">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={profile.full_name || 'User'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="h-12 w-12 text-ironbound-grey-400" />
                        </div>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-ironbound-grey-900 mb-1">
                      {profile?.full_name || user.name || 'User'}
                    </h2>
                    <p className="text-ironbound-grey-600 mb-2">{user.email}</p>
                    {profile?.phone && (
                      <div className="flex items-center justify-center space-x-2 text-sm text-ironbound-grey-600 mb-4">
                        <Phone className="h-4 w-4" />
                        <span>{profile.phone}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-center space-x-2 text-sm text-ironbound-grey-500 mb-6">
                      <Calendar className="h-4 w-4" />
                      <span>Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'recently'}</span>
                    </div>

                    <button
                      onClick={() => setShowEditModal(true)}
                      className="w-full bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white py-2 px-4 rounded-lg transition-colors"
                    >
                      Edit Profile
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Stats and Activity */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-ironbound-grey-900">0</p>
                    <p className="text-sm text-ironbound-grey-600">Total Bids</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center space-x-3">
                  <div className="bg-green-100 p-3 rounded-lg">
                    <Trophy className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-ironbound-grey-900">0</p>
                    <p className="text-sm text-ironbound-grey-600">Auctions Won</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center space-x-3">
                  <div className="bg-purple-100 p-3 rounded-lg">
                    <User className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-ironbound-grey-900">0</p>
                    <p className="text-sm text-ironbound-grey-600">Items Listed</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-ironbound-grey-900 mb-4">Recent Activity</h3>
              
              <div className="text-center py-8">
                <div className="bg-ironbound-grey-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-8 w-8 text-ironbound-grey-400" />
                </div>
                <p className="text-ironbound-grey-600 mb-2">No recent activity</p>
                <p className="text-sm text-ironbound-grey-500">
                  Your bidding activity and auction participation will appear here
                </p>
              </div>
            </div>

            {/* Account Settings */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-ironbound-grey-900 mb-4">Account Settings</h3>
              
              <div className="space-y-3">
                <button className="w-full text-left p-3 hover:bg-ironbound-grey-50 rounded-lg transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ironbound-grey-900">Account Information</span>
                    <span className="text-ironbound-grey-400">→</span>
                  </div>
                  <p className="text-sm text-ironbound-grey-600 mt-1">View and update your account details</p>
                </button>

                <button className="w-full text-left p-3 hover:bg-ironbound-grey-50 rounded-lg transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ironbound-grey-900">Notification Preferences</span>
                    <span className="text-ironbound-grey-400">→</span>
                  </div>
                  <p className="text-sm text-ironbound-grey-600 mt-1">Manage email and push notifications</p>
                </button>

                <button className="w-full text-left p-3 hover:bg-ironbound-grey-50 rounded-lg transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ironbound-grey-900">Payment Methods</span>
                    <span className="text-ironbound-grey-400">→</span>
                  </div>
                  <p className="text-sm text-ironbound-grey-600 mt-1">Add or update payment information</p>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showEditModal && profile && (
        <EditProfileModal
          profile={profile}
          onClose={() => setShowEditModal(false)}
          onSave={handleProfileUpdate}
        />
      )}
    </div>
  );
}