import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, cors, err } from '../_shared/cors.ts'

async function validateInitData(initData: string, botToken: string): Promise<Record<string, string> | null> {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const enc = new TextEncoder()

  // secret_key = HMAC-SHA256(key="WebAppData", data=botToken)
  const webAppDataKey = await crypto.subtle.importKey(
    'raw', enc.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const secretKeyBytes = await crypto.subtle.sign('HMAC', webAppDataKey, enc.encode(botToken))

  // verification = HMAC-SHA256(key=secretKey, data=dataCheckString)
  const hmacKey = await crypto.subtle.importKey(
    'raw', secretKeyBytes,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const hashBytes = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(dataCheckString))
  const hashHex = Array.from(new Uint8Array(hashBytes)).map(b => b.toString(16).padStart(2, '0')).join('')

  if (hashHex !== hash) return null

  // Reject stale initData (older than 1 hour)
  const authDate = parseInt(params.get('auth_date') ?? '0')
  if (Date.now() / 1000 - authDate > 3600) return null

  const userStr = params.get('user')
  if (!userStr) return null
  return JSON.parse(userStr)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { initData } = await req.json()
    if (!initData) return err('initData required')

    const botToken = Deno.env.get('BOT_TOKEN')!
    const user = await validateInitData(initData, botToken)
    if (!user) return err('Invalid or expired initData', 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const telegramId = parseInt(user.id)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    // Check if fully onboarded
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', telegramId)
      .maybeSingle()

    // Upsert session — one active session per Telegram user, not one per open
    const { data: session, error: sessionErr } = await supabase
      .from('sessions')
      .upsert({
        telegram_id: telegramId,
        user_id: existingUser?.id ?? null,
        expires_at: expiresAt,
      }, { onConflict: 'telegram_id' })
      .select('id')
      .single()

    if (sessionErr) throw sessionErr

    return cors({
      sessionToken: session.id,
      isOnboarded: !!existingUser,
    })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Internal error', 500)
  }
})
