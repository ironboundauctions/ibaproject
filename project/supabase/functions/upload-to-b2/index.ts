import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3.529.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface UploadResponse {
  success: boolean;
  path?: string;
  url?: string;
  cdnUrl?: string;
  error?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const itemId = formData.get("itemId") as string;

    if (!file || !itemId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing file or itemId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const b2KeyId = Deno.env.get("B2_KEY_ID");
    const b2AppKey = Deno.env.get("B2_APP_KEY");
    const b2Bucket = Deno.env.get("B2_BUCKET");
    const b2Endpoint = Deno.env.get("B2_ENDPOINT");
    const b2Region = Deno.env.get("B2_REGION");
    const cdnBaseUrl = Deno.env.get("CDN_BASE_URL");

    if (!b2KeyId || !b2AppKey || !b2Bucket || !b2Endpoint || !b2Region) {
      console.error("[B2] Missing B2 configuration");
      return new Response(
        JSON.stringify({ success: false, error: "B2 configuration missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const s3Client = new S3Client({
      endpoint: b2Endpoint,
      region: b2Region,
      credentials: {
        accessKeyId: b2KeyId,
        secretAccessKey: b2AppKey,
      },
    });

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `items/${itemId}/${fileName}`;

    const fileBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(fileBuffer);

    console.log(`[B2] Uploading file: ${filePath}`);
    console.log(`[B2] File size: ${file.size} bytes`);
    console.log(`[B2] MIME type: ${file.type}`);

    const command = new PutObjectCommand({
      Bucket: b2Bucket,
      Key: filePath,
      Body: uint8Array,
      ContentType: file.type,
      CacheControl: "public, max-age=31536000",
    });

    await s3Client.send(command);

    const cdnUrl = cdnBaseUrl
      ? `${cdnBaseUrl}/${filePath}`
      : `${b2Endpoint}/${b2Bucket}/${filePath}`;

    console.log(`[B2] Upload successful: ${cdnUrl}`);

    const response: UploadResponse = {
      success: true,
      path: filePath,
      url: `${b2Endpoint}/${b2Bucket}/${filePath}`,
      cdnUrl: cdnUrl,
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("[B2] Upload error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Upload failed"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
