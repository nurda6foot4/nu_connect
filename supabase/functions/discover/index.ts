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

    // Get current user preferences
    const { data: me } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user_id)
      .single()

    if (!me) return err('Profile not found', 404)

    const url = new URL(req.url)
    const offset = parseInt(url.searchParams.get('offset') ?? '0')
    const limit = 10

    // Get IDs of users already swiped
    const { data: swiped } = await supabase
      .from('swipes')
      .select('swiped_id')
      .eq('swiper_id', me.id)

    // Get IDs of users blocked in either direction
    const { data: blockedBy } = await supabase
      .from('blocks')
      .select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${me.id},blocked_id.eq.${me.id}`)

    const excludeIds = new Set<string>([me.id])
    swiped?.forEach(s => excludeIds.add(s.swiped_id))
    blockedBy?.forEach(b => {
      excludeIds.add(b.blocker_id)
      excludeIds.add(b.blocked_id)
    })

    // Build gender filter based on my preferences
    let genderFilter: string | null = null
    if (me.interested_in === 'men') genderFilter = 'male'
    else if (me.interested_in === 'women') genderFilter = 'female'

    let query = supabase
      .from('users')
      .select('id, age, gender, height_cm, weight_kg_min, weight_kg_max, intent, interested_in, age_pref_min, age_pref_max, photo_path')
      .eq('is_active', true)
      .gte('age', me.age_pref_min)
      .lte('age', me.age_pref_max)
      .gte('age_pref_min', 0) // ensure prefs exist
      .not('id', 'in', `(${[...excludeIds].join(',')})`)
      .range(offset, offset + limit - 1)

    if (genderFilter) {
      query = query.eq('gender', genderFilter)
    }

    const { data: candidates } = await query

    // Filter: their preferences must include my gender
    const profiles = (candidates ?? []).filter(c => {
      const wantsMe =
        c.interested_in === 'both' ||
        (c.interested_in === 'men' && me.gender === 'male') ||
        (c.interested_in === 'women' && me.gender === 'female')
      const ageMatch = me.age >= c.age_pref_min && me.age <= c.age_pref_max
      return wantsMe && ageMatch
    })

    // Generate signed photo URLs (1hr expiry) for profiles that have photos
    const profilesWithUrls = await Promise.all(
      profiles.map(async (p) => {
        let photo_url: string | undefined
        if (p.photo_path) {
          const { data: signed } = await supabase.storage
            .from('photos')
            .createSignedUrl(p.photo_path, 3600)
          photo_url = signed?.signedUrl
        }
        const { interested_in: _i, age_pref_min: _min, age_pref_max: _max, photo_path: _pp, ...rest } = p
        return { ...rest, photo_url }
      })
    )

    return cors({ profiles: profilesWithUrls })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Internal error', 500)
  }
})
