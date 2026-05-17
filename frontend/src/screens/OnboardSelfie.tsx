import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

type Step = 'disclosure' | 'preview' | 'checking'

export default function OnboardSelfie() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('disclosure')
  const [capturedImage, setCapturedImage] = useState<string>('')
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [error, setError] = useState('')

  function openCamera() {
    inputRef.current?.click()
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      // Compress to max 800px, 0.75 quality — keeps under 200KB
      const MAX = 800
      const scale = Math.min(1, MAX / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75)
      URL.revokeObjectURL(objectUrl)
      setPreviewUrl(dataUrl)
      setCapturedImage(dataUrl.split(',')[1])
      setStep('preview')
    }
    img.src = objectUrl
  }

  function retake() {
    setCapturedImage('')
    setPreviewUrl('')
    setError('')
    // Reset file input so same file can be selected again
    if (inputRef.current) inputRef.current.value = ''
    openCamera()
  }

  async function submit() {
    setStep('checking')
    setError('')
    try {
      const result = await api.verifySelfie(capturedImage)
      if (!result.ok) {
        setError(result.reason ?? 'Verification failed. Please try again with a clear face photo.')
        setStep('preview')
        return
      }
      navigate('/onboard/profile')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Verification failed')
      setStep('preview')
    }
  }

  // Hidden native camera input — works in Telegram iOS WKWebView
  const cameraInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      capture="user"
      className="hidden"
      onChange={onFileChange}
    />
  )

  if (step === 'disclosure') {
    return (
      <div className="min-h-screen flex flex-col p-6">
        {cameraInput}
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
          <div className="text-4xl mb-4 text-center">🤳</div>
          <h2 className="text-xl font-bold text-center mb-4">Liveness Check</h2>
          <div className="bg-[var(--tg-secondary-bg)] rounded-xl p-4 mb-6 text-sm space-y-2">
            <p>✅ <strong>What we do:</strong> Take a selfie to confirm you're a real person.</p>
            <p>🔒 <strong>Privacy:</strong> Your selfie is sent to Google Gemini for a one-time liveness check only.</p>
            <p>🗑️ <strong>Deleted immediately</strong> after the check. We never store it.</p>
          </div>
          <button
            onClick={openCamera}
            className="w-full py-3 rounded-xl font-semibold text-white"
            style={{ backgroundColor: 'var(--tg-button)' }}
          >
            📸 Take Selfie
          </button>
        </div>
      </div>
    )
  }

  if (step === 'preview') {
    return (
      <div className="min-h-screen flex flex-col p-6">
        {cameraInput}
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
          <h2 className="text-xl font-bold text-center mb-4">Looks good?</h2>
          <img
            src={previewUrl}
            alt="selfie preview"
            className="w-full rounded-2xl mb-6 object-cover"
            style={{ maxHeight: 360 }}
          />
          {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}
          <button
            onClick={submit}
            className="w-full py-3 rounded-xl font-semibold text-white mb-3"
            style={{ backgroundColor: 'var(--tg-button)' }}
          >
            Submit
          </button>
          <button onClick={retake} className="w-full py-2 text-sm opacity-60">
            Retake
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-4xl mb-4">🔍</div>
      <p className="font-medium">Checking your selfie...</p>
      <p className="text-sm opacity-60 mt-1">This takes a few seconds</p>
    </div>
  )
}
