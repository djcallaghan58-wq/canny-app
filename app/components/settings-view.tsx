'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings } from 'lucide-react'
import type { Business } from '@/lib/supabase'
import { updateBusiness, inviteTeamMember } from '@/app/actions/business'

// ── Design tokens ─────────────────────────────────────────────────────────────
const DS = {
  pageBg:       '#F7F9F8',
  cardBg:       '#FFFFFF',
  cardBorder:   '#E0EBE5',
  bodyText:     '#085041',
  secondary:    '#6B8C7E',
  muted:        '#9FD4C0',
  primary:      '#1D9E75',
  primaryGlow:  'rgba(29,158,117,0.15)',
  accentLight:  '#E1F5EE',
  outlineBorder:'#C2D6CC',
  outlineText:  '#4A7A6A',
  inputBg:      '#F7F9F8',
}

const FIELDS = [
  { key: 'name'           as const, label: 'Business Name',                  placeholder: "e.g. Miller's HVAC & Cooling",                     type: 'text' },
  { key: 'industry'       as const, label: 'What does your business do?',    placeholder: 'e.g. HVAC, Apparel, Landscaping, Staffing',         type: 'text' },
  { key: 'ideal_customer' as const, label: 'Who is your ideal customer?',    placeholder: 'e.g. Sports teams and businesses that need apparel', type: 'text' },
  { key: 'main_service'   as const, label: 'What is your main service?',     placeholder: 'e.g. Custom t-shirts, uniforms, merchandise',       type: 'text' },
  { key: 'city'           as const, label: 'City',                           placeholder: 'e.g. Phoenix, AZ',                                 type: 'text' },
  { key: 'phone'          as const, label: 'Phone',                          placeholder: 'e.g. (602) 555-0123',                              type: 'tel'  },
] as const

type FieldKey = typeof FIELDS[number]['key']

