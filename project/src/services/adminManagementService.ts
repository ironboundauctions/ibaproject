import { supabase } from '../lib/supabase';
import { UserRole, UserPermissions, UserRoleRecord } from './userRoleService';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface AdminWithProfile {
  id: string;
  user_id: string;
  role: UserRole;
  permissions: UserPermissions;
  invitation_status?: 'pending' | 'accepted' | 'expired';
  invitation_expires_at?: string;
  created_at: string;
  email: string;
  full_name: string;
  avatar_url?: string;
}

export interface CreateAdminData {
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'user';
  permissions: UserPermissions;
}

export interface InvitationData {
  token: string;
  email: string;
  role: UserRole;
  permissions: UserPermissions;
  expires_at: string;
}

export class AdminManagementService {
  static async getAllAdmins(): Promise<AdminWithProfile[]> {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          *,
          profiles!user_roles_user_id_fkey (
            email,
            full_name,
            avatar_url
          )
        `)
        .in('role', ['super_admin', 'admin'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching admins:', error);
        return [];
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        role: item.role,
        permissions: item.permissions,
        invitation_status: item.invitation_status,
        invitation_expires_at: item.invitation_expires_at,
        created_at: item.created_at,
        email: item.profiles.email,
        full_name: item.profiles.full_name,
        avatar_url: item.profiles.avatar_url
      }));
    } catch (error) {
      console.error('Error fetching admins:', error);
      return [];
    }
  }

  static async getAllUsers(): Promise<AdminWithProfile[]> {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          *,
          profiles!user_roles_user_id_fkey (
            email,
            full_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        return [];
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        role: item.role,
        permissions: item.permissions,
        invitation_status: item.invitation_status,
        invitation_expires_at: item.invitation_expires_at,
        created_at: item.created_at,
        email: item.profiles.email,
        full_name: item.profiles.full_name,
        avatar_url: item.profiles.avatar_url
      }));
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }

  static async createAdminWithInvitation(adminData: CreateAdminData): Promise<{ success: boolean; temporaryPassword?: string; email?: string; error?: string }> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      // Get the current user's session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

      const payload = {
        email: adminData.email,
        name: adminData.name,
        role: adminData.role,
        permissions: adminData.permissions,
      };

      console.log('Sending payload to create-user:', payload);
      console.log('Session token:', session.access_token?.substring(0, 20) + '...');
      console.log('Anon key:', supabaseAnonKey?.substring(0, 20) + '...');

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseAnonKey,
      };

      console.log('Request headers:', Object.keys(headers));

      const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log('Response from create-user:', { status: response.status, result });
      console.error('ERROR DETAILS:', result.error);

      if (!response.ok || !result.success) {
        return { success: false, error: result.error || 'Failed to create user' };
      }

      return {
        success: true,
        temporaryPassword: result.temporaryPassword,
        email: result.email
      };
    } catch (error: any) {
      console.error('Error creating admin with invitation:', error);
      return { success: false, error: error.message };
    }
  }

  static async promoteUserToAdmin(userId: string, role: 'super_admin' | 'admin', permissions: UserPermissions): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Promoting user:', { userId, role, permissions });

      const { data, error } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role,
          permissions,
          invitation_status: 'accepted'
        }, {
          onConflict: 'user_id'
        })
        .select();

      console.log('Promotion result:', { data, error });

      if (error) {
        console.error('Promotion error:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error promoting user to admin:', error);
      return { success: false, error: error.message };
    }
  }

  static async updateAdminPermissions(userId: string, permissions: UserPermissions): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

      // Get current role to preserve it
      const { data: currentRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (!currentRole) {
        return { success: false, error: 'User role not found' };
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/update-user-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          userId,
          role: currentRole.role,
          permissions
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return { success: false, error: result.error || 'Failed to update permissions' };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error updating admin permissions:', error);
      return { success: false, error: error.message };
    }
  }

  static async changeAdminRole(userId: string, newRole: 'super_admin' | 'admin'): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

      // Get current permissions to preserve them
      const { data: currentRole } = await supabase
        .from('user_roles')
        .select('permissions')
        .eq('user_id', userId)
        .maybeSingle();

      const response = await fetch(`${supabaseUrl}/functions/v1/update-user-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          userId,
          role: newRole,
          permissions: currentRole?.permissions
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return { success: false, error: result.error || 'Failed to change role' };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error changing admin role:', error);
      return { success: false, error: error.message };
    }
  }

  static async demoteAdminToUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/update-user-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          userId,
          role: 'user',
          permissions: {
            can_manage_events: false,
            can_manage_inventory: false,
            can_manage_users: false
          }
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return { success: false, error: result.error || 'Failed to demote user' };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error demoting admin to user:', error);
      return { success: false, error: error.message };
    }
  }

  static async deleteAdmin(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ userId }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return { success: false, error: result.error || 'Failed to delete user' };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting admin:', error);
      return { success: false, error: error.message };
    }
  }

  static async resetUserPassword(userId: string, sendEmail: boolean = false): Promise<{ success: boolean; temporaryPassword?: string; email?: string; error?: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/reset-user-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ userId, sendEmail }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return { success: false, error: result.error || 'Failed to reset password' };
      }

      return {
        success: true,
        temporaryPassword: result.temporaryPassword,
        email: result.email
      };
    } catch (error: any) {
      console.error('Error resetting password:', error);
      return { success: false, error: error.message };
    }
  }

  static async verifyInvitationToken(token: string): Promise<InvitationData | null> {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          *,
          profiles!inner (email)
        `)
        .eq('invitation_token', token)
        .eq('invitation_status', 'pending')
        .maybeSingle();

      if (error || !data) {
        console.error('Error verifying invitation token:', error);
        return null;
      }

      const expiresAt = new Date(data.invitation_expires_at);
      if (expiresAt < new Date()) {
        await supabase
          .from('user_roles')
          .update({ invitation_status: 'expired' })
          .eq('invitation_token', token);
        return null;
      }

      return {
        token: data.invitation_token,
        email: data.profiles.email,
        role: data.role,
        permissions: data.permissions,
        expires_at: data.invitation_expires_at
      };
    } catch (error) {
      console.error('Error verifying invitation token:', error);
      return null;
    }
  }

  static async acceptInvitation(token: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const invitation = await this.verifyInvitationToken(token);
      if (!invitation) {
        return { success: false, error: 'Invalid or expired invitation' };
      }

      const { data: roleData, error: roleQueryError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('invitation_token', token)
        .maybeSingle();

      if (roleQueryError || !roleData) {
        return { success: false, error: 'Invitation not found' };
      }

      const { error: updateError } = await supabase.auth.admin.updateUserById(
        roleData.user_id,
        { password }
      );

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      const { error: statusError } = await supabase
        .from('user_roles')
        .update({
          invitation_status: 'accepted',
          invitation_token: null,
          invitation_expires_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('invitation_token', token);

      if (statusError) {
        return { success: false, error: statusError.message };
      }

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: invitation.email,
        password
      });

      if (signInError) {
        return { success: false, error: signInError.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      return { success: false, error: error.message };
    }
  }

  static async resendInvitation(userId: string): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      const newToken = this.generateInvitationToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      const { error } = await supabase
        .from('user_roles')
        .update({
          invitation_token: newToken,
          invitation_expires_at: expiresAt.toISOString(),
          invitation_status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, token: newToken };
    } catch (error: any) {
      console.error('Error resending invitation:', error);
      return { success: false, error: error.message };
    }
  }

  static async cancelInvitation(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('invitation_status', 'pending');

      if (roleError) {
        return { success: false, error: roleError.message };
      }

      const { error: userError } = await supabase.auth.admin.deleteUser(userId);

      if (userError) {
        return { success: false, error: userError.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error canceling invitation:', error);
      return { success: false, error: error.message };
    }
  }

  static async getSuperAdminCount(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'super_admin');

      if (error) {
        console.error('Error counting super admins:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error counting super admins:', error);
      return 0;
    }
  }

  static async canDeleteAdmin(userId: string, currentUserId: string): Promise<{ canDelete: boolean; reason?: string }> {
    if (userId === currentUserId) {
      return { canDelete: false, reason: 'Cannot delete your own account' };
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) {
        return { canDelete: false, reason: 'Admin not found' };
      }

      if (data.role === 'super_admin') {
        const superAdminCount = await this.getSuperAdminCount();
        if (superAdminCount <= 1) {
          return { canDelete: false, reason: 'Cannot delete the last super admin' };
        }
      }

      return { canDelete: true };
    } catch (error) {
      console.error('Error checking if admin can be deleted:', error);
      return { canDelete: false, reason: 'Error checking permissions' };
    }
  }

  private static generateInvitationToken(): string {
    return `inv_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
  }
}
