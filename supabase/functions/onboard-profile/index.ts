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

    const { data: session } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (!session) return err('Unauthorized', 401)
    if (!session.email_verified_at) return err('Email not verified')
    if (!session.selfie_verified_at) return err('Selfie not verified')

    const body = await req.json()
    const { age, gender, height_cm, weight_kg_min, weight_kg_max, intent, interested_in, age_pref_min, age_pref_max } = body

    // Basic validation
    if (!age || age < 18) return err('Must be 18+')
    if (!['male','female','other'].includes(gender)) return err('Invalid gender')
    if (!height_cm || height_cm < 100 || height_cm > 250) return err('Invalid height')
    if (!weight_kg_min || !weight_kg_max || weight_kg_min > weight_kg_max) return err('Invalid weight range')
    if (!['fwb','one_time','ongoing','talk_first'].includes(intent)) return err('Invalid intent')
    if (!['men','women','both'].includes(interested_in)) return err('Invalid interested_in')
    if (!age_pref_min || !age_pref_max || age_pref_min < 18 || age_pref_max < age_pref_min) return err('Invalid age preference')

    // Create user record
    const { data: user, error: userErr } = await supabase
      .from('users')
      .insert({
        telegram_id: session.telegram_id,
        nu_email_hash: session.email_hash,
        email_verified_at: session.email_verified_at,
        selfie_verified_at: session.selfie_verified_at,
        age, gender, height_cm, weight_kg_min, weight_kg_max,
        intent, interested_in, age_pref_min, age_pref_max,
      })
      .select('id')
      .single()

    if (userErr) {
      if (userErr.code === '23505') return err('Account already exists')
      throw userErr
    }

    // Link session to new user
    await supabase
      .from('sessions')
      .update({ user_id: user.id })
      .eq('id', token)

    return cors({ ok: true, userId: user.id })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Internal error', 500)
  }
})
