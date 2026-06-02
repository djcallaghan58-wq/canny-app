'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings } from 'lucide-react'
import { getAccent, getGlow } from '@/lib/supabase'
import type { Business } from '@/lib/supabase'
import { updateBusiness } from '@/app/actions/business'

const FIELDS = [
  {
    key:         'name' as const,
    label:       'Business Name',
    placeholder: 'e.g. Miller\'s HVAC & Cooling',
    type:        'text',
  },
  {
    key:         'industry' as const,
    label:       'What does your business do?',
    placeholder: 'e.g. HVAC, Apparel, Landscaping, Staffing',
    type:        'text',
  },
  {
    key:         'ideal_customer' as const,
    label:       'Who is your ideal customer?',
    placeholder: 'e.g. Sports teams and businesses that need custom apparel',
    type:        'text',
  },
  {
    key:         'main_service' as const,
    label:       'What is your main service or product?',
    placeholder: 'e.g. Custom t-shirts, uniforms, and branded merchandise',
    type:        'text',
  },
  {
    key:         'city' as const,
    label:       'City',
    placeholder: 'e.g. Phoenix, AZ',
    type:        'text',
  },
  {
    key:         'phone' as const,
    label:       'Phone',
    placeholder: 'e.g. (602) 555-0123',
    type:        'tel',
  },
] as const

type FieldKey = typeof FIELDS[number]['key']

export function SettingsView({ business }: { business: Business }) {
  const router = useRouter()
  const accent = getAccent(business.trade_type)
  const glow   = getGlow(business.trade_type)

  const [form, setForm] = useState<Record<FieldKey, string>>({
    name:           business.name,
    industry:       business.industry       ?? '',
    ideal_customer: business.ideal_customer ?? '',
    main_service:   business.main_service   ?? '',
    city:           business.city,
    phone:          business.phone,
  })
  const [businessDescription,       setBusinessDescription]       = useState(business.business_description       ?? '')
  const [idealCustomerDescription,  setIdealCustomerDescription]  = useState(business.ideal_customer_description ?? '')
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState('')

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px',
    background: '#F4F4F5', border: '1.5px solid rgba(0,0,0,0.10)',
    borderRadius: 9, fontSize: 13.5, color: '#09090B',
    outline: 'none', fontFamily: 'inherit',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = accent
    e.target.style.boxShadow = `0 0 0 3px ${glow}`
    e.target.style.background = '#fff'
  }
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = 'rgba(0,0,0,0.10)'
    e.target.style.boxShadow = 'none'
    e.target.style.background = '#F4F4F5'
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    setSaved(false)
    setError('')

    const result = await updateBusiness({
      name:                        form.name.trim()                      || undefined,
      industry:                    form.industry.trim()                   || undefined,
      ideal_customer:              form.ideal_customer.trim()             || undefined,
      main_service:                form.main_service.trim()               || undefined,
      city:                        form.city.trim()                       || undefined,
      phone:                       form.phone.trim()                      || undefined,
      business_description:        businessDescription.trim()             || undefined,
      ideal_customer_description:  idealCustomerDescription.trim()        || undefined,
    })

    setSaving(false)

    if (!result.success) {
      setError(result.error ?? 'Something went wrong.')
      return
    }

    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.1) transparent' }}>

      {/* Page header */}
      <div style={{
        padding: '20px 28px 16px', flexShrink: 0,
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        background: '#FFFFFF',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: glow, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Settings size={18} color={accent} />
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#A1A1AA', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 2 }}>
            {business.name}
          </p>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#09090B', letterSpacing: '-0.4px', lineHeight: 1 }}>
            Business Settings
          </h1>
        </div>
      </div>

      <div style={{ padding: '28px', maxWidth: 600 }}>
        <div style={{
          background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)',
          borderRadius: 14, padding: '28px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#A1A1AA', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 20 }}>
            Business Profile
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {FIELDS.map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label style={{
                  fontSize: 11, fontWeight: 700, color: '#52525B',
                  letterSpacing: '0.4px', textTransform: 'uppercase',
                  display: 'block', marginBottom: 6,
                }}>
                  {label}
                </label>
                <input
                  type={type}
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  onFocus={onFocus} onBlur={onBlur}
                  style={inputStyle}
                />
              </div>
            ))}

            {/* Textarea fields */}
            <div>
              <label style={{
                fontSize: 11, fontWeight: 700, color: '#52525B',
                letterSpacing: '0.4px', textTransform: 'uppercase',
                display: 'block', marginBottom: 6,
              }}>
                About Your Business
              </label>
              <textarea
                value={businessDescription}
                onChange={e => setBusinessDescription(e.target.value)}
                rows={3}
                placeholder="Tell us about your business — what you do, who you serve, what makes you different."
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 } as React.CSSProperties}
                onFocus={onFocus} onBlur={onBlur}
              />
            </div>

            <div>
              <label style={{
                fontSize: 11, fontWeight: 700, color: '#52525B',
                letterSpacing: '0.4px', textTransform: 'uppercase',
                display: 'block', marginBottom: 6,
              }}>
                Ideal Customer Description
              </label>
              <textarea
                value={idealCustomerDescription}
                onChange={e => setIdealCustomerDescription(e.target.value)}
                rows={3}
                placeholder="Describe your ideal customer in your own words."
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 } as React.CSSProperties}
                onFocus={onFocus} onBlur={onBlur}
              />
            </div>
          </div>

          {error && (
            <p style={{ marginTop: 16, fontSize: 12.5, color: '#DC2626', fontWeight: 500 }}>⚠ {error}</p>
          )}

          <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '10px 24px', borderRadius: 9, border: 'none',
                background: saving ? '#E4E4E7' : accent,
                color: 'white', fontSize: 13.5, fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', letterSpacing: '-0.2px',
                boxShadow: saving ? 'none' : `0 2px 10px ${glow}`,
                transition: 'all 0.2s', minHeight: 44,
              }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            {saved && (
              <span style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>
                ✓ Saved
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
