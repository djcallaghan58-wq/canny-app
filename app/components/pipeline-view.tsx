'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronLeft, ChevronRight, Bot, X } from 'lucide-react'
import { getAccent, getGlow } from '@/lib/supabase'
import type { Business, Lead, LeadStage } from '@/lib/supabase'
import { updateLeadStage, createLead } from '@/app/actions/leads'

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES: LeadStage[] = [
  'New Lead', 'Quoted', 'Following Up', 'Booked', 'Scheduled', 'Complete',
]

const URGENCY_STYLE: Record<string, { color: string; bg: string }> = {
  Low:       { color: '#71717A', bg: '#F4F4F5' },
  Medium:    { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  High:      { color: '#DC2626', bg: 'rgba(220,38,38,0.10)' },
  Emergency: { color: '#DC2626', bg: 'rgba(220,38,38,0.16)' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

function isStale(lead: Lead): boolean {
  if (lead.stage === 'Complete') return false
  const ref = lead.last_contacted_at ?? lead.created_at
  return daysSince(ref) >= 3
}

// ─── Lead card ────────────────────────────────────────────────────────────────

function LeadCard({
  lead, accent, glow, onMove, onCoach,
}: {
  lead: Lead
  accent: string
  glow: string
  onMove: (id: string, dir: 'back' | 'forward') => void
  onCoach: (lead: Lead) => void
}) {
  const stale    = isStale(lead)
  const stageIdx = STAGES.indexOf(lead.stage)
  const urgency  = URGENCY_STYLE[lead.urgency] ?? URGENCY_STYLE.Medium

  const arrBtn: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 7,
    border: '1px solid rgba(0,0,0,0.10)',
    background: '#F4F4F5', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.15s',
    color: '#52525B', flexShrink: 0,
  }

  return (
    <div style={{
      background: '#FFFFFF',
      border: `1px solid ${stale ? 'rgba(220,38,38,0.22)' : 'rgba(0,0,0,0.07)'}`,
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: stale
        ? '0 1px 4px rgba(220,38,38,0.08), 0 1px 2px rgba(0,0,0,0.04)'
        : '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
      transition: 'box-shadow 0.2s, transform 0.15s',
    }}>
      {/* Top bar — red if stale, accent otherwise */}
      <div style={{
        height: 3,
        background: stale ? '#DC2626' : accent,
        opacity: stale ? 1 : 0.18,
      }} />

      <div style={{ padding: '14px 16px' }}>
        {/* Name + value */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5, gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#09090B', letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lead.customer_name}
            </div>
            {stale && (
              <span style={{ fontSize: 10, fontWeight: 600, color: '#DC2626', background: 'rgba(220,38,38,0.08)', padding: '1px 6px', borderRadius: 4, display: 'inline-block', marginTop: 2 }}>
                ● No contact 3d+
              </span>
            )}
          </div>
          {lead.value > 0 && (
            <span style={{ fontSize: 13, fontWeight: 700, color: accent, flexShrink: 0 }}>
              ${Number(lead.value).toLocaleString()}
            </span>
          )}
        </div>

        {/* Service type + urgency */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 13, flexWrap: 'wrap' }}>
          {lead.service_type && (
            <span style={{ fontSize: 11.5, color: '#71717A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
              {lead.service_type}
            </span>
          )}
          {lead.service_type && <span style={{ fontSize: 11, color: '#D4D4D8' }}>·</span>}
          <span style={{
            fontSize: 10.5, fontWeight: 600,
            color: urgency.color, background: urgency.bg,
            padding: '1px 7px', borderRadius: 4, flexShrink: 0,
          }}>
            {lead.urgency}
          </span>
        </div>

        {/* Footer: age + controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#A1A1AA', fontWeight: 500, flexShrink: 0 }}>
            {daysSince(lead.created_at)}d ago
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <button
              onClick={() => onMove(lead.id, 'back')}
              disabled={stageIdx === 0}
              aria-label="Move back"
              style={{ ...arrBtn, color: stageIdx === 0 ? '#D4D4D8' : '#52525B', cursor: stageIdx === 0 ? 'not-allowed' : 'pointer' }}
            >
              <ChevronLeft size={13} />
            </button>
            <button
              onClick={() => onMove(lead.id, 'forward')}
              disabled={stageIdx === STAGES.length - 1}
              aria-label="Move forward"
              style={{ ...arrBtn, color: stageIdx === STAGES.length - 1 ? '#D4D4D8' : '#52525B', cursor: stageIdx === STAGES.length - 1 ? 'not-allowed' : 'pointer' }}
            >
              <ChevronRight size={13} />
            </button>
            <button
              onClick={() => onCoach(lead)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 6, minHeight: 28,
                border: '1px solid rgba(0,0,0,0.10)',
                background: '#F4F4F5', color: '#52525B',
                fontSize: 11, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s', flexShrink: 0,
              }}
            >
              <Bot size={11} /> Coach
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Add lead modal ───────────────────────────────────────────────────────────

const FIELDS = [
  { key: 'customer_name',  label: 'Customer Name *', placeholder: 'e.g. John Smith',           type: 'text'   },
  { key: 'customer_phone', label: 'Phone',            placeholder: 'e.g. (602) 555-0123',       type: 'tel'    },
  { key: 'customer_email', label: 'Email',            placeholder: 'e.g. john@email.com',       type: 'email'  },
  { key: 'service_type',   label: 'Service Type',     placeholder: 'e.g. AC Install, Roof Fix', type: 'text'   },
  { key: 'value',          label: 'Estimated Value ($)', placeholder: 'e.g. 1200',              type: 'number' },
] as const

type FormKey = typeof FIELDS[number]['key'] | 'urgency' | 'notes'
type NewLeadForm = Record<FormKey, string>

function AddLeadModal({
  business, accent, glow, onClose, onAdd,
}: {
  business: Business
  accent: string
  glow: string
  onClose: () => void
  onAdd: (lead: Lead) => void
}) {
  const [form, setForm] = useState<NewLeadForm>({
    customer_name: '', customer_phone: '', customer_email: '',
    service_type: '', value: '', urgency: 'Medium', notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 13px',
    background: '#F4F4F5', border: '1.5px solid rgba(0,0,0,0.10)',
    borderRadius: 9, fontSize: 13, color: '#09090B',
    outline: 'none', fontFamily: 'inherit', transition: 'all 0.15s',
  }

  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.target.style.borderColor = accent
    e.target.style.boxShadow = `0 0 0 3px ${glow}`
    e.target.style.background = '#fff'
  }
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.target.style.borderColor = 'rgba(0,0,0,0.10)'
    e.target.style.boxShadow = 'none'
    e.target.style.background = '#F4F4F5'
  }

  const handleSubmit = async () => {
    if (!form.customer_name.trim()) { setError('Customer name is required'); return }
    setLoading(true); setError('')

    const result = await createLead({
      business_id:     business.id,
      customer_name:   form.customer_name,
      customer_phone:  form.customer_phone,
      customer_email:  form.customer_email,
      service_type:    form.service_type,
      urgency:         form.urgency,
      value:           parseFloat(form.value) || 0,
      notes:           form.notes,
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
      style={{ position: 'fixed', inset: 0, background: 'rgba(9,9,11,0.5)', backdropFilter: 'blur(8px) saturate(180%)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#FFFFFF', borderRadius: 18, padding: '28px', width: '100%', maxWidth: 440, boxShadow: '0 20px 48px rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.06)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#09090B', letterSpacing: '-0.4px' }}>Add New Lead</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A1A1AA', padding: 4, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Text / email / number fields */}
        {FIELDS.map(({ key, label, placeholder, type }) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: '#A1A1AA', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
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

        {/* Urgency */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 10.5, fontWeight: 700, color: '#A1A1AA', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
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

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 10.5, fontWeight: 700, color: '#A1A1AA', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
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

        {error && <p style={{ fontSize: 12.5, color: '#DC2626', marginBottom: 14, fontWeight: 500 }}>⚠ {error}</p>}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '9px 18px', borderRadius: 9, border: '1.5px solid rgba(0,0,0,0.10)', background: 'transparent', color: '#52525B', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !form.customer_name.trim()}
            style={{
              padding: '9px 20px', borderRadius: 9, border: 'none',
              background: form.customer_name.trim() && !loading ? accent : '#E4E4E7',
              color: 'white', fontSize: 13, fontWeight: 600,
              cursor: form.customer_name.trim() && !loading ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              boxShadow: form.customer_name.trim() && !loading ? `0 2px 8px ${glow}` : 'none',
              transition: 'all 0.15s', minHeight: 44,
            }}
          >
            {loading ? 'Adding…' : '+ Add Lead'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Pipeline view ────────────────────────────────────────────────────────────

export function PipelineView({
  business,
  initialLeads,
}: {
  business: Business
  initialLeads: Lead[]
}) {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [showAdd, setShowAdd] = useState(false)

  const accent = getAccent(business.trade_type)
  const glow   = getGlow(business.trade_type)

  const handleMove = async (leadId: string, dir: 'back' | 'forward') => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return
    const idx    = STAGES.indexOf(lead.stage)
    const newIdx = dir === 'forward' ? idx + 1 : idx - 1
    if (newIdx < 0 || newIdx >= STAGES.length) return
    const newStage = STAGES[newIdx]

    // Optimistic
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage } : l))

    const result = await updateLeadStage(leadId, newStage)
    if (!result.success) {
      // Revert
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

  const activeLeads = leads.filter(l => l.stage !== 'Complete')
  const staleCount  = leads.filter(isStale).length
  const totalValue  = activeLeads.reduce((s, l) => s + Number(l.value), 0)

  return (
    <>
      <style>{`
        .pipeline-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(264px, 1fr)); gap: 10px; }
        @media (max-width: 600px) { .pipeline-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* Page header */}
      <div style={{
        padding: '20px 28px', flexShrink: 0,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(0,0,0,0.07)', background: '#FFFFFF',
      }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#A1A1AA', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 3 }}>
            {business.name}
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#09090B', letterSpacing: '-0.5px', marginBottom: 4 }}>
            Pipeline
          </h1>
          <p style={{ fontSize: 13, color: '#71717A' }}>
            {leads.length} leads · ${totalValue.toLocaleString()} active
            {staleCount > 0 && (
              <span style={{ color: '#DC2626', fontWeight: 600 }}> · {staleCount} need follow-up</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 18px', borderRadius: 9,
            background: accent, border: 'none', color: 'white',
            fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', letterSpacing: '-0.2px',
            boxShadow: `0 2px 10px ${glow}`, minHeight: 44,
            transition: 'opacity 0.15s, transform 0.15s',
          }}
        >
          <Plus size={15} /> Add Lead
        </button>
      </div>

      {/* Scrollable stage list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 28px 36px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.1) transparent' }}>
        {STAGES.map(stage => {
          const stageLeads = leads.filter(l => l.stage === stage)
          return (
            <div key={stage} style={{ marginBottom: 6 }}>
              {/* Stage divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 10px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#A1A1AA', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  {stage}
                </span>
                <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.07)' }} />
                <span style={{ fontSize: 10.5, fontWeight: 600, color: '#A1A1AA', background: '#F4F4F5', border: '1px solid rgba(0,0,0,0.07)', padding: '1px 8px', borderRadius: 20 }}>
                  {stageLeads.length}
                </span>
              </div>

              {stageLeads.length > 0 ? (
                <div className="pipeline-grid" style={{ marginBottom: 4 }}>
                  {stageLeads.map(lead => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      accent={accent}
                      glow={glow}
                      onMove={handleMove}
                      onCoach={handleCoach}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ border: '1.5px dashed rgba(0,0,0,0.07)', borderRadius: 12, padding: '13px 16px', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#D4D4D8' }}>No leads in {stage}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showAdd && (
        <AddLeadModal
          business={business}
          accent={accent}
          glow={glow}
          onClose={() => setShowAdd(false)}
          onAdd={lead => setLeads(prev => [lead, ...prev])}
        />
      )}
    </>
  )
}
