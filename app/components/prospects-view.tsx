'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Upload, GitBranch, X, ChevronLeft, ChevronRight,
  Bot, Mail, Plus, Loader2, Copy, Check,
} from 'lucide-react'
import type { Business, Prospect, ProspectStage, ProspectSearch } from '@/lib/supabase'
import {
  createProspect, updateProspectStage, updateProspect, importProspects,
  saveProspectFromSearch, checkRecentSearch, saveSearch, moveToLeadsPipeline,
} from '@/app/actions/prospects'

// ── Design tokens ─────────────────────────────────────────────────────────────
const DS = {
  pageBg:        '#F7F9F8',
  cardBg:        '#FFFFFF',
  cardBorder:    '#E0EBE5',
  cardHover:     '#1D9E75',
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
  headerBg:      '#0F6E56',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface BatchResult {
  company_name: string; website: string; location: string; overview: string
  contact_name: string; contact_title: string; email_format: string
  pain_points: string; pitch_angle: string; email_subject: string; email_body: string
}

interface DraftEmail { subject: string; body: string }

interface CsvRow {
  company_name: string; contact_name: string; contact_title: string
  email: string; phone: string; notes: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGES: ProspectStage[] = ['New', 'Researched', 'Contacted', 'Responded', 'Meeting Set', 'Closed']

const STAGE_STYLE: Record<ProspectStage, { color: string; bg: string }> = {
  'New':         { color: DS.secondary, bg: DS.accentMid    },
  'Researched':  { color: '#0891B2',    bg: 'rgba(8,145,178,0.10)'   },
  'Contacted':   { color: '#F59E0B',    bg: 'rgba(245,158,11,0.10)'  },
  'Responded':   { color: '#7C3AED',    bg: 'rgba(124,58,237,0.10)'  },
  'Meeting Set': { color: DS.primary,   bg: DS.accentLight  },
  'Closed':      { color: '#16A34A',    bg: 'rgba(22,163,74,0.12)'   },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseTalkingPoints(raw: string): string[] {
  if (!raw) return []
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [raw] }
  catch { return raw.split('\n').filter(Boolean) }
}

function parseCSV(text: string): CsvRow[] {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h =>
    h.replace(/"/g, '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '')
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
      phone:         row['phone']        || '',
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

function getInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  if (words.length === 1) return words[0][0].toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

// ── Draft Email Modal ─────────────────────────────────────────────────────────

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
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: DS.muted, padding: 4 }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ background: DS.accentMid, borderRadius: 8, padding: '10px 13px', marginBottom: 10 }}>
          <p style={{ fontSize: 9.5, fontWeight: 700, color: DS.muted, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 3 }}>Subject</p>
          <p style={{ fontSize: 13, color: DS.bodyText, fontWeight: 500 }}>{email.subject}</p>
        </div>

        <div style={{ background: DS.accentMid, borderRadius: 8, padding: '10px 13px', marginBottom: 18 }}>
          <p style={{ fontSize: 9.5, fontWeight: 700, color: DS.muted, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 7 }}>Body</p>
          <p style={{ fontSize: 12.5, color: DS.bodyText, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{email.body}</p>
        </div>

        <button
          onClick={copy}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            width: '100%', padding: '9px 16px', borderRadius: 8,
            background: copied ? DS.primary : DS.bodyText,
            border: 'none', color: 'white', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', justifyContent: 'center', fontFamily: 'inherit',
            transition: 'background 0.2s', minHeight: 40,
          }}
        >
          {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy to Clipboard</>}
        </button>
      </div>
    </div>
  )
}

// ── Prospect Detail Slide-Over ────────────────────────────────────────────────

