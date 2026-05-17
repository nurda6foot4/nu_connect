import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

type Step = 'email' | 'otp'

export default function OnboardEmail() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isNuEmail = email.endsWith('@nu.edu.kz')

  async function sendOtp() {
    if (!isNuEmail) return
    setLoading(true)
    setError('')
    try {
      await api.sendEmailOtp(email)
      setStep('otp')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send code')
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp() {
    if (otp.length !== 6) return
    setLoading(true)
    setError('')
    try {
      await api.confirmOtp(email, otp)
      navigate('/onboard/selfie')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col p-6">
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        <div className="text-4xl mb-4 text-center">🎓</div>
        <h1 className="text-2xl font-bold text-center mb-2">NU Connect</h1>
        <p className="text-center opacity-60 text-sm mb-8">
          {step === 'email'
            ? 'Verify your NU student email to continue'
            : `Enter the 6-digit code sent to ${email}`}
        </p>

        {step === 'email' ? (
          <>
            <input
              type="email"
              placeholder="yourname@nu.edu.kz"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border bg-[var(--tg-secondary-bg)] text-[var(--tg-text)] mb-3 outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="email"
              autoFocus
            />
            {email && !isNuEmail && (
              <p className="text-red-500 text-xs mb-3">Must be an @nu.edu.kz email</p>
            )}
            <button
              onClick={sendOtp}
              disabled={!isNuEmail || loading}
              className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: 'var(--tg-button)' }}
            >
              {loading ? 'Sending...' : 'Send Code'}
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              inputMode="numeric"
              placeholder="000000"
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-3 rounded-xl border bg-[var(--tg-secondary-bg)] text-[var(--tg-text)] mb-3 outline-none text-center text-2xl tracking-widest focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              onClick={verifyOtp}
              disabled={otp.length !== 6 || loading}
              className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: 'var(--tg-button)' }}
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            <button
              onClick={() => { setStep('email'); setOtp(''); setError('') }}
              className="w-full py-2 mt-2 text-sm opacity-60"
            >
              Change email
            </button>
          </>
        )}

        {error && <p className="text-red-500 text-sm text-center mt-3">{error}</p>}
      </div>
    </div>
  )
}
