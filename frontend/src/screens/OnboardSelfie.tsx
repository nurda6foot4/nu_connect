import { useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

type Step = 'disclosure' | 'camera' | 'preview' | 'checking'

export default function OnboardSelfie() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [step, setStep] = useState<Step>('disclosure')
  const [capturedImage, setCapturedImage] = useState<string>('')
  const [error, setError] = useState('')

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setStep('camera')
    } catch {
      setError('Camera access denied. Please allow camera and try again.')
    }
  }, [])

  function capture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
    setCapturedImage(base64)
    streamRef.current?.getTracks().forEach(t => t.stop())
    setStep('preview')
  }

  function retake() {
    setCapturedImage('')
    setError('')
    startCamera()
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

  if (step === 'disclosure') {
    return (
      <div className="min-h-screen flex flex-col p-6">
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
          <div className="text-4xl mb-4 text-center">🤳</div>
          <h2 className="text-xl font-bold text-center mb-4">Liveness Check</h2>
          <div className="bg-[var(--tg-secondary-bg)] rounded-xl p-4 mb-6 text-sm space-y-2">
            <p>✅ <strong>What we do:</strong> Take a selfie to confirm you're a real person.</p>
            <p>🔒 <strong>Privacy:</strong> Your selfie is sent to Google Gemini for a one-time liveness check only.</p>
            <p>🗑️ <strong>Deleted immediately</strong> after the check. We never store it.</p>
          </div>
          <button
            onClick={startCamera}
            className="w-full py-3 rounded-xl font-semibold text-white"
            style={{ backgroundColor: 'var(--tg-button)' }}
          >
            Allow Camera & Continue
          </button>
        </div>
      </div>
    )
  }

  if (step === 'camera') {
    return (
      <div className="min-h-screen flex flex-col bg-black">
        <video
          ref={videoRef}
          className="flex-1 w-full object-cover"
          playsInline
          muted
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas ref={canvasRef} className="hidden" />
        <div className="p-6 flex flex-col items-center gap-3">
          <p className="text-white text-sm opacity-70">Look straight at the camera</p>
          <button
            onClick={capture}
            className="w-20 h-20 rounded-full bg-white border-4 border-gray-300 flex items-center justify-center text-3xl"
          >
            📸
          </button>
        </div>
      </div>
    )
  }

  if (step === 'preview') {
    return (
      <div className="min-h-screen flex flex-col p-6">
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
          <h2 className="text-xl font-bold text-center mb-4">Looks good?</h2>
          <img
            src={`data:image/jpeg;base64,${capturedImage}`}
            alt="selfie preview"
            className="w-full rounded-2xl mb-6 object-cover"
            style={{ transform: 'scaleX(-1)', maxHeight: 320 }}
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
