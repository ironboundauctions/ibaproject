import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  const CF_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  const CF_API_TOKEN = Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN");
  const CF_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/live_inputs`;

  function cfHeaders() {
    return {
      "Authorization": `Bearer ${CF_API_TOKEN}`,
      "Content-Type": "application/json",
    };
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // POST /cloudflare-stream?action=create  { eventId, eventName }
    if (req.method === "POST" && action === "create") {
      const { eventId, eventName } = await req.json();

      const cfRes = await fetch(CF_BASE, {
        method: "POST",
        headers: cfHeaders(),
        body: JSON.stringify({
          meta: { name: eventName || `Auction ${eventId}` },
          recording: { mode: "automatic", timeoutSeconds: 300 },
        }),
      });

      if (!cfRes.ok) {
        const errText = await cfRes.text();
        return new Response(JSON.stringify({ error: "Cloudflare error", detail: errText }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cfData = await cfRes.json();
      const liveInput = cfData.result;

      const whipUrl = `https://live.cloudflare.com/live/${CF_ACCOUNT_ID}/${liveInput.uid}/whip`;
      const playbackUrl = `https://customer-${liveInput.uid}.cloudflarestream.com/${liveInput.uid}/manifest/video.m3u8`;

      // Store on session
      await supabase
        .from("live_auction_sessions")
        .update({
          cf_stream_uid: liveInput.uid,
          cf_stream_whip_url: whipUrl,
          cf_stream_playback_url: playbackUrl,
          cf_stream_status: "idle",
        })
        .eq("event_id", eventId)
        .neq("status", "ended");

      return new Response(
        JSON.stringify({
          uid: liveInput.uid,
          whipUrl,
          playbackUrl,
          whepUrl: `https://customer-${liveInput.uid}.cloudflarestream.com/${liveInput.uid}/whep`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /cloudflare-stream?action=status&uid=...
    if (req.method === "GET" && action === "status") {
      const uid = url.searchParams.get("uid");
      if (!uid) {
        return new Response(JSON.stringify({ error: "uid required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cfRes = await fetch(`${CF_BASE}/${uid}`, { headers: cfHeaders() });
      if (!cfRes.ok) {
        return new Response(JSON.stringify({ error: "Stream not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cfData = await cfRes.json();
      const liveInput = cfData.result;

      return new Response(
        JSON.stringify({
          uid: liveInput.uid,
          status: liveInput.status?.current?.state ?? "idle",
          videoId: liveInput.status?.current?.videoId ?? null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE /cloudflare-stream?action=delete&uid=...
    if (req.method === "DELETE" && action === "delete") {
      const uid = url.searchParams.get("uid");
      if (!uid) {
        return new Response(JSON.stringify({ error: "uid required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await fetch(`${CF_BASE}/${uid}`, {
        method: "DELETE",
        headers: cfHeaders(),
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
