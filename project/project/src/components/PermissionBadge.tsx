import React from 'react';
import { Calendar, Package, Users } from 'lucide-react';

interface PermissionBadgeProps {
  permission: 'can_manage_events' | 'can_manage_inventory' | 'can_manage_users';
  className?: string;
}

export const PermissionBadge: React.FC<PermissionBadgeProps> = ({ permission, className = '' }) => {
  const getPermissionInfo = () => {
    switch (permission) {
      case 'can_manage_events':
        return {
          icon: Calendar,
          label: 'Events',
          color: 'bg-blue-100 text-blue-700 border-blue-200'
        };
      case 'can_manage_inventory':
        return {
          icon: Package,
          label: 'Inventory',
          color: 'bg-green-100 text-green-700 border-green-200'
        };
      case 'can_manage_users':
        return {
          icon: Users,
          label: 'Users',
          color: 'bg-purple-100 text-purple-700 border-purple-200'
        };
    }
  };

  const info = getPermissionInfo();
  const Icon = info.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${info.color} ${className}`}
      title={`Can manage ${info.label.toLowerCase()}`}
    >
      <Icon className="w-3 h-3" />
      {info.label}
    </span>
  );
};
