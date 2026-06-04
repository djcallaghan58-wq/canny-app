'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, Check } from 'lucide-react'
import { createBusiness } from '@/app/actions/business'
import type { CatalogItem, WritingStyle } from '@/lib/supabase'

// ── Design tokens ─────────────────────────────────────────────────────────────
const ACCENT = '#1D9E75'
const GLOW   = 'rgba(29,158,117,0.15)'
const BG     = '#F7F9F8'
const CARD_BORDER = '#E0EBE5'
const BODY_TEXT   = '#085041'
const SECONDARY   = '#6B8C7E'
const MUTED       = '#9FD4C0'
const INPUT_BG    = '#F7F9F8'
const OUTLINE_BORDER = '#C2D6CC'

const STEPS = ['Basics', 'Catalog', 'Customers', 'Voice', 'Launch']

const INDUSTRIES = [
  'Apparel & Printing', 'HVAC', 'Plumbing', 'Electrical', 'Roofing',
  'Cleaning', 'Landscaping', 'Property Management', 'Other',
]

const UNIT_TYPES: CatalogItem['unit'][] = ['per hour', 'per job', 'per unit', 'per item']

const COMMERCIAL_TYPES = [
  'Property managers', 'Restaurants', 'Gyms', 'Schools', 'Offices', 'Retail', 'Hospitality',
]

// ── Styles ────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  background: INPUT_BG, border: `1.5px solid ${OUTLINE_BORDER}`,
  borderRadius: 8, fontSize: 14, color: BODY_TEXT,
  outline: 'none', fontFamily: 'inherit',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, color: SECONDARY,
  letterSpacing: '0.4px', textTransform: 'uppercase',
  display: 'block', marginBottom: 6,
}

function focusIn(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.target.style.borderColor = ACCENT
  e.target.style.boxShadow   = `0 0 0 3px ${GLOW}`
  e.target.style.background  = '#fff'
}
function focusOut(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.target.style.borderColor = OUTLINE_BORDER
  e.target.style.boxShadow   = 'none'
  e.target.style.background  = INPUT_BG
}

// ── Form state ────────────────────────────────────────────────────────────────

type CustomerType = 'Residential' | 'Commercial' | 'Both'

interface FormState {
  name: string; industry: string; city: string; service_area: string; business_description: string
  catalog: CatalogItem[]
  customer_type: CustomerType; commercial_types: string[]; ideal_customer_description: string
  voice_emails: string; voice_profile: WritingStyle | null; voice_analyzed: boolean
}

// ── Onboarding flow ───────────────────────────────────────────────────────────

