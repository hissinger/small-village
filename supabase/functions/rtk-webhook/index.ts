// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ROOMS_TABLE = "rooms";
enum RoomEvent {
  STARTED = "meeting.started",
  ENDED = "meeting.ended",
  PARTICIPANT_JOINED = "meeting.participantJoined",
  PARTICIPANT_LEFT = "meeting.participantLeft",
}

Deno.serve(async (req) => {
  const body = await req.json()
  const event = body.event
  if (event === RoomEvent.STARTED) {
    const { id, title } = body.meeting;
    const { error } = await supabase
      .from(ROOMS_TABLE)
      .insert([{ id, title }]);

    if (error) {
      console.error("DB insert error:", error);
      return new Response(
        JSON.stringify({ error: "db_insert_failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  } else if (event === RoomEvent.ENDED) {
    const { id } = body.meeting;
    const { error } = await supabase
      .from(ROOMS_TABLE)
      .delete()
      .eq("id", id);

    if (error) {
      console.error("DB delete error:", error);
      return new Response(
        JSON.stringify({ error: "db_delete_failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  } else if (event === RoomEvent.PARTICIPANT_JOINED) {
  
  } else if (event === RoomEvent.PARTICIPANT_LEFT) {
    const { customParticipantId} = body.participant;

    const { error } = await supabase
      .from("users")
      .delete()
      .eq("id", customParticipantId);
    
    if (error) {
      console.error("Failed to delete participant:", error);
      return new Response(
        JSON.stringify({ error: "db_delete_failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  return new Response(
    JSON.stringify({ message: "ok" }),
    {
      headers: { "Content-Type": "application/json" }
    }
  )
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/rtk-webhook' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
