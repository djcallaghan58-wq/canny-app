'use client'

import { useState } from 'react'
import { Sparkles, Plus, Check, Pencil, Trash2, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react'
import type { Business, WritingStyleRow } from '@/lib/supabase'
import {
  createWritingStyle,
  updateWritingStyle,
  deleteWritingStyle,
  setActiveStyle,
} from '@/app/actions/writing-styles'

// ── Design tokens ─────────────────────────────────────────────────────────────
const DS = {
  pageBg:        '#F7F9F8',
  cardBg:        '#FFFFFF',
  cardBorder:    '#E0EBE5',
  bodyText:      '#085041',
  secondary:     '#6B8C7E',
  muted:         '#9FD4C0',
  primary:       '#1D9E75',
  primaryGlow:   'rgba(29,158,117,0.15)',
  accentLight:   '#E1F5EE',
  accentMid:     '#F0F7F4',
  outlineBorder: '#C2D6CC',
  outlineText:   '#4A7A6A',
  inputBg:       '#F7F9F8',
  danger:        '#DC2626',
  dangerBg:      'rgba(220,38,38,0.08)',
  dangerBorder:  'rgba(220,38,38,0.20)',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type StyleForm = {
  name: string; tone: string; greeting: string
  sign_off: string; key_phrases: string; sample_text: string
}

const EMPTY_FORM: StyleForm = { name: '', tone: '', greeting: '', sign_off: '', key_phrases: '', sample_text: '' }

function toForm(s: WritingStyleRow): StyleForm {
  return {
    name:        s.name,
    tone:        s.tone        ?? '',
    greeting:    s.greeting    ?? '',
    sign_off:    s.sign_off    ?? '',
    key_phrases: (s.key_phrases ?? []).join(', '),
    sample_text: s.sample_text ?? '',
  }
}

function parsePayload(f: StyleForm) {
  return {
    name:        f.name.trim(),
    tone:        f.tone.trim()        || null,
    greeting:    f.greeting.trim()    || null,
    sign_off:    f.sign_off.trim()    || null,
    key_phrases: f.key_phrases.split(',').map(p => p.trim()).filter(Boolean),
    sample_text: f.sample_text.trim() || null,
  }
}

// ── Shared input helpers ──────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  background: DS.inputBg, border: `1.5px solid ${DS.outlineBorder}`,
  borderRadius: 7, fontSize: 13, color: DS.bodyText,
  outline: 'none', fontFamily: 'inherit', transition: 'all 0.15s',
}

function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = DS.primary
  e.target.style.boxShadow   = `0 0 0 3px ${DS.primaryGlow}`
  e.target.style.background  = '#fff'
}
function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = DS.outlineBorder
  e.target.style.boxShadow   = 'none'
  e.target.style.background  = DS.inputBg
}

// ── Style Form Modal ──────────────────────────────────────────────────────────

