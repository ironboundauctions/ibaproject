import { supabase } from '../lib/supabase';

export class AuthService {
  static async checkAdminExists(): Promise<boolean> {
    if (!supabase) return false;

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('id')
        .eq('role', 'super_admin')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('Error checking for admin:', error);
        return false;
      }

      return !!data;
    } catch (err) {
      console.error('checkAdminExists error:', err);
      return false;
    }
  }

  static async updatePassword(newPassword: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;
  }

  static async createFirstAdmin(email: string, password: string, name: string): Promise<any> {
    if (!supabase) throw new Error('Supabase not configured');

    // Sign up the user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role: 'admin'
        },
        emailRedirectTo: undefined
      }
    });

    if (authError) throw authError;

    // If user was created but needs confirmation, they'll be in the session
    // The auth state change listener will pick up the login
    if (authData.session) {
      console.log('Admin user created and signed in automatically');
      return authData.user;
    }

    // If no session, the user was created but needs email confirmation
    // Try to sign in anyway (works if email confirmation is disabled)
    console.log('No session after signup, attempting to sign in...');
    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        console.warn('Sign in after signup failed:', signInError.message);
        // User was created but can't sign in - they need to confirm email
        throw new Error('Account created but requires email confirmation. Please check your email.');
      }

      return signInData.user;
    } catch (err) {
      console.error('Error signing in after admin creation:', err);
      throw err;
    }
  }

  static async signIn(email: string, password: string): Promise<any> {
    if (!supabase) throw new Error('Supabase not configured');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    let avatarUrl = null;
    let role = 'user';

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', data.user.id)
        .maybeSingle();
      avatarUrl = profile?.avatar_url;
    } catch (err) {
      console.warn('Could not fetch profile avatar:', err);
    }

    try {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .maybeSingle();
      role = roleData?.role || 'user';
    } catch (err) {
      console.warn('Could not fetch user role:', err);
    }

    return {
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.name || 'User',
      role: role,
      avatar: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.user.user_metadata?.name || 'User')}&background=f97316&color=fff`
    };
  }

  static async signUp(email: string, password: string, name: string): Promise<any> {
    if (!supabase) throw new Error('Supabase not configured');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/`
      }
    });

    if (error) throw error;

    // Always sign out immediately after signup to force email confirmation
    if (data.session) {
      await supabase.auth.signOut();
    }

    // Return special object that indicates confirmation is required
    return {
      requiresConfirmation: true,
      message: 'Please check your email and click the confirmation link before signing in.'
    };
  }

  static async signOut(): Promise<void> {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  static async getCurrentUser(): Promise<any> {
    if (!supabase) return null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      let avatarUrl = null;
      let role = 'user';

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .maybeSingle();
        avatarUrl = profile?.avatar_url;
      } catch (err) {
        console.warn('Could not fetch profile avatar:', err);
      }

      try {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        role = roleData?.role || 'user';
      } catch (err) {
        console.warn('Could not fetch user role:', err);
      }

      return {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || 'User',
        role: role,
        avatar: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata?.name || 'User')}&background=f97316&color=fff`
      };
    } catch (error) {
      console.error('getCurrentUser error:', error);
      return null;
    }
  }

  static onAuthStateChange(callback: (user: any) => void) {
    if (!supabase) {
      return {
        data: {
          subscription: {
            unsubscribe: () => {}
          }
        }
      };
    }

    return supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (session?.user) {
          let avatarUrl = null;
          let role = 'user';

          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('avatar_url')
              .eq('id', session.user.id)
              .maybeSingle();
            avatarUrl = profile?.avatar_url;
          } catch (err) {
            console.warn('Could not fetch profile avatar:', err);
          }

          try {
            const { data: roleData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id)
              .maybeSingle();
            role = roleData?.role || 'user';
          } catch (err) {
            console.warn('Could not fetch user role:', err);
          }

          const user = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name || 'User',
            role: role,
            avatar: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user.user_metadata?.name || 'User')}&background=f97316&color=fff`
          };
          callback(user);
        } else {
          callback(null);
        }
      })();
    });
  }

  static async getAllAdminUsers(): Promise<any[]> {
    if (!supabase) return [];

    try {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role, permissions')
        .in('role', ['super_admin', 'admin']);

      if (!roles || roles.length === 0) return [];

      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      return profiles?.map(profile => {
        const roleData = roles.find(r => r.user_id === profile.id);
        return {
          ...profile,
          role: roleData?.role || 'user',
          permissions: roleData?.permissions
        };
      }) || [];
    } catch (err) {
      console.error('getAllAdminUsers error:', err);
      return [];
    }
  }

  static async makeUserAdmin(userId: string): Promise<void> {
    if (!supabase) return;

    // Check if user_roles entry exists
    const { data: existing } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      // Update existing role
      await supabase
        .from('user_roles')
        .update({
          role: 'admin',
          permissions: {
            can_manage_events: true,
            can_manage_inventory: true,
            can_manage_users: false
          }
        })
        .eq('user_id', userId);
    } else {
      // Create new role entry
      await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'admin',
          permissions: {
            can_manage_events: true,
            can_manage_inventory: true,
            can_manage_users: false
          }
        });
    }
  }
}

export const isAdminUser = (user: any): boolean => {
  return user && (user.role === 'admin' || user.role === 'super_admin');
};

export const isSuperAdmin = (user: any): boolean => {
  return user && user.role === 'super_admin';
};

export const isMainAdmin = (user: any): boolean => {
  return isSuperAdmin(user);
};

export const canManageAdmins = (user: any): boolean => {
  return isSuperAdmin(user);
};

export const canManageRegularUsers = (user: any): boolean => {
  return isAdminUser(user);
};

export const canAccessAdminPanel = (user: any): boolean => {
  return isAdminUser(user);
};
