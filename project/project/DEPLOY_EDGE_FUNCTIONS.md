# IronDrive Edge Functions Deployment Instructions

## IMPORTANT: Deploy to IronDrive Supabase

These edge functions MUST be deployed to **IronDrive's Supabase instance**, NOT the auction website Supabase.

**IronDrive Supabase:**
- URL: `https://utrmoxkjpviruijfjgps.supabase.co`
- Project ID: `utrmoxkjpviruijfjgps`

**Auction Website Supabase (DO NOT deploy here):**
- URL: `https://sbhdjnchafboizbnqsmp.supabase.co`
- Project ID: `sbhdjnchafboizbnqsmp`

## Overview - Option A Integration

Following Option A (clean separation):
- **IronDrive Supabase**: Stores images in storage buckets, hosts edge functions
- **Auction Website Supabase**: Stores metadata about uploads in `file_uploads` table, tracks user roles

## Storage Bucket Setup

First, create the storage bucket in IronDrive's Supabase:

1. Go to: https://supabase.com/dashboard/project/utrmoxkjpviruijfjgps/storage/buckets
2. Click "New bucket"
3. Name: `ecommerce-images`
4. Public: **Yes** (enable public access)
5. Click "Create bucket"

## Required Edge Functions

### 1. ecommerce-auth

**Purpose:** Authenticates requests from the auction website.

**File:** `supabase/functions/ecommerce-auth/index.ts`

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
    const { email } = await req.json();

    if (email === "ibaproject.bid@outlook.com") {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Authentication successful"
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: "Invalid email"
      }),
      {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
```

### 2. ecommerce-upload

**Purpose:** Handles image uploads for inventory items and stores them in Supabase Storage.

**File:** `supabase/functions/ecommerce-upload/index.ts`

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { productId, images } = await req.json();

    if (!productId || !images || !Array.isArray(images)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid request body"
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const results = [];

    for (const image of images) {
      try {
        const buffer = Uint8Array.from(atob(image.fileData), c => c.charCodeAt(0));

        const { data, error } = await supabase.storage
          .from("ecommerce-images")
          .upload(`${productId}/${image.fileName}`, buffer, {
            contentType: image.mimeType,
            upsert: true
          });

        if (error) {
          results.push({
            success: false,
            fileName: image.fileName,
            error: error.message
          });
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("ecommerce-images")
          .getPublicUrl(`${productId}/${image.fileName}`);

        results.push({
          success: true,
          fileName: image.fileName,
          publicURL: urlData.publicUrl,
          storage: "supabase"
        });
      } catch (error) {
        results.push({
          success: false,
          fileName: image.fileName,
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
```

### 3. ecommerce-images

**Purpose:** Serves uploaded images from Supabase Storage.

**File:** `supabase/functions/ecommerce-images/index.ts`

```typescript
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
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(p => p);

    if (pathParts.length < 3) {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    const productId = pathParts[pathParts.length - 2];
    const filename = pathParts[pathParts.length - 1];

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase.storage
      .from("ecommerce-images")
      .download(`${productId}/${filename}`);

    if (error) {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    const contentType = filename.endsWith('.png') ? 'image/png' :
                       filename.endsWith('.jpg') || filename.endsWith('.jpeg') ? 'image/jpeg' :
                       filename.endsWith('.gif') ? 'image/gif' :
                       filename.endsWith('.webp') ? 'image/webp' :
                       'application/octet-stream';

    return new Response(data, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    return new Response("Internal server error", {
      status: 500,
      headers: corsHeaders
    });
  }
});
```

## Deployment Instructions

**Use your IronDrive AI assistant to deploy these functions.**

Tell the AI assistant (in the IronDrive chat):

```
I need to deploy three edge functions to my Supabase project. Here are the functions:

1. ecommerce-auth - copy the code from the ecommerce-auth section in DEPLOY_EDGE_FUNCTIONS.md
2. ecommerce-upload - copy the code from the ecommerce-upload section
3. ecommerce-images - copy the code from the ecommerce-images section

Please deploy all three functions to my Supabase project.
```

## Testing

After deployment, test using the auction website's connection test feature:

1. Go to Admin Panel in auction website
2. Navigate to IronDrive tab
3. Click "Test Connection"
4. Should see: "Successfully connected to IronDrive!"

## How It Works

1. User uploads image through auction website
2. Auction website calls IronDrive's `ecommerce-upload` function
3. Image is stored in IronDrive's Supabase storage bucket
4. Upload metadata is saved to auction website's `file_uploads` table
5. Images are served via IronDrive's `ecommerce-images` function
6. User roles are managed in auction website's `user_roles` table
