'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, Check } from 'lucide-react'
import { createBusiness } from '@/app/actions/business'
import type { CatalogItem, WritingStyle } from '@/lib/supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#059669'
const GLOW   = 'rgba(5,150,105,0.15)'
const STEPS  = ['Basics', 'Catalog', 'Customers', 'Voice', 'Launch']

const INDUSTRIES = [
  'Apparel & Printing',
  'HVAC',
  'Plumbing',
  'Electrical',
  'Roofing',
  'Cleaning',
  'Landscaping',
  'Property Management',
  'Other',
]

const UNIT_TYPES: CatalogItem['unit'][] = ['per hour', 'per job', 'per unit', 'per item']

const COMMERCIAL_TYPES = [
  'Property managers',
  'Restaurants',
  'Gyms',
  'Schools',
  'Offices',
  'Retail',
  'Hospitality',
]

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  background: '#F4F4F5', border: '1.5px solid rgba(0,0,0,0.10)',
  borderRadius: 9, fontSize: 14, color: '#09090B',
  outline: 'none', fontFamily: 'inherit',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#52525B',
  letterSpacing: '0.4px', textTransform: 'uppercase',
  display: 'block', marginBottom: 6,
}

function focusIn(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.target.style.borderColor = ACCENT
  e.target.style.boxShadow = `0 0 0 3px ${GLOW}`
  e.target.style.background = '#fff'
}
function focusOut(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.target.style.borderColor = 'rgba(0,0,0,0.10)'
  e.target.style.boxShadow = 'none'
  e.target.style.background = '#F4F4F5'
}

// ─── Form state ───────────────────────────────────────────────────────────────

type CustomerType = 'Residential' | 'Commercial' | 'Both'

interface FormState {
  // Step 1
  name: string
  industry: string
  city: string
  service_area: string
  business_description: string
  // Step 2
  catalog: CatalogItem[]
  // Step 3
  customer_type: CustomerType
  commercial_types: string[]
  ideal_customer_description: string
  // Step 4
  voice_emails: string
  voice_profile: WritingStyle | null
  voice_analyzed: boolean
}

// ─── Onboarding Flow ──────────────────────────────────────────────────────────