function ProspectDetail({
  prospect, business, onClose, onUpdate,
}: {
  prospect: Prospect; business: Business; onClose: () => void; onUpdate: (p: Prospect) => void
}) {
  const router = useRouter()
  const tps = parseTalkingPoints(prospect.talking_points)

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
      prospect.contact_name ? `Contact: ${prospect.contact_name}, ${prospect.contact_title}` : '',
      `Stage: ${stage}`,
      prospect.pain_points  ? `Pain points: ${prospect.pain_points}` : '',
      prospect.pitch_angle  ? `Pitch angle: ${prospect.pitch_angle}` : '',
      `\nWhat's my best next move to advance this deal?`,
    ].filter(Boolean).join('\n')
    router.push(`/dashboard/agent?prompt=${encodeURIComponent(prompt)}`)
  }

  const lbl: React.CSSProperties = {
    fontSize: 9.5, fontWeight: 700, color: DS.muted,
    letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 5,
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(8,80,65,0.25)', backdropFilter: 'blur(2px)', zIndex: 300 }} />
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 460,
        background: DS.cardBg, zIndex: 301,
        boxShadow: '-8px 0 32px rgba(0,0,0,0.10)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.25s ease-out',
      }}>
        <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid ${DS.cardBorder}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                background: DS.accentLight, color: DS.primary,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
              }}>
                {getInitials(prospect.company_name)}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: DS.muted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 2 }}>Prospect</p>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: DS.bodyText, letterSpacing: '-0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {prospect.company_name}
                </h2>
                {prospect.contact_name && (
                  <p style={{ fontSize: 12.5, color: DS.secondary, marginTop: 1 }}>
                    {prospect.contact_name}{prospect.contact_title ? ` · ${prospect.contact_title}` : ''}
                  </p>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
              {prospect.enriched && (
                <span style={{ fontSize: 9.5, fontWeight: 700, color: DS.primary, background: DS.accentLight, padding: '2px 8px', borderRadius: 20 }}>
                  ✦ Enriched
                </span>
              )}
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: DS.muted, padding: 3, display: 'flex' }}>
                <X size={17} />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', scrollbarWidth: 'thin', scrollbarColor: `${DS.muted} transparent` }}>

          <div style={{ marginBottom: 18 }}>
            <p style={lbl}>Stage</p>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {STAGES.map(s => {
                const st     = STAGE_STYLE[s]
                const active = s === stage
                return (
                  <button key={s} onClick={() => changeStage(s)} style={{
                    padding: '3px 11px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    border: `1.5px solid ${active ? st.color : DS.cardBorder}`,
                    background: active ? st.bg : 'transparent',
                    color: active ? st.color : DS.secondary,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}>
                    {s}
                  </button>
                )
              })}
            </div>
          </div>

          {(prospect.email || prospect.phone) && (
            <div style={{ background: DS.accentMid, borderRadius: 9, padding: '11px 13px', marginBottom: 18 }}>
              <p style={lbl}>Contact Info</p>
              {prospect.email && <p style={{ fontSize: 12.5, color: DS.bodyText, marginBottom: 2 }}>✉ {prospect.email}</p>}
              {prospect.phone && <p style={{ fontSize: 12.5, color: DS.bodyText }}>📞 {prospect.phone}</p>}
              {prospect.email_format && !prospect.email && (
                <p style={{ fontSize: 11.5, color: DS.secondary, marginTop: 4 }}>Format: {prospect.email_format}</p>
              )}
            </div>
          )}

          {prospect.company_overview && (
            <div style={{ marginBottom: 14 }}>
              <p style={lbl}>Company Overview</p>
              <p style={{ fontSize: 12.5, color: DS.secondary, lineHeight: 1.65 }}>{prospect.company_overview}</p>
            </div>
          )}

          {prospect.pain_points && (
            <div style={{ marginBottom: 14 }}>
              <p style={lbl}>Pain Points</p>
              <p style={{ fontSize: 12.5, color: DS.secondary, lineHeight: 1.65 }}>{prospect.pain_points}</p>
            </div>
          )}

          {prospect.pitch_angle && (
            <div style={{ marginBottom: 14, borderLeft: `3px solid ${DS.primary}`, paddingLeft: 10, background: DS.accentMid, borderRadius: '0 7px 7px 0', padding: '9px 12px 9px 11px' }}>
              <p style={lbl}>Pitch Angle</p>
              <p style={{ fontSize: 12.5, color: DS.bodyText, lineHeight: 1.65, fontWeight: 500 }}>{prospect.pitch_angle}</p>
            </div>
          )}

          {tps.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <p style={lbl}>Talking Points</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tps.map((tp, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: DS.primary, background: DS.accentLight, borderRadius: 4, padding: '1px 6px', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                    <p style={{ fontSize: 12.5, color: DS.secondary, lineHeight: 1.6 }}>{tp}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <p style={lbl}>Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="Add notes about this prospect..."
              style={{
                width: '100%', padding: '9px 11px',
                background: DS.inputBg, border: `1.5px solid ${DS.outlineBorder}`,
                borderRadius: 8, fontSize: 12.5, color: DS.bodyText,
                outline: 'none', fontFamily: 'inherit', resize: 'vertical',
                lineHeight: 1.6, transition: 'all 0.15s',
              }}
              onFocus={e => { e.target.style.borderColor = DS.primary; e.target.style.background = '#fff'; e.target.style.boxShadow = `0 0 0 3px ${DS.primaryGlow}` }}
              onBlur={e => { e.target.style.borderColor = DS.outlineBorder; e.target.style.background = DS.inputBg; e.target.style.boxShadow = 'none' }}
            />
            {notes !== prospect.notes && (
              <button
                onClick={saveNotes}
                disabled={savingNotes}
                style={{
                  marginTop: 7, padding: '6px 14px', borderRadius: 7, border: 'none',
                  background: DS.primary, color: 'white', fontSize: 11.5, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {savingNotes ? 'Saving…' : 'Save Notes'}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 22px', borderTop: `1px solid ${DS.cardBorder}`, display: 'flex', gap: 8, flexShrink: 0, background: DS.pageBg }}>
          <button
            onClick={generateFollowUp}
            disabled={draftLoading}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '9px 12px', borderRadius: 7, border: 'none',
              background: draftLoading ? '#E4E4E7' : DS.primary,
              color: 'white', fontSize: 12, fontWeight: 600,
              cursor: draftLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', minHeight: 38,
              boxShadow: draftLoading ? 'none' : `0 2px 8px ${DS.primaryGlow}`,
            }}
          >
            {draftLoading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Mail size={12} />}
            {draftLoading ? 'Writing…' : 'Generate Follow-Up'}
          </button>
          <button
            onClick={openCoach}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '9px 14px', borderRadius: 7,
              border: `1.5px solid ${DS.outlineBorder}`,
              background: DS.cardBg, color: DS.outlineText,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 38,
            }}
          >
            <Bot size={12} /> AI Coach
          </button>
        </div>
      </div>

      {draftEmail && <EmailModal email={draftEmail} onClose={() => setDraftEmail(null)} />}
    </>
  )
}

// ── Skeleton Card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{ background: DS.cardBg, borderRadius: 10, border: `1px solid ${DS.cardBorder}`, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ height: 3, background: DS.accentMid }} />
      <div style={{ padding: '14px' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div className="sk" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="sk" style={{ height: 14, width: '55%', marginBottom: 6 }} />
            <div className="sk" style={{ height: 10, width: '35%' }} />
          </div>
        </div>
        <div className="sk" style={{ height: 10, width: '90%', marginBottom: 4 }} />
        <div className="sk" style={{ height: 10, width: '75%', marginBottom: 12 }} />
        <div className="sk" style={{ height: 36, width: '100%', borderRadius: 7 }} />
        <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
          <div className="sk" style={{ height: 28, width: 100, borderRadius: 6 }} />
          <div className="sk" style={{ height: 28, width: 110, borderRadius: 6 }} />
        </div>
      </div>
    </div>
  )
}

// ── AI Search Tab ─────────────────────────────────────────────────────────────

function AISearchTab({
  business, prospects, onProspectsAdded,
}: {
  business: Business; prospects: Prospect[]; onProspectsAdded: (ps: Prospect[]) => void
}) {
  const [query,         setQuery]         = useState('')
  const [searching,     setSearching]     = useState(false)
  const [totalExpected, setTotalExpected] = useState(10)
  const [results,       setResults]       = useState<BatchResult[]>([])
  const [searchErr,     setSearchErr]     = useState('')
  const [cachedSearch,  setCachedSearch]  = useState<ProspectSearch | null>(null)
  const [selectedIdx,   setSelectedIdx]   = useState<Set<number>>(new Set())
  const [savedMap,      setSavedMap]      = useState<Map<number, Prospect>>(new Map())
  const [duplicateIdx,  setDuplicateIdx]  = useState<Set<number>>(new Set())
  const [inPipelineIdx, setInPipelineIdx] = useState<Set<number>>(new Set())
  const [addingIdx,     setAddingIdx]     = useState<Set<number>>(new Set())
  const [savingAll,       setSavingAll]       = useState(false)
  const [savingProspects, setSavingProspects] = useState(false)
  const [addedConfirm,    setAddedConfirm]    = useState(false)
  const [emailModal,      setEmailModal]      = useState<DraftEmail | null>(null)

  const pollRef           = useRef<ReturnType<typeof setInterval> | null>(null)
  const pills             = quickSearches(business)
  const existingCompanies = prospects.map(p => p.company_name)
  const sl: React.CSSProperties = { fontSize: 9.5, fontWeight: 700, color: DS.muted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 4 }

  // Clear poll interval on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  const saveResults = async (batchResults: BatchResult[], searchText: string) => {
    const saves = await Promise.all(
      batchResults.map((r, i) =>
        saveProspectFromSearch({
          business_id: business.id, company_name: r.company_name, contact_name: r.contact_name,
          contact_title: r.contact_title, email: r.email_format, website: r.website,
          location: r.location, company_overview: r.overview, email_format: r.email_format,
          pain_points: r.pain_points, pitch_angle: r.pitch_angle, talking_points: '[]',
          search_query: searchText, source: 'ai_search_batch',
        }).then(saved => ({ i, saved }))
      )
    )
    const sm: Map<number, Prospect> = new Map()
    const di: Set<number>           = new Set()
    const pi: Set<number>           = new Set()
    const newProspects: Prospect[]  = []
    saves.forEach(({ i, saved }) => {
      if (saved.prospect) {
        sm.set(i, saved.prospect)
        if (saved.duplicate) di.add(i)
        if (saved.prospect.status === 'pipeline') pi.add(i)
        if (!saved.duplicate) newProspects.push(saved.prospect)
      }
    })
    setSavedMap(sm); setDuplicateIdx(di); setInPipelineIdx(pi)
    if (newProspects.length) onProspectsAdded(newProspects)
    await saveSearch(business.id, searchText, batchResults.length)
  }

  const runSearch = async (q: string, force = false) => {
    const text = q.trim()
    if (!text || searching) return
    stopPolling()
    setQuery(text); setSearching(true); setResults([]); setSearchErr(''); setCachedSearch(null)
    setTotalExpected(10); setSavingProspects(false); setAddedConfirm(false)
    setSelectedIdx(new Set()); setSavedMap(new Map()); setDuplicateIdx(new Set()); setInPipelineIdx(new Set())

    // Cache path — still instant
    if (!force) {
      const cached = await checkRecentSearch(business.id, text)
      if (cached.found && cached.search && cached.prospects && cached.prospects.length >= 3) {
        setCachedSearch(cached.search)
        const batchResults: BatchResult[] = cached.prospects.map(p => ({
          company_name: p.company_name, website: p.website ?? '', location: p.location ?? '',
          overview: p.company_overview ?? '', contact_name: p.contact_name ?? '',
          contact_title: p.contact_title ?? '', email_format: p.email_format ?? '',
          pain_points: p.pain_points ?? '', pitch_angle: p.pitch_angle ?? '',
          email_subject: '', email_body: '',
        }))
        setResults(batchResults)
        const sm = new Map<number, Prospect>()
        const pi = new Set<number>()
        cached.prospects.forEach((p, i) => { sm.set(i, p); if (p.status === 'pipeline') pi.add(i) })
        setSavedMap(sm); setInPipelineIdx(pi); setSearching(false)
        return
      }
    }

    // Live search — kick off background run, then poll
    try {
      const res = await fetch('/api/research/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: text,
          businessId: business.id,
          business: { name: business.name, industry: business.industry, ideal_customer: business.ideal_customer, main_service: business.main_service, city: business.city },
          existingCompanies,
        }),
      })
      const { runId, total } = await res.json()
      if (!runId) { setSearchErr('Search failed to start.'); setSearching(false); return }
      setTotalExpected(total ?? 10)

      // Poll every 2 seconds for completed tasks
      pollRef.current = setInterval(async () => {
        try {
          const poll = await fetch(`/api/research/batch?runId=${runId}`)
          const data = await poll.json()

          if (data.results?.length) setResults(data.results)
          if (data.total)           setTotalExpected(data.total)

          const isDone = data.status === 'done' || data.status === 'failed' ||
            (data.completed + data.failed) >= (data.total ?? 10)

          if (isDone) {
            stopPolling()
            setSearching(false)
            if (!data.results?.length) {
              setSearchErr('No results found. Try a more specific search.')
            } else {
              // Save to Supabase in background — keep buttons disabled until done
              setSavingProspects(true)
              saveResults(data.results, text).finally(() => setSavingProspects(false))
            }
          }
        } catch {
          // transient poll error — keep trying
        }
      }, 2000)
    } catch {
      setSearchErr('Search failed. Check your connection and try again.')
      setSearching(false)
    }
  }

  const toggleSelect = (i: number) => {
    if (duplicateIdx.has(i)) return
    setSelectedIdx(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next })
  }

  const addOneToPipeline = async (i: number) => {
    const p = savedMap.get(i)
    if (!p || addingIdx.has(i) || inPipelineIdx.has(i)) return
    setAddingIdx(prev => new Set([...prev, i]))
    const { success } = await moveToLeadsPipeline(p.id, business.id)
    if (success) setInPipelineIdx(prev => new Set([...prev, i]))
    setAddingIdx(prev => { const s = new Set(prev); s.delete(i); return s })
  }

  const addAllToPipeline = async (indices?: Set<number>) => {
    setSavingAll(true)
    const toSave = indices
      ? Array.from(indices).filter(i => !inPipelineIdx.has(i) && savedMap.has(i))
      : Array.from(savedMap.keys()).filter(i => !inPipelineIdx.has(i) && !duplicateIdx.has(i))
    await Promise.all(toSave.map(i => { const p = savedMap.get(i)!; return moveToLeadsPipeline(p.id, business.id) }))
    setInPipelineIdx(prev => new Set([...prev, ...toSave]))
    setSelectedIdx(new Set())
    setSavingAll(false)
    if (toSave.length > 0) {
      setAddedConfirm(true)
      setTimeout(() => setAddedConfirm(false), 2500)
    }
  }

  const nonDuplicateCount = results.filter((_, i) => !duplicateIdx.has(i)).length
  const inPipelineCount   = Array.from(inPipelineIdx).filter(i => !duplicateIdx.has(i)).length

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 40px', scrollbarWidth: 'thin', scrollbarColor: `${DS.muted} transparent`, background: DS.pageBg }}>
      <style>{`
        @keyframes spin    { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .sk { background: linear-gradient(90deg, #F0F7F4 25%, #E1F5EE 50%, #F0F7F4 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 4px; }
        .batch-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        @media (max-width: 860px) { .batch-grid { grid-template-columns: 1fr; } }
        .prospect-card:hover { border-color: #1D9E75 !important; box-shadow: 0 3px 10px rgba(29,158,117,0.10) !important; }
        .prospect-card.selected { border-color: #1D9E75 !important; border-width: 1.5px !important; }
      `}</style>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 9,
          background: DS.inputBg, border: `1.5px solid ${DS.outlineBorder}`,
          borderRadius: 8, padding: '0 13px', height: 38,
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
          onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = DS.primary; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 3px ${DS.primaryGlow}` }}
          onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { (e.currentTarget as HTMLDivElement).style.borderColor = DS.outlineBorder; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' } }}
        >
          <Search size={13} color={DS.muted} style={{ flexShrink: 0 }} />
          <input
            type="text" placeholder="Search for prospects (returns 10 results)..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runSearch(query)}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13.5, color: DS.bodyText, background: 'transparent', fontFamily: 'inherit' }}
          />
        </div>
        <button
          onClick={() => runSearch(query)} disabled={!query.trim() || searching}
          style={{
            padding: '0 18px', borderRadius: 8, border: 'none', height: 38,
            background: query.trim() && !searching ? DS.primary : '#E4E4E7',
            color: 'white', fontSize: 12, fontWeight: 600,
            cursor: query.trim() && !searching ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            boxShadow: query.trim() && !searching ? `0 2px 8px ${DS.primaryGlow}` : 'none',
            transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {searching ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={13} />}
          {searching ? 'Researching…' : 'Find 10 Prospects'}
        </button>
      </div>

      {/* Quick pills */}
      {!results.length && !searching && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ ...sl, marginBottom: 9 }}>Quick Searches</p>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {pills.map(pill => (
              <button key={pill}
                onClick={() => { setQuery(pill); runSearch(pill) }}
                style={{ padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: `1px solid ${DS.outlineBorder}`, background: DS.accentLight, color: DS.outlineText, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = DS.primary; (e.currentTarget as HTMLButtonElement).style.color = DS.primary }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = DS.outlineBorder; (e.currentTarget as HTMLButtonElement).style.color = DS.outlineText }}
              >{pill}</button>
            ))}
          </div>
        </div>
      )}

      {searchErr && (
        <div style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.14)', borderRadius: 9, padding: '11px 14px', marginBottom: 14 }}>
          <p style={{ fontSize: 12.5, color: '#DC2626', fontWeight: 500 }}>⚠ {searchErr}</p>
        </div>
      )}

      {cachedSearch && results.length > 0 && (
        <div style={{ background: DS.accentLight, border: `1px solid ${DS.primary}22`, borderRadius: 8, padding: '8px 13px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <p style={{ fontSize: 12, color: DS.primary, fontWeight: 500 }}>
            🕐 Searched {Math.floor((Date.now() - new Date(cachedSearch.created_at).getTime()) / 86400000)}d ago — showing saved results
          </p>
          <button onClick={() => runSearch(query, true)}
            style={{ fontSize: 11.5, fontWeight: 600, color: DS.primary, background: 'none', border: `1px solid ${DS.primary}`, borderRadius: 5, padding: '2px 9px', cursor: 'pointer', fontFamily: 'inherit' }}>
            Refresh
          </button>
        </div>
      )}

      {/* Summary bar */}
      {results.length > 0 && !searching && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: DS.bodyText, background: DS.accentLight, border: `1px solid ${DS.cardBorder}`, padding: '3px 10px', borderRadius: 20 }}>
              {results.length} found
            </span>
            {duplicateIdx.size > 0 && (
              <span style={{ fontSize: 11.5, color: DS.muted, background: DS.pageBg, border: `1px solid ${DS.cardBorder}`, padding: '3px 10px', borderRadius: 20 }}>
                {duplicateIdx.size} already saved
              </span>
            )}
            {inPipelineCount > 0 && (
              <span style={{ fontSize: 11.5, fontWeight: 600, color: DS.primary, background: DS.accentLight, border: `1px solid ${DS.cardBorder}`, padding: '3px 10px', borderRadius: 20 }}>
                {inPipelineCount} in pipeline
              </span>
            )}
            {selectedIdx.size > 0 && (
              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#0891B2', background: 'rgba(8,145,178,0.10)', border: '1px solid rgba(8,145,178,0.2)', padding: '3px 10px', borderRadius: 20 }}>
                {selectedIdx.size} selected
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            {savingProspects && (
              <span style={{ fontSize: 11, color: DS.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Saving…
              </span>
            )}
            {selectedIdx.size > 0 && (
              <button
                onClick={() => addAllToPipeline(selectedIdx)}
                disabled={savingAll || savingProspects}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7,
                  border: `1.5px solid ${DS.primary}`, background: DS.cardBg,
                  color: DS.primary, fontSize: 12, fontWeight: 600,
                  cursor: savingAll || savingProspects ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', opacity: savingProspects ? 0.5 : 1,
                }}
              >
                {savingAll ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={12} />}
                {savingAll ? 'Adding…' : `Add Selected (${selectedIdx.size})`}
              </button>
            )}
            <button
              onClick={() => addAllToPipeline()}
              disabled={savingAll || savingProspects || inPipelineCount >= nonDuplicateCount}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: 'none',
                background: addedConfirm ? '#059669'
                  : savingAll || savingProspects || inPipelineCount >= nonDuplicateCount ? '#E4E4E7'
                  : DS.primary,
                color: 'white', fontSize: 12, fontWeight: 600,
                cursor: savingAll || savingProspects || inPipelineCount >= nonDuplicateCount ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                boxShadow: savingAll || savingProspects || inPipelineCount >= nonDuplicateCount ? 'none' : `0 2px 8px ${DS.primaryGlow}`,
                transition: 'background 0.2s',
              }}
            >
              {savingAll
                ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
                : addedConfirm
                ? <><Check size={12} /> Added!</>
                : inPipelineCount >= nonDuplicateCount
                ? '✓ All in Pipeline'
                : <><Plus size={12} /> Save All to Pipeline</>
              }
            </button>
          </div>
        </div>
      )}

      {/* Live grid: real cards first, skeletons fill remaining slots during search */}
      {(searching && results.length === 0) && (
        <div className="batch-grid">
          {Array.from({ length: totalExpected }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Results grid (also shown mid-search with trailing skeletons) */}
      {results.length > 0 && (
        <div className="batch-grid">
          {results.map((r, i) => {
            const isDupe    = duplicateIdx.has(i)
            const inPipe    = inPipelineIdx.has(i)
            const isAdding  = addingIdx.has(i)
            const isSelected= selectedIdx.has(i)
            const saved     = savedMap.get(i)
            return (
              <div
                key={i}
                className={`prospect-card${isSelected ? ' selected' : ''}`}
                style={{
                  background:   DS.cardBg,
                  border:       `1px solid ${isDupe ? DS.accentMid : DS.cardBorder}`,
                  borderRadius: 10, overflow: 'hidden',
                  boxShadow:    '0 1px 3px rgba(0,0,0,0.05)',
                  opacity:      isDupe ? 0.65 : 1,
                  transition:   'border-color 0.15s, box-shadow 0.15s',
                }}
              >
                <div style={{ height: 3, background: isDupe ? DS.accentMid : inPipe ? '#059669' : DS.primary }} />
                <div style={{ padding: '13px 14px' }}>

                  {/* Header: checkbox + avatar + company */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 10 }}>
                    {!isDupe && (
                      <input
                        type="checkbox" checked={isSelected}
                        onChange={() => toggleSelect(i)}
                        style={{ width: 14, height: 14, cursor: 'pointer', accentColor: DS.primary, flexShrink: 0, marginTop: 3 }}
                      />
                    )}
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: isDupe ? DS.pageBg : DS.accentLight,
                      color: isDupe ? DS.muted : DS.primary,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                    }}>
                      {getInitials(r.company_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: DS.bodyText, letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.company_name}
                      </p>
                      {(r.contact_name || r.location) && (
                        <p style={{ fontSize: 11, color: DS.secondary, marginTop: 1 }}>
                          {r.contact_name && <><strong style={{ color: DS.secondary }}>{r.contact_name}</strong>{r.contact_title ? ` · ${r.contact_title}` : ''}</>}
                          {r.location && <span style={{ color: DS.muted }}>{r.contact_name ? ' · ' : ''}{r.location}</span>}
                        </p>
                      )}
                      {r.website && (
                        <a href={r.website.startsWith('http') ? r.website : `https://${r.website}`} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 10.5, color: DS.primary, textDecoration: 'none', display: 'inline-block', marginTop: 1 }}>
                          {r.website.replace(/^https?:\/\//, '').split('/')[0]} ↗
                        </a>
                      )}
                    </div>
                    {isDupe ? (
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: DS.muted, background: DS.pageBg, padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>Saved</span>
                    ) : inPipe ? (
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: '#059669', background: 'rgba(5,150,105,0.10)', padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>✓ Pipeline</span>
                    ) : null}
                  </div>

                  {/* Overview */}
                  {r.overview && (
                    <p style={{ fontSize: 11.5, color: DS.secondary, lineHeight: 1.6, marginBottom: 9 }}>{r.overview}</p>
                  )}

                  {/* Pain points */}
                  {r.pain_points && (
                    <div style={{ marginBottom: 8 }}>
                      <p style={sl}>Pain Points</p>
                      <p style={{ fontSize: 11.5, color: DS.secondary, lineHeight: 1.6 }}>{r.pain_points}</p>
                    </div>
                  )}

                  {/* Pitch block with green left border */}
                  {r.pitch_angle && (
                    <div style={{
                      marginBottom: 10,
                      borderLeft: `3px solid ${DS.primary}`,
                      background: DS.accentMid,
                      borderRadius: '0 6px 6px 0',
                      padding: '8px 11px',
                    }}>
                      <p style={sl}>Pitch</p>
                      <p style={{ fontSize: 11.5, color: DS.bodyText, lineHeight: 1.6, fontWeight: 500 }}>{r.pitch_angle}</p>
                    </div>
                  )}

                  {r.email_format && (
                    <p style={{ fontSize: 10.5, color: DS.muted, fontFamily: 'monospace', marginBottom: 10 }}>{r.email_format}</p>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    {r.email_subject && r.email_body && (
                      <button
                        onClick={() => setEmailModal({ subject: r.email_subject, body: r.email_body })}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: `1.5px solid ${DS.outlineBorder}`, background: DS.cardBg, color: DS.outlineText, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        <Mail size={10} /> Draft Email
                      </button>
                    )}
                    {!isDupe && (
                      <button
                        onClick={() => addOneToPipeline(i)}
                        disabled={isAdding || inPipe || !saved}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '5px 10px', borderRadius: 6, border: 'none',
                          background: inPipe ? '#059669' : isAdding || !saved ? '#E4E4E7' : DS.primary,
                          color: 'white', fontSize: 11.5, fontWeight: 600,
                          cursor: isAdding || inPipe || !saved ? 'default' : 'pointer',
                          fontFamily: 'inherit',
                          boxShadow: !inPipe && !isAdding && saved ? `0 1px 6px ${DS.primaryGlow}` : 'none',
                        }}
                      >
                        {inPipe ? <><Check size={10} /> Pipeline</>
                          : isAdding || !saved ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
                            : <><Plus size={10} /> Pipeline</>
                        }
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {/* Trailing skeletons while more results are coming in */}
          {searching && Array.from({ length: Math.max(0, totalExpected - results.length) }).map((_, i) => (
            <SkeletonCard key={`sk-${i}`} />
          ))}
        </div>
      )}

      {emailModal && <EmailModal email={emailModal} onClose={() => setEmailModal(null)} />}
    </div>
  )
}

