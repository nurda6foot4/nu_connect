import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
import { api } from './api'
import { enableDemoMode } from './demoData'
import OnboardEmail from './screens/OnboardEmail'
import OnboardSelfie from './screens/OnboardSelfie'
import OnboardProfile from './screens/OnboardProfile'
import Discover from './screens/Discover'
import Matches from './screens/Matches'

type AuthState = 'loading' | 'onboarding' | 'ready' | 'error'

function Root() {
  const [authState, setAuthState] = useState<AuthState>('loading')
  const navigate = useNavigate()

  useEffect(() => {
    WebApp.ready()
    WebApp.expand()

    // Secret demo mode — triggered by t.me/nuconnect_kz_bot/app?startapp=admin2004
    const startParam = WebApp.initDataUnsafe?.start_param
    if (startParam === 'admin2004') {
      enableDemoMode()
      setAuthState('ready')
      navigate('/discover')
      return
    }

    const initData = WebApp.initData
    if (!initData) {
      // Dev fallback: allow browsing screens without Telegram
      if (import.meta.env.DEV) {
        setAuthState('onboarding')
        navigate('/onboard/email')
        return
      }
      setAuthState('error')
      return
    }

    api.authVerify(initData)
      .then(({ sessionToken, isOnboarded }) => {
        localStorage.setItem('nu_session_token', sessionToken)
        if (isOnboarded) {
          setAuthState('ready')
          navigate('/discover')
        } else {
          setAuthState('onboarding')
          navigate('/onboard/email')
        }
      })
      .catch(() => setAuthState('error'))
  }, [navigate])

  if (authState === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-4xl mb-2">💫</div>
          <p className="text-sm opacity-60">Loading...</p>
        </div>
      </div>
    )
  }

  if (authState === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="text-center">
          <div className="text-4xl mb-2">⚠️</div>
          <p className="font-medium">Open inside Telegram</p>
          <p className="text-sm opacity-60 mt-1">This app only works as a Telegram Mini App</p>
        </div>
      </div>
    )
  }

  return null
}

function Nav() {
  const navigate = useNavigate()
  return (
    <div className="fixed bottom-0 left-0 right-0 flex border-t bg-[var(--tg-secondary-bg)]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <button onClick={() => navigate('/discover')} className="flex-1 py-3 text-xs flex flex-col items-center gap-1">
        <span className="text-xl">🔥</span>Discover
      </button>
      <button onClick={() => navigate('/matches')} className="flex-1 py-3 text-xs flex flex-col items-center gap-1">
        <span className="text-xl">💬</span>Matches
      </button>
    </div>
  )
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-16">
      {children}
      <Nav />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Root />} />
        <Route path="/onboard/email" element={<OnboardEmail />} />
        <Route path="/onboard/selfie" element={<OnboardSelfie />} />
        <Route path="/onboard/profile" element={<OnboardProfile />} />
        <Route path="/discover" element={<AppLayout><Discover /></AppLayout>} />
        <Route path="/matches" element={<AppLayout><Matches /></AppLayout>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
