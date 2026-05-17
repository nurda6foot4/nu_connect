import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, cors, err } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const token = req.headers.get('x-session-token')
    if (!token) return err('Unauthorized', 401)

    const { otp } = await req.json()
    if (!otp || otp.length !== 6) return err('Invalid OTP format')

    const { data: session } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (!session) return err('Unauthorized', 401)
    if (!session.otp_code) return err('No pending OTP — request a new code')
    if (new Date(session.otp_expires_at) < new Date()) return err('Code expired — request a new one')
    if (session.otp_code !== otp) return err('Incorrect code')

    // Mark email verified, clear OTP
    await supabase
      .from('sessions')
      .update({
        email_verified_at: new Date().toISOString(),
        otp_code: null,
        otp_expires_at: null,
      })
      .eq('id', token)

    return cors({ ok: true })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Internal error', 500)
  }
})
