// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REALTIME_API_KEY  = Deno.env.get('RTC_API_KEY')
const REALTIME_API_URL  = Deno.env.get('RTC_API_URL')

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

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

  const { title } = await req.json().catch(() => ({}))
  if (!title) {
    return new Response('`title` is required', { status: 400, headers: CORS_HEADERS })
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
    return new Response(`Cloudflare error: ${msg}`, { status: 502, headers: CORS_HEADERS })
  }

  const { data } = await rtcRes.json()

  // rooms row 를 미팅 생성 시점에 바로 만든다. 예전에는 meeting.started webhook 이
  // 참가자 첫 입장 때 insert 했는데, 그 사이 클라이언트는 이미 room_id 로 users 를
  // write 하므로 rooms 가 없어 FK 위반(409)이 반복됐다. 생성 시점에 만들어 두면
  // 방은 태어날 때부터 존재하고, "방이 없으면 입장 불가" 규칙이 성립한다.
  // (webhook meeting.started 도 idempotent upsert 로 바뀌어 중복돼도 무해하다.)
  const { error: roomError } = await supabase
    .from('rooms')
    .upsert({ id: data.id, title })
  if (roomError) {
    console.error('rooms upsert error:', roomError)
    return new Response(`DB error: ${roomError.message}`, { status: 500, headers: CORS_HEADERS })
  }

  return new Response(JSON.stringify({ meeting_id: data.id }), {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    }
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
