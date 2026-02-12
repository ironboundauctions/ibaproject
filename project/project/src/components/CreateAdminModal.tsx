import React, { useState, useEffect } from 'react';
import { X, UserPlus, ArrowUp, Mail, User, Calendar, Package, Users as UsersIcon, Crown, Shield } from 'lucide-react';
import { AdminManagementService } from '../services/adminManagementService';
import { UserPermissions } from '../services/userRoleService';
import { supabase } from '../lib/supabase';

interface CreateAdminModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type CreationMode = 'create' | 'promote';

interface RegularUser {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
}

export const CreateAdminModal: React.FC<CreateAdminModalProps> = ({ onClose, onSuccess }) => {
  const [mode, setMode] = useState<CreationMode>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'super_admin' | 'admin'>('admin');
  const [permissions, setPermissions] = useState<UserPermissions>({
    can_manage_events: true,
    can_manage_inventory: true,
    can_manage_users: false
  });

  const [regularUsers, setRegularUsers] = useState<RegularUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (mode === 'promote') {
      loadRegularUsers();
    }
  }, [mode]);

  const loadRegularUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          profiles!inner (
            id,
            email,
            full_name,
            avatar_url,
            created_at
          )
        `)
        .eq('role', 'user')
        .order('profiles(created_at)', { ascending: false });

      if (error) throw error;

      const users = (data || []).map((item: any) => ({
        id: item.user_id,
        email: item.profiles.email,
        full_name: item.profiles.full_name,
        avatar_url: item.profiles.avatar_url,
        created_at: item.profiles.created_at
      }));

      setRegularUsers(users);
    } catch (err) {
      console.error('Error loading regular users:', err);
      setError('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleTogglePermission = (key: keyof UserPermissions) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'create') {
        if (!email || !name) {
          setError('Email and name are required');
          setLoading(false);
          return;
        }

        const result = await AdminManagementService.createAdminWithInvitation({
          email,
          name,
          role,
          permissions: role === 'super_admin' ? {
            can_manage_events: true,
            can_manage_inventory: true,
            can_manage_users: true
          } : permissions
        });

        if (result.success) {
          onSuccess();
          onClose();
        } else {
          setError(result.error || 'Failed to create admin');
        }
      } else {
        if (!selectedUserId) {
          setError('Please select a user to promote');
          setLoading(false);
          return;
        }

        const result = await AdminManagementService.promoteUserToAdmin(
          selectedUserId,
          role,
          role === 'super_admin' ? {
            can_manage_events: true,
            can_manage_inventory: true,
            can_manage_users: true
          } : permissions
        );

        if (result.success) {
          onSuccess();
          onClose();
        } else {
          setError(result.error || 'Failed to promote user');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const selectedUser = regularUsers.find(u => u.id === selectedUserId);

  const permissionOptions = [
    {
      key: 'can_manage_events' as keyof UserPermissions,
      label: 'Event Management',
      description: 'Create, edit, and delete auction events',
      icon: Calendar,
      color: 'text-blue-600'
    },
    {
      key: 'can_manage_inventory' as keyof UserPermissions,
      label: 'Inventory Management',
      description: 'Manage inventory items and lots',
      icon: Package,
      color: 'text-green-600'
    },
    {
      key: 'can_manage_users' as keyof UserPermissions,
      label: 'User Management',
      description: 'View and manage user accounts',
      icon: UsersIcon,
      color: 'text-purple-600'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Add New Admin</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => setMode('create')}
              className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                mode === 'create'
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <UserPlus className="w-5 h-5" />
              <span className="font-medium">Create New Admin</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('promote')}
              className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                mode === 'promote'
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <ArrowUp className="w-5 h-5" />
              <span className="font-medium">Promote Existing User</span>
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'create' ? (
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail className="w-4 h-4 inline mr-1" />
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="admin@example.com"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User className="w-4 h-4 inline mr-1" />
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="John Doe"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    An invitation email will be sent to this address with a secure link to set up their password.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                {loadingUsers ? (
                  <div className="text-center py-8 text-gray-500">Loading users...</div>
                ) : regularUsers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No regular users found</div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select User to Promote
                    </label>
                    <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {regularUsers.map((user) => (
                        <label
                          key={user.id}
                          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                            selectedUserId === user.id
                              ? 'bg-orange-50 border-2 border-orange-500'
                              : 'border-2 border-transparent hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="user"
                            value={user.id}
                            checked={selectedUserId === user.id}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="w-4 h-4 text-orange-600"
                            disabled={loading}
                          />
                          <img
                            src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=f97316&color=fff`}
                            alt={user.full_name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{user.full_name}</p>
                            <p className="text-sm text-gray-600 truncate">{user.email}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {selectedUser && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      {selectedUser.full_name} will be promoted immediately and can access admin features right away.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">Role</label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    role === 'admin'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="admin"
                    checked={role === 'admin'}
                    onChange={(e) => setRole(e.target.value as 'admin')}
                    className="mt-1 w-4 h-4 text-orange-600"
                    disabled={loading}
                  />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="w-4 h-4 text-orange-600" />
                      <span className="font-medium text-gray-900">Admin</span>
                    </div>
                    <p className="text-sm text-gray-600">Limited access based on assigned permissions</p>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    role === 'super_admin'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="super_admin"
                    checked={role === 'super_admin'}
                    onChange={(e) => setRole(e.target.value as 'super_admin')}
                    className="mt-1 w-4 h-4 text-orange-600"
                    disabled={loading}
                  />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Crown className="w-4 h-4 text-red-600" />
                      <span className="font-medium text-gray-900">Super Admin</span>
                    </div>
                    <p className="text-sm text-gray-600">Full access to all features</p>
                  </div>
                </label>
              </div>

              {role === 'super_admin' && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800 font-medium">
                    Warning: Super admins have unrestricted access to all admin features including user and admin management.
                  </p>
                </div>
              )}
            </div>

            {role === 'admin' && (
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 text-sm mb-3">Permissions</h4>
                <div className="space-y-3">
                  {permissionOptions.map((option) => {
                    const Icon = option.icon;
                    const isEnabled = permissions[option.key];

                    return (
                      <label
                        key={option.key}
                        className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                          isEnabled
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => handleTogglePermission(option.key)}
                          className="mt-1 w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                          disabled={loading}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={`w-4 h-4 ${option.color}`} />
                            <span className="font-medium text-gray-900">{option.label}</span>
                          </div>
                          <p className="text-sm text-gray-600">{option.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                disabled={loading || (mode === 'promote' && !selectedUserId)}
              >
                {loading ? 'Processing...' : mode === 'create' ? 'Send Invitation' : 'Promote to Admin'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