export function OnboardingFlow() {
  const router  = useRouter()
  const [step,  setStep]    = useState(1)
  const [form,  setForm]    = useState<FormState>({
    name: '', industry: '', city: '', service_area: '', business_description: '',
    catalog: [],
    customer_type: 'Both', commercial_types: [], ideal_customer_description: '',
    voice_emails: '', voice_profile: null, voice_analyzed: false,
  })
  const [loading,   setLoading]   = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error,     setError]     = useState('')

  // Step 2 local draft item
  const [draft, setDraft] = useState<{ name: string; price: string; unit: CatalogItem['unit'] }>({
    name: '', price: '', unit: 'per job',
  })

  const canAdvance = () => {
    if (step === 1) return form.name.trim().length > 1 && form.industry.length > 0 && form.city.trim().length > 0
    if (step === 2) return form.catalog.length > 0
    if (step === 3) return true
    if (step === 4) return true
    return false
  }

  const next = () => { if (step < 5) setStep(s => s + 1) }
  const back = () => { if (step > 1) setStep(s => s - 1) }

  // ── Step 2: catalog helpers ─────────────────────────────────────────────────

  const addItem = () => {
    const name  = draft.name.trim()
    const price = parseFloat(draft.price)
    if (!name || isNaN(price) || price < 0) return
    setForm(f => ({ ...f, catalog: [...f.catalog, { name, price, unit: draft.unit }] }))
    setDraft({ name: '', price: '', unit: 'per job' })
  }

  const removeItem = (i: number) =>
    setForm(f => ({ ...f, catalog: f.catalog.filter((_, idx) => idx !== i) }))

  // ── Step 3: commercial types ─────────────────────────────────────────────────

  const toggleCommercial = (type: string) =>
    setForm(f => ({
      ...f,
      commercial_types: f.commercial_types.includes(type)
        ? f.commercial_types.filter(t => t !== type)
        : [...f.commercial_types, type],
    }))

  // ── Step 4: voice analysis ───────────────────────────────────────────────────

  const analyzeVoice = async () => {
    if (!form.voice_emails.trim() || analyzing) return
    setAnalyzing(true)
    try {
      const res = await fetch('/api/style/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: form.voice_emails }),
      })
      const data = await res.json()
      if (data.style) {
        setForm(f => ({ ...f, voice_profile: data.style, voice_analyzed: true }))
      }
    } catch { /* non-critical */ }
    setAnalyzing(false)
  }

  // ── Step 5: submit ───────────────────────────────────────────────────────────

  const submit = async () => {
    if (loading) return
    setLoading(true)
    setError('')

    const result = await createBusiness({
      name:                        form.name.trim(),
      industry:                    form.industry,
      city:                        form.city.trim(),
      service_area:                form.service_area.trim(),
      business_description:        form.business_description.trim() || undefined,
      catalog:                     form.catalog,
      target_customer_type:        form.customer_type,
      customer_types:              form.commercial_types,
      ideal_customer_description:  form.ideal_customer_description.trim() || undefined,
      writing_style:               form.voice_profile,
    })

    if (!result.success) {
      setError(result.error ?? 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    router.refresh()
  }

  // ── Shared components ────────────────────────────────────────────────────────

  const StepLabel = ({ n }: { n: number }) => (
    <p style={{ fontSize: 11, fontWeight: 600, color: '#A1A1AA', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 6 }}>
      Step {n} of 5
    </p>
  )

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div style={{
        minHeight: '100vh', background: '#FAFAFA',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '32px 16px', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${GLOW}` }}>
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
              <path d="M3 8L7 12L13 4" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#09090B', letterSpacing: '-0.4px' }}>Salevo</span>
        </div>

        {/* Card */}
        <div style={{
          width: '100%', maxWidth: step === 2 ? 560 : 500,
          background: '#FFFFFF', borderRadius: 18,
          border: '1px solid rgba(0,0,0,0.07)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
          overflow: 'hidden', transition: 'max-width 0.3s ease',
        }}>
          {/* Progress bar */}
          <div style={{ height: 3, background: '#F4F4F5' }}>
            <div style={{ height: '100%', width: `${(step / 5) * 100}%`, background: ACCENT, transition: 'width 0.4s ease' }} />
          </div>

          <div style={{ padding: '32px 32px 28px' }}>
            {/* Step dots */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 28 }}>
              {STEPS.map((label, i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: i + 1 <= step ? ACCENT : '#F4F4F5',
                    border: `2px solid ${i + 1 <= step ? ACCENT : 'rgba(0,0,0,0.08)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.3s',
                  }}>
                    {i + 1 < step
                      ? <Check size={10} color="white" strokeWidth={3} />
                      : <span style={{ fontSize: 9, fontWeight: 700, color: i + 1 === step ? 'white' : '#A1A1AA' }}>{i + 1}</span>
                    }
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{ width: 18, height: 1, background: i + 1 < step ? ACCENT : 'rgba(0,0,0,0.08)', transition: 'background 0.3s' }} />
                  )}
                </div>
              ))}
              <span style={{ marginLeft: 8, fontSize: 12, color: '#A1A1AA', fontWeight: 500 }}>{STEPS[step - 1]}</span>
            </div>

            {/* ── Step 1: Business Basics ─────────────────────────────────── */}
            {step === 1 && (
              <div>
                <StepLabel n={1} />
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#09090B', letterSpacing: '-0.5px', marginBottom: 6 }}>Tell us about your business</h2>
                <p style={{ fontSize: 13.5, color: '#52525B', marginBottom: 24 }}>This sets up your workspace in Salevo.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Business Name</label>
                    <input autoFocus type="text" placeholder="e.g. Evans Custom Apparel"
                      value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && canAdvance() && next()}
                      style={inputStyle} onFocus={focusIn} onBlur={focusOut}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Industry</label>
                    <select value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                      style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' as const }}
                      onFocus={focusIn} onBlur={focusOut}
                    >
                      <option value="">Select your industry…</option>
                      {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 2 }}>
                      <label style={labelStyle}>City</label>
                      <input type="text" placeholder="e.g. Omaha"
                        value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                        style={{ ...inputStyle, padding: '11px 14px' }} onFocus={focusIn} onBlur={focusOut}
                      />
                    </div>
                    <div style={{ flex: 3 }}>
                      <label style={labelStyle}>Service Area</label>
                      <input type="text" placeholder="e.g. Omaha metro + 50 miles"
                        value={form.service_area} onChange={e => setForm(f => ({ ...f, service_area: e.target.value }))}
                        style={{ ...inputStyle, padding: '11px 14px' }} onFocus={focusIn} onBlur={focusOut}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>About Your Business <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#A1A1AA' }}>(optional)</span></label>
                    <textarea
                      value={form.business_description}
                      onChange={e => setForm(f => ({ ...f, business_description: e.target.value }))}
                      rows={3}
                      placeholder="Tell us about your business — what you do, who you serve, what makes you different."
                      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 } as React.CSSProperties}
                      onFocus={focusIn} onBlur={focusOut}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Products & Services ────────────────────────────── */}
            {step === 2 && (
              <div>
                <StepLabel n={2} />
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#09090B', letterSpacing: '-0.5px', marginBottom: 6 }}>Products & Services</h2>
                <p style={{ fontSize: 13.5, color: '#52525B', marginBottom: 22 }}>Add your most common services or products. You can update this anytime.</p>

                {/* Add item row */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'flex-end' }}>
                  <div style={{ flex: 3 }}>
                    <label style={{ ...labelStyle, marginBottom: 5 }}>Item Name</label>
                    <input type="text" placeholder="e.g. Custom T-Shirt"
                      value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addItem()}
                      style={{ ...inputStyle, padding: '10px 12px', fontSize: 13.5 }}
                      onFocus={focusIn} onBlur={focusOut}
                    />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={{ ...labelStyle, marginBottom: 5 }}>Price ($)</label>
                    <input type="number" min="0" step="0.01" placeholder="0.00"
                      value={draft.price} onChange={e => setDraft(d => ({ ...d, price: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addItem()}
                      style={{ ...inputStyle, padding: '10px 12px', fontSize: 13.5 }}
                      onFocus={focusIn} onBlur={focusOut}
                    />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={{ ...labelStyle, marginBottom: 5 }}>Unit</label>
                    <select value={draft.unit} onChange={e => setDraft(d => ({ ...d, unit: e.target.value as CatalogItem['unit'] }))}
                      style={{ ...inputStyle, padding: '10px 12px', fontSize: 13.5, cursor: 'pointer', appearance: 'none' as const }}
                      onFocus={focusIn} onBlur={focusOut}
                    >
                      {UNIT_TYPES.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <button
                    onClick={addItem}
                    disabled={!draft.name.trim() || !draft.price || isNaN(parseFloat(draft.price))}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 40, height: 40, borderRadius: 9, border: 'none', flexShrink: 0,
                      background: draft.name.trim() && draft.price && !isNaN(parseFloat(draft.price)) ? ACCENT : '#E4E4E7',
                      color: 'white', cursor: draft.name.trim() && draft.price ? 'pointer' : 'not-allowed',
                      boxShadow: draft.name.trim() && draft.price ? `0 2px 8px ${GLOW}` : 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {/* Item list */}
                {form.catalog.length > 0 ? (
                  <div style={{ background: '#FAFAFA', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 10, overflow: 'hidden' }}>
                    {form.catalog.map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.06)' : undefined, gap: 10 }}>
                        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: '#09090B' }}>{item.name}</span>
                        <span style={{ fontSize: 13, color: '#52525B', fontWeight: 600 }}>${item.price.toLocaleString()}</span>
                        <span style={{ fontSize: 11, color: '#A1A1AA', background: '#F4F4F5', padding: '2px 8px', borderRadius: 6 }}>{item.unit}</span>
                        <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 4, display: 'flex', flexShrink: 0 }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ border: '1.5px dashed rgba(0,0,0,0.10)', borderRadius: 10, padding: '18px', textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: '#A1A1AA' }}>No items yet — add at least one to continue</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 3: Target Customer ─────────────────────────────────── */}
            {step === 3 && (
              <div>
                <StepLabel n={3} />
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#09090B', letterSpacing: '-0.5px', marginBottom: 6 }}>Who do you sell to?</h2>
                <p style={{ fontSize: 13.5, color: '#52525B', marginBottom: 22 }}>This helps Salevo tailor your outreach and quotes.</p>

                {/* Customer type toggle */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
                  {(['Residential', 'Commercial', 'Both'] as CustomerType[]).map(type => (
                    <button key={type}
                      onClick={() => setForm(f => ({ ...f, customer_type: type }))}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: 9, fontSize: 13.5, fontWeight: 600,
                        border: `1.5px solid ${form.customer_type === type ? ACCENT : 'rgba(0,0,0,0.10)'}`,
                        background: form.customer_type === type ? GLOW : '#fff',
                        color: form.customer_type === type ? ACCENT : '#52525B',
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                      }}
                    >{type}</button>
                  ))}
                </div>

                {/* Commercial types */}
                {(form.customer_type === 'Commercial' || form.customer_type === 'Both') && (
                  <div style={{ marginBottom: 22 }}>
                    <label style={labelStyle}>What types of commercial customers?</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {COMMERCIAL_TYPES.map(type => {
                        const active = form.commercial_types.includes(type)
                        return (
                          <button key={type}
                            onClick={() => toggleCommercial(type)}
                            style={{
                              padding: '7px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 500,
                              border: `1.5px solid ${active ? ACCENT : 'rgba(0,0,0,0.10)'}`,
                              background: active ? GLOW : '#FAFAFA',
                              color: active ? ACCENT : '#52525B',
                              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                            }}
                          >{type}</button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Free-text ideal customer */}
                <div>
                  <label style={labelStyle}>Describe your ideal customer <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#A1A1AA' }}>(optional)</span></label>
                  <textarea
                    value={form.ideal_customer_description}
                    onChange={e => setForm(f => ({ ...f, ideal_customer_description: e.target.value }))}
                    rows={3}
                    placeholder="Describe your ideal customer in your own words (optional)"
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 } as React.CSSProperties}
                    onFocus={focusIn} onBlur={focusOut}
                  />
                </div>
              </div>
            )}

            {/* ── Step 4: Your Voice ──────────────────────────────────────── */}
            {step === 4 && (
              <div>
                <StepLabel n={4} />
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#09090B', letterSpacing: '-0.5px', marginBottom: 6 }}>Your writing voice</h2>
                <p style={{ fontSize: 13.5, color: '#52525B', marginBottom: 22 }}>Paste 2-3 emails or messages you've sent. Salevo learns your tone to write like you.</p>

                <textarea
                  value={form.voice_emails}
                  onChange={e => setForm(f => ({ ...f, voice_emails: e.target.value, voice_analyzed: false, voice_profile: null }))}
                  rows={6}
                  placeholder={`Hey Mike,\n\nJust following up on the quote I sent over...\n\n---\n\nHi Sarah, thanks for reaching out!`}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 } as React.CSSProperties}
                  onFocus={focusIn} onBlur={focusOut}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                  <button
                    onClick={analyzeVoice}
                    disabled={!form.voice_emails.trim() || analyzing}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '9px 20px', borderRadius: 9, border: 'none',
                      background: form.voice_emails.trim() && !analyzing ? ACCENT : '#E4E4E7',
                      color: 'white', fontSize: 13, fontWeight: 600,
                      cursor: form.voice_emails.trim() && !analyzing ? 'pointer' : 'not-allowed',
                      fontFamily: 'inherit', transition: 'all 0.2s',
                      boxShadow: form.voice_emails.trim() && !analyzing ? `0 2px 8px ${GLOW}` : 'none',
                    }}
                  >
                    {analyzing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                    {analyzing ? 'Analyzing…' : 'Analyze My Style'}
                  </button>
                  <button onClick={next} style={{ fontSize: 13, color: '#A1A1AA', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
                    Skip this step
                  </button>
                </div>

                {/* Voice profile preview */}
                {form.voice_profile && (
                  <div style={{ marginTop: 18, background: GLOW, border: `1px solid ${ACCENT}22`, borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <Check size={13} color={ACCENT} />
                      <p style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>Style extracted</p>
                    </div>
                    <p style={{ fontSize: 13, color: '#52525B', marginBottom: 8 }}>{form.voice_profile.summary}</p>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {[
                        { label: 'Tone', value: form.voice_profile.tone },
                        { label: 'Greeting', value: form.voice_profile.greeting_style },
                        { label: 'Sign-off', value: form.voice_profile.signature },
                      ].map(({ label, value }) => value ? (
                        <div key={label}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: '#A1A1AA', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 2 }}>{label}</p>
                          <p style={{ fontSize: 12.5, color: '#09090B', fontWeight: 500 }}>{value}</p>
                        </div>
                      ) : null)}
                    </div>
                    {form.voice_profile.phrases?.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                        {form.voice_profile.phrases.map((p, i) => (
                          <span key={i} style={{ fontSize: 11.5, color: ACCENT, background: 'white', padding: '2px 9px', borderRadius: 20, border: `1px solid ${ACCENT}33` }}>"{p}"</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Step 5: Review & Launch ─────────────────────────────────── */}
            {step === 5 && (
              <div>
                <StepLabel n={5} />
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#09090B', letterSpacing: '-0.5px', marginBottom: 6 }}>Review & Launch</h2>
                <p style={{ fontSize: 13.5, color: '#52525B', marginBottom: 22 }}>Everything looks good? Hit Launch to get started.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                  {/* Business */}
                  <SummaryCard label="Business">
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: '#09090B' }}>{form.name}</p>
                    <p style={{ fontSize: 12.5, color: '#71717A' }}>{form.industry} · {form.city}{form.service_area ? ` · ${form.service_area}` : ''}</p>
                  </SummaryCard>

                  {/* Catalog */}
                  <SummaryCard label={`Products & Services (${form.catalog.length})`}>
                    {form.catalog.slice(0, 3).map((item, i) => (
                      <p key={i} style={{ fontSize: 12.5, color: '#52525B' }}>
                        {item.name} — <strong style={{ color: '#09090B' }}>${item.price}</strong> <span style={{ color: '#A1A1AA' }}>{item.unit}</span>
                      </p>
                    ))}
                    {form.catalog.length > 3 && <p style={{ fontSize: 12, color: '#A1A1AA' }}>+{form.catalog.length - 3} more</p>}
                  </SummaryCard>

                  {/* Customers */}
                  <SummaryCard label="Target Customers">
                    <p style={{ fontSize: 12.5, color: '#52525B' }}>
                      {form.customer_type}
                      {form.commercial_types.length > 0 && ` · ${form.commercial_types.join(', ')}`}
                    </p>
                  </SummaryCard>

                  {/* Voice */}
                  <SummaryCard label="Writing Voice">
                    {form.voice_profile
                      ? <p style={{ fontSize: 12.5, color: '#52525B' }}>{form.voice_profile.summary}</p>
                      : <p style={{ fontSize: 12.5, color: '#A1A1AA' }}>Not set — you can add this in Settings</p>
                    }
                  </SummaryCard>
                </div>

                {error && <p style={{ fontSize: 12.5, color: '#DC2626', fontWeight: 500, marginBottom: 14 }}>⚠ {error}</p>}
              </div>
            )}

            {/* ── Navigation ─────────────────────────────────────────────── */}
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
              >← Back</button>

              {step < 5 ? (
                <button
                  onClick={next} disabled={!canAdvance()}
                  style={{
                    padding: '10px 26px', borderRadius: 9, border: 'none',
                    background: canAdvance() ? ACCENT : '#E4E4E7', color: 'white',
                    fontSize: 13.5, fontWeight: 600, cursor: canAdvance() ? 'pointer' : 'default',
                    fontFamily: 'inherit', letterSpacing: '-0.2px',
                    boxShadow: canAdvance() ? `0 2px 10px ${GLOW}` : 'none', transition: 'all 0.2s',
                  }}
                >Continue →</button>
              ) : (
                <button
                  onClick={submit} disabled={loading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '10px 26px', borderRadius: 9, border: 'none',
                    background: loading ? '#E4E4E7' : ACCENT, color: 'white',
                    fontSize: 13.5, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', letterSpacing: '-0.2px',
                    boxShadow: loading ? 'none' : `0 2px 10px ${GLOW}`, transition: 'all 0.2s',
                  }}
                >
                  {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                  {loading ? 'Setting up…' : '✓ Launch Salevo'}
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

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#FAFAFA', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 10, padding: '12px 14px' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#A1A1AA', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 6 }}>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{children}</div>
    </div>
  )
}