export function OnboardingFlow() {
  const router = useRouter()
  const [step,      setStep]      = useState(1)
  const [form,      setForm]      = useState<FormState>({
    name: '', industry: '', city: '', service_area: '', business_description: '',
    catalog: [],
    customer_type: 'Both', commercial_types: [], ideal_customer_description: '',
    voice_emails: '', voice_profile: null, voice_analyzed: false,
  })
  const [loading,   setLoading]   = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error,     setError]     = useState('')
  const [draft,     setDraft]     = useState<{ name: string; price: string; unit: CatalogItem['unit'] }>({
    name: '', price: '', unit: 'per job',
  })

  const canAdvance = () => {
    if (step === 1) return form.name.trim().length > 1 && form.industry.length > 0 && form.city.trim().length > 0
    if (step === 2) return form.catalog.length > 0
    return true
  }

  const next = () => { if (step < 5) setStep(s => s + 1) }
  const back = () => { if (step > 1) setStep(s => s - 1) }

  const addItem = () => {
    const name  = draft.name.trim()
    const price = parseFloat(draft.price)
    if (!name || isNaN(price) || price < 0) return
    setForm(f => ({ ...f, catalog: [...f.catalog, { name, price, unit: draft.unit }] }))
    setDraft({ name: '', price: '', unit: 'per job' })
  }

  const removeItem = (i: number) =>
    setForm(f => ({ ...f, catalog: f.catalog.filter((_, idx) => idx !== i) }))

  const toggleCommercial = (type: string) =>
    setForm(f => ({
      ...f,
      commercial_types: f.commercial_types.includes(type)
        ? f.commercial_types.filter(t => t !== type)
        : [...f.commercial_types, type],
    }))

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

  const submit = async () => {
    if (loading) return
    setLoading(true); setError('')

    const result = await createBusiness({
      name:                       form.name.trim(),
      industry:                   form.industry,
      city:                       form.city.trim(),
      service_area:               form.service_area.trim(),
      business_description:       form.business_description.trim() || undefined,
      catalog:                    form.catalog,
      target_customer_type:       form.customer_type,
      customer_types:             form.commercial_types,
      ideal_customer_description: form.ideal_customer_description.trim() || undefined,
      writing_style:              form.voice_profile,
    })

    if (!result.success) {
      setError(result.error ?? 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }
    router.refresh()
  }

  const StepLabel = ({ n }: { n: number }) => (
    <p style={{ fontSize: 10.5, fontWeight: 600, color: MUTED, letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 5 }}>
      Step {n} of 5
    </p>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div style={{
        minHeight: '100vh', background: BG,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '32px 16px', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 32 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: ACCENT,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 14px ${GLOW}`,
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8L7 12L13 4" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, color: BODY_TEXT, letterSpacing: '-0.4px' }}>Salevo</span>
        </div>

        {/* Card */}
        <div style={{
          width: '100%', maxWidth: step === 2 ? 560 : 500,
          background: '#FFFFFF', borderRadius: 16,
          border: `1px solid ${CARD_BORDER}`,
          boxShadow: '0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)',
          overflow: 'hidden', transition: 'max-width 0.3s ease',
        }}>
          {/* Progress bar */}
          <div style={{ height: 3, background: '#F0F7F4' }}>
            <div style={{ height: '100%', width: `${(step / 5) * 100}%`, background: ACCENT, transition: 'width 0.4s ease' }} />
          </div>

          <div style={{ padding: '28px 28px 24px' }}>
            {/* Step dots */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 24 }}>
              {STEPS.map((label, i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: i + 1 <= step ? ACCENT : '#F0F7F4',
                    border: `2px solid ${i + 1 <= step ? ACCENT : CARD_BORDER}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.3s',
                  }}>
                    {i + 1 < step
                      ? <Check size={10} color="white" strokeWidth={3} />
                      : <span style={{ fontSize: 9, fontWeight: 700, color: i + 1 === step ? 'white' : MUTED }}>{i + 1}</span>
                    }
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{ width: 18, height: 1, background: i + 1 < step ? ACCENT : CARD_BORDER, transition: 'background 0.3s' }} />
                  )}
                </div>
              ))}
              <span style={{ marginLeft: 8, fontSize: 11.5, color: MUTED, fontWeight: 500 }}>{STEPS[step - 1]}</span>
            </div>

            {/* ── Step 1: Business Basics ── */}
            {step === 1 && (
              <div>
                <StepLabel n={1} />
                <h2 style={{ fontSize: 21, fontWeight: 700, color: BODY_TEXT, letterSpacing: '-0.5px', marginBottom: 5 }}>Tell us about your business</h2>
                <p style={{ fontSize: 13.5, color: SECONDARY, marginBottom: 22 }}>This sets up your workspace in Salevo.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
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
                        style={inputStyle} onFocus={focusIn} onBlur={focusOut}
                      />
                    </div>
                    <div style={{ flex: 3 }}>
                      <label style={labelStyle}>Service Area</label>
                      <input type="text" placeholder="e.g. Omaha metro + 50 miles"
                        value={form.service_area} onChange={e => setForm(f => ({ ...f, service_area: e.target.value }))}
                        style={inputStyle} onFocus={focusIn} onBlur={focusOut}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>
                      About Your Business{' '}
                      <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: MUTED }}>(optional)</span>
                    </label>
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

            {/* ── Step 2: Products & Services ── */}
            {step === 2 && (
              <div>
                <StepLabel n={2} />
                <h2 style={{ fontSize: 21, fontWeight: 700, color: BODY_TEXT, letterSpacing: '-0.5px', marginBottom: 5 }}>Products & Services</h2>
                <p style={{ fontSize: 13.5, color: SECONDARY, marginBottom: 20 }}>Add your most common services or products. You can update this anytime.</p>

                <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-end' }}>
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
                      width: 40, height: 40, borderRadius: 8, border: 'none', flexShrink: 0,
                      background: draft.name.trim() && draft.price && !isNaN(parseFloat(draft.price)) ? ACCENT : '#E4E4E7',
                      color: 'white', cursor: draft.name.trim() && draft.price ? 'pointer' : 'not-allowed',
                      boxShadow: draft.name.trim() && draft.price ? `0 2px 8px ${GLOW}` : 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Plus size={15} />
                  </button>
                </div>

                {form.catalog.length > 0 ? (
                  <div style={{ background: '#F0F7F4', border: `1px solid ${CARD_BORDER}`, borderRadius: 9, overflow: 'hidden' }}>
                    {form.catalog.map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '10px 13px', borderTop: i > 0 ? `1px solid ${CARD_BORDER}` : undefined, gap: 10 }}>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: BODY_TEXT }}>{item.name}</span>
                        <span style={{ fontSize: 12.5, color: SECONDARY, fontWeight: 600 }}>${item.price.toLocaleString()}</span>
                        <span style={{ fontSize: 10.5, color: MUTED, background: '#FFFFFF', padding: '2px 7px', borderRadius: 5, border: `1px solid ${CARD_BORDER}` }}>{item.unit}</span>
                        <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 3, display: 'flex', flexShrink: 0 }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ border: `1.5px dashed ${CARD_BORDER}`, borderRadius: 9, padding: '16px', textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: MUTED }}>No items yet — add at least one to continue</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 3: Target Customer ── */}
            {step === 3 && (
              <div>
                <StepLabel n={3} />
                <h2 style={{ fontSize: 21, fontWeight: 700, color: BODY_TEXT, letterSpacing: '-0.5px', marginBottom: 5 }}>Who do you sell to?</h2>
                <p style={{ fontSize: 13.5, color: SECONDARY, marginBottom: 20 }}>This helps Salevo tailor your outreach and quotes.</p>

                <div style={{ display: 'flex', gap: 9, marginBottom: 20 }}>
                  {(['Residential', 'Commercial', 'Both'] as CustomerType[]).map(type => (
                    <button key={type}
                      onClick={() => setForm(f => ({ ...f, customer_type: type }))}
                      style={{
                        flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
                        border: `1.5px solid ${form.customer_type === type ? ACCENT : CARD_BORDER}`,
                        background: form.customer_type === type ? '#E1F5EE' : '#fff',
                        color: form.customer_type === type ? ACCENT : SECONDARY,
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                      }}
                    >{type}</button>
                  ))}
                </div>

                {(form.customer_type === 'Commercial' || form.customer_type === 'Both') && (
                  <div style={{ marginBottom: 20 }}>
                    <label style={labelStyle}>What types of commercial customers?</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                      {COMMERCIAL_TYPES.map(type => {
                        const active = form.commercial_types.includes(type)
                        return (
                          <button key={type}
                            onClick={() => toggleCommercial(type)}
                            style={{
                              padding: '6px 13px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                              border: `1.5px solid ${active ? ACCENT : CARD_BORDER}`,
                              background: active ? '#E1F5EE' : '#F7F9F8',
                              color: active ? ACCENT : SECONDARY,
                              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                            }}
                          >{type}</button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label style={labelStyle}>
                    Describe your ideal customer{' '}
                    <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: MUTED }}>(optional)</span>
                  </label>
                  <textarea
                    value={form.ideal_customer_description}
                    onChange={e => setForm(f => ({ ...f, ideal_customer_description: e.target.value }))}
                    rows={3}
                    placeholder="Describe your ideal customer in your own words"
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 } as React.CSSProperties}
                    onFocus={focusIn} onBlur={focusOut}
                  />
                </div>
              </div>
            )}

            {/* ── Step 4: Your Voice ── */}
            {step === 4 && (
              <div>
                <StepLabel n={4} />
                <h2 style={{ fontSize: 21, fontWeight: 700, color: BODY_TEXT, letterSpacing: '-0.5px', marginBottom: 5 }}>Your writing voice</h2>
                <p style={{ fontSize: 13.5, color: SECONDARY, marginBottom: 20 }}>Paste 2-3 emails or messages you've sent. Salevo learns your tone to write like you.</p>

                <textarea
                  value={form.voice_emails}
                  onChange={e => setForm(f => ({ ...f, voice_emails: e.target.value, voice_analyzed: false, voice_profile: null }))}
                  rows={6}
                  placeholder={`Hey Mike,\n\nJust following up on the quote I sent over...\n\n---\n\nHi Sarah, thanks for reaching out!`}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 } as React.CSSProperties}
                  onFocus={focusIn} onBlur={focusOut}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 11 }}>
                  <button
                    onClick={analyzeVoice}
                    disabled={!form.voice_emails.trim() || analyzing}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 18px', borderRadius: 8, border: 'none',
                      background: form.voice_emails.trim() && !analyzing ? ACCENT : '#E4E4E7',
                      color: 'white', fontSize: 12.5, fontWeight: 600,
                      cursor: form.voice_emails.trim() && !analyzing ? 'pointer' : 'not-allowed',
                      fontFamily: 'inherit', transition: 'all 0.2s',
                      boxShadow: form.voice_emails.trim() && !analyzing ? `0 2px 8px ${GLOW}` : 'none',
                    }}
                  >
                    {analyzing ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                    {analyzing ? 'Analyzing…' : 'Analyze My Style'}
                  </button>
                  <button onClick={next} style={{ fontSize: 12.5, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
                    Skip this step
                  </button>
                </div>

                {form.voice_profile && (
                  <div style={{ marginTop: 16, background: '#E1F5EE', border: `1px solid ${ACCENT}22`, borderRadius: 9, padding: '13px 15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
                      <Check size={12} color={ACCENT} />
                      <p style={{ fontSize: 11.5, fontWeight: 700, color: ACCENT }}>Style extracted</p>
                    </div>
                    <p style={{ fontSize: 12.5, color: SECONDARY, marginBottom: 8 }}>{form.voice_profile.summary}</p>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {[
                        { label: 'Tone',     value: form.voice_profile.tone          },
                        { label: 'Greeting', value: form.voice_profile.greeting_style },
                        { label: 'Sign-off', value: form.voice_profile.signature      },
                      ].map(({ label, value }) => value ? (
                        <div key={label}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: MUTED, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 2 }}>{label}</p>
                          <p style={{ fontSize: 12, color: BODY_TEXT, fontWeight: 500 }}>{value}</p>
                        </div>
                      ) : null)}
                    </div>
                    {form.voice_profile.phrases?.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 9 }}>
                        {form.voice_profile.phrases.map((p, i) => (
                          <span key={i} style={{ fontSize: 11, color: ACCENT, background: 'white', padding: '2px 8px', borderRadius: 20, border: `1px solid ${ACCENT}33` }}>"{p}"</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Step 5: Review & Launch ── */}
            {step === 5 && (
              <div>
                <StepLabel n={5} />
                <h2 style={{ fontSize: 21, fontWeight: 700, color: BODY_TEXT, letterSpacing: '-0.5px', marginBottom: 5 }}>Review & Launch</h2>
                <p style={{ fontSize: 13.5, color: SECONDARY, marginBottom: 20 }}>Everything looks good? Hit Launch to get started.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 22 }}>
                  <SummaryCard label="Business">
                    <p style={{ fontSize: 13, fontWeight: 600, color: BODY_TEXT }}>{form.name}</p>
                    <p style={{ fontSize: 12, color: SECONDARY }}>{form.industry} · {form.city}{form.service_area ? ` · ${form.service_area}` : ''}</p>
                  </SummaryCard>
                  <SummaryCard label={`Products & Services (${form.catalog.length})`}>
                    {form.catalog.slice(0, 3).map((item, i) => (
                      <p key={i} style={{ fontSize: 12, color: SECONDARY }}>
                        {item.name} — <strong style={{ color: BODY_TEXT }}>${item.price}</strong>{' '}
                        <span style={{ color: MUTED }}>{item.unit}</span>
                      </p>
                    ))}
                    {form.catalog.length > 3 && <p style={{ fontSize: 11.5, color: MUTED }}>+{form.catalog.length - 3} more</p>}
                  </SummaryCard>
                  <SummaryCard label="Target Customers">
                    <p style={{ fontSize: 12, color: SECONDARY }}>
                      {form.customer_type}{form.commercial_types.length > 0 && ` · ${form.commercial_types.join(', ')}`}
                    </p>
                  </SummaryCard>
                  <SummaryCard label="Writing Voice">
                    {form.voice_profile
                      ? <p style={{ fontSize: 12, color: SECONDARY }}>{form.voice_profile.summary}</p>
                      : <p style={{ fontSize: 12, color: MUTED }}>Not set — you can add this in Settings</p>
                    }
                  </SummaryCard>
                </div>

                {error && <p style={{ fontSize: 12, color: '#DC2626', fontWeight: 500, marginBottom: 12 }}>⚠ {error}</p>}
              </div>
            )}

            {/* ── Navigation ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
              <button
                onClick={back} disabled={step === 1}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  border: `1.5px solid ${CARD_BORDER}`,
                  background: 'transparent', color: step === 1 ? MUTED : SECONDARY,
                  fontSize: 13, fontWeight: 500, cursor: step === 1 ? 'default' : 'pointer',
                  fontFamily: 'inherit', transition: 'all 0.15s',
                }}
              >← Back</button>

              {step < 5 ? (
                <button
                  onClick={next} disabled={!canAdvance()}
                  style={{
                    padding: '9px 24px', borderRadius: 8, border: 'none',
                    background: canAdvance() ? ACCENT : '#E4E4E7', color: 'white',
                    fontSize: 13, fontWeight: 600, cursor: canAdvance() ? 'pointer' : 'default',
                    fontFamily: 'inherit',
                    boxShadow: canAdvance() ? `0 2px 10px ${GLOW}` : 'none', transition: 'all 0.2s',
                  }}
                >Continue →</button>
              ) : (
                <button
                  onClick={submit} disabled={loading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '9px 24px', borderRadius: 8, border: 'none',
                    background: loading ? '#E4E4E7' : ACCENT, color: 'white',
                    fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: loading ? 'none' : `0 2px 10px ${GLOW}`, transition: 'all 0.2s',
                  }}
                >
                  {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                  {loading ? 'Setting up…' : '✓ Launch Salevo'}
                </button>
              )}
            </div>
          </div>
        </div>

        <p style={{ marginTop: 18, fontSize: 11.5, color: MUTED, textAlign: 'center' }}>
          Secured by Clerk · Your data stays private
        </p>
      </div>
    </>
  )
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#F0F7F4', border: `1px solid ${CARD_BORDER}`, borderRadius: 9, padding: '11px 13px' }}>
      <p style={{ fontSize: 9.5, fontWeight: 700, color: MUTED, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 5 }}>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{children}</div>
    </div>
  )
}
