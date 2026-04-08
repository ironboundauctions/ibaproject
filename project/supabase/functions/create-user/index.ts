import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateUserRequest {
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'user';
  permissions: {
    can_manage_events: boolean;
    can_manage_inventory: boolean;
    can_manage_users: boolean;
  };
}

function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Verify caller's permissions
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth verification error:', userError);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Check if user has permission to create users
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role, permissions')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleError || !roleData) {
      console.error('Role check error:', roleError);
      return new Response(
        JSON.stringify({ success: false, error: "User role not found" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Super admins can create anyone. Regular admins can create users and admins (but not super admins)
    const requestData: CreateUserRequest = await req.json();
    const { email, name, role, permissions } = requestData;

    if (roleData.role !== 'super_admin') {
      if (!roleData.permissions?.can_manage_users) {
        return new Response(
          JSON.stringify({ success: false, error: "Insufficient permissions to create users" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      if (role === 'super_admin') {
        return new Response(
          JSON.stringify({ success: false, error: "Only super admins can create other super admins" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
    }

    console.log('Received request data:', JSON.stringify(requestData, null, 2));

    if (!email || !name || !role) {
      console.error('Missing fields:', { email: !!email, name: !!name, role: !!role });
      return new Response(
        JSON.stringify({
          success: false,
          error: `Missing required fields. Received: email=${!!email}, name=${!!name}, role=${!!role}`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Generate a temporary password
    const temporaryPassword = generateTemporaryPassword();

    // Create user with temporary password and email confirmed
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        name,
        role
      }
    });

    if (createError || !authData?.user) {
      console.error('Auth error:', createError);
      return new Response(
        JSON.stringify({ success: false, error: createError?.message || 'Failed to create user' }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log('User created in auth.users:', authData.user.id);

    // Wait for trigger to create profile and default user_role
    await new Promise(resolve => setTimeout(resolve, 500));

    // Update user role (trigger creates a default 'user' role, so we update it)
    const { error: roleUpdateError } = await supabaseAdmin
      .from('user_roles')
      .update({
        role,
        permissions
      })
      .eq('user_id', authData.user.id);

    if (roleUpdateError) {
      console.error('Role update error:', roleUpdateError);

      // Clean up: delete the user we just created
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to update user role: ${roleUpdateError.message}`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log('User created successfully:', {
      userId: authData.user.id,
      email,
      role
    });

    // Return success with temporary password
    return new Response(
      JSON.stringify({
        success: true,
        userId: authData.user.id,
        email: email,
        temporaryPassword: temporaryPassword
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error('Error creating user:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Full error details:', JSON.stringify(error, null, 2));
    return new Response(
      JSON.stringify({
        success: false,
        error: `Database error creating new user: ${errorMessage}`
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
