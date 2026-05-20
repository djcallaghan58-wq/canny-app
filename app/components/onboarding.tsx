'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBusiness } from '@/app/actions/business'

const ACCENT = '#059669'
const GLOW   = 'rgba(5,150,105,0.15)'
const STEPS  = ['Business', 'Industry', 'Customer', 'Contact']

type Form = {
  name: string
  industry: string
  ideal_customer: string
  city: string
  state: string
  phone: string
}

export function OnboardingFlow() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<Form>({
    name: '', industry: '', ideal_customer: '', city: '', state: '', phone: '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const canAdvance = () => {
    if (step === 1) return form.name.trim().length > 1
    if (step === 2) return form.industry.trim().length > 0
    if (step === 3) return form.ideal_customer.trim().length > 0
    if (step === 4) return form.city.trim().length > 0 && form.state.trim().length > 0 && form.phone.trim().length > 6
    return false
  }

  const next   = () => { if (canAdvance() && step < 4) setStep(s => s + 1) }
  const back   = () => { if (step > 1) setStep(s => s - 1) }

  const submit = async () => {
    if (!canAdvance() || loading) return
    setLoading(true)
    setError('')

    const result = await createBusiness({
      name:           form.name.trim(),
      industry:       form.industry.trim(),
      ideal_customer: form.ideal_customer.trim(),
      main_service:   '',
      city:           `${form.city.trim()}, ${form.state.trim()}`,
      phone:          form.phone.trim(),
    })

    if (!result.success) {
      setError(result.error ?? 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    router.refresh()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px',
    background: '#F4F4F5', border: '1.5px solid rgba(0,0,0,0.10)',
    borderRadius: 10, fontSize: 14.5, color: '#09090B',
    outline: 'none', fontFamily: 'inherit',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = ACCENT
    e.target.style.boxShadow = `0 0 0 3px ${GLOW}`
    e.target.style.background = '#fff'
  }
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(0,0,0,0.10)'
    e.target.style.boxShadow = 'none'
    e.target.style.background = '#F4F4F5'
  }

  const stepLabel = (n: number) => (
    <p style={{ fontSize: 11, fontWeight: 600, color: '#A1A1AA', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 6 }}>
      Step {n} of 4
    </p>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
      `}</style>

      <div style={{
        minHeight: '100vh', background: '#FAFAFA',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9, background: ACCENT,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 16px ${GLOW}`,
          }}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M3 8L7 12L13 4" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#09090B', letterSpacing: '-0.4px' }}>
            TradeCommand
          </span>
        </div>

        {/* Card */}
        <div style={{
          width: '100%', maxWidth: 480,
          background: '#FFFFFF', borderRadius: 18,
          border: '1px solid rgba(0,0,0,0.07)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}>
          {/* Progress bar */}
          <div style={{ height: 3, background: '#F4F4F5' }}>
            <div style={{
              height: '100%', width: `${(step / 4) * 100}%`,
              background: ACCENT, transition: 'width 0.4s ease',
            }} />
          </div>

          <div style={{ padding: '32px 32px 28px' }}>
            {/* Step dots */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>
              {STEPS.map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: i + 1 <= step ? ACCENT : '#F4F4F5',
                    border: `2px solid ${i + 1 <= step ? ACCENT : 'rgba(0,0,0,0.08)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.3s',
                  }}>
                    {i + 1 < step ? (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <span style={{ fontSize: 9, fontWeight: 700, color: i + 1 === step ? 'white' : '#A1A1AA' }}>{i + 1}</span>
                    )}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{ width: 24, height: 1, background: i + 1 < step ? ACCENT : 'rgba(0,0,0,0.08)', transition: 'background 0.3s' }} />
                  )}
                </div>
              ))}
            </div>

            {/* Step 1 — Business Name */}
            {step === 1 && (
              <div>
                {stepLabel(1)}
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#09090B', letterSpacing: '-0.5px', marginBottom: 6 }}>What's your business called?</h2>
                <p style={{ fontSize: 13.5, color: '#52525B', marginBottom: 24 }}>This is how you'll appear in TradeCommand.</p>
                <input
                  autoFocus type="text"
                  placeholder="e.g. Evans Custom Apparel"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && next()}
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur}
                />
              </div>
            )}

            {/* Step 2 — Industry */}
            {step === 2 && (
              <div>
                {stepLabel(2)}
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#09090B', letterSpacing: '-0.5px', marginBottom: 6 }}>What does your business do?</h2>
                <p style={{ fontSize: 13.5, color: '#52525B', marginBottom: 24 }}>e.g. HVAC, Apparel, Landscaping, Staffing</p>
                <input
                  autoFocus type="text"
                  placeholder="e.g. Custom apparel and uniforms"
                  value={form.industry}
                  onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && next()}
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur}
                />
              </div>
            )}

            {/* Step 3 — Ideal Customer */}
            {step === 3 && (
              <div>
                {stepLabel(3)}
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#09090B', letterSpacing: '-0.5px', marginBottom: 6 }}>Who is your ideal customer?</h2>
                <p style={{ fontSize: 13.5, color: '#52525B', marginBottom: 24 }}>e.g. "Sports teams and businesses needing custom apparel"</p>
                <input
                  autoFocus type="text"
                  placeholder="e.g. Sports teams and local businesses"
                  value={form.ideal_customer}
                  onChange={e => setForm(f => ({ ...f, ideal_customer: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && next()}
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur}
                />
              </div>
            )}

            {/* Step 4 — City + Phone */}
            {step === 4 && (
              <div>
                {stepLabel(4)}
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#09090B', letterSpacing: '-0.5px', marginBottom: 6 }}>Where are you based?</h2>
                <p style={{ fontSize: 13.5, color: '#52525B', marginBottom: 24 }}>Used for finding local prospects and generating outreach.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 2 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#A1A1AA', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>City</label>
                      <input
                        autoFocus type="text" placeholder="e.g. Omaha"
                        value={form.city}
                        onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                        style={{ ...inputStyle, padding: '11px 14px', fontSize: 14 }}
                        onFocus={onFocus} onBlur={onBlur}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#A1A1AA', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>State</label>
                      <input
                        type="text" placeholder="e.g. NE"
                        value={form.state}
                        onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                        style={{ ...inputStyle, padding: '11px 14px', fontSize: 14 }}
                        onFocus={onFocus} onBlur={onBlur}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#A1A1AA', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Phone</label>
                    <input
                      type="tel" placeholder="e.g. (402) 555-0123"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && submit()}
                      style={{ ...inputStyle, padding: '11px 14px', fontSize: 14 }}
                      onFocus={onFocus} onBlur={onBlur}
                    />
                  </div>
                </div>
                {error && (
                  <p style={{ marginTop: 12, fontSize: 12.5, color: '#DC2626', fontWeight: 500 }}>⚠ {error}</p>
                )}
              </div>
            )}

            {/* Nav */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 }}>
              <button
                onClick={back} disabled={step === 1}
                style={{
                  padding: '9px 18px', borderRadius: 9,
                  border: '1.5px solid rgba(0,0,0,0.10)',
                  background: 'transparent', color: step === 1 ? '#D4D4D8' : '#52525B',
                  fontSize: 13.5, fontWeight: 500, cursor: step === 1 ? 'default' : 'pointer',
                  fontFamily: 'inherit', transition: 'all 0.15s',
                }}
              >
                ← Back
              </button>

              {step < 4 ? (
                <button
                  onClick={next} disabled={!canAdvance()}
                  style={{
                    padding: '10px 24px', borderRadius: 9,
                    background: canAdvance() ? ACCENT : '#E4E4E7',
                    border: 'none', color: 'white',
                    fontSize: 13.5, fontWeight: 600, cursor: canAdvance() ? 'pointer' : 'default',
                    fontFamily: 'inherit', letterSpacing: '-0.2px',
                    boxShadow: canAdvance() ? `0 2px 10px ${GLOW}` : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  Continue →
                </button>
              ) : (
                <button
                  onClick={submit} disabled={!canAdvance() || loading}
                  style={{
                    padding: '10px 24px', borderRadius: 9,
                    background: canAdvance() && !loading ? ACCENT : '#E4E4E7',
                    border: 'none', color: 'white',
                    fontSize: 13.5, fontWeight: 600,
                    cursor: canAdvance() && !loading ? 'pointer' : 'default',
                    fontFamily: 'inherit', letterSpacing: '-0.2px',
                    boxShadow: canAdvance() && !loading ? `0 2px 10px ${GLOW}` : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {loading ? 'Setting up…' : '✓ Launch TradeCommand'}
                </button>
              )}
            </div>
          </div>
        </div>

        <p style={{ marginTop: 20, fontSize: 12, color: '#A1A1AA', textAlign: 'center' }}>
          Secured by Clerk · Your data stays private
        </p>
      </div>
    </>
  )
}