function StyleFormModal({ mode, initial, businessId, onSave, onClose }: {
  mode: 'create' | 'edit'; initial?: WritingStyleRow
  businessId: string; onSave: (s: WritingStyleRow) => void; onClose: () => void
}) {
  const [form,   setForm]   = useState<StyleForm>(initial ? toForm(initial) : EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const set = (k: keyof StyleForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    const payload = parsePayload(form)
    if (mode === 'create') {
      const res = await createWritingStyle({ ...payload, business_id: businessId })
      if (res.success && res.style) { onSave(res.style) }
      else { setError(res.error ?? 'Failed to save'); setSaving(false) }
    } else {
      const res = await updateWritingStyle(initial!.id, payload)
      if (res.success) { onSave({ ...initial!, ...payload }) }
      else { setError(res.error ?? 'Failed to save'); setSaving(false) }
    }
  }

  const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: DS.muted, letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: 4 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,80,65,0.4)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 16 }} onClick={onClose}>
      <div style={{ background: DS.cardBg, borderRadius: 14, padding: 24, width: '100%', maxWidth: 500, boxShadow: '0 20px 48px rgba(0,0,0,0.12)', border: `1px solid ${DS.cardBorder}`, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: DS.bodyText, letterSpacing: '-0.3px' }}>
            {mode === 'create' ? 'New Writing Style' : 'Edit Style'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: DS.muted, padding: 4, display: 'flex' }}><X size={16} /></button>
        </div>

        {([
          { key: 'name',        label: 'Style Name *',                    placeholder: 'e.g. Friendly Outreach'        },
          { key: 'tone',        label: 'Tone',                            placeholder: 'e.g. Warm and direct'          },
          { key: 'greeting',    label: 'Greeting',                        placeholder: 'e.g. Hi [name],'               },
          { key: 'sign_off',    label: 'Sign-off',                        placeholder: 'e.g. Best,'                    },
          { key: 'key_phrases', label: 'Key Phrases (comma-separated)',   placeholder: 'e.g. "quick question", "happy to help"' },
        ] as const).map(({ key, label, placeholder }) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <label style={lbl}>{label}</label>
            <input type="text" value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder} style={inputBase} onFocus={onFocus} onBlur={onBlur} />
          </div>
        ))}

        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Sample / Summary</label>
          <textarea value={form.sample_text} onChange={e => set('sample_text', e.target.value)} placeholder="1-2 sentence description or example sentence…" rows={3} style={{ ...inputBase, resize: 'vertical', lineHeight: 1.6 }} onFocus={onFocus} onBlur={onBlur} />
        </div>

        {error && <p style={{ fontSize: 12, color: DS.danger, marginBottom: 12, fontWeight: 500 }}>⚠ {error}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 6, border: `1.5px solid ${DS.outlineBorder}`, background: 'transparent', color: DS.outlineText, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()} style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: form.name.trim() && !saving ? DS.primary : '#E4E4E7', color: 'white', fontSize: 12, fontWeight: 600, cursor: form.name.trim() && !saving ? 'pointer' : 'not-allowed', fontFamily: 'inherit', minHeight: 36, display: 'flex', alignItems: 'center', gap: 6, boxShadow: form.name.trim() && !saving ? `0 2px 8px ${DS.primaryGlow}` : 'none', transition: 'all 0.15s' }}>
            {saving && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />}
            {saving ? 'Saving…' : mode === 'create' ? '+ Create Style' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────

function DeleteModal({ name, onConfirm, onClose, deleting }: {
  name: string; onConfirm: () => void; onClose: () => void; deleting: boolean
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,80,65,0.4)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 16 }} onClick={onClose}>
      <div style={{ background: DS.cardBg, borderRadius: 14, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 20px 48px rgba(0,0,0,0.12)', border: `1px solid ${DS.cardBorder}` }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: DS.bodyText, marginBottom: 8 }}>Delete Style</h2>
        <p style={{ fontSize: 13, color: DS.secondary, marginBottom: 20, lineHeight: 1.6 }}>Delete <strong style={{ color: DS.bodyText }}>{name}</strong>? This cannot be undone.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 6, border: `1.5px solid ${DS.outlineBorder}`, background: 'transparent', color: DS.outlineText, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={onConfirm} disabled={deleting} style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: deleting ? '#E4E4E7' : DS.danger, color: 'white', fontSize: 12, fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, minHeight: 36 }}>
            {deleting && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Style Card ────────────────────────────────────────────────────────────────

function StyleCard({ style, onEdit, onDelete, onActivate, activating }: {
  style: WritingStyleRow; onEdit: () => void; onDelete: () => void
  onActivate: () => void; activating: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ background: DS.cardBg, border: `1.5px solid ${style.is_active ? DS.primary : hovered ? DS.outlineBorder : DS.cardBorder}`, borderRadius: 10, overflow: 'hidden', boxShadow: style.is_active ? `0 2px 10px ${DS.primaryGlow}` : hovered ? '0 2px 8px rgba(0,0,0,0.06)' : '0 1px 3px rgba(0,0,0,0.04)', transition: 'border-color 0.15s, box-shadow 0.15s' }}>
      <div style={{ height: 3, background: style.is_active ? DS.primary : DS.accentMid }} />
      <div style={{ padding: '14px 15px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: DS.bodyText, letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{style.name}</p>
            {style.tone && <p style={{ fontSize: 11.5, color: DS.secondary, marginTop: 2 }}>{style.tone}</p>}
          </div>
          {style.is_active && (
            <span style={{ fontSize: 9.5, fontWeight: 700, color: DS.primary, background: DS.accentLight, padding: '2px 8px', borderRadius: 20, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Check size={9} /> Active
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {style.greeting && <span style={{ fontSize: 10.5, color: DS.outlineText, background: DS.accentMid, border: `1px solid ${DS.cardBorder}`, padding: '2px 8px', borderRadius: 20 }}>{style.greeting}</span>}
          {style.sign_off && <span style={{ fontSize: 10.5, color: DS.outlineText, background: DS.accentMid, border: `1px solid ${DS.cardBorder}`, padding: '2px 8px', borderRadius: 20 }}>{style.sign_off}</span>}
        </div>

        {style.key_phrases?.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
            {style.key_phrases.slice(0, 4).map((p, i) => (
              <span key={i} style={{ fontSize: 10, color: DS.primary, background: DS.accentLight, padding: '1px 7px', borderRadius: 20 }}>"{p}"</span>
            ))}
            {style.key_phrases.length > 4 && <span style={{ fontSize: 10, color: DS.muted }}>+{style.key_phrases.length - 4} more</span>}
          </div>
        )}

        {style.sample_text && (
          <p style={{ fontSize: 11.5, color: DS.secondary, lineHeight: 1.6, marginBottom: 10, fontStyle: 'italic' }}>{style.sample_text}</p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 8, borderTop: `1px solid ${DS.cardBorder}` }}>
          {!style.is_active ? (
            <button onClick={onActivate} disabled={activating} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 10px', borderRadius: 6, border: `1.5px solid ${DS.primary}`, background: 'transparent', color: DS.primary, fontSize: 11.5, fontWeight: 600, cursor: activating ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
              {activating ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={10} />}
              {activating ? 'Setting…' : 'Set Active'}
            </button>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', color: DS.primary, fontSize: 11.5, fontWeight: 600 }}>
              <Check size={10} /> In use for all AI drafts
            </div>
          )}
          <button onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 6, border: `1px solid ${DS.cardBorder}`, background: DS.inputBg, color: DS.secondary, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Pencil size={10} /> Edit
          </button>
          <button onClick={onDelete} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 6, border: `1px solid ${DS.dangerBorder}`, background: DS.dangerBg, color: DS.danger, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Trash2 size={10} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Analyze Section ───────────────────────────────────────────────────────────

type AnalyzedStyle = { tone: string; greeting: string; sign_off: string; key_phrases: string[]; sample_text: string }

function AnalyzeSection({ businessId, onStyleCreated }: { businessId: string; onStyleCreated: (s: WritingStyleRow) => void }) {
  const [open,      setOpen]      = useState(false)
  const [emails,    setEmails]    = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result,    setResult]    = useState<AnalyzedStyle | null>(null)
  const [name,      setName]      = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const analyze = async () => {
    if (!emails.trim() || analyzing) return
    setAnalyzing(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/style/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emails, businessId }) })
      const data = await res.json()
      if (data.tone) { setResult(data); setName('') }
      else { setError(data.error ?? 'Analysis failed') }
    } catch { setError('Something went wrong. Try again.') }
    finally { setAnalyzing(false) }
  }

  const saveAsStyle = async () => {
    if (!result || !name.trim() || saving) return
    setSaving(true); setError('')
    const res = await createWritingStyle({ business_id: businessId, name: name.trim(), tone: result.tone, greeting: result.greeting, sign_off: result.sign_off, key_phrases: result.key_phrases, sample_text: result.sample_text })
    if (res.success && res.style) { onStyleCreated(res.style); setEmails(''); setResult(null); setName(''); setOpen(false) }
    else { setError(res.error ?? 'Failed to save') }
    setSaving(false)
  }

  return (
    <div style={{ background: DS.cardBg, border: `1px solid ${DS.cardBorder}`, borderRadius: 12, overflow: 'hidden', marginTop: 24 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: DS.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={14} color={DS.primary} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: DS.bodyText }}>Analyze My Writing</p>
            <p style={{ fontSize: 11.5, color: DS.secondary, marginTop: 1 }}>Paste 2–3 emails to extract a new style automatically</p>
          </div>
        </div>
        {open ? <ChevronUp size={15} color={DS.muted} /> : <ChevronDown size={15} color={DS.muted} />}
      </button>

      {open && (
        <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${DS.cardBorder}` }}>
          <div style={{ paddingTop: 16 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: DS.muted, letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Paste 2–3 emails you have written
            </label>
            <textarea value={emails} onChange={e => setEmails(e.target.value)} disabled={analyzing} rows={8} placeholder={`Paste emails here, separated by ---\n\nExample:\nHi Mike,\nJust wanted to circle back on...\n\n---\n\nHey Sarah,\nI noticed you recently...`} style={{ ...inputBase, resize: 'vertical', lineHeight: 1.6, marginBottom: 12 }} onFocus={onFocus} onBlur={onBlur} />

            {error && <p style={{ fontSize: 12, color: DS.danger, fontWeight: 500, marginBottom: 12 }}>⚠ {error}</p>}

            {!result && (
              <button onClick={analyze} disabled={!emails.trim() || analyzing} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 8, border: 'none', background: emails.trim() && !analyzing ? DS.primary : '#E4E4E7', color: 'white', fontSize: 13, fontWeight: 600, cursor: emails.trim() && !analyzing ? 'pointer' : 'not-allowed', fontFamily: 'inherit', minHeight: 40, boxShadow: emails.trim() && !analyzing ? `0 2px 8px ${DS.primaryGlow}` : 'none', transition: 'all 0.15s' }}>
                {analyzing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={13} />}
                {analyzing ? 'Analyzing…' : 'Analyze Style'}
              </button>
            )}

            {result && (
              <div style={{ background: DS.accentMid, border: `1px solid ${DS.outlineBorder}`, borderRadius: 10, padding: 16, marginTop: 4 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: DS.muted, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 10 }}>Extracted Style</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  {[{ label: 'Tone', value: result.tone }, { label: 'Greeting', value: result.greeting }, { label: 'Sign-off', value: result.sign_off }].map(({ label, value }) => value ? (
                    <div key={label}>
                      <p style={{ fontSize: 9.5, fontWeight: 700, color: DS.muted, letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 2 }}>{label}</p>
                      <p style={{ fontSize: 12.5, color: DS.bodyText, fontWeight: 500 }}>{value}</p>
                    </div>
                  ) : null)}
                </div>
                {result.key_phrases?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 9.5, fontWeight: 700, color: DS.muted, letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 5 }}>Key Phrases</p>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {result.key_phrases.map((p, i) => <span key={i} style={{ fontSize: 11, color: DS.primary, background: DS.accentLight, padding: '1px 8px', borderRadius: 20 }}>"{p}"</span>)}
                    </div>
                  </div>
                )}
                {result.sample_text && <p style={{ fontSize: 12, color: DS.secondary, lineHeight: 1.6, marginBottom: 14, fontStyle: 'italic' }}>{result.sample_text}</p>}

                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: DS.muted, letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Style Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My Natural Tone" style={inputBase} onFocus={onFocus} onBlur={onBlur} />
                  </div>
                  <button onClick={saveAsStyle} disabled={!name.trim() || saving} style={{ padding: '9px 16px', borderRadius: 7, border: 'none', background: name.trim() && !saving ? DS.primary : '#E4E4E7', color: 'white', fontSize: 12.5, fontWeight: 600, cursor: name.trim() && !saving ? 'pointer' : 'not-allowed', fontFamily: 'inherit', minHeight: 38, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, boxShadow: name.trim() && !saving ? `0 2px 8px ${DS.primaryGlow}` : 'none' }}>
                    {saving && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />}
                    {saving ? 'Saving…' : 'Save Style'}
                  </button>
                  <button onClick={() => { setResult(null); setEmails('') }} style={{ padding: '9px 12px', borderRadius: 7, border: `1.5px solid ${DS.outlineBorder}`, background: 'transparent', color: DS.outlineText, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', minHeight: 38 }}>Discard</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Writing Styles Panel ──────────────────────────────────────────────────────
// Headless panel — no page header, no scroll wrapper. Used in settings tab and
// wrapped by StyleManager for the standalone /settings/style page.

export function WritingStylesPanel({ business, initialStyles }: { business: Business; initialStyles: WritingStyleRow[] }) {
  const [styles,       setStyles]       = useState<WritingStyleRow[]>(initialStyles)
  const [formOpen,     setFormOpen]     = useState(false)
  const [formMode,     setFormMode]     = useState<'create' | 'edit'>('create')
  const [editTarget,   setEditTarget]   = useState<WritingStyleRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WritingStyleRow | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [activatingId, setActivatingId] = useState<string | null>(null)

  const openCreate = () => { setFormMode('create'); setEditTarget(null); setFormOpen(true) }
  const openEdit   = (s: WritingStyleRow) => { setFormMode('edit'); setEditTarget(s); setFormOpen(true) }

  const handleSaved = (saved: WritingStyleRow) => {
    setStyles(prev => {
      const idx = prev.findIndex(s => s.id === saved.id)
      return idx >= 0 ? prev.map(s => s.id === saved.id ? saved : s) : [...prev, saved]
    })
    setFormOpen(false)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await deleteWritingStyle(deleteTarget.id)
    if (res.success) { setStyles(prev => prev.filter(s => s.id !== deleteTarget.id)); setDeleteTarget(null) }
    setDeleting(false)
  }

  const handleActivate = async (id: string) => {
    if (activatingId) return
    setActivatingId(id)
    const res = await setActiveStyle(id, business.id)
    if (res.success) setStyles(prev => prev.map(s => ({ ...s, is_active: s.id === id })))
    setActivatingId(null)
  }

  const active = styles.find(s => s.is_active)

  return (
    <>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: DS.secondary }}>{styles.length} {styles.length === 1 ? 'style' : 'styles'}</span>
          {active && (
            <span style={{ fontSize: 11, color: DS.primary, background: DS.accentLight, padding: '2px 8px', borderRadius: 20, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Check size={9} /> {active.name} active
            </span>
          )}
        </div>
        {styles.length < 20 && (
          <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: 'none', background: DS.primary, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 2px 8px ${DS.primaryGlow}` }}>
            <Plus size={12} /> Add New Style
          </button>
        )}
      </div>

      {/* Empty state */}
      {styles.length === 0 && (
        <div style={{ border: `2px dashed ${DS.outlineBorder}`, borderRadius: 12, padding: '32px 24px', textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: DS.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
            <Sparkles size={18} color={DS.primary} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: DS.bodyText, marginBottom: 5 }}>No writing styles yet</p>
          <p style={{ fontSize: 12.5, color: DS.secondary, marginBottom: 16 }}>Create one manually or analyze your emails below.</p>
          <button onClick={openCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7, border: 'none', background: DS.primary, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 2px 8px ${DS.primaryGlow}` }}>
            <Plus size={12} /> Create First Style
          </button>
        </div>
      )}

      {/* Card grid */}
      {styles.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 4 }}>
          {styles.map(s => (
            <StyleCard key={s.id} style={s} onEdit={() => openEdit(s)} onDelete={() => setDeleteTarget(s)} onActivate={() => handleActivate(s.id)} activating={activatingId === s.id} />
          ))}
        </div>
      )}

      {styles.length >= 20 && <p style={{ fontSize: 12, color: DS.muted, marginTop: 10 }}>Maximum of 20 styles reached.</p>}

      <AnalyzeSection businessId={business.id} onStyleCreated={s => setStyles(prev => [...prev, s])} />

      {formOpen && <StyleFormModal mode={formMode} initial={editTarget ?? undefined} businessId={business.id} onSave={handleSaved} onClose={() => setFormOpen(false)} />}
      {deleteTarget && <DeleteModal name={deleteTarget.name} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} deleting={deleting} />}
    </>
  )
}

// ── Style Manager (standalone page) ──────────────────────────────────────────

export function StyleManager({ business, initialStyles }: { business: Business; initialStyles: WritingStyleRow[] }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: `${DS.muted} transparent` }}>
      <div style={{ padding: '20px 28px 16px', flexShrink: 0, borderBottom: `1px solid ${DS.cardBorder}`, background: DS.cardBg, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: DS.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={17} color={DS.primary} />
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: DS.muted, letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 2 }}>{business.name}</p>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: DS.bodyText, letterSpacing: '-0.4px', lineHeight: 1 }}>Writing Styles</h1>
        </div>
      </div>
      <div style={{ padding: '24px 28px 40px', maxWidth: 900 }}>
        <WritingStylesPanel business={business} initialStyles={initialStyles} />
      </div>
    </div>
  )
}
