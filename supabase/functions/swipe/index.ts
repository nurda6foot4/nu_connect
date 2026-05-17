import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, cors, err } from '../_shared/cors.ts'

// Rate limit: 100 swipes per hour per user (stored in memory — resets on cold start)
// For a hobby app this is sufficient; upgrade to KV store if needed
const swipeCounts = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = swipeCounts.get(userId)
  if (!entry || entry.resetAt < now) {
    swipeCounts.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (entry.count >= 100) return false
  entry.count++
  return true
}

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

    if (!checkRateLimit(session.user_id)) {
      return err('Rate limit: 100 swipes per hour', 429)
    }

    const { swiped_id, liked } = await req.json()
    if (!swiped_id || typeof liked !== 'boolean') return err('swiped_id and liked required')
    if (swiped_id === session.user_id) return err('Cannot swipe on yourself')

    // Atomic swipe + match via PostgreSQL function
    const { data, error } = await supabase.rpc('process_swipe', {
      p_swiper_id: session.user_id,
      p_swiped_id: swiped_id,
      p_liked: liked,
    })

    if (error) throw error

    const result = data as { match: boolean; match_id: string | null }

    // Send match notification via Telegram bot if it's a new match
    if (result.match && result.match_id) {
      const botToken = Deno.env.get('BOT_TOKEN')!

      // Get both users' telegram IDs
      const { data: users } = await supabase
        .from('users')
        .select('telegram_id')
        .in('id', [session.user_id, swiped_id])

      const notifyPromises = (users ?? []).map(u =>
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: u.telegram_id,
            text: '🎉 You have a new match! Open NU Connect to see them.',
            parse_mode: 'HTML',
          }),
        })
      )
      await Promise.allSettled(notifyPromises)
    }

    return cors({ match: result.match, match_id: result.match_id })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Internal error', 500)
  }
})
