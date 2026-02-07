import React, { useState, useEffect } from 'react';
import { UserPlus, Shield, Crown, RefreshCw } from 'lucide-react';
import { AdminManagementService, AdminWithProfile } from '../services/adminManagementService';
import { AdminCard } from './AdminCard';
import { CreateAdminModal } from './CreateAdminModal';
import { EditPermissionsModal } from './EditPermissionsModal';

interface AdminManagementPanelProps {
  currentUserId: string;
}

export const AdminManagementPanel: React.FC<AdminManagementPanelProps> = ({ currentUserId }) => {
  const [admins, setAdmins] = useState<AdminWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminWithProfile | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    setLoading(true);
    const data = await AdminManagementService.getAllAdmins();
    setAdmins(data);
    setLoading(false);
  };

  const handleEditPermissions = (admin: AdminWithProfile) => {
    setEditingAdmin(admin);
  };

  const handleChangeRole = async (admin: AdminWithProfile) => {
    if (actionInProgress) return;

    const newRole = admin.role === 'super_admin' ? 'admin' : 'super_admin';
    const confirmMessage =
      newRole === 'super_admin'
        ? `Are you sure you want to promote ${admin.full_name} to Super Admin? They will have full access to all features including admin management.`
        : `Are you sure you want to change ${admin.full_name} to a regular Admin? They will lose super admin privileges.`;

    if (!confirm(confirmMessage)) return;

    setActionInProgress(true);
    const result = await AdminManagementService.changeAdminRole(admin.user_id, newRole);

    if (result.success) {
      await loadAdmins();
    } else {
      alert(result.error || 'Failed to change role');
    }
    setActionInProgress(false);
  };

  const handleDemote = async (admin: AdminWithProfile) => {
    if (actionInProgress) return;

    if (!confirm(`Are you sure you want to demote ${admin.full_name} to a regular user? They will lose all admin access.`)) {
      return;
    }

    setActionInProgress(true);
    const result = await AdminManagementService.demoteAdminToUser(admin.user_id);

    if (result.success) {
      await loadAdmins();
    } else {
      alert(result.error || 'Failed to demote admin');
    }
    setActionInProgress(false);
  };

  const handleDelete = async (admin: AdminWithProfile) => {
    if (actionInProgress) return;

    const canDeleteResult = await AdminManagementService.canDeleteAdmin(admin.user_id, currentUserId);

    if (!canDeleteResult.canDelete) {
      alert(canDeleteResult.reason || 'Cannot delete this admin');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${admin.full_name}'s account? This action cannot be undone.`)) {
      return;
    }

    setActionInProgress(true);
    const result = await AdminManagementService.deleteAdmin(admin.user_id);

    if (result.success) {
      await loadAdmins();
    } else {
      alert(result.error || 'Failed to delete admin');
    }
    setActionInProgress(false);
  };

  const handleResendInvitation = async (admin: AdminWithProfile) => {
    if (actionInProgress) return;

    setActionInProgress(true);
    const result = await AdminManagementService.resendInvitation(admin.user_id);

    if (result.success) {
      alert(`Invitation resent to ${admin.email}`);
      await loadAdmins();
    } else {
      alert(result.error || 'Failed to resend invitation');
    }
    setActionInProgress(false);
  };

  const handleCancelInvitation = async (admin: AdminWithProfile) => {
    if (actionInProgress) return;

    if (!confirm(`Are you sure you want to cancel the invitation for ${admin.email}?`)) {
      return;
    }

    setActionInProgress(true);
    const result = await AdminManagementService.cancelInvitation(admin.user_id);

    if (result.success) {
      await loadAdmins();
    } else {
      alert(result.error || 'Failed to cancel invitation');
    }
    setActionInProgress(false);
  };

  const superAdmins = admins.filter(a => a.role === 'super_admin');
  const regularAdmins = admins.filter(a => a.role === 'admin');
  const pendingInvitations = admins.filter(a => a.invitation_status === 'pending');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Loading admin data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Admin Management</h2>
          <p className="text-gray-600 mt-1">Manage admin accounts and permissions</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
        >
          <UserPlus className="w-5 h-5" />
          Add New Admin
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Crown className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-red-600 font-medium">Super Admins</p>
              <p className="text-2xl font-bold text-red-900">{superAdmins.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Shield className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-orange-600 font-medium">Admins</p>
              <p className="text-2xl font-bold text-orange-900">{regularAdmins.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <UserPlus className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-yellow-600 font-medium">Pending Invitations</p>
              <p className="text-2xl font-bold text-yellow-900">{pendingInvitations.length}</p>
            </div>
          </div>
        </div>
      </div>

      {pendingInvitations.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Pending Invitations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingInvitations.map((admin) => (
              <AdminCard
                key={admin.id}
                admin={admin}
                currentUserId={currentUserId}
                onEditPermissions={handleEditPermissions}
                onChangeRole={handleChangeRole}
                onDemote={handleDemote}
                onDelete={handleDelete}
                onResendInvitation={handleResendInvitation}
                onCancelInvitation={handleCancelInvitation}
              />
            ))}
          </div>
        </div>
      )}

      {superAdmins.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Super Admins</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {superAdmins.map((admin) => (
              <AdminCard
                key={admin.id}
                admin={admin}
                currentUserId={currentUserId}
                onEditPermissions={handleEditPermissions}
                onChangeRole={handleChangeRole}
                onDemote={handleDemote}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {regularAdmins.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Admins</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {regularAdmins.map((admin) => (
              <AdminCard
                key={admin.id}
                admin={admin}
                currentUserId={currentUserId}
                onEditPermissions={handleEditPermissions}
                onChangeRole={handleChangeRole}
                onDemote={handleDemote}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {admins.length === 0 && (
        <div className="text-center py-12">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No admins found</h3>
          <p className="text-gray-600 mb-4">Get started by creating your first admin account</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors inline-flex items-center gap-2"
          >
            <UserPlus className="w-5 h-5" />
            Add New Admin
          </button>
        </div>
      )}

      {showCreateModal && (
        <CreateAdminModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={loadAdmins}
        />
      )}

      {editingAdmin && (
        <EditPermissionsModal
          admin={editingAdmin}
          onClose={() => setEditingAdmin(null)}
          onSuccess={loadAdmins}
        />
      )}
    </div>
  );
};
