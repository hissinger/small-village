// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const REALTIME_API_KEY  = Deno.env.get('RTC_API_KEY')
const REALTIME_API_URL  = Deno.env.get('RTC_API_URL')

Deno.serve(async (req) => {
  const { title } = await req.json().catch(() => ({}))

  if (!title) {
    return new Response('`title` is required', { status: 400 })
  }

  // Cloudflare Realtime – Add Participant
  const rtcRes = await fetch(
    `${REALTIME_API_URL}/meetings`,
    {
      method : 'POST',
      headers: {
        'Authorization': `Basic ${REALTIME_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        title,
        preferred_region: "ap-southeast-1", // Singapore
        record_on_start: false
      })
    }
  )

  if (!rtcRes.ok) {
    const msg = await rtcRes.text()
    console.error('RTC error:', msg)
    return new Response(`Cloudflare error: ${msg}`, { status: 502 })
  }

  const { data } = await rtcRes.json()
  return new Response(JSON.stringify({ meeting_id: data.id }), {
    headers: { 'content-type': 'application/json' }
  })
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create-meeting' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
