import type { Profile, Match } from './api'

export const DEMO_PROFILES: Profile[] = [
  {
    id: 'demo-1',
    age: 20,
    gender: 'female',
    height_cm: 167,
    weight_kg_min: 52,
    weight_kg_max: 57,
    intent: 'talk_first',
  },
  {
    id: 'demo-2',
    age: 22,
    gender: 'female',
    height_cm: 171,
    weight_kg_min: 55,
    weight_kg_max: 62,
    intent: 'fwb',
  },
  {
    id: 'demo-3',
    age: 21,
    gender: 'male',
    height_cm: 183,
    weight_kg_min: 75,
    weight_kg_max: 82,
    intent: 'ongoing',
  },
  {
    id: 'demo-4',
    age: 19,
    gender: 'female',
    height_cm: 163,
    weight_kg_min: 48,
    weight_kg_max: 54,
    intent: 'talk_first',
  },
  {
    id: 'demo-5',
    age: 23,
    gender: 'male',
    height_cm: 178,
    weight_kg_min: 72,
    weight_kg_max: 78,
    intent: 'fwb',
  },
  {
    id: 'demo-6',
    age: 20,
    gender: 'female',
    height_cm: 169,
    weight_kg_min: 56,
    weight_kg_max: 63,
    intent: 'one_time',
  },
]

export const DEMO_MATCH: Match = {
  id: 'demo-match-1',
  matched_at: new Date().toISOString(),
  other_user: {
    id: 'demo-2',
    telegram_id: 0,
    age: 22,
    gender: 'female',
    height_cm: 171,
    weight_kg_min: 55,
    weight_kg_max: 62,
    intent: 'fwb',
  },
}

export function isDemoMode(): boolean {
  return localStorage.getItem('nu_demo_mode') === '1'
}

export function enableDemoMode() {
  localStorage.setItem('nu_demo_mode', '1')
  // Also fake a session so app skips auth
  localStorage.setItem('nu_session_token', 'demo-session-token')
}
