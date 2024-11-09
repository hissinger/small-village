// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface ResponseData {
  success: boolean;
  data?: {
    sessionId: string;
  };
  error?: string;
}

const baseUrl = "https://rtc.live.cloudflare.com/v1/apps";

const appId = Deno.env.get("CLOUDFLARE_APP_ID");
const appSecret = Deno.env.get("CLOUDFLARE_APP_SECRET");

async function createSession(): Promise<string> {
  try {
    const url = `${baseUrl}/${appId}/sessions/new`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appSecret}`,
        "Content-Type": "application/json",
      },
    });
    const { sessionId } = await response.json();
    return sessionId;
  } catch (error) {
    console.error("Error creating session:", error);
    throw error;
  }
}

async function isActiveSessionId(sessionId: string): Promise<boolean> {
  try {
    const url = `${baseUrl}/${appId}/sessions/${sessionId}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${appSecret}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 200) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error("Error checking session:", error);
    return false;
  }
}

Deno.serve(async (req) => {
  // Preflight 요청 처리
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(null, {
      status: 405,
      statusText: "Method Not Allowed",
    });
  }

  let sessionId: string | null = null;

  try {
    // Create a Supabase client with the Auth context of the logged in user.
    const supabaseClient = createClient(
      // Supabase API URL - env var exported by default.
      Deno.env.get("SUPABASE_URL") ?? "",
      // Supabase API ANON KEY - env var exported by default.
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      // Create client with Auth context of the user that called the function.
      // This way your row-level-security (RLS) policies are applied.
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // get the room from rooms table
    const { data, error } = await supabaseClient
      .from("rooms")
      .select()
      .eq("id", 1)
      .single();

    if (error) {
      console.error("getting room:", error);
    }

    sessionId = data?.session_id;

    if (sessionId && (await isActiveSessionId(sessionId))) {
      const resp: ResponseData = {
        success: true,
        data: { sessionId },
      };
      return new Response(JSON.stringify(resp), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // there is no session_id or the session_id is not active, create a new session
    const newSessionId = await createSession();

    // insert the session_id into the rooms table
    const newRoom = { id: 1, session_id: newSessionId };
    const { data: insertedRoom, error: insertError } = await supabaseClient
      .from("rooms")
      .upsert(newRoom);
    if (insertError) {
      console.error("Error inserting room:", insertError);
      throw insertError;
    }

    console.log("Inserted room:", insertedRoom);

    const resp: ResponseData = {
      success: true,
      data: { sessionId: newSessionId },
    };
    return new Response(JSON.stringify(resp), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const resp: ResponseData = {
      success: false,
      error: error.message,
    };
    return new Response(JSON.stringify(resp), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/get-session' \
    --header 'Authorization: Bearer ' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
