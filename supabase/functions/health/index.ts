import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(() =>
  new Response(JSON.stringify({ ok: true, ts: new Date().toISOString() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
)
