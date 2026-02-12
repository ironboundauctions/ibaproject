import { supabase } from '../lib/supabase';

export type UserRole = 'super_admin' | 'admin' | 'user';

export interface UserPermissions {
  can_manage_events: boolean;
  can_manage_inventory: boolean;
  can_manage_users: boolean;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  permissions: UserPermissions;
  invitation_token?: string;
  invitation_expires_at?: string;
  invitation_status?: 'pending' | 'accepted' | 'expired';
  created_at: string;
  updated_at: string;
}

export class UserRoleService {
  static async getUserRole(userId: string): Promise<UserRole | null> {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }

      return data?.role || null;
    } catch (error) {
      console.error('Error fetching user role:', error);
      return null;
    }
  }

  static async getCurrentUserRole(): Promise<UserRole | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return null;
      }

      return await this.getUserRole(user.id);
    } catch (error) {
      console.error('Error fetching current user role:', error);
      return null;
    }
  }

  static async isAdmin(userId?: string): Promise<boolean> {
    try {
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;
        userId = user.id;
      }

      const role = await this.getUserRole(userId);
      return role === 'admin' || role === 'super_admin';
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }

  static async isSuperAdmin(userId?: string): Promise<boolean> {
    try {
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;
        userId = user.id;
      }

      const role = await this.getUserRole(userId);
      return role === 'super_admin';
    } catch (error) {
      console.error('Error checking super admin status:', error);
      return false;
    }
  }

  static async getUserPermissions(userId: string): Promise<UserPermissions | null> {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('permissions')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user permissions:', error);
        return null;
      }

      return data?.permissions || null;
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      return null;
    }
  }

  static async checkPermission(userId: string, permissionName: keyof UserPermissions): Promise<boolean> {
    try {
      const role = await this.getUserRole(userId);
      if (role === 'super_admin') return true;

      const permissions = await this.getUserPermissions(userId);
      return permissions?.[permissionName] || false;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  static async isAdminOrSubadmin(userId?: string): Promise<boolean> {
    return this.isAdmin(userId);
  }

  static async setUserRole(userId: string, role: UserRole, permissions?: UserPermissions): Promise<boolean> {
    try {
      const updateData: any = {
        user_id: userId,
        role: role,
        updated_at: new Date().toISOString()
      };

      if (permissions) {
        updateData.permissions = permissions;
      }

      const { error } = await supabase
        .from('user_roles')
        .upsert(updateData, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error setting user role:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error setting user role:', error);
      return false;
    }
  }

  static async updateUserPermissions(userId: string, permissions: UserPermissions): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({
          permissions,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating user permissions:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating user permissions:', error);
      return false;
    }
  }

  static async getAllUserRoles(): Promise<UserRoleRecord[]> {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user roles:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching user roles:', error);
      return [];
    }
  }
}
