import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export default function OnboardProfile() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    age: '',
    gender: '',
    height_cm: '',
    weight_kg_min: '',
    weight_kg_max: '',
    intent: '',
    interested_in: '',
    age_pref_min: '18',
    age_pref_max: '30',
  })

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  const isValid =
    Number(form.age) >= 18 &&
    form.gender &&
    Number(form.height_cm) >= 100 &&
    Number(form.weight_kg_min) > 0 &&
    Number(form.weight_kg_max) >= Number(form.weight_kg_min) &&
    form.intent &&
    form.interested_in

  async function submit() {
    if (!isValid) return
    setLoading(true)
    setError('')
    try {
      await api.saveProfile({
        age: Number(form.age),
        gender: form.gender,
        height_cm: Number(form.height_cm),
        weight_kg_min: Number(form.weight_kg_min),
        weight_kg_max: Number(form.weight_kg_max),
        intent: form.intent,
        interested_in: form.interested_in,
        age_pref_min: Number(form.age_pref_min),
        age_pref_max: Number(form.age_pref_max),
      })
      navigate('/discover')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const select = (key: string, options: { value: string; label: string }[], current: string) => (
    <div className="flex gap-2 flex-wrap">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => set(key, o.value)}
          className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
            current === o.value
              ? 'text-white border-transparent'
              : 'bg-[var(--tg-secondary-bg)] border-transparent opacity-70'
          }`}
          style={current === o.value ? { backgroundColor: 'var(--tg-button)' } : {}}
        >
          {o.label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col p-6 pb-8">
      <h1 className="text-2xl font-bold mb-1">Your Profile</h1>
      <p className="text-sm opacity-60 mb-6">All info is kept anonymous until a mutual match.</p>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Age</label>
          <input
            type="number"
            min={18}
            max={99}
            placeholder="e.g. 21"
            value={form.age}
            onChange={e => set('age', e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[var(--tg-secondary-bg)] outline-none"
          />
          {form.age && Number(form.age) < 18 && (
            <p className="text-red-500 text-xs mt-1">Must be 18+</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Gender</label>
          {select('gender', [
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
            { value: 'other', label: 'Other' },
          ], form.gender)}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-2">Height (cm)</label>
            <input
              type="number"
              min={100}
              max={250}
              placeholder="e.g. 175"
              value={form.height_cm}
              onChange={e => set('height_cm', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[var(--tg-secondary-bg)] outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Weight range (kg)</label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min={30}
                placeholder="Min"
                value={form.weight_kg_min}
                onChange={e => set('weight_kg_min', e.target.value)}
                className="w-full px-3 py-3 rounded-xl bg-[var(--tg-secondary-bg)] outline-none"
              />
              <span className="opacity-40">–</span>
              <input
                type="number"
                min={30}
                placeholder="Max"
                value={form.weight_kg_max}
                onChange={e => set('weight_kg_max', e.target.value)}
                className="w-full px-3 py-3 rounded-xl bg-[var(--tg-secondary-bg)] outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Looking for</label>
          {select('intent', [
            { value: 'talk_first', label: '💬 Talk first' },
            { value: 'fwb', label: '🔥 FWB' },
            { value: 'one_time', label: '⚡ One-time' },
            { value: 'ongoing', label: '🔄 Ongoing' },
          ], form.intent)}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Interested in</label>
          {select('interested_in', [
            { value: 'men', label: 'Men' },
            { value: 'women', label: 'Women' },
            { value: 'both', label: 'Both' },
          ], form.interested_in)}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Age preference: {form.age_pref_min}–{form.age_pref_max}
          </label>
          <div className="flex gap-3">
            <input
              type="range" min={18} max={50}
              value={form.age_pref_min}
              onChange={e => set('age_pref_min', e.target.value)}
              className="flex-1"
            />
            <input
              type="range" min={18} max={50}
              value={form.age_pref_max}
              onChange={e => set('age_pref_max', e.target.value)}
              className="flex-1"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}

      <button
        onClick={submit}
        disabled={!isValid || loading}
        className="w-full py-3 rounded-xl font-semibold text-white mt-8 disabled:opacity-40"
        style={{ backgroundColor: 'var(--tg-button)' }}
      >
        {loading ? 'Saving...' : 'Start Discovering 🔥'}
      </button>
    </div>
  )
}
