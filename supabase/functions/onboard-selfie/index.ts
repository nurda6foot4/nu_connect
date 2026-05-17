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
    if (!session.email_verified_at) return err('Complete email verification first')

    const { image } = await req.json()
    if (!image) return err('image required (base64 JPEG)')

    // Call Gemini Vision
    const geminiKey = Deno.env.get('GEMINI_API_KEY')!
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: { mime_type: 'image/jpeg', data: image }
              },
              {
                text: 'Analyze this image. Reply ONLY with valid JSON (no markdown): {"is_real_face": boolean, "is_live_photo": boolean, "appears_adult": boolean, "reason": "string or null"}. is_real_face: true if a clear human face is visible. is_live_photo: true if this appears to be a live photo rather than a photo of a printed image or screen. appears_adult: true if the person appears to be 18 years old or older. reason: brief explanation only when any value is false, otherwise null.'
              }
            ]
          }],
          generationConfig: { temperature: 0 }
        }),
      }
    )

    if (!geminiRes.ok) {
      const body = await geminiRes.text()
      throw new Error(`Gemini error: ${body}`)
    }

    const geminiData = await geminiRes.json()
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'

    let result: { is_real_face: boolean; is_live_photo: boolean; appears_adult: boolean; reason: string | null }
    try {
      result = JSON.parse(rawText.trim())
    } catch {
      throw new Error('Could not parse Gemini response')
    }

    if (!result.is_real_face || !result.is_live_photo || !result.appears_adult) {
      const reason = result.reason ?? 'Could not verify as a live adult face'
      return cors({ ok: false, reason })
    }

    // Mark selfie verified
    await supabase
      .from('sessions')
      .update({ selfie_verified_at: new Date().toISOString() })
      .eq('id', token)

    // Selfie is NOT stored — image variable is discarded here
    return cors({ ok: true })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Internal error', 500)
  }
})
