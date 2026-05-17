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
      .select('user_id')
      .eq('id', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (!session?.user_id) return err('Unauthorized', 401)

    const myId = session.user_id

    // Get all matches where I'm user_a or user_b
    const { data: rawMatches, error: matchErr } = await supabase
      .from('matches')
      .select('id, matched_at, user_a, user_b')
      .or(`user_a.eq.${myId},user_b.eq.${myId}`)
      .order('matched_at', { ascending: false })

    if (matchErr) throw matchErr

    if (!rawMatches || rawMatches.length === 0) {
      return cors({ matches: [] })
    }

    // Get the other user's ID for each match
    const otherIds = rawMatches.map(m => m.user_a === myId ? m.user_b : m.user_a)

    const { data: otherUsers } = await supabase
      .from('users')
      .select('id, telegram_id, age, gender, height_cm, weight_kg_min, weight_kg_max, intent, photo_path')
      .in('id', otherIds)

    const userMap = new Map((otherUsers ?? []).map(u => [u.id, u]))

    // Build response with signed photo URLs
    const matches = await Promise.all(
      rawMatches.map(async (m) => {
        const otherId = m.user_a === myId ? m.user_b : m.user_a
        const other = userMap.get(otherId)
        if (!other) return null

        let photo_url: string | undefined
        if (other.photo_path) {
          const { data: signed } = await supabase.storage
            .from('photos')
            .createSignedUrl(other.photo_path, 3600)
          photo_url = signed?.signedUrl
        }

        const { photo_path: _pp, ...otherRest } = other
        return {
          id: m.id,
          matched_at: m.matched_at,
          other_user: { ...otherRest, photo_url },
        }
      })
    )

    return cors({ matches: matches.filter(Boolean) })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Internal error', 500)
  }
})
