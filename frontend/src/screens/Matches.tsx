import { useEffect, useState } from 'react'
import { api, type Match } from '../api'
import { isDemoMode, DEMO_MATCH } from '../demoData'

const INTENT_LABEL: Record<string, string> = {
  talk_first: '💬 Talk first',
  fwb: '🔥 FWB',
  one_time: '⚡ One-time',
  ongoing: '🔄 Ongoing',
}

export default function Matches() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isDemoMode()) {
      setMatches([DEMO_MATCH])
      setLoading(false)
      return
    }
    api.matches()
      .then(({ matches: m }) => setMatches(m))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-4xl animate-pulse">💬</div>
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="text-center">
          <div className="text-5xl mb-4">💫</div>
          <h2 className="text-xl font-bold mb-2">No matches yet</h2>
          <p className="text-sm opacity-60">Keep swiping — when someone likes you back, they appear here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4">
      <h1 className="text-xl font-bold mb-4 pt-2">Matches</h1>
      <div className="space-y-3">
        {matches.map(m => {
          const u = m.other_user
          const chatUrl = `tg://user?id=${u.telegram_id}`
          return (
            <div
              key={m.id}
              className="bg-[var(--tg-secondary-bg)] rounded-2xl p-4 flex items-center gap-4"
            >
              {u.photo_url ? (
                <img
                  src={u.photo_url}
                  alt="match"
                  className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">{u.gender === 'male' ? '👨' : u.gender === 'female' ? '👩' : '🧑'}</span>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{u.age} y.o.</span>
                  <span className="text-sm opacity-60 capitalize">{u.gender}</span>
                </div>
                <p className="text-sm opacity-60">{u.height_cm} cm · {u.weight_kg_min}–{u.weight_kg_max} kg</p>
                <p className="text-xs mt-1">{INTENT_LABEL[u.intent]}</p>
              </div>

              <a
                href={chatUrl}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white flex-shrink-0"
                style={{ backgroundColor: 'var(--tg-button)' }}
              >
                Chat
              </a>
            </div>
          )
        })}
      </div>
    </div>
  )
}
