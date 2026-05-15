'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Upload, GitBranch, X, ChevronLeft, ChevronRight,
  Bot, Mail, Plus, Loader2, Copy, Check,
} from 'lucide-react'
import { getAccent, getGlow } from '@/lib/supabase'
import type { Business, Prospect, ProspectStage } from '@/lib/supabase'
import {
  createProspect, updateProspectStage, updateProspect, importProspects,
} from '@/app/actions/prospects'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResearchResult {
  company_name: string
  company_overview: string
  decision_maker_name: string
  decision_maker_title: string
  email_format: string
  pain_points: string
  pitch_angle: string
  talking_points: string[]
}

interface DraftEmail { subject: string; body: string }

interface CsvRow {
  company_name: string
  contact_name: string
  contact_title: string
  email: string
  phone: string
  notes: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES: ProspectStage[] = ['New', 'Researched', 'Contacted', 'Responded', 'Meeting Set', 'Closed']

const STAGE_STYLE: Record<ProspectStage, { color: string; bg: string }> = {
  'New':          { color: '#71717A', bg: '#F4F4F5' },
  'Researched':   { color: '#0891B2', bg: 'rgba(8,145,178,0.10)' },
  'Contacted':    { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
  'Responded':    { color: '#7C3AED', bg: 'rgba(124,58,237,0.10)' },
  'Meeting Set':  { color: '#059669', bg: 'rgba(5,150,105,0.10)' },
  'Closed':       { color: '#16A34A', bg: 'rgba(22,163,74,0.12)' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseTalkingPoints(raw: string): string[] {
  if (!raw) return []
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [raw] }
  catch { return raw.split('\n').filter(Boolean) }
}

function parseCSV(text: string): CsvRow[] {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h =>
    h.replace(/"/g, '').trim().toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z_]/g, '')
  )

  return lines.slice(1).map(line => {
    const vals: string[] = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    vals.push(cur.trim())

    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (vals[i] ?? '').replace(/^"|"$/g, '') })

    return {
      company_name:  row['company_name'] || row['company'] || '',
      contact_name:  row['contact_name'] || row['name']    || row['contact'] || '',
      contact_title: row['contact_title']|| row['title']   || row['job_title'] || '',
      email:         row['email']        || '',
      phone: row['phone']        || row['phone'] || '',
      notes:         row['notes']        || '',
    }
  }).filter(r => r.company_name)
}

function quickSearches(business: Business): string[] {
  const city = business.city?.split(',')[0]?.trim() ?? ''
  const ind  = business.industry ?? ''
  const ic   = business.ideal_customer ?? ''
  const out: string[] = []
  if (ic && city)  out.push(`${ic} in ${city}`)
  if (ic && !city) out.push(ic)
  if (ind && city) out.push(`${ind} companies in ${city}`)
  if (city)        out.push(`Growing businesses in ${city}`)
  if (ind)         out.push(`Top ${ind} prospects`)
  return out.slice(0, 4)
}

// ─── Draft Email Modal ────────────────────────────────────────────────────────

function EmailModal({ email, onClose }: { email: DraftEmail; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const full = `Subject: ${email.subject}\n\n${email.body}`

  const copy = () => {
    navigator.clipboard.writeText(full)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(9,9,11,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, boxShadow: '0 20px 48px rgba(0,0,0,0.14)', border: '1px solid rgba(0,0,0,0.06)', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={16} color="#52525B" />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#09090B' }}>Draft Outreach Email</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A1A1AA', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ background: '#F4F4F5', borderRadius: 9, padding: '10px 14px', marginBottom: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#A1A1AA', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 3 }}>Subject</p>
          <p style={{ fontSize: 13.5, color: '#09090B', fontWeight: 500 }}>{email.subject}</p>
        </div>

        <div style={{ background: '#F4F4F5', borderRadius: 9, padding: '10px 14px', marginBottom: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#A1A1AA', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>Body</p>
          <p style={{ fontSize: 13, color: '#09090B', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{email.body}</p>
        </div>

        <button
          onClick={copy}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            width: '100%', padding: '10px 18px', borderRadius: 9,
            background: copied ? '#059669' : '#09090B',
            border: 'none', color: 'white', fontSize: 13.5, fontWeight: 600,
            cursor: 'pointer', justifyContent: 'center', fontFamily: 'inherit',
            transition: 'background 0.2s', minHeight: 44,
          }}
        >
          {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy to Clipboard</>}
        </button>
      </div>
    </div>
  )
}

// ─── Prospect Detail Slide-Over ───────────────────────────────────────────────

function ProspectDetail({
  prospect,
  business,
  onClose,
  onUpdate,
}: {
  prospect: Prospect
  business: Business
  onClose: () => void
  onUpdate: (p: Prospect) => void
}) {
  const router = useRouter()
  const accent = getAccent(business.trade_type)
  const glow   = getGlow(business.trade_type)
  const tps    = parseTalkingPoints(prospect.talking_points)

  const [notes,        setNotes]        = useState(prospect.notes)
  const [savingNotes,  setSavingNotes]  = useState(false)
  const [stage,        setStage]        = useState<ProspectStage>(prospect.stage)
  const [draftEmail,   setDraftEmail]   = useState<DraftEmail | null>(null)
  const [draftLoading, setDraftLoading] = useState(false)

  const stageSt = STAGE_STYLE[stage]

  const saveNotes = async () => {
    setSavingNotes(true)
    await updateProspect(prospect.id, { notes })
    onUpdate({ ...prospect, notes, stage })
    setSavingNotes(false)
  }

  const changeStage = async (s: ProspectStage) => {
    setStage(s)
    await updateProspectStage(prospect.id, s)
    onUpdate({ ...prospect, notes, stage: s })
  }

  const generateFollowUp = async () => {
    setDraftLoading(true)
    const res = await fetch('/api/prospect/draft-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospect, business }),
    })
    const data = await res.json()
    if (data.subject) setDraftEmail(data)
    setDraftLoading(false)
  }

  const openCoach = () => {
    const prompt = [
      `Help me with this prospect:`,
      `Company: ${prospect.company_name}`,
      prospect.contact_name  ? `Contact: ${prospect.contact_name}, ${prospect.contact_title}` : '',
      `Stage: ${stage}`,
      prospect.pain_points   ? `Pain points: ${prospect.pain_points}` : '',
      prospect.pitch_angle   ? `Pitch angle: ${prospect.pitch_angle}` : '',
      `\nWhat's my best next move to advance this deal?`,
    ].filter(Boolean).join('\n')
    router.push(`/dashboard/agent?prompt=${encodeURIComponent(prompt)}`)
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: '#A1A1AA',
    letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 5,
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(9,9,11,0.3)', backdropFilter: 'blur(2px)', zIndex: 300 }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 460,
        background: '#fff', zIndex: 301,
        boxShadow: '-8px 0 32px rgba(0,0,0,0.10)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.25s ease-out',
      }}>
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to   { transform: translateX(0); }
          }
        `}</style>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(0,0,0,0.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#A1A1AA', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 3 }}>Prospect</p>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#09090B', letterSpacing: '-0.4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {prospect.company_name}
              </h2>
              {prospect.contact_name && (
                <p style={{ fontSize: 13, color: '#71717A', marginTop: 2 }}>
                  {prospect.contact_name}{prospect.contact_title ? ` · ${prospect.contact_title}` : ''}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {prospect.enriched && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: 'rgba(5,150,105,0.10)', padding: '2px 8px', borderRadius: 20 }}>
                  ✦ Enriched
                </span>
              )}
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A1A1AA', padding: 4, display: 'flex' }}>
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.1) transparent' }}>

          {/* Stage */}
          <div style={{ marginBottom: 20 }}>
            <p style={labelStyle}>Stage</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STAGES.map(s => {
                const st = STAGE_STYLE[s]
                const active = s === stage
                return (
                  <button
                    key={s}
                    onClick={() => changeStage(s)}
                    style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: 600,
                      border: `1.5px solid ${active ? st.color : 'rgba(0,0,0,0.08)'}`,
                      background: active ? st.bg : 'transparent',
                      color: active ? st.color : '#71717A',
                      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                    }}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Contact info */}
          {(prospect.email || prospect.phone) && (
            <div style={{ background: '#F4F4F5', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
              <p style={labelStyle}>Contact Info</p>
              {prospect.email && <p style={{ fontSize: 13, color: '#09090B', marginBottom: 3 }}>✉ {prospect.email}</p>}
              {prospect.phone && <p style={{ fontSize: 13, color: '#09090B' }}>📞 {prospect.phone}</p>}
              {prospect.email_format && !prospect.email && (
                <p style={{ fontSize: 12, color: '#71717A', marginTop: 4 }}>Format: {prospect.email_format}</p>
              )}
            </div>
          )}

          {/* Research brief */}
          {prospect.company_overview && (
            <div style={{ marginBottom: 16 }}>
              <p style={labelStyle}>Company Overview</p>
              <p style={{ fontSize: 13, color: '#52525B', lineHeight: 1.65 }}>{prospect.company_overview}</p>
            </div>
          )}

          {prospect.pain_points && (
            <div style={{ marginBottom: 16 }}>
              <p style={labelStyle}>Pain Points</p>
              <p style={{ fontSize: 13, color: '#52525B', lineHeight: 1.65 }}>{prospect.pain_points}</p>
            </div>
          )}

          {prospect.pitch_angle && (
            <div style={{ marginBottom: 16 }}>
              <p style={labelStyle}>Pitch Angle</p>
              <p style={{ fontSize: 13, color: accent, lineHeight: 1.65, fontWeight: 500 }}>{prospect.pitch_angle}</p>
            </div>
          )}

          {tps.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={labelStyle}>Talking Points</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tps.map((tp, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: accent, background: glow, borderRadius: 4, padding: '1px 6px', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                    <p style={{ fontSize: 13, color: '#52525B', lineHeight: 1.6 }}>{tp}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div style={{ marginBottom: 20 }}>
            <p style={labelStyle}>Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="Add notes about this prospect..."
              style={{
                width: '100%', padding: '10px 12px',
                background: '#F4F4F5', border: '1.5px solid rgba(0,0,0,0.10)',
                borderRadius: 9, fontSize: 13, color: '#09090B',
                outline: 'none', fontFamily: 'inherit', resize: 'vertical',
                lineHeight: 1.6, transition: 'all 0.15s',
              }}
              onFocus={e => { e.target.style.borderColor = accent; e.target.style.background = '#fff'; e.target.style.boxShadow = `0 0 0 3px ${glow}` }}
              onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.10)'; e.target.style.background = '#F4F4F5'; e.target.style.boxShadow = 'none' }}
            />
            {notes !== prospect.notes && (
              <button
                onClick={saveNotes}
                disabled={savingNotes}
                style={{
                  marginTop: 8, padding: '7px 16px', borderRadius: 8, border: 'none',
                  background: accent, color: 'white', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {savingNotes ? 'Saving…' : 'Save Notes'}
              </button>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(0,0,0,0.07)', display: 'flex', gap: 8, flexShrink: 0, background: '#FAFAFA' }}>
          <button
            onClick={generateFollowUp}
            disabled={draftLoading}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 14px', borderRadius: 9, border: 'none',
              background: draftLoading ? '#E4E4E7' : accent,
              color: 'white', fontSize: 13, fontWeight: 600,
              cursor: draftLoading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', minHeight: 44,
              boxShadow: draftLoading ? 'none' : `0 2px 8px ${glow}`,
            }}
          >
            {draftLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Mail size={13} />}
            {draftLoading ? 'Writing…' : 'Generate Follow-Up'}
          </button>
          <button
            onClick={openCoach}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 16px', borderRadius: 9,
              border: '1.5px solid rgba(0,0,0,0.10)',
              background: '#fff', color: '#52525B',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit', minHeight: 44,
            }}
          >
            <Bot size={13} /> AI Coach
          </button>
        </div>
      </div>

      {draftEmail && <EmailModal email={draftEmail} onClose={() => setDraftEmail(null)} />}
    </>
  )
}

// ─── AI Search Tab ────────────────────────────────────────────────────────────

function AISearchTab({
  business, accent, glow, onProspectAdded,
}: {
  business: Business
  accent: string
  glow: string
  onProspectAdded: (p: Prospect) => void
}) {
  const [query,      setQuery]      = useState('')
  const [searching,  setSearching]  = useState(false)
  const [result,     setResult]     = useState<ResearchResult | null>(null)
  const [searchErr,  setSearchErr]  = useState('')
  const [added,      setAdded]      = useState(false)
  const [adding,     setAdding]     = useState(false)
  const [draftEmail, setDraftEmail] = useState<DraftEmail | null>(null)
  const [drafting,   setDrafting]   = useState(false)

  const pills = quickSearches(business)

  const search = async (q?: string) => {
    const text = (q ?? query).trim()
    if (!text || searching) return
    setQuery(text)
    setSearching(true)
    setResult(null)
    setSearchErr('')
    setAdded(false)

    try {
      const res = await fetch('/api/prospect/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: text,
          business: { name: business.name, industry: business.industry, ideal_customer: business.ideal_customer, main_service: business.main_service, city: business.city },
        }),
      })
      const data = await res.json()
      if (data.result) setResult(data.result)
      else setSearchErr(data.error || 'No results found. Try a more specific company name.')
    } catch {
      setSearchErr('Search failed. Check your connection and try again.')
    } finally {
      setSearching(false)
    }
  }

  const addToPipeline = async () => {
    if (!result || adding) return
    setAdding(true)
    const { success, prospect } = await createProspect({
      business_id:      business.id,
      company_name:     result.company_name,
      contact_name:     result.decision_maker_name,
      contact_title:    result.decision_maker_title,
      email:            result.email_format,
      company_overview: result.company_overview,
      email_format:     result.email_format,
      pain_points:      result.pain_points,
      pitch_angle:      result.pitch_angle,
      talking_points:   JSON.stringify(result.talking_points),
      enriched:         true,
      stage:            'Researched',
    })
    if (success && prospect) {
      onProspectAdded(prospect)
      setAdded(true)
    }
    setAdding(false)
  }

  const draftOutreach = async () => {
    if (!result || drafting) return
    setDrafting(true)
    const mockProspect = {
      company_name:  result.company_name,
      contact_name:  result.decision_maker_name,
      contact_title: result.decision_maker_title,
      pain_points:   result.pain_points,
      pitch_angle:   result.pitch_angle,
      talking_points: JSON.stringify(result.talking_points),
    }
    const res = await fetch('/api/prospect/draft-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospect: mockProspect, business }),
    })
    const data = await res.json()
    if (data.subject) setDraftEmail(data)
    setDrafting(false)
  }

  const sectionLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#A1A1AA', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 6 }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 40px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.1) transparent' }}>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 10,
          background: '#fff', border: '1.5px solid rgba(0,0,0,0.10)',
          borderRadius: 10, padding: '0 14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
          onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = accent; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 3px ${glow}` }}
          onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,0,0,0.10)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)' } }}
        >
          <Search size={15} color="#A1A1AA" style={{ flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search for a company or prospect..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#09090B', background: 'transparent', padding: '13px 0', fontFamily: 'inherit' }}
          />
        </div>
        <button
          onClick={() => search()}
          disabled={!query.trim() || searching}
          style={{
            padding: '0 22px', borderRadius: 10, border: 'none',
            background: query.trim() && !searching ? accent : '#E4E4E7',
            color: 'white', fontSize: 13.5, fontWeight: 600,
            cursor: query.trim() && !searching ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit', letterSpacing: '-0.2px',
            boxShadow: query.trim() && !searching ? `0 2px 8px ${glow}` : 'none',
            transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 7, minHeight: 44,
          }}
        >
          {searching ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
          {searching ? 'Researching…' : 'Research'}
        </button>
      </div>

      {/* Quick search pills */}
      {!result && !searching && (
        <div style={{ marginBottom: 28 }}>
          <p style={{ ...sectionLabel, marginBottom: 10 }}>Quick Searches</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {pills.map(pill => (
              <button
                key={pill}
                onClick={() => search(pill)}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 500,
                  border: '1px solid rgba(0,0,0,0.10)', background: '#F4F4F5',
                  color: '#52525B', cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = accent; (e.currentTarget as HTMLButtonElement).style.color = accent; (e.currentTarget as HTMLButtonElement).style.background = glow }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,0,0,0.10)'; (e.currentTarget as HTMLButtonElement).style.color = '#52525B'; (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F5' }}
              >
                {pill}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {searching && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.07)', padding: '32px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <Loader2 size={22} color={accent} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: '#09090B', marginBottom: 4 }}>Researching prospect…</p>
          <p style={{ fontSize: 12.5, color: '#A1A1AA' }}>Searching the web and compiling a research brief</p>
        </div>
      )}

      {/* Error */}
      {searchErr && !searching && (
        <div style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 10, padding: '12px 16px' }}>
          <p style={{ fontSize: 13, color: '#DC2626', fontWeight: 500 }}>⚠ {searchErr}</p>
        </div>
      )}

      {/* Result card */}
      {result && !searching && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.07)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ height: 3, background: accent }} />
          <div style={{ padding: '22px 24px' }}>
            {/* Company header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#09090B', letterSpacing: '-0.4px', marginBottom: 3 }}>{result.company_name}</h3>
                <p style={{ fontSize: 13, color: '#71717A' }}>
                  {result.decision_maker_name && <><strong style={{ color: '#52525B' }}>{result.decision_maker_name}</strong> · {result.decision_maker_title}</>}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                <button
                  onClick={draftOutreach}
                  disabled={drafting}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '8px 14px', borderRadius: 8, minHeight: 36,
                    border: '1.5px solid rgba(0,0,0,0.10)',
                    background: '#fff', color: '#52525B',
                    fontSize: 12.5, fontWeight: 600, cursor: drafting ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                >
                  {drafting ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Mail size={12} />}
                  {drafting ? 'Writing…' : 'Draft Outreach'}
                </button>
                <button
                  onClick={addToPipeline}
                  disabled={adding || added}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '8px 14px', borderRadius: 8, minHeight: 36,
                    border: 'none',
                    background: added ? '#059669' : adding ? '#E4E4E7' : accent,
                    color: 'white',
                    fontSize: 12.5, fontWeight: 600, cursor: adding || added ? 'default' : 'pointer',
                    fontFamily: 'inherit', transition: 'all 0.15s',
                    boxShadow: adding || added ? 'none' : `0 2px 8px ${glow}`,
                  }}
                >
                  {added ? <><Check size={12} /> Added</> : adding ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <><Plus size={12} /> Add to Pipeline</>}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <p style={sectionLabel}>Company Overview</p>
                <p style={{ fontSize: 13, color: '#52525B', lineHeight: 1.7 }}>{result.company_overview}</p>
              </div>
              {result.email_format && (
                <div>
                  <p style={sectionLabel}>Email Format</p>
                  <p style={{ fontSize: 13, color: '#52525B', fontFamily: 'monospace' }}>{result.email_format}</p>
                </div>
              )}
              <div>
                <p style={sectionLabel}>Pain Points</p>
                <p style={{ fontSize: 13, color: '#52525B', lineHeight: 1.7 }}>{result.pain_points}</p>
              </div>
              <div>
                <p style={sectionLabel}>Pitch Angle</p>
                <p style={{ fontSize: 13, color: accent, lineHeight: 1.7, fontWeight: 500 }}>{result.pitch_angle}</p>
              </div>
              {result.talking_points?.length > 0 && (
                <div>
                  <p style={sectionLabel}>Talking Points</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {result.talking_points.map((tp, i) => (
                      <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: accent, background: glow, borderRadius: 4, padding: '2px 6px', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                        <p style={{ fontSize: 13, color: '#52525B', lineHeight: 1.65 }}>{tp}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {draftEmail && <EmailModal email={draftEmail} onClose={() => setDraftEmail(null)} />}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ─── My Lists Tab ─────────────────────────────────────────────────────────────

function MyListsTab({
  business, accent, glow, prospects, onProspectsAdded,
}: {
  business: Business
  accent: string
  glow: string
  prospects: Prospect[]
  onProspectsAdded: (ps: Prospect[]) => void
}) {
  const fileRef                  = useRef<HTMLInputElement>(null)
  const [csvRows,    setCsvRows] = useState<CsvRow[]>([])
  const [importing,  setImporting]  = useState(false)
  const [imported,   setImported]   = useState(false)
  const [enriching,  setEnriching]  = useState(false)
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0 })
  const [importError, setImportError] = useState('')

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const rows = parseCSV(text)
      if (rows.length === 0) {
        setImportError('No valid rows found. Expected columns: Company Name, Contact Name, Title, Email, Phone, Notes')
        return
      }
      setCsvRows(rows)
      setImported(false)
      setImportError('')
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.csv')) handleFile(file)
  }

  const doImport = async () => {
    if (!csvRows.length || importing) return
    setImporting(true)
    const result = await importProspects(business.id, csvRows)
    if (result.success) {
      setImported(true)
      // Refresh prospects by reloading
      window.location.reload()
    } else {
      setImportError(result.error ?? 'Import failed')
    }
    setImporting(false)
  }

  const listProspects = prospects.filter(p => !p.enriched)

  const enrichAll = async () => {
    if (enriching) return
    const targets = listProspects.slice(0, 20)
    if (!targets.length) return
    setEnriching(true)
    setEnrichProgress({ current: 0, total: targets.length })

    for (let i = 0; i < targets.length; i++) {
      const p = targets[i]
      try {
        const res = await fetch('/api/prospect/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prospect: { company_name: p.company_name, contact_name: p.contact_name, contact_title: p.contact_title, email: p.email },
            business: { name: business.name, industry: business.industry, ideal_customer: business.ideal_customer, main_service: business.main_service, city: business.city },
          }),
        })
        const data = await res.json()
        if (data.result) {
          await updateProspect(p.id, {
            company_overview: data.result.company_overview,
            email_format:     data.result.email_format,
            pain_points:      data.result.pain_points,
            pitch_angle:      data.result.pitch_angle,
            talking_points:   JSON.stringify(data.result.talking_points),
            enriched:         true,
          })
        }
      } catch { /* continue on error */ }
      setEnrichProgress({ current: i + 1, total: targets.length })
    }

    setEnriching(false)
    window.location.reload()
  }

  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid rgba(0,0,0,0.07)',
    borderRadius: 14, overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 40px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.1) transparent' }}>

      {/* Upload area */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed rgba(0,0,0,0.12)`,
          borderRadius: 14, padding: '28px 24px',
          textAlign: 'center', cursor: 'pointer',
          marginBottom: 24, transition: 'all 0.15s',
          background: '#fff',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = accent; (e.currentTarget as HTMLDivElement).style.background = glow }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,0,0,0.12)'; (e.currentTarget as HTMLDivElement).style.background = '#fff' }}
      >
        <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        <Upload size={22} color="#A1A1AA" style={{ margin: '0 auto 10px' }} />
        <p style={{ fontSize: 14, fontWeight: 600, color: '#09090B', marginBottom: 4 }}>Drop a CSV file or click to upload</p>
        <p style={{ fontSize: 12.5, color: '#A1A1AA' }}>Columns: Company Name, Contact Name, Title, Email, Phone, Notes</p>
      </div>

      {importError && (
        <div style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#DC2626', fontWeight: 500 }}>⚠ {importError}</p>
        </div>
      )}

      {/* CSV preview */}
      {csvRows.length > 0 && !imported && (
        <div style={{ ...card, marginBottom: 24 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#09090B' }}>{csvRows.length} rows ready to import</p>
            <button
              onClick={doImport}
              disabled={importing}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 18px', borderRadius: 8, border: 'none',
                background: importing ? '#E4E4E7' : accent,
                color: 'white', fontSize: 12.5, fontWeight: 600,
                cursor: importing ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', minHeight: 36,
                boxShadow: importing ? 'none' : `0 2px 8px ${glow}`,
              }}
            >
              {importing ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={12} />}
              {importing ? 'Importing…' : `Import All ${csvRows.length} rows`}
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#F4F4F5' }}>
                  {['Company', 'Contact', 'Title', 'Email', 'Phone'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, color: '#71717A', fontSize: 11, letterSpacing: '0.4px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvRows.slice(0, 8).map((row, i) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(0,0,0,0.045)' }}>
                    <td style={{ padding: '9px 14px', color: '#09090B', fontWeight: 500, whiteSpace: 'nowrap' }}>{row.company_name}</td>
                    <td style={{ padding: '9px 14px', color: '#52525B', whiteSpace: 'nowrap' }}>{row.contact_name}</td>
                    <td style={{ padding: '9px 14px', color: '#71717A', whiteSpace: 'nowrap' }}>{row.contact_title}</td>
                    <td style={{ padding: '9px 14px', color: '#71717A', whiteSpace: 'nowrap' }}>{row.email}</td>
                    <td style={{ padding: '9px 14px', color: '#71717A', whiteSpace: 'nowrap' }}>{row.phone}</td>
                  </tr>
                ))}
                {csvRows.length > 8 && (
                  <tr style={{ borderTop: '1px solid rgba(0,0,0,0.045)' }}>
                    <td colSpan={5} style={{ padding: '9px 14px', color: '#A1A1AA', fontSize: 12 }}>
                      +{csvRows.length - 8} more rows…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Imported prospects */}
      {listProspects.length > 0 && (
        <div style={{ ...card }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#09090B' }}>{listProspects.length} prospects need enrichment</p>
              {enriching && (
                <p style={{ fontSize: 12, color: accent, fontWeight: 600, marginTop: 2 }}>
                  Enriching {enrichProgress.current} of {enrichProgress.total}…
                </p>
              )}
            </div>
            <button
              onClick={enrichAll}
              disabled={enriching}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 18px', borderRadius: 8, border: 'none',
                background: enriching ? '#E4E4E7' : '#09090B',
                color: 'white', fontSize: 12.5, fontWeight: 600,
                cursor: enriching ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', minHeight: 36,
              }}
            >
              {enriching
                ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Enriching {enrichProgress.current}/{enrichProgress.total}</>
                : <><Bot size={12} /> Enrich with AI</>
              }
            </button>
          </div>
          {listProspects.slice(0, 12).map((p, i) => (
            <div key={p.id} style={{ padding: '11px 18px', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.045)' : undefined, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#09090B' }}>{p.company_name}</p>
                {p.contact_name && <p style={{ fontSize: 12, color: '#71717A' }}>{p.contact_name}{p.contact_title ? ` · ${p.contact_title}` : ''}</p>}
              </div>
              {p.enriched
                ? <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: 'rgba(5,150,105,0.10)', padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>✦ Enriched</span>
                : <span style={{ fontSize: 10, fontWeight: 600, color: '#A1A1AA', background: '#F4F4F5', padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>Not enriched</span>
              }
            </div>
          ))}
        </div>
      )}

      {listProspects.length === 0 && csvRows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#A1A1AA' }}>
          <Upload size={28} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
          <p style={{ fontSize: 14, fontWeight: 500 }}>Upload a CSV to import prospects in bulk</p>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── Pipeline Tab ─────────────────────────────────────────────────────────────

function PipelineTab({
  business, accent, glow, prospects, onStageChange, onSelect,
}: {
  business: Business
  accent: string
  glow: string
  prospects: Prospect[]
  onStageChange: (id: string, stage: ProspectStage) => void
  onSelect: (p: Prospect) => void
}) {
  const router = useRouter()

  const move = async (p: Prospect, dir: 'back' | 'forward') => {
    const idx = STAGES.indexOf(p.stage)
    const next = dir === 'forward' ? idx + 1 : idx - 1
    if (next < 0 || next >= STAGES.length) return
    const newStage = STAGES[next]
    onStageChange(p.id, newStage)
    await updateProspectStage(p.id, newStage)
  }

  const openCoach = (p: Prospect) => {
    const prompt = [
      `Help me with this prospect:`,
      `Company: ${p.company_name}`,
      p.contact_name  ? `Contact: ${p.contact_name}, ${p.contact_title}` : '',
      `Stage: ${p.stage}`,
      p.pain_points   ? `Pain points: ${p.pain_points}` : '',
      p.pitch_angle   ? `Pitch angle: ${p.pitch_angle}` : '',
      `\nWhat's my best next move?`,
    ].filter(Boolean).join('\n')
    router.push(`/dashboard/agent?prompt=${encodeURIComponent(prompt)}`)
  }

  const [draftFor,    setDraftFor]    = useState<Prospect | null>(null)
  const [draftEmail,  setDraftEmail]  = useState<DraftEmail | null>(null)
  const [draftLoading,setDraftLoading]= useState(false)

  const draftEmailFor = async (p: Prospect) => {
    setDraftFor(p)
    setDraftLoading(true)
    const res = await fetch('/api/prospect/draft-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospect: p, business }),
    })
    const data = await res.json()
    if (data.subject) setDraftEmail(data)
    setDraftLoading(false)
  }

  const arrBtn: React.CSSProperties = {
    width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(0,0,0,0.10)',
    background: '#F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: '#52525B', flexShrink: 0, transition: 'all 0.15s',
  }

  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 28px 36px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.1) transparent' }}>
        <style>{`
          .prospect-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>

        {STAGES.map(stage => {
          const stageProspects = prospects.filter(p => p.stage === stage)
          const st = STAGE_STYLE[stage]
          return (
            <div key={stage} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: st.color, letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{stage}</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.07)' }} />
                <span style={{ fontSize: 10.5, fontWeight: 600, color: st.color, background: st.bg, border: '1px solid rgba(0,0,0,0.07)', padding: '1px 8px', borderRadius: 20 }}>
                  {stageProspects.length}
                </span>
              </div>

              {stageProspects.length > 0 ? (
                <div className="prospect-grid" style={{ marginBottom: 4 }}>
                  {stageProspects.map(p => {
                    const stageIdx = STAGES.indexOf(p.stage)
                    return (
                      <div
                        key={p.id}
                        onClick={() => onSelect(p)}
                        style={{
                          background: '#fff', border: '1px solid rgba(0,0,0,0.07)',
                          borderRadius: 13, overflow: 'hidden', cursor: 'pointer',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
                          transition: 'box-shadow 0.15s, transform 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.10)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.07)'; (e.currentTarget as HTMLDivElement).style.transform = 'none' }}
                      >
                        <div style={{ height: 3, background: st.color, opacity: 0.5 }} />
                        <div style={{ padding: '13px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#09090B', letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{p.company_name}</p>
                            {p.enriched && <span style={{ fontSize: 9, fontWeight: 700, color: '#059669', background: 'rgba(5,150,105,0.10)', padding: '1px 6px', borderRadius: 10, flexShrink: 0 }}>✦</span>}
                          </div>
                          {p.contact_name && (
                            <p style={{ fontSize: 11.5, color: '#71717A', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.contact_name}{p.contact_title ? ` · ${p.contact_title}` : ''}
                            </p>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => move(p, 'back')} disabled={stageIdx === 0} style={{ ...arrBtn, color: stageIdx === 0 ? '#D4D4D8' : '#52525B', cursor: stageIdx === 0 ? 'not-allowed' : 'pointer' }} aria-label="Move back">
                                <ChevronLeft size={12} />
                              </button>
                              <button onClick={() => move(p, 'forward')} disabled={stageIdx === STAGES.length - 1} style={{ ...arrBtn, color: stageIdx === STAGES.length - 1 ? '#D4D4D8' : '#52525B', cursor: stageIdx === STAGES.length - 1 ? 'not-allowed' : 'pointer' }} aria-label="Move forward">
                                <ChevronRight size={12} />
                              </button>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                onClick={() => draftEmailFor(p)}
                                disabled={draftLoading && draftFor?.id === p.id}
                                style={{ ...arrBtn, gap: 3, padding: '0 8px', width: 'auto', fontSize: 11, fontWeight: 600, color: '#52525B' }}
                              >
                                {draftLoading && draftFor?.id === p.id
                                  ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
                                  : <Mail size={10} />
                                }
                                Email
                              </button>
                              <button onClick={() => openCoach(p)} style={{ ...arrBtn, gap: 3, padding: '0 8px', width: 'auto', fontSize: 11, fontWeight: 600, color: '#52525B' }}>
                                <Bot size={10} /> Coach
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ border: '1.5px dashed rgba(0,0,0,0.07)', borderRadius: 11, padding: '11px 14px', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#D4D4D8' }}>No prospects in {stage}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {draftEmail && <EmailModal email={draftEmail} onClose={() => { setDraftEmail(null); setDraftFor(null) }} />}
    </>
  )
}

// ─── Prospects View ───────────────────────────────────────────────────────────

type Tab = 'search' | 'lists' | 'pipeline'

export function ProspectsView({
  business,
  initialProspects,
}: {
  business: Business
  initialProspects: Prospect[]
}) {
  const accent = getAccent(business.trade_type)
  const glow   = getGlow(business.trade_type)

  const [activeTab,  setActiveTab]  = useState<Tab>('search')
  const [prospects,  setProspects]  = useState<Prospect[]>(initialProspects)
  const [selected,   setSelected]   = useState<Prospect | null>(null)

  const addProspect  = (p: Prospect) => setProspects(prev => [p, ...prev])
  const updateLocal  = (p: Prospect) => setProspects(prev => prev.map(x => x.id === p.id ? p : x))
  const changeStage  = (id: string, stage: ProspectStage) =>
    setProspects(prev => prev.map(p => p.id === id ? { ...p, stage } : p))

  const TABS: { id: Tab; label: string; icon: typeof Search }[] = [
    { id: 'search',   label: 'AI Search', icon: Search    },
    { id: 'lists',    label: 'My Lists',  icon: Upload    },
    { id: 'pipeline', label: 'Pipeline',  icon: GitBranch },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Page header */}
      <div style={{
        padding: '20px 28px 0', flexShrink: 0,
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        background: '#FFFFFF',
      }}>
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#A1A1AA', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 3 }}>
            {business.name}
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#09090B', letterSpacing: '-0.5px' }}>
            Prospects
          </h1>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2 }}>
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: '8px 8px 0 0',
                  border: 'none', background: active ? '#FAFAFA' : 'transparent',
                  color: active ? accent : '#71717A',
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
                  transition: 'all 0.15s', marginBottom: -1,
                }}
              >
                <Icon size={13} />
                {label}
                {id === 'pipeline' && prospects.length > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: active ? accent : '#A1A1AA', background: active ? glow : '#F4F4F5', padding: '1px 6px', borderRadius: 20 }}>
                    {prospects.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'search' && (
        <AISearchTab business={business} accent={accent} glow={glow} onProspectAdded={addProspect} />
      )}
      {activeTab === 'lists' && (
        <MyListsTab business={business} accent={accent} glow={glow} prospects={prospects} onProspectsAdded={ps => setProspects(prev => [...ps, ...prev])} />
      )}
      {activeTab === 'pipeline' && (
        <PipelineTab business={business} accent={accent} glow={glow} prospects={prospects} onStageChange={changeStage} onSelect={setSelected} />
      )}

      {/* Slide-over detail */}
      {selected && (
        <ProspectDetail
          prospect={selected}
          business={business}
          onClose={() => setSelected(null)}
          onUpdate={p => { updateLocal(p); setSelected(p) }}
        />
      )}
    </div>
  )
}
