import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AttachRequest {
  file_key: string;
  file_name: string;
  file_type: string;
  lot_id?: string;
  auction_id?: string;
  priority?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: AttachRequest = await req.json();

    if (!body.file_key || !body.file_name || !body.file_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: file_key, file_name, file_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: fileData, error: fileError } = await supabase
      .from("auction_files")
      .insert({
        file_key: body.file_key,
        file_name: body.file_name,
        file_type: body.file_type,
        lot_id: body.lot_id || null,
        auction_id: body.auction_id || null,
        publish_status: "pending",
      })
      .select()
      .single();

    if (fileError) {
      console.error("Error creating auction_file:", fileError);
      return new Response(
        JSON.stringify({ error: "Failed to create file record", details: fileError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: jobData, error: jobError } = await supabase
      .from("publish_jobs")
      .insert({
        file_id: fileData.id,
        status: "pending",
        priority: body.priority || 5,
        max_retries: 5,
      })
      .select()
      .single();

    if (jobError) {
      console.error("Error creating publish_job:", jobError);
      return new Response(
        JSON.stringify({ error: "Failed to create job", details: jobError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        file: fileData,
        job: jobData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
