import React, { useState, useEffect } from 'react';
import { UserPlus, RefreshCw, Shield, Crown, Mail, Calendar, KeyRound, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AdminManagementService } from '../services/adminManagementService';
import { UserPermissions } from '../services/userRoleService';
import { CreateAdminModal } from './CreateAdminModal';

interface RegularUser {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
}

export const UserPromotionPanel: React.FC = () => {
  const [users, setUsers] = useState<RegularUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [promotingUserId, setPromotingUserId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  useEffect(() => {
    loadRegularUsers();
  }, []);

  const loadRegularUsers = async () => {
    setLoading(true);
    try {
      const { data: allProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        setUsers([]);
        return;
      }

      const { data: adminRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['super_admin', 'admin']);

      if (rolesError) {
        console.error('Error fetching admin roles:', rolesError);
      }

      const adminUserIds = new Set(adminRoles?.map(r => r.user_id) || []);
      const regularUsers = (allProfiles || []).filter(p => !adminUserIds.has(p.id));

      setUsers(regularUsers);
    } catch (error) {
      console.error('Error loading regular users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteUser = async (user: RegularUser, role: 'admin' | 'super_admin') => {
    const confirmMessage = role === 'super_admin'
      ? `Promote ${user.full_name} to Super Admin? They will have full access to all features including admin management.`
      : `Promote ${user.full_name} to Admin? They will be able to manage events and inventory.`;

    if (!confirm(confirmMessage)) return;

    setPromotingUserId(user.id);

    const permissions: UserPermissions = {
      can_manage_events: true,
      can_manage_inventory: true,
      can_manage_users: role === 'super_admin'
    };

    const result = await AdminManagementService.promoteUserToAdmin(user.id, role, permissions);

    if (result.success) {
      alert(`Successfully promoted ${user.full_name} to ${role === 'super_admin' ? 'Super Admin' : 'Admin'}!`);
      await loadRegularUsers();
    } else {
      console.error('Promotion failed:', result.error);
      alert(`Failed to promote user: ${result.error || 'Unknown error'}`);
    }

    setPromotingUserId(null);
  };

  const handleResetPassword = async (user: RegularUser) => {
    const newPassword = prompt(`Enter new password for ${user.full_name}:`);
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    const confirmPassword = prompt('Confirm new password:');
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    setActionInProgress(`reset-${user.id}`);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({
            userId: user.id,
            newPassword
          })
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        alert(`Password reset successfully for ${user.full_name}`);
      } else {
        throw new Error(result.error || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      alert(`Failed to reset password: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeleteUser = async (user: RegularUser) => {
    if (!confirm(`Are you sure you want to delete ${user.full_name}? This action cannot be undone.`)) {
      return;
    }

    if (!confirm(`This will permanently delete ${user.email} and all associated data. Are you absolutely sure?`)) {
      return;
    }

    setActionInProgress(`delete-${user.id}`);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({ userId: user.id })
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        alert(`Successfully deleted ${user.full_name}`);
        await loadRegularUsers();
      } else {
        throw new Error(result.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setActionInProgress(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
          <p className="text-white">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">User Management</h2>
          <p className="text-gray-300 mt-1">Manage users and promote them to admin roles</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
        >
          <UserPlus className="w-5 h-5" />
          Create New User
        </button>
      </div>

      {users.length === 0 ? (
        <div className="text-center py-12 bg-gray-800 rounded-lg border border-gray-700">
          <UserPlus className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No regular users found</h3>
          <p className="text-gray-300">All users are already admins or super admins</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((user) => (
            <div
              key={user.id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3 mb-4">
                <img
                  src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=f97316&color=fff`}
                  alt={user.full_name}
                  className="w-12 h-12 rounded-full"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{user.full_name}</h3>
                  <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                    <Calendar className="w-3 h-3" />
                    <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePromoteUser(user, 'admin')}
                    disabled={promotingUserId === user.id || actionInProgress !== null}
                    className="flex-1 px-3 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Shield className="w-4 h-4" />
                    {promotingUserId === user.id ? 'Promoting...' : 'Make Admin'}
                  </button>
                  <button
                    onClick={() => handlePromoteUser(user, 'super_admin')}
                    disabled={promotingUserId === user.id || actionInProgress !== null}
                    className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Crown className="w-4 h-4" />
                    {promotingUserId === user.id ? 'Promoting...' : 'Super Admin'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleResetPassword(user)}
                    disabled={actionInProgress !== null}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <KeyRound className="w-4 h-4" />
                    {actionInProgress === `reset-${user.id}` ? 'Resetting...' : 'Reset Password'}
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user)}
                    disabled={actionInProgress !== null}
                    className="flex-1 px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {actionInProgress === `delete-${user.id}` ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateAdminModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={loadRegularUsers}
        />
      )}
    </div>
  );
};
