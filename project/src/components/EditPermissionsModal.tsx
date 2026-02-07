import React, { useState } from 'react';
import { X, Calendar, Package, Users, Save } from 'lucide-react';
import { AdminWithProfile, AdminManagementService } from '../services/adminManagementService';
import { UserPermissions } from '../services/userRoleService';

interface EditPermissionsModalProps {
  admin: AdminWithProfile;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditPermissionsModal: React.FC<EditPermissionsModalProps> = ({
  admin,
  onClose,
  onSuccess
}) => {
  const [permissions, setPermissions] = useState<UserPermissions>(admin.permissions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const result = await AdminManagementService.updateAdminPermissions(admin.user_id, permissions);

    if (result.success) {
      onSuccess();
      onClose();
    } else {
      setError(result.error || 'Failed to update permissions');
    }

    setLoading(false);
  };

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
      icon: Users,
      color: 'text-purple-600'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Edit Permissions</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <img
                src={admin.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(admin.full_name)}&background=f97316&color=fff`}
                alt={admin.full_name}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <h3 className="font-semibold text-gray-900">{admin.full_name}</h3>
                <p className="text-sm text-gray-600">{admin.email}</p>
              </div>
            </div>
          </div>

          {admin.role === 'super_admin' && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                Super admins have all permissions by default. Changes here will only take effect if the role is changed to Admin.
              </p>
            </div>
          )}

          <div className="space-y-4 mb-6">
            <h4 className="font-medium text-gray-900 text-sm mb-3">Permissions</h4>
            {permissionOptions.map((option) => {
              const Icon = option.icon;
              const isEnabled = permissions[option.key];

              return (
                <label
                  key={option.key}
                  className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
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
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={loading}
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
