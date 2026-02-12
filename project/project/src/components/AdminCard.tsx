import React from 'react';
import { MoreVertical, Edit, Trash2, ArrowDown, RefreshCw, XCircle } from 'lucide-react';
import { AdminWithProfile } from '../services/adminManagementService';
import { RoleBadge } from './RoleBadge';
import { PermissionBadge } from './PermissionBadge';
import { UserPermissions } from '../services/userRoleService';

interface AdminCardProps {
  admin: AdminWithProfile;
  currentUserId: string;
  onEditPermissions: (admin: AdminWithProfile) => void;
  onChangeRole: (admin: AdminWithProfile) => void;
  onDemote: (admin: AdminWithProfile) => void;
  onDelete: (admin: AdminWithProfile) => void;
  onResendInvitation?: (admin: AdminWithProfile) => void;
  onCancelInvitation?: (admin: AdminWithProfile) => void;
}

export const AdminCard: React.FC<AdminCardProps> = ({
  admin,
  currentUserId,
  onEditPermissions,
  onChangeRole,
  onDemote,
  onDelete,
  onResendInvitation,
  onCancelInvitation
}) => {
  const [showMenu, setShowMenu] = React.useState(false);
  const isCurrentUser = admin.user_id === currentUserId;
  const isPending = admin.invitation_status === 'pending';

  const activePermissions = Object.entries(admin.permissions)
    .filter(([_, value]) => value === true)
    .map(([key]) => key as keyof UserPermissions);

  const avatarUrl = admin.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(admin.full_name)}&background=f97316&color=fff`;

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow ${isPending ? 'opacity-75' : ''}`}>
      <div className="flex items-start gap-4">
        <img
          src={avatarUrl}
          alt={admin.full_name}
          className="w-12 h-12 rounded-full object-cover"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 truncate">{admin.full_name}</h3>
            {isCurrentUser && (
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">
                You
              </span>
            )}
          </div>

          <p className="text-sm text-gray-600 mb-2 truncate">{admin.email}</p>

          <div className="flex items-center gap-2 mb-3">
            <RoleBadge role={admin.role} />
            {isPending && (
              <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full font-medium border border-yellow-200">
                Invitation Pending
              </span>
            )}
          </div>

          {activePermissions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activePermissions.map((permission) => (
                <PermissionBadge key={permission} permission={permission} />
              ))}
            </div>
          )}

          {activePermissions.length === 0 && !isPending && admin.role === 'admin' && (
            <p className="text-xs text-gray-500 italic">No permissions assigned</p>
          )}
        </div>

        {!isCurrentUser && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Actions"
            >
              <MoreVertical className="w-5 h-5 text-gray-600" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  {isPending ? (
                    <>
                      {onResendInvitation && (
                        <button
                          onClick={() => {
                            onResendInvitation(admin);
                            setShowMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Resend Invitation
                        </button>
                      )}
                      {onCancelInvitation && (
                        <button
                          onClick={() => {
                            onCancelInvitation(admin);
                            setShowMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <XCircle className="w-4 h-4" />
                          Cancel Invitation
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          onEditPermissions(admin);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Edit Permissions
                      </button>
                      <button
                        onClick={() => {
                          onChangeRole(admin);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Change Role
                      </button>
                      <button
                        onClick={() => {
                          onDemote(admin);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <ArrowDown className="w-4 h-4" />
                        Demote to User
                      </button>
                      <button
                        onClick={() => {
                          onDelete(admin);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Account
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Added {new Date(admin.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })}
        </p>
      </div>
    </div>
  );
};
