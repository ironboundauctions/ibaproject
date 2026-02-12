import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const url = new URL(req.url);
    const fileId = url.searchParams.get("file_id");
    const lotId = url.searchParams.get("lot_id");
    const auctionId = url.searchParams.get("auction_id");

    if (!fileId && !lotId && !auctionId) {
      return new Response(
        JSON.stringify({ error: "Must provide file_id, lot_id, or auction_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let query = supabase
      .from("auction_files")
      .select(`
        id,
        file_key,
        file_name,
        file_type,
        thumb_url,
        display_url,
        publish_status,
        published_at,
        deleted_at,
        cdn_key_prefix,
        lot_id,
        auction_id
      `);

    if (fileId) {
      query = query.eq("id", fileId);
    } else if (lotId) {
      query = query.eq("lot_id", lotId);
    } else if (auctionId) {
      query = query.eq("auction_id", auctionId);
    }

    query = query.is("deleted_at", null);

    const { data: files, error: filesError } = await query;

    if (filesError) {
      console.error("Error fetching files:", filesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch files", details: filesError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!files || files.length === 0) {
      return new Response(
        JSON.stringify({ files: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileIds = files.map((f) => f.id);
    const { data: jobs, error: jobsError } = await supabase
      .from("publish_jobs")
      .select("file_id, status, retry_count, error_message, started_at, completed_at")
      .in("file_id", fileIds)
      .order("created_at", { ascending: false });

    if (jobsError) {
      console.error("Error fetching jobs:", jobsError);
    }

    const jobsByFileId = new Map();
    if (jobs) {
      jobs.forEach((job) => {
        if (!jobsByFileId.has(job.file_id)) {
          jobsByFileId.set(job.file_id, job);
        }
      });
    }

    const result = files.map((file) => ({
      ...file,
      job: jobsByFileId.get(file.id) || null,
    }));

    return new Response(
      JSON.stringify({ files: result }),
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