// ── My Lists Tab ──────────────────────────────────────────────────────────────

function MyListsTab({
  business, prospects, onProspectsAdded,
}: {
  business: Business; prospects: Prospect[]; onProspectsAdded: (ps: Prospect[]) => void
}) {
  const fileRef                     = useRef<HTMLInputElement>(null)
  const [csvRows,     setCsvRows]   = useState<CsvRow[]>([])
  const [importing,   setImporting] = useState(false)
  const [imported,    setImported]  = useState(false)
  const [enriching,   setEnriching] = useState(false)
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0 })
  const [importError, setImportError] = useState('')

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const rows = parseCSV(text)
      if (rows.length === 0) { setImportError('No valid rows found. Expected columns: Company Name, Contact Name, Title, Email, Phone, Notes'); return }
      setCsvRows(rows); setImported(false); setImportError('')
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
    if (result.success) { setImported(true); window.location.reload() }
    else { setImportError(result.error ?? 'Import failed') }
    setImporting(false)
  }

  const listProspects = prospects.filter(p => !p.enriched)

  const enrichAll = async () => {
    if (enriching) return
    const targets = listProspects.slice(0, 20)
    if (!targets.length) return
    setEnriching(true); setEnrichProgress({ current: 0, total: targets.length })

    for (let i = 0; i < targets.length; i++) {
      const p = targets[i]
      try {
        const res = await fetch('/api/prospect/enrich', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prospect: { company_name: p.company_name, contact_name: p.contact_name, contact_title: p.contact_title, email: p.email },
            business: { name: business.name, industry: business.industry, ideal_customer: business.ideal_customer, main_service: business.main_service, city: business.city },
          }),
        })
        const data = await res.json()
        if (data.result) {
          await updateProspect(p.id, {
            company_overview: data.result.company_overview, email_format: data.result.email_format,
            pain_points: data.result.pain_points, pitch_angle: data.result.pitch_angle,
            talking_points: JSON.stringify(data.result.talking_points), enriched: true,
          })
        }
      } catch { /* continue */ }
      setEnrichProgress({ current: i + 1, total: targets.length })
    }
    setEnriching(false); window.location.reload()
  }

  const card: React.CSSProperties = { background: DS.cardBg, border: `1px solid ${DS.cardBorder}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 40px', scrollbarWidth: 'thin', scrollbarColor: `${DS.muted} transparent`, background: DS.pageBg }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Upload area */}
      <div
        onDrop={handleDrop} onDragOver={e => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        style={{ border: `2px dashed ${DS.outlineBorder}`, borderRadius: 10, padding: '24px', textAlign: 'center', cursor: 'pointer', marginBottom: 20, transition: 'all 0.15s', background: DS.cardBg }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = DS.primary; (e.currentTarget as HTMLDivElement).style.background = DS.accentLight }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = DS.outlineBorder; (e.currentTarget as HTMLDivElement).style.background = DS.cardBg }}
      >
        <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        <Upload size={20} color={DS.muted} style={{ margin: '0 auto 9px' }} />
        <p style={{ fontSize: 13.5, fontWeight: 600, color: DS.bodyText, marginBottom: 3 }}>Drop a CSV file or click to upload</p>
        <p style={{ fontSize: 12, color: DS.secondary }}>Columns: Company Name, Contact Name, Title, Email, Phone, Notes</p>
      </div>

      {importError && (
        <div style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.14)', borderRadius: 9, padding: '10px 13px', marginBottom: 14 }}>
          <p style={{ fontSize: 12.5, color: '#DC2626', fontWeight: 500 }}>⚠ {importError}</p>
        </div>
      )}

      {csvRows.length > 0 && !imported && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ padding: '13px 16px', borderBottom: `1px solid ${DS.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: DS.bodyText }}>{csvRows.length} rows ready to import</p>
            <button
              onClick={doImport} disabled={importing}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '7px 16px', borderRadius: 7, border: 'none',
                background: importing ? '#E4E4E7' : DS.primary, color: 'white', fontSize: 12, fontWeight: 600,
                cursor: importing ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                boxShadow: importing ? 'none' : `0 2px 8px ${DS.primaryGlow}`,
              }}
            >
              {importing ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={11} />}
              {importing ? 'Importing…' : `Import All ${csvRows.length} rows`}
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: DS.accentMid }}>
                  {['Company', 'Contact', 'Title', 'Email', 'Phone'].map(h => (
                    <th key={h} style={{ padding: '7px 13px', textAlign: 'left', fontWeight: 700, color: DS.secondary, fontSize: 10.5, letterSpacing: '0.4px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvRows.slice(0, 8).map((row, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${DS.cardBorder}` }}>
                    <td style={{ padding: '8px 13px', color: DS.bodyText, fontWeight: 500, whiteSpace: 'nowrap' }}>{row.company_name}</td>
                    <td style={{ padding: '8px 13px', color: DS.secondary, whiteSpace: 'nowrap' }}>{row.contact_name}</td>
                    <td style={{ padding: '8px 13px', color: DS.secondary, whiteSpace: 'nowrap' }}>{row.contact_title}</td>
                    <td style={{ padding: '8px 13px', color: DS.secondary, whiteSpace: 'nowrap' }}>{row.email}</td>
                    <td style={{ padding: '8px 13px', color: DS.secondary, whiteSpace: 'nowrap' }}>{row.phone}</td>
                  </tr>
                ))}
                {csvRows.length > 8 && (
                  <tr style={{ borderTop: `1px solid ${DS.cardBorder}` }}>
                    <td colSpan={5} style={{ padding: '8px 13px', color: DS.muted, fontSize: 11.5 }}>+{csvRows.length - 8} more rows…</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {listProspects.length > 0 && (
        <div style={card}>
          <div style={{ padding: '13px 16px', borderBottom: `1px solid ${DS.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: DS.bodyText }}>{listProspects.length} prospects need enrichment</p>
              {enriching && <p style={{ fontSize: 11.5, color: DS.primary, fontWeight: 600, marginTop: 2 }}>Enriching {enrichProgress.current} of {enrichProgress.total}…</p>}
            </div>
            <button
              onClick={enrichAll} disabled={enriching}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '7px 16px', borderRadius: 7, border: 'none',
                background: enriching ? '#E4E4E7' : DS.bodyText, color: 'white', fontSize: 12, fontWeight: 600,
                cursor: enriching ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}
            >
              {enriching ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Enriching {enrichProgress.current}/{enrichProgress.total}</> : <><Bot size={11} /> Enrich with AI</>}
            </button>
          </div>
          {listProspects.slice(0, 12).map((p, i) => (
            <div key={p.id} style={{ padding: '10px 16px', borderTop: i > 0 ? `1px solid ${DS.cardBorder}` : undefined, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12.5, fontWeight: 600, color: DS.bodyText }}>{p.company_name}</p>
                {p.contact_name && <p style={{ fontSize: 11.5, color: DS.secondary }}>{p.contact_name}{p.contact_title ? ` · ${p.contact_title}` : ''}</p>}
              </div>
              {p.enriched
                ? <span style={{ fontSize: 9.5, fontWeight: 700, color: DS.primary, background: DS.accentLight, padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>✦ Enriched</span>
                : <span style={{ fontSize: 9.5, fontWeight: 600, color: DS.muted, background: DS.pageBg, padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>Not enriched</span>
              }
            </div>
          ))}
        </div>
      )}

      {listProspects.length === 0 && csvRows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: DS.muted }}>
          <Upload size={26} style={{ margin: '0 auto 9px', opacity: 0.5 }} />
          <p style={{ fontSize: 13.5, fontWeight: 500 }}>Upload a CSV to import prospects in bulk</p>
        </div>
      )}
    </div>
  )
}

// ── Pipeline Tab ──────────────────────────────────────────────────────────────

function PipelineTab({
  business, prospects, onStageChange, onSelect,
}: {
  business: Business; prospects: Prospect[]
  onStageChange: (id: string, stage: ProspectStage) => void
  onSelect: (p: Prospect) => void
}) {
  const router = useRouter()

  const move = async (p: Prospect, dir: 'back' | 'forward') => {
    const idx  = STAGES.indexOf(p.stage)
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
      p.contact_name ? `Contact: ${p.contact_name}, ${p.contact_title}` : '',
      `Stage: ${p.stage}`,
      p.pain_points  ? `Pain points: ${p.pain_points}` : '',
      p.pitch_angle  ? `Pitch angle: ${p.pitch_angle}` : '',
      `\nWhat's my best next move?`,
    ].filter(Boolean).join('\n')
    router.push(`/dashboard/agent?prompt=${encodeURIComponent(prompt)}`)
  }

  const [draftFor,     setDraftFor]     = useState<Prospect | null>(null)
  const [draftEmail,   setDraftEmail]   = useState<DraftEmail | null>(null)
  const [draftLoading, setDraftLoading] = useState(false)

  const draftEmailFor = async (p: Prospect) => {
    setDraftFor(p); setDraftLoading(true)
    const res = await fetch('/api/prospect/draft-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospect: p, business }),
    })
    const data = await res.json()
    if (data.subject) setDraftEmail(data)
    setDraftLoading(false)
  }

  const arrBtn: React.CSSProperties = {
    width: 24, height: 24, borderRadius: 5, border: `1px solid ${DS.cardBorder}`,
    background: DS.inputBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: DS.secondary, flexShrink: 0, transition: 'all 0.15s',
  }

  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 24px 32px', scrollbarWidth: 'thin', scrollbarColor: `${DS.muted} transparent`, background: DS.pageBg }}>
        <style>{`
          .prospect-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 9px; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>

        {STAGES.map(stage => {
          const stageProspects = prospects.filter(p => p.stage === stage)
          const st = STAGE_STYLE[stage]
          return (
            <div key={stage} style={{ marginBottom: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 0' }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: st.color, letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{stage}</span>
                <div style={{ flex: 1, height: 1, background: DS.cardBorder }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: st.color, background: st.bg, border: `1px solid ${DS.cardBorder}`, padding: '1px 8px', borderRadius: 20 }}>
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
                        style={{ background: DS.cardBg, border: `1px solid ${DS.cardBorder}`, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s' }}
                        onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = DS.cardHover; el.style.boxShadow = '0 3px 10px rgba(29,158,117,0.10)'; el.style.transform = 'translateY(-1px)' }}
                        onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = DS.cardBorder; el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; el.style.transform = 'none' }}
                      >
                        <div style={{ height: 3, background: st.color, opacity: 0.6 }} />
                        <div style={{ padding: '11px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 3 }}>
                            <p style={{ fontSize: 12.5, fontWeight: 600, color: DS.bodyText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{p.company_name}</p>
                            {p.enriched && <span style={{ fontSize: 9, fontWeight: 700, color: DS.primary, background: DS.accentLight, padding: '1px 5px', borderRadius: 10, flexShrink: 0 }}>✦</span>}
                          </div>
                          {p.contact_name && (
                            <p style={{ fontSize: 11, color: DS.secondary, marginBottom: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.contact_name}{p.contact_title ? ` · ${p.contact_title}` : ''}
                            </p>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 5 }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => move(p, 'back')} disabled={stageIdx === 0} style={{ ...arrBtn, color: stageIdx === 0 ? DS.muted : DS.secondary, cursor: stageIdx === 0 ? 'not-allowed' : 'pointer' }} aria-label="Move back">
                                <ChevronLeft size={11} />
                              </button>
                              <button onClick={() => move(p, 'forward')} disabled={stageIdx === STAGES.length - 1} style={{ ...arrBtn, color: stageIdx === STAGES.length - 1 ? DS.muted : DS.secondary, cursor: stageIdx === STAGES.length - 1 ? 'not-allowed' : 'pointer' }} aria-label="Move forward">
                                <ChevronRight size={11} />
                              </button>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => draftEmailFor(p)} disabled={draftLoading && draftFor?.id === p.id}
                                style={{ ...arrBtn, gap: 3, padding: '0 7px', width: 'auto', fontSize: 10.5, fontWeight: 600 }}>
                                {draftLoading && draftFor?.id === p.id ? <Loader2 size={9} style={{ animation: 'spin 1s linear infinite' }} /> : <Mail size={9} />}
                                Email
                              </button>
                              <button onClick={() => openCoach(p)} style={{ ...arrBtn, gap: 3, padding: '0 7px', width: 'auto', fontSize: 10.5, fontWeight: 600 }}>
                                <Bot size={9} /> Coach
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ border: `1.5px dashed ${DS.cardBorder}`, borderRadius: 9, padding: '10px 13px', marginBottom: 4 }}>
                  <span style={{ fontSize: 11.5, color: DS.muted }}>No prospects in {stage}</span>
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

// ── Prospects View ────────────────────────────────────────────────────────────

type Tab = 'search' | 'lists' | 'pipeline'

export function ProspectsView({
  business,
  initialProspects,
}: {
  business: Business
  initialProspects: Prospect[]
}) {
  const [activeTab, setActiveTab] = useState<Tab>('search')
  const [prospects, setProspects] = useState<Prospect[]>(initialProspects)
  const [selected,  setSelected]  = useState<Prospect | null>(null)

  const addProspects  = (ps: Prospect[]) => setProspects(prev => [...ps, ...prev])
  const updateLocal   = (p: Prospect)   => setProspects(prev => prev.map(x => x.id === p.id ? p : x))
  const changeStage   = (id: string, stage: ProspectStage) =>
    setProspects(prev => prev.map(p => p.id === id ? { ...p, stage } : p))

  const TABS: { id: Tab; label: string; icon: typeof Search }[] = [
    { id: 'search',   label: 'Prospecting', icon: Search    },
    { id: 'lists',    label: 'My Lists',  icon: Upload    },
    { id: 'pipeline', label: 'Pipeline',  icon: GitBranch },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Page header + tabs */}
      <div style={{
        padding: '16px 24px 0', flexShrink: 0,
        borderBottom: `1px solid ${DS.cardBorder}`,
        background: DS.cardBg,
      }}>
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: DS.muted, letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 2 }}>
            {business.name}
          </p>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: DS.bodyText, letterSpacing: '-0.4px' }}>
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
                  padding: '8px 14px', borderRadius: '7px 7px 0 0',
                  border: 'none', background: active ? DS.pageBg : 'transparent',
                  color: active ? DS.primary : DS.secondary,
                  fontSize: 12.5, fontWeight: active ? 700 : 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  borderBottom: active ? `2px solid ${DS.primary}` : '2px solid transparent',
                  transition: 'all 0.15s', marginBottom: -1,
                }}
              >
                <Icon size={12} />
                {label}
                {id === 'pipeline' && prospects.length > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: active ? DS.primary : DS.muted, background: active ? DS.accentLight : DS.pageBg, padding: '1px 6px', borderRadius: 20 }}>
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
        <AISearchTab business={business} prospects={prospects} onProspectsAdded={addProspects} />
      )}
      {activeTab === 'lists' && (
        <MyListsTab business={business} prospects={prospects} onProspectsAdded={ps => setProspects(prev => [...ps, ...prev])} />
      )}
      {activeTab === 'pipeline' && (
        <PipelineTab business={business} prospects={prospects} onStageChange={changeStage} onSelect={setSelected} />
      )}

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
