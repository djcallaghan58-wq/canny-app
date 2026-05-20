'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Check } from 'lucide-react'
import { getAccent, getGlow } from '@/lib/supabase'
import type { Business, WritingStyle } from '@/lib/supabase'

export function StyleTrainer({ business }: { business: Business }) {
  const router  = useRouter()
  const accent  = getAccent(business.trade_type)
  const glow    = getGlow(business.trade_type)

  const [emails,   setEmails]   = useState('')
  const [training, setTraining] = useState(false)
  const [style,    setStyle]    = useState<WritingStyle | null>(business.writing_style)
  const [error,    setError]    = useState('')

  const train = async () => {
    if (!emails.trim() || training) return
    setTraining(true)
    setError('')
    try {
      const res = await fetch('/api/style/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails, businessId: business.id }),
      })
      const data = await res.json()
      if (data.style) {
        setStyle(data.style)
        setEmails('')
        router.refresh()
      } else {
        setError(data.error ?? 'Training failed')
      }
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setTraining(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px',
    background: '#F4F4F5', border: '1.5px solid rgba(0,0,0,0.10)',
    borderRadius: 9, fontSize: 13.5, color: '#09090B',
    outline: 'none', fontFamily: 'inherit',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  const onFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    e.target.style.borderColor = accent
    e.target.style.boxShadow = `0 0 0 3px ${glow}`
    e.target.style.background = '#fff'
  }
  const onBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    e.target.style.borderColor = 'rgba(0,0,0,0.10)'
    e.target.style.boxShadow = 'none'
    e.target.style.background = '#F4F4F5'
  }

  const card: React.CSSProperties = {
    background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)',
    borderRadius: 14, padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    marginBottom: 20,
  }

  const label: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: '#52525B',
    letterSpacing: '0.4px', textTransform: 'uppercase',
    display: 'block', marginBottom: 6,
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.1) transparent' }}>

      {/* Header */}
      <div style={{
        padding: '20px 28px 16px', flexShrink: 0,
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        background: '#FFFFFF',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: glow, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={18} color={accent} />
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#A1A1AA', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 2 }}>
            {business.name}
          </p>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#09090B', letterSpacing: '-0.4px', lineHeight: 1 }}>
            Writing Style
          </h1>
        </div>
      </div>

      <div style={{ padding: '28px', maxWidth: 640 }}>

        {/* Current style summary */}
        {style && (
          <div style={{ ...card, borderLeft: `3px solid ${accent}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Check size={14} color={accent} />
              <p style={{ fontSize: 13, fontWeight: 700, color: '#09090B' }}>Current Style</p>
            </div>
            <p style={{ fontSize: 13.5, color: '#52525B', lineHeight: 1.7, marginBottom: 16 }}>
              {style.summary}
            </p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { label: 'Tone',      value: style.tone },
                { label: 'Sentences', value: style.sentence_length },
                { label: 'Greeting',  value: style.greeting_style },
                { label: 'Sign-off',  value: style.signature },
              ].map(({ label: l, value: v }) => v ? (
                <div key={l}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#A1A1AA', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 2 }}>{l}</p>
                  <p style={{ fontSize: 13, color: '#09090B', fontWeight: 500 }}>{v}</p>
                </div>
              ) : null)}
            </div>
            {style.phrases?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#A1A1AA', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 6 }}>Signature phrases</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {style.phrases.map((p, i) => (
                    <span key={i} style={{ fontSize: 12, fontWeight: 500, color: accent, background: glow, padding: '2px 10px', borderRadius: 20 }}>
                      "{p}"
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Train */}
        <div style={card}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#A1A1AA', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 16 }}>
            {style ? 'Retrain style' : 'Train your style'}
          </p>
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Paste 2–3 emails you've written</label>
            <textarea
              value={emails}
              onChange={e => setEmails(e.target.value)}
              rows={10}
              placeholder={`Paste 2-3 emails you've sent — the more natural the better.\n\nExample:\nHey John,\nJust wanted to reach out about...\n\n---\n\nHi Sarah,\nI noticed your team recently...`}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 } as React.CSSProperties}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>

          {error && (
            <p style={{ fontSize: 12.5, color: '#DC2626', fontWeight: 500, marginBottom: 14 }}>⚠ {error}</p>
          )}

          <button
            onClick={train}
            disabled={!emails.trim() || training}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 24px', borderRadius: 9, border: 'none',
              background: emails.trim() && !training ? accent : '#E4E4E7',
              color: 'white', fontSize: 13.5, fontWeight: 600,
              cursor: emails.trim() && !training ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', letterSpacing: '-0.2px',
              boxShadow: emails.trim() && !training ? `0 2px 10px ${glow}` : 'none',
              transition: 'all 0.2s', minHeight: 44,
            }}
          >
            <Sparkles size={14} />
            {training ? 'Training…' : style ? 'Retrain My Style' : 'Train My Style'}
          </button>

          <p style={{ fontSize: 12, color: '#A1A1AA', marginTop: 10 }}>
            Claude analyses your phrasing, tone, and structure — then uses it when drafting outreach emails.
            Your style also improves automatically each time you edit a draft.
          </p>
        </div>
      </div>
    </div>
  )
}
