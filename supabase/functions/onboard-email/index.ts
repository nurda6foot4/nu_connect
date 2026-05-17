import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, cors, err } from '../_shared/cors.ts'

async function getSession(req: Request, supabase: ReturnType<typeof createClient>) {
  const token = req.headers.get('x-session-token')
  if (!token) return null
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  return data
}

async function sendOtpEmail(to: string, otp: string, resendKey: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'NU Connect <verify@nuconnect.app>',
      to: [to],
      subject: 'Your NU Connect verification code',
      html: `
        <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px">
          <h2 style="margin-bottom:8px">NU Connect</h2>
          <p>Your verification code:</p>
          <div style="font-size:36px;font-weight:bold;letter-spacing:8px;margin:16px 0">${otp}</div>
          <p style="color:#666;font-size:13px">Valid for 10 minutes. Do not share this code.</p>
        </div>
      `,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Email send failed: ${body}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const session = await getSession(req, supabase)
    if (!session) return err('Unauthorized', 401)

    const { email } = await req.json()
    if (!email || !email.endsWith('@nu.edu.kz')) {
      return err('Must be an @nu.edu.kz email')
    }

    // Check email not already used by another user
    const emailHash = await hashEmail(email)
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('nu_email_hash', emailHash)
      .maybeSingle()
    if (existing) return err('This email is already registered')

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    // Store OTP in session
    await supabase
      .from('sessions')
      .update({ email_hash: emailHash, otp_code: otp, otp_expires_at: otpExpires })
      .eq('id', session.id)

    await sendOtpEmail(email, otp, Deno.env.get('RESEND_API_KEY')!)

    return cors({ ok: true })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Internal error', 500)
  }
})

async function hashEmail(email: string): Promise<string> {
  const data = new TextEncoder().encode(email.toLowerCase().trim())
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}
