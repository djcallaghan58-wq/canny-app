'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronLeft, ChevronRight, Bot, X, Bell, Mail, Loader2 } from 'lucide-react'
import type { Business, Lead, LeadStage, Prospect } from '@/lib/supabase'
import { updateLeadStage, createLead } from '@/app/actions/leads'
import { getProspectById } from '@/app/actions/prospects'
import { FollowupsTab } from '@/app/components/followups-tab'

// ── Design tokens ─────────────────────────────────────────────────────────────
const DS = {
  pageBg:       '#F7F9F8',
  cardBg:       '#FFFFFF',
  cardBorder:   '#E0EBE5',
  cardHover:    '#1D9E75',
  bodyText:     '#085041',
  secondary:    '#6B8C7E',
  muted:        '#9FD4C0',
  primary:      '#1D9E75',
  primaryGlow:  'rgba(29,158,117,0.15)',
  accentLight:  '#E1F5EE',
  accentMid:    '#F0F7F4',
  outlineBorder:'#C2D6CC',
  outlineText:  '#4A7A6A',
  inputBg:      '#F7F9F8',
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGES: LeadStage[] = [
  'New Lead', 'Quoted', 'Following Up', 'Booked', 'Scheduled', 'Complete',
]

const STAGE_COLORS: Record<string, string> = {
  'New Lead':     '#1D9E75',
  'Quoted':       '#0891B2',
  'Following Up': '#F59E0B',
  'Booked':       '#059669',
  'Scheduled':    '#7C3AED',
  'Complete':     '#9FD4C0',
}

const URGENCY_STYLE: Record<string, { color: string; bg: string }> = {
  Low:       { color: '#6B8C7E', bg: '#F0F7F4' },
  Medium:    { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  High:      { color: '#DC2626', bg: 'rgba(220,38,38,0.10)' },
  Emergency: { color: '#DC2626', bg: 'rgba(220,38,38,0.16)' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

function isStale(lead: Lead): boolean {
  if (lead.stage === 'Complete') return false
  const ref = lead.last_contacted_at ?? lead.created_at
  return daysSince(ref) >= 3
}

// ── Email modal (for prospect-linked leads) ───────────────────────────────────

function PipelineEmailModal({ subject, body, email, onClose }: {
  subject: string; body: string; email: string; onClose: () => void
}) {
  const open = () => {
    const to  = encodeURIComponent(email)
    const su  = encodeURIComponent(subject)
    const bd  = encodeURIComponent(body)
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${su}&body=${bd}`, '_blank')
    onClose()
  }
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(8,80,65,0.4)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: DS.cardBg, borderRadius: 14, padding: 24, width: '100%', maxWidth: 520, boxShadow: '0 20px 48px rgba(0,0,0,0.12)', border: `1px solid ${DS.cardBorder}`, maxHeight: '85vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Mail size={15} color={DS.secondary} />
            <span style={{ fontSize: 15, fontWeight: 700, color: DS.bodyText }}>Draft Outreach Email</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: DS.muted, padding: 4 }}><X size={15} /></button>
        </div>
        {email && (
          <div style={{ background: DS.accentLight, borderRadius: 8, padding: '8px 13px', marginBottom: 10 }}>
            <p style={{ fontSize: 9.5, fontWeight: 700, color: DS.muted, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 2 }}>To</p>
            <p style={{ fontSize: 12.5, color: DS.primary, fontWeight: 500 }}>{email}</p>
          </div>
        )}
        <div style={{ background: DS.accentMid, borderRadius: 8, padding: '10px 13px', marginBottom: 10 }}>
          <p style={{ fontSize: 9.5, fontWeight: 700, color: DS.muted, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 3 }}>Subject</p>
          <p style={{ fontSize: 13, color: DS.bodyText, fontWeight: 500 }}>{subject}</p>
        </div>
        <div style={{ background: DS.accentMid, borderRadius: 8, padding: '10px 13px', marginBottom: 18 }}>
          <p style={{ fontSize: 9.5, fontWeight: 700, color: DS.muted, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 7 }}>Body</p>
          <p style={{ fontSize: 12.5, color: DS.bodyText, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{body}</p>
        </div>
        <button
          onClick={open}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, width: '100%',
            padding: '9px 16px', borderRadius: 8, background: DS.primary,
            border: 'none', color: 'white', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', justifyContent: 'center', fontFamily: 'inherit',
            boxShadow: '0 2px 8px rgba(29,158,117,0.25)', minHeight: 40,
          }}
        >
          <Mail size={13} /> Open in Gmail
        </button>
      </div>
    </div>
  )
}

// ── Lead card (kanban) ────────────────────────────────────────────────────────

function LeadCard({
  lead, onMove, onCoach, onDraftEmail, draftLoading,
}: {
  lead: Lead
  onMove: (id: string, dir: 'back' | 'forward') => void
  onCoach: (lead: Lead) => void
  onDraftEmail?: (lead: Lead) => void
  draftLoading?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const stale    = isStale(lead)
  const stageIdx = STAGES.indexOf(lead.stage)
  const urgency  = URGENCY_STYLE[lead.urgency] ?? URGENCY_STYLE.Medium
  const stageColor = STAGE_COLORS[lead.stage] ?? DS.primary

  const arrBtn: React.CSSProperties = {
    width: 24, height: 24, borderRadius: 5,
    border: `1px solid ${DS.cardBorder}`,
    background: DS.inputBg, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.15s',
    color: DS.secondary, flexShrink: 0,
  }

  return (
    <div
      style={{
        background:   DS.cardBg,
        border:       `1px solid ${stale ? 'rgba(220,38,38,0.25)' : hovered ? DS.cardHover : DS.cardBorder}`,
        borderRadius: 10,
        overflow:     'hidden',
        boxShadow:    hovered
          ? '0 3px 10px rgba(29,158,117,0.10)'
          : stale
          ? '0 1px 4px rgba(220,38,38,0.06)'
          : '0 1px 3px rgba(0,0,0,0.05)',
        transition:   'border-color 0.15s, box-shadow 0.15s',
        marginBottom: 8,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Stage accent bar */}
      <div style={{
        height:     3,
        background: stale ? '#DC2626' : stageColor,
        opacity:    stale ? 1 : 0.7,
      }} />

      <div style={{ padding: '11px 13px' }}>
        {/* Name + value */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, gap: 6 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: DS.bodyText, letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lead.customer_name}
            </div>
            {stale && (
              <span style={{ fontSize: 9.5, fontWeight: 600, color: '#DC2626', background: 'rgba(220,38,38,0.08)', padding: '1px 6px', borderRadius: 4, display: 'inline-block', marginTop: 2 }}>
                No contact 3d+
              </span>
            )}
          </div>
          {lead.value > 0 && (
            <span style={{ fontSize: 12.5, fontWeight: 700, color: DS.primary, flexShrink: 0 }}>
              ${Number(lead.value).toLocaleString()}
            </span>
          )}
        </div>

        {/* Service type + urgency */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
          {lead.service_type && (
            <span style={{ fontSize: 11, color: DS.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
              {lead.service_type}
            </span>
          )}
          {lead.service_type && <span style={{ fontSize: 10, color: DS.muted }}>·</span>}
          <span style={{ fontSize: 10, fontWeight: 600, color: urgency.color, background: urgency.bg, padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>
            {lead.urgency}
          </span>
        </div>

        {/* Footer: age + controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 5 }}>
          <span style={{ fontSize: 10.5, color: DS.muted, fontWeight: 500, flexShrink: 0 }}>
            {daysSince(lead.created_at)}d ago
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => onMove(lead.id, 'back')}
              disabled={stageIdx === 0}
              aria-label="Move back"
              style={{ ...arrBtn, color: stageIdx === 0 ? DS.muted : DS.secondary, cursor: stageIdx === 0 ? 'not-allowed' : 'pointer' }}
            >
              <ChevronLeft size={12} />
            </button>
            <button
              onClick={() => onMove(lead.id, 'forward')}
              disabled={stageIdx === STAGES.length - 1}
              aria-label="Move forward"
              style={{ ...arrBtn, color: stageIdx === STAGES.length - 1 ? DS.muted : DS.secondary, cursor: stageIdx === STAGES.length - 1 ? 'not-allowed' : 'pointer' }}
            >
              <ChevronRight size={12} />
            </button>
            {lead.prospect_id && (
              <button
                onClick={() => onDraftEmail?.(lead)}
                disabled={draftLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  padding: '3px 9px', borderRadius: 5, minHeight: 24,
                  border: `1px solid ${DS.cardBorder}`,
                  background: DS.inputBg, color: DS.secondary,
                  fontSize: 10.5, fontWeight: 600,
                  cursor: draftLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s', flexShrink: 0,
                }}
              >
                {draftLoading
                  ? <Loader2 size={9} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Mail size={9} />
                }
                Draft Email
              </button>
            )}
            <button
              onClick={() => onCoach(lead)}
              style={{
                display: 'flex', alignItems: 'center', gap: 3,
                padding: '3px 9px', borderRadius: 5, minHeight: 24,
                border: `1px solid ${DS.cardBorder}`,
                background: DS.inputBg, color: DS.secondary,
                fontSize: 10.5, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s', flexShrink: 0,
              }}
            >
              <Bot size={10} /> Coach
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Add lead modal ────────────────────────────────────────────────────────────

const FIELDS = [
  { key: 'customer_name',  label: 'Customer Name *',       placeholder: 'e.g. John Smith',           type: 'text'   },
  { key: 'customer_phone', label: 'Phone',                  placeholder: 'e.g. (602) 555-0123',       type: 'tel'    },
  { key: 'customer_email', label: 'Email',                  placeholder: 'e.g. john@email.com',       type: 'email'  },
  { key: 'service_type',   label: 'Service Type',           placeholder: 'e.g. AC Install, Roof Fix', type: 'text'   },
  { key: 'value',          label: 'Estimated Value ($)',     placeholder: 'e.g. 1200',                 type: 'number' },
] as const

type FormKey    = typeof FIELDS[number]['key'] | 'urgency' | 'notes'
type NewLeadForm = Record<FormKey, string>

function AddLeadModal({
  business, onClose, onAdd,
}: {
  business: Business
  onClose: () => void
  onAdd: (lead: Lead) => void
}) {
  const [form, setForm] = useState<NewLeadForm>({
    customer_name: '', customer_phone: '', customer_email: '',
    service_type: '', value: '', urgency: 'Medium', notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px',
    background: DS.inputBg, border: `1.5px solid ${DS.outlineBorder}`,
    borderRadius: 7, fontSize: 13, color: DS.bodyText,
    outline: 'none', fontFamily: 'inherit', transition: 'all 0.15s',
  }

  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.target.style.borderColor = DS.primary
    e.target.style.boxShadow   = `0 0 0 3px ${DS.primaryGlow}`
    e.target.style.background  = '#fff'
  }
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.target.style.borderColor = DS.outlineBorder
    e.target.style.boxShadow   = 'none'
    e.target.style.background  = DS.inputBg
  }

  const handleSubmit = async () => {
    if (!form.customer_name.trim()) { setError('Customer name is required'); return }
    setLoading(true); setError('')

    const result = await createLead({
      business_id:    business.id,
      customer_name:  form.customer_name,
      customer_phone: form.customer_phone,
      customer_email: form.customer_email,
      service_type:   form.service_type,
      urgency:        form.urgency,
      value:          parseFloat(form.value) || 0,
      notes:          form.notes,
    })

    if (!result.success || !result.lead) {
      setError(result.error ?? 'Failed to add lead')
      setLoading(false)
      return
    }
    onAdd(result.lead)
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(8,80,65,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: DS.cardBg, borderRadius: 14, padding: '24px', width: '100%', maxWidth: 440, boxShadow: '0 20px 48px rgba(0,0,0,0.12)', border: `1px solid ${DS.cardBorder}`, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: DS.bodyText, letterSpacing: '-0.3px' }}>Add New Lead</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: DS.muted, padding: 4, display: 'flex' }}>
            <X size={17} />
          </button>
        </div>

        {FIELDS.map(({ key, label, placeholder, type }) => (
          <div key={key} style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: DS.muted, letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
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

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: DS.muted, letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
            Urgency
          </label>
          <select
            value={form.urgency}
            onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))}
            onFocus={onFocus} onBlur={onBlur}
            style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' as const }}
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
            <option>Emergency</option>
          </select>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: DS.muted, letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
            Notes
          </label>
          <textarea
            placeholder="Any relevant details..."
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            onFocus={onFocus} onBlur={onBlur}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {error && <p style={{ fontSize: 12, color: '#DC2626', marginBottom: 12, fontWeight: 500 }}>⚠ {error}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 6, border: `1.5px solid ${DS.outlineBorder}`, background: 'transparent', color: DS.outlineText, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !form.customer_name.trim()}
            style={{
              padding: '8px 18px', borderRadius: 6, border: 'none',
              background: form.customer_name.trim() && !loading ? DS.primary : '#E4E4E7',
              color: 'white', fontSize: 12, fontWeight: 600,
              cursor: form.customer_name.trim() && !loading ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              boxShadow: form.customer_name.trim() && !loading ? `0 2px 8px ${DS.primaryGlow}` : 'none',
              transition: 'all 0.15s', minHeight: 38,
            }}
          >
            {loading ? 'Adding…' : '+ Add Lead'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Pipeline view ─────────────────────────────────────────────────────────────

export function PipelineView({
  business,
  initialLeads,
}: {
  business: Business
  initialLeads: Lead[]
}) {
  const router = useRouter()
  const [leads,          setLeads]          = useState<Lead[]>(initialLeads)
  const [showAdd,        setShowAdd]        = useState(false)
  const [draftEmailData, setDraftEmailData] = useState<{ subject: string; body: string; email: string } | null>(null)
  const [draftLoadingId, setDraftLoadingId] = useState<string | null>(null)

  const handleDraftEmail = async (lead: Lead) => {
    if (!lead.prospect_id || draftLoadingId) return
    setDraftLoadingId(lead.id)
    try {
      const prospect = await getProspectById(lead.prospect_id)
      if (!prospect) return
      const res = await fetch('/api/prospect/draft-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect, business }),
      })
      const data = await res.json()
      if (data.subject) {
        setDraftEmailData({
          subject: data.subject,
          body:    data.body,
          email:   prospect.email || prospect.email_format || '',
        })
      }
    } finally {
      setDraftLoadingId(null)
    }
  }

  const handleMove = async (leadId: string, dir: 'back' | 'forward') => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return
    const idx    = STAGES.indexOf(lead.stage)
    const newIdx = dir === 'forward' ? idx + 1 : idx - 1
    if (newIdx < 0 || newIdx >= STAGES.length) return
    const newStage = STAGES[newIdx]

    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage } : l))
    const result = await updateLeadStage(leadId, newStage)
    if (!result.success) {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: lead.stage } : l))
    }
  }

  const handleCoach = (lead: Lead) => {
    const prompt = [
      `Coach me on this job:`,
      `Customer: ${lead.customer_name}`,
      `Service: ${lead.service_type || 'General service'}`,
      `Stage: ${lead.stage}`,
      `Value: $${Number(lead.value).toLocaleString()}`,
      `Days in pipeline: ${daysSince(lead.created_at)}`,
      `Urgency: ${lead.urgency}`,
      lead.notes ? `Notes: ${lead.notes}` : null,
      ``,
      `What's my best next move to close this job?`,
    ].filter(Boolean).join('\n')

    router.push(`/dashboard/agent?prompt=${encodeURIComponent(prompt)}`)
  }

  const [activeTab, setActiveTab] = useState<'pipeline' | 'followups'>('pipeline')

  const activeLeads = leads.filter(l => l.stage !== 'Complete')
  const staleCount  = leads.filter(isStale).length
  const totalValue  = activeLeads.reduce((s, l) => s + Number(l.value), 0)

  // Overdue count from leads (computed locally; prospects loaded lazily in FollowupsTab)
  const sched       = business.follow_up_schedule ?? { first: 3, second: 7, third: 14 }
  const overdueCount = leads.filter(l => {
    if (l.stage === 'Complete') return false
    const elapsed = Date.now() - new Date(l.last_contacted_at ?? l.created_at).getTime()
    return elapsed >= sched.first * 24 * 60 * 60 * 1000
  }).length

  return (
    <>
      {/* Page header */}
      <div style={{
        padding: '16px 24px 0', flexShrink: 0,
        borderBottom: `1px solid ${DS.cardBorder}`, background: DS.cardBg,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 10.5, fontWeight: 600, color: DS.muted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 2 }}>
              {business.name}
            </p>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: DS.bodyText, letterSpacing: '-0.4px', marginBottom: 2 }}>
              Pipeline
            </h1>
            <p style={{ fontSize: 12.5, color: DS.secondary }}>
              {leads.length} leads · ${totalValue.toLocaleString()} active
              {staleCount > 0 && (
                <span style={{ color: '#DC2626', fontWeight: 600 }}> · {staleCount} need follow-up</span>
              )}
            </p>
          </div>
          {activeTab === 'pipeline' && (
            <button
              onClick={() => setShowAdd(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 6,
                background: DS.primary, border: 'none', color: 'white',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: `0 2px 10px ${DS.primaryGlow}`, minHeight: 36,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.9' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
            >
              <Plus size={13} /> Add Lead
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2 }}>
          {(['pipeline', 'followups'] as const).map(tab => {
            const active = activeTab === tab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: '7px 7px 0 0',
                  border: 'none', background: active ? DS.pageBg : 'transparent',
                  color: active ? DS.primary : DS.secondary,
                  fontSize: 12.5, fontWeight: active ? 700 : 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  borderBottom: active ? `2px solid ${DS.primary}` : '2px solid transparent',
                  transition: 'all 0.15s', marginBottom: -1,
                }}
              >
                {tab === 'pipeline' ? 'Pipeline' : (
                  <>
                    <Bell size={11} />
                    Follow-ups
                    {overdueCount > 0 && (
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.14)', padding: '1px 6px', borderRadius: 20 }}>
                        {overdueCount}
                      </span>
                    )}
                  </>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {activeTab === 'followups' && <FollowupsTab business={business} />}

      {/* Kanban board — horizontal scroll */}
      {activeTab === 'pipeline' && <div style={{
        flex: 1, overflowX: 'auto', overflowY: 'hidden',
        display: 'flex', gap: 10,
        padding: '14px 20px 20px',
        scrollbarWidth: 'thin', scrollbarColor: `${DS.muted} transparent`,
        background: DS.pageBg,
      }}>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        {STAGES.map(stage => {
          const stageLeads = leads.filter(l => l.stage === stage)
          const stageColor = STAGE_COLORS[stage] ?? DS.primary
          return (
            <div
              key={stage}
              style={{
                minWidth:      240,
                maxWidth:      240,
                flexShrink:    0,
                display:       'flex',
                flexDirection: 'column',
                height:        '100%',
              }}
            >
              {/* Column header */}
              <div style={{
                background:   DS.cardBg,
                border:       `1px solid ${DS.cardBorder}`,
                borderRadius: '8px 8px 0 0',
                borderBottom: 'none',
                overflow:     'hidden',
              }}>
                <div style={{ height: 3, background: stageColor }} />
                <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: DS.bodyText, letterSpacing: '-0.1px' }}>
                    {stage}
                  </span>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700,
                    color: stageColor,
                    background: `${stageColor}18`,
                    padding: '1px 7px', borderRadius: 20,
                  }}>
                    {stageLeads.length}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div style={{
                flex:         1,
                overflowY:    'auto',
                padding:      '8px 10px 10px',
                background:   DS.pageBg,
                border:       `1px solid ${DS.cardBorder}`,
                borderTop:    'none',
                borderRadius: '0 0 8px 8px',
                scrollbarWidth: 'thin',
                scrollbarColor: `${DS.muted} transparent`,
              }}>
                {stageLeads.length > 0 ? (
                  stageLeads.map(lead => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onMove={handleMove}
                      onCoach={handleCoach}
                      onDraftEmail={handleDraftEmail}
                      draftLoading={draftLoadingId === lead.id}
                    />
                  ))
                ) : (
                  <div style={{
                    border: `1.5px dashed ${DS.cardBorder}`,
                    borderRadius: 8, padding: '12px',
                    textAlign: 'center',
                  }}>
                    <span style={{ fontSize: 11.5, color: DS.muted }}>No leads</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>}

      {showAdd && (
        <AddLeadModal
          business={business}
          onClose={() => setShowAdd(false)}
          onAdd={lead => setLeads(prev => [lead, ...prev])}
        />
      )}

      {draftEmailData && (
        <PipelineEmailModal
          subject={draftEmailData.subject}
          body={draftEmailData.body}
          email={draftEmailData.email}
          onClose={() => setDraftEmailData(null)}
        />
      )}
    </>
  )
}
