import React from 'react';
import { Shield, Crown } from 'lucide-react';
import { UserRole } from '../services/userRoleService';

interface RoleBadgeProps {
  role: UserRole;
  className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, className = '' }) => {
  const getRoleStyles = () => {
    switch (role) {
      case 'super_admin':
        return {
          bg: 'bg-red-100',
          text: 'text-red-800',
          border: 'border-red-200',
          icon: Crown,
          label: 'SUPER ADMIN'
        };
      case 'admin':
        return {
          bg: 'bg-orange-100',
          text: 'text-orange-800',
          border: 'border-orange-200',
          icon: Shield,
          label: 'ADMIN'
        };
      case 'user':
        return {
          bg: 'bg-gray-100',
          text: 'text-gray-800',
          border: 'border-gray-200',
          icon: null,
          label: 'USER'
        };
    }
  };

  const styles = getRoleStyles();
  const Icon = styles.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${styles.bg} ${styles.text} ${styles.border} ${className}`}
      title={`Role: ${styles.label}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {styles.label}
    </span>
  );
};
