const BASE = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL // e.g. https://xxx.supabase.co/functions/v1

function getToken() {
  return localStorage.getItem('nu_session_token') ?? ''
}

async function call<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-session-token': getToken(),
      ...(options.headers ?? {}),
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Request failed')
  return data as T
}

export const api = {
  authVerify: (initData: string) =>
    call<{ sessionToken: string; isOnboarded: boolean }>('auth-verify', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    }),

  sendEmailOtp: (email: string) =>
    call<{ ok: boolean }>('onboard-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  confirmOtp: (email: string, otp: string) =>
    call<{ ok: boolean }>('onboard-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    }),

  verifySelfie: (base64Image: string) =>
    call<{ ok: boolean; reason?: string }>('onboard-selfie', {
      method: 'POST',
      body: JSON.stringify({ image: base64Image }),
    }),

  saveProfile: (profile: {
    age: number
    gender: string
    height_cm: number
    weight_kg_min: number
    weight_kg_max: number
    intent: string
    interested_in: string
    age_pref_min: number
    age_pref_max: number
  }) =>
    call<{ ok: boolean }>('onboard-profile', {
      method: 'POST',
      body: JSON.stringify(profile),
    }),

  discover: (offset = 0) =>
    call<{ profiles: Profile[] }>(`discover?offset=${offset}`),

  swipe: (swiped_id: string, liked: boolean) =>
    call<{ match: boolean; match_id?: string }>('swipe', {
      method: 'POST',
      body: JSON.stringify({ swiped_id, liked }),
    }),

  matches: () =>
    call<{ matches: Match[] }>('matches'),
}

export interface Profile {
  id: string
  age: number
  gender: string
  height_cm: number
  weight_kg_min: number
  weight_kg_max: number
  intent: string
  photo_url?: string
}

export interface Match {
  id: string
  matched_at: string
  other_user: {
    id: string
    telegram_id: number
    age: number
    gender: string
    height_cm: number
    weight_kg_min: number
    weight_kg_max: number
    intent: string
    photo_url?: string
  }
}
