import { useEffect, useState, useCallback, useRef } from 'react'
import { api, type Profile } from '../api'
import { isDemoMode, DEMO_PROFILES } from '../demoData'

const INTENT_LABEL: Record<string, string> = {
  talk_first: '💬 Talk first',
  fwb: '🔥 FWB',
  one_time: '⚡ One-time',
  ongoing: '🔄 Ongoing',
}

export default function Discover() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [empty, setEmpty] = useState(false)
  const [matchAlert, setMatchAlert] = useState(false)
  const [tapCount, setTapCount] = useState(0)
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleTitleTap() {
    const next = tapCount + 1
    setTapCount(next)
    if (tapTimer.current) clearTimeout(tapTimer.current)
    if (next >= 5) {
      setTapCount(0)
      if (!isDemoMode()) {
        localStorage.setItem('nu_demo_mode', '1')
        setProfiles(DEMO_PROFILES)
        setEmpty(false)
      } else {
        localStorage.removeItem('nu_demo_mode')
        load(0)
      }
      return
    }
    tapTimer.current = setTimeout(() => setTapCount(0), 1500)
  }

  const load = useCallback(async (off: number) => {
    setLoading(true)
    try {
      if (isDemoMode()) {
        setProfiles(DEMO_PROFILES)
        setLoading(false)
        return
      }
      const { profiles: p } = await api.discover(off)
      if (p.length === 0) {
        setEmpty(true)
      } else {
        setProfiles(p)
        setEmpty(false)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(0) }, [load])

  async function handleSwipe(profile: Profile, liked: boolean) {
    const remaining = profiles.filter(p => p.id !== profile.id)
    setProfiles(remaining)

    if (isDemoMode()) {
      // Demo: trigger match on 2nd like
      if (liked && profile.id === 'demo-2') {
        setMatchAlert(true)
        setTimeout(() => setMatchAlert(false), 4000)
      }
      if (remaining.length === 0) setEmpty(true)
      return
    }

    try {
      const result = await api.swipe(profile.id, liked)
      if (result.match) {
        setMatchAlert(true)
        setTimeout(() => setMatchAlert(false), 3000)
      }
    } catch { /* swipe failure is non-blocking */ }

    if (remaining.length <= 2) {
      const nextOffset = offset + 10
      setOffset(nextOffset)
      const { profiles: more } = await api.discover(nextOffset)
      if (more.length === 0) setEmpty(remaining.length === 0)
      else setProfiles(prev => [...prev, ...more])
    }
  }

  if (loading && profiles.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-4xl mb-2 animate-pulse">🔥</div>
          <p className="text-sm opacity-60">Finding people...</p>
        </div>
      </div>
    )
  }

  if (empty) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="text-center">
          <div className="text-5xl mb-4">😴</div>
          <h2 className="text-xl font-bold mb-2">No more profiles</h2>
          <p className="text-sm opacity-60">Check back later — more NU students join every day.</p>
        </div>
      </div>
    )
  }

  const current = profiles[0]

  return (
    <div className="min-h-screen flex flex-col p-4">
      {matchAlert && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-green-500 text-white text-center py-3 rounded-xl font-semibold shadow-lg animate-bounce">
          🎉 It's a match! Check your matches tab
        </div>
      )}

      <h1 className="text-xl font-bold mb-4 pt-2 select-none" onClick={handleTitleTap}>
        Discover {isDemoMode() ? '✨' : ''}
      </h1>

      {current && (
        <div className="flex-1 flex flex-col">
          <div className="bg-[var(--tg-secondary-bg)] rounded-3xl p-6 flex-1 flex flex-col justify-between mb-4">
            {current.photo_url ? (
              <div
                className="w-full h-56 rounded-2xl bg-cover bg-center mb-4"
                style={{ backgroundImage: `url(${current.photo_url})`, filter: 'blur(12px)' }}
              />
            ) : (
              <div className="w-full h-56 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center mb-4">
                <span className="text-6xl">{current.gender === 'male' ? '👨' : current.gender === 'female' ? '👩' : '🧑'}</span>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-lg font-bold">{current.age} y.o.</span>
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm capitalize">
                  {current.gender}
                </span>
                <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm">
                  {INTENT_LABEL[current.intent]}
                </span>
              </div>
              <p className="text-sm opacity-60">
                {current.height_cm} cm · {current.weight_kg_min}–{current.weight_kg_max} kg
              </p>
              <p className="text-xs opacity-40 mt-2">
                Photo revealed after mutual match 🔒
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => handleSwipe(current, false)}
              className="flex-1 py-4 rounded-2xl text-2xl bg-[var(--tg-secondary-bg)] font-bold"
            >
              ✕
            </button>
            <button
              onClick={() => handleSwipe(current, true)}
              className="flex-1 py-4 rounded-2xl text-2xl text-white font-bold"
              style={{ backgroundColor: 'var(--tg-button)' }}
            >
              ❤️
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
