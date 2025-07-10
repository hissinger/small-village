// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const REALTIME_API_KEY  = Deno.env.get('RTC_API_KEY')
const REALTIME_API_URL  = Deno.env.get('RTC_API_URL')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    })
  }

  const { meeting_id, user_id, user_name } = await req.json().catch(() => ({}))

  if (!meeting_id) {
    return new Response('`meeting_id` is required', { status: 400, headers: CORS_HEADERS })
  }

  if (!user_id) {
    return new Response('`user_id` is required', { status: 400, headers: CORS_HEADERS })
  }

  if (!user_name) {
    return new Response('`user_name` is required', { status: 400, headers: CORS_HEADERS })
  }

  // Cloudflare Realtime – Add Participant
  const rtcRes = await fetch(
    `${REALTIME_API_URL}/meetings/${meeting_id}/participants`,
    {
      method : 'POST',
      headers: {
        'Authorization': `Basic ${REALTIME_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        name: user_name,
        preset_name: "default",
        client_specific_id: user_id,
      })
    }
  )

  if (!rtcRes.ok) {
    const msg = await rtcRes.text()
    console.error('RTC error:', msg)
    return new Response(`Cloudflare error: ${msg}`, { status: 502, headers: CORS_HEADERS })
  }

  const { data } = await rtcRes.json()
  return new Response(JSON.stringify({ authToken: data.token }), {
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  })
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create-rtk-token' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