export function SettingsView({ business }: { business: Business }) {
  const router = useRouter()

  const [form, setForm] = useState<Record<FieldKey, string>>({
    name:           business.name,
    industry:       business.industry       ?? '',
    ideal_customer: business.ideal_customer ?? '',
    main_service:   business.main_service   ?? '',
    city:           business.city,
    phone:          business.phone,
  })
  const [businessDescription,      setBusinessDescription]      = useState(business.business_description       ?? '')
  const [idealCustomerDescription, setIdealCustomerDescription] = useState(business.ideal_customer_description ?? '')
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState('')

  const [inviteEmail,   setInviteEmail]   = useState('')
  const [inviting,      setInviting]      = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [inviteError,   setInviteError]   = useState('')

  // Follow-up schedule
  const defaultSched = business.follow_up_schedule ?? { first: 3, second: 7, third: 14 }
  const [fuFirst,  setFuFirst]  = useState(String(defaultSched.first))
  const [fuSecond, setFuSecond] = useState(String(defaultSched.second))
  const [fuThird,  setFuThird]  = useState(String(defaultSched.third))
  const [reactDays, setReactDays] = useState(String(business.reactivation_days ?? 60))
  const [savingFu,  setSavingFu]  = useState(false)
  const [savedFu,   setSavedFu]   = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 13px',
    background: DS.inputBg, border: `1.5px solid ${DS.outlineBorder}`,
    borderRadius: 7, fontSize: 13.5, color: DS.bodyText,
    outline: 'none', fontFamily: 'inherit',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = DS.primary
    e.target.style.boxShadow   = `0 0 0 3px ${DS.primaryGlow}`
    e.target.style.background  = '#fff'
  }
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = DS.outlineBorder
    e.target.style.boxShadow   = 'none'
    e.target.style.background  = DS.inputBg
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim() || inviting) return
    setInviting(true); setInviteSuccess(''); setInviteError('')
    const result = await inviteTeamMember(inviteEmail.trim())
    setInviting(false)
    if (result.success) {
      setInviteSuccess(`Invitation sent to ${inviteEmail.trim()}`)
      setInviteEmail('')
    } else {
      setInviteError(result.error ?? 'Could not send invitation.')
    }
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true); setSaved(false); setError('')

    const result = await updateBusiness({
      name:                       form.name.trim()                     || undefined,
      industry:                   form.industry.trim()                  || undefined,
      ideal_customer:             form.ideal_customer.trim()            || undefined,
      main_service:               form.main_service.trim()              || undefined,
      city:                       form.city.trim()                      || undefined,
      phone:                      form.phone.trim()                     || undefined,
      business_description:       businessDescription.trim()            || undefined,
      ideal_customer_description: idealCustomerDescription.trim()       || undefined,
    })

    setSaving(false)
    if (!result.success) { setError(result.error ?? 'Something went wrong.'); return }
    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 3000)
  }

  const handleSaveFu = async () => {
    if (savingFu) return
    setSavingFu(true); setSavedFu(false)
    await updateBusiness({
      follow_up_schedule: { first: Number(fuFirst), second: Number(fuSecond), third: Number(fuThird) },
      reactivation_days:  Number(reactDays),
    })
    setSavingFu(false); setSavedFu(true)
    router.refresh()
    setTimeout(() => setSavedFu(false), 3000)
  }

  const sectionCard: React.CSSProperties = {
    background:   DS.cardBg,
    border:       `1px solid ${DS.cardBorder}`,
    borderRadius: 12,
    padding:      '24px',
    boxShadow:    '0 1px 3px rgba(0,0,0,0.05)',
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: `${DS.muted} transparent`, background: DS.pageBg }}>

      {/* Page header */}
      <div style={{
        padding: '16px 24px 14px', flexShrink: 0,
        borderBottom: `1px solid ${DS.cardBorder}`,
        background: DS.cardBg,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: DS.accentLight,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Settings size={16} color={DS.primary} />
        </div>
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, color: DS.muted, letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 1 }}>
            {business.name}
          </p>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: DS.bodyText, letterSpacing: '-0.3px', lineHeight: 1 }}>
            Business Settings
          </h1>
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: 600 }}>

        {/* Business Profile */}
        <div style={sectionCard}>
          <p style={{ fontSize: 10.5, fontWeight: 700, color: DS.muted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 18 }}>
            Business Profile
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {FIELDS.map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: DS.secondary, letterSpacing: '0.4px', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
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

            <div>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: DS.secondary, letterSpacing: '0.4px', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
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
              <label style={{ fontSize: 10.5, fontWeight: 700, color: DS.secondary, letterSpacing: '0.4px', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
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
            <p style={{ marginTop: 14, fontSize: 12, color: '#DC2626', fontWeight: 500 }}>⚠ {error}</p>
          )}

          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '9px 22px', borderRadius: 6, border: 'none',
                background: saving ? '#E4E4E7' : DS.primary,
                color: 'white', fontSize: 12, fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                boxShadow: saving ? 'none' : `0 2px 10px ${DS.primaryGlow}`,
                transition: 'all 0.2s', minHeight: 38,
              }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            {saved && (
              <span style={{ fontSize: 12.5, color: DS.primary, fontWeight: 600 }}>✓ Saved</span>
            )}
          </div>
        </div>

        {/* Team Members */}
        <div style={{ ...sectionCard, marginTop: 16 }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, color: DS.muted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 5 }}>
            Team Members
          </p>
          <p style={{ fontSize: 13, color: DS.secondary, marginBottom: 18 }}>
            Invite teammates to collaborate on your pipeline and prospects. They'll see the same data as you.
          </p>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="email"
              placeholder="teammate@company.com"
              value={inviteEmail}
              onChange={e => { setInviteEmail(e.target.value); setInviteSuccess(''); setInviteError('') }}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
              onFocus={onFocus} onBlur={onBlur}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={handleInvite}
              disabled={!inviteEmail.trim() || inviting}
              style={{
                padding: '9px 18px', borderRadius: 6, border: 'none', flexShrink: 0,
                background: inviteEmail.trim() && !inviting ? DS.primary : '#E4E4E7',
                color: 'white', fontSize: 12, fontWeight: 600,
                cursor: inviteEmail.trim() && !inviting ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                boxShadow: inviteEmail.trim() && !inviting ? `0 2px 10px ${DS.primaryGlow}` : 'none',
                transition: 'all 0.2s', whiteSpace: 'nowrap' as const,
              }}
            >
              {inviting ? 'Sending…' : 'Send Invite'}
            </button>
          </div>

          {inviteSuccess && (
            <p style={{ marginTop: 10, fontSize: 12, color: DS.primary, fontWeight: 500 }}>✓ {inviteSuccess}</p>
          )}
          {inviteError && (
            <p style={{ marginTop: 10, fontSize: 12, color: '#DC2626', fontWeight: 500 }}>⚠ {inviteError}</p>
          )}
        </div>

        {/* Follow-up Schedule */}
        <div style={{ ...sectionCard, marginTop: 16 }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, color: DS.muted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 5 }}>
            Follow-up Schedule
          </p>
          <p style={{ fontSize: 13, color: DS.secondary, marginBottom: 18 }}>
            How many days after last contact before each follow-up is due.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
            {[
              { label: '1st Follow-up',  options: ['2', '3', '5'],        val: fuFirst,  set: setFuFirst  },
              { label: '2nd Follow-up',  options: ['5', '7', '10'],       val: fuSecond, set: setFuSecond },
              { label: '3rd Follow-up',  options: ['10', '14', '21'],     val: fuThird,  set: setFuThird  },
            ].map(({ label, options, val, set }) => (
              <div key={label}>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: DS.secondary, letterSpacing: '0.4px', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                  {label}
                </label>
                <select
                  value={val}
                  onChange={e => set(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' as const }}
                  onFocus={e => { e.target.style.borderColor = DS.primary; e.target.style.boxShadow = `0 0 0 3px ${DS.primaryGlow}`; e.target.style.background = '#fff' }}
                  onBlur={e => { e.target.style.borderColor = DS.outlineBorder; e.target.style.boxShadow = 'none'; e.target.style.background = DS.inputBg }}
                >
                  {options.map(o => <option key={o} value={o}>{o} days</option>)}
                </select>
              </div>
            ))}
          </div>

          <div style={{ borderTop: `1px solid ${DS.cardBorder}`, paddingTop: 18, marginTop: 4 }}>
            <p style={{ fontSize: 10.5, fontWeight: 700, color: DS.muted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 5 }}>
              Reactivation Window
            </p>
            <p style={{ fontSize: 13, color: DS.secondary, marginBottom: 10 }}>
              Flag past customers for a warm reactivation campaign after this many days.
            </p>
            <div style={{ maxWidth: 200 }}>
              <select
                value={reactDays}
                onChange={e => setReactDays(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' as const }}
                onFocus={e => { e.target.style.borderColor = DS.primary; e.target.style.boxShadow = `0 0 0 3px ${DS.primaryGlow}`; e.target.style.background = '#fff' }}
                onBlur={e => { e.target.style.borderColor = DS.outlineBorder; e.target.style.boxShadow = 'none'; e.target.style.background = DS.inputBg }}
              >
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleSaveFu}
              disabled={savingFu}
              style={{
                padding: '9px 22px', borderRadius: 6, border: 'none',
                background: savingFu ? '#E4E4E7' : DS.primary,
                color: 'white', fontSize: 12, fontWeight: 600,
                cursor: savingFu ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                boxShadow: savingFu ? 'none' : `0 2px 10px ${DS.primaryGlow}`,
                transition: 'all 0.2s', minHeight: 38,
              }}
            >
              {savingFu ? 'Saving…' : 'Save Schedule'}
            </button>
            {savedFu && <span style={{ fontSize: 12.5, color: DS.primary, fontWeight: 600 }}>✓ Saved</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
