'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Mail, Bot, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Business, Prospect, ProspectStage } from '@/lib/supabase'
import { updateProspectStage, markProspectOutreachSent } from '@/app/actions/prospects'
import { FollowupsTab } from '@/app/components/followups-tab'
import {
  ProspectDetail, EmailModal, PIPELINE_STAGES, STAGE_STYLE, type DraftEmail,
} from '@/app/components/prospects-view'

// ── Design tokens (matches prospects-view.tsx) ────────────────────────────────
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
}

type Tab = 'pipeline' | 'followups'

// A deal only lands here once a prospect has actually replied - New and
// Contacted prospects live in Prospecting > Outreach instead. This is the
// last mile of the funnel: Replied -> Meeting Set -> Proposal -> Closed.
export function SalesPipelineView({
  business, initialProspects,
}: {
  business: Business
  initialProspects: Prospect[]
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('pipeline')
  const [prospects, setProspects] = useState<Prospect[]>(initialProspects)
  const [selected,  setSelected]  = useState<Prospect | null>(null)

  const changeStage = (id: string, stage: ProspectStage, lastOutreachAt?: string | null) =>
    setProspects(prev => prev.map(p => p.id === id
      ? { ...p, stage, ...(lastOutreachAt !== undefined ? { last_outreach_at: lastOutreachAt } : {}) }
      : p))

  const updateLocal = (p: Prospect) => setProspects(prev => prev.map(x => x.id === p.id ? p : x))

  // Only prospects who've actually replied show up on this board at all.
  const dealProspects = prospects.filter(p => PIPELINE_STAGES.includes(p.stage))

  const openStages: ProspectStage[] = PIPELINE_STAGES.filter(s => s !== 'Closed Won' && s !== 'Closed Lost')
  const openDeals   = dealProspects.filter(p => openStages.includes(p.stage))
  const openValue   = openDeals.reduce((sum, p) => sum + (p.value || 0), 0)
  const won         = dealProspects.filter(p => p.stage === 'Closed Won')
  const wonValue    = won.reduce((sum, p) => sum + (p.value || 0), 0)
  const lost        = dealProspects.filter(p => p.stage === 'Closed Lost')
  const decided     = won.length + lost.length
  const winRate     = decided > 0 ? Math.round((won.length / decided) * 100) : null

  // "Closed Won" is the end of the normal forward flow - "Closed Lost" is a
  // branch you opt into explicitly, not something you nudge into.
  const FORWARD_LIMIT = PIPELINE_STAGES.indexOf('Closed Won')

  const move = async (p: Prospect, dir: 'back' | 'forward') => {
    const idx  = PIPELINE_STAGES.indexOf(p.stage)
    const next = dir === 'forward' ? idx + 1 : idx - 1
    if (next < 0 || next > FORWARD_LIMIT) return
    const newStage = PIPELINE_STAGES[next]
    changeStage(p.id, newStage)
    await updateProspectStage(p.id, newStage)
  }

  const markLost = async (p: Prospect) => {
    changeStage(p.id, 'Closed Lost')
    await updateProspectStage(p.id, 'Closed Lost')
  }

  const openCoach = (p: Prospect) => {
    const prompt = [
      `Help me with this deal:`,
      `Company: ${p.company_name}`,
      p.contact_name ? `Contact: ${p.contact_name}, ${p.contact_title}` : '',
      `Stage: ${p.stage}`,
      p.pain_points ? `Pain points: ${p.pain_points}` : '',
      p.pitch_angle ? `Pitch angle: ${p.pitch_angle}` : '',
      `\nWhat's my best next move to close this?`,
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
    if (data.subject) setDraftEmail({ ...data, email: p.email || p.email_format || '' })
    setDraftLoading(false)
  }

  const arrBtn: React.CSSProperties = {
    width: 24, height: 24, borderRadius: 5, border: `1px solid ${DS.cardBorder}`,
    background: DS.inputBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: DS.secondary, flexShrink: 0, transition: 'all 0.15s',
  }

  const stat = (label: string, value: string) => (
    <div>
      <p style={{ fontSize: 9.5, fontWeight: 700, color: DS.muted, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 700, color: DS.bodyText }}>{value}</p>
    </div>
  )

  return (
    <>
      {/* Page header */}
      <div style={{ padding: '16px 24px 0', flexShrink: 0, borderBottom: `1px solid ${DS.cardBorder}`, background: DS.cardBg }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 10.5, fontWeight: 600, color: DS.muted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 2 }}>
              {business.name}
            </p>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: DS.bodyText, letterSpacing: '-0.4px', marginBottom: 2 }}>Pipeline</h1>
            <p style={{ fontSize: 12.5, color: DS.secondary }}>
              Deals that have replied and are in progress - not raw outreach
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 2 }}>
          {(['pipeline', 'followups'] as const).map(tab => {
            const active = activeTab === tab
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: '7px 7px 0 0',
                border: 'none', background: active ? DS.pageBg : 'transparent',
                color: active ? DS.primary : DS.secondary,
                fontSize: 12.5, fontWeight: active ? 700 : 500,
                cursor: 'pointer', fontFamily: 'inherit',
                borderBottom: active ? `2px solid ${DS.primary}` : '2px solid transparent',
                transition: 'all 0.15s', marginBottom: -1,
              }}>
                {tab === 'pipeline' ? 'Pipeline' : (<><Bell size={11} /> Follow-ups</>)}
              </button>
            )
          })}
        </div>
      </div>

      {activeTab === 'followups' && <FollowupsTab business={business} />}

      {activeTab === 'pipeline' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 24px 32px', scrollbarWidth: 'thin', scrollbarColor: `${DS.muted} transparent`, background: DS.pageBg }}>
          <style>{`
            .deal-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 9px; }
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          `}</style>

          {/* Summary bar */}
          <div style={{ display: 'flex', gap: 24, background: DS.cardBg, border: `1px solid ${DS.cardBorder}`, borderRadius: 10, padding: '12px 18px', marginBottom: 14 }}>
            {stat('Open deals', `${openDeals.length} · $${openValue.toLocaleString()}`)}
            {stat('Closed won', `${won.length} · $${wonValue.toLocaleString()}`)}
            {stat('Win rate', winRate === null ? '—' : `${winRate}%`)}
          </div>

          {dealProspects.length === 0 && (
            <div style={{ border: `2px dashed ${DS.cardBorder}`, borderRadius: 12, padding: '32px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: DS.bodyText, marginBottom: 5 }}>Nothing in your pipeline yet</p>
              <p style={{ fontSize: 12.5, color: DS.secondary }}>
                Prospects show up here once you mark them Replied from Prospecting &gt; Outreach.
              </p>
            </div>
          )}

          {PIPELINE_STAGES.map(stage => {
            const stageDeals = dealProspects.filter(p => p.stage === stage)
            const st = STAGE_STYLE[stage]
            if (dealProspects.length === 0) return null
            return (
              <div key={stage} style={{ marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 0' }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: st.color, letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{stage}</span>
                  <div style={{ flex: 1, height: 1, background: DS.cardBorder }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: st.color, background: st.bg, border: `1px solid ${DS.cardBorder}`, padding: '1px 8px', borderRadius: 20 }}>
                    {stageDeals.length}
                  </span>
                </div>

                {stageDeals.length > 0 ? (
                  <div className="deal-grid" style={{ marginBottom: 4 }}>
                    {stageDeals.map(p => {
                      const stageIdx = PIPELINE_STAGES.indexOf(p.stage)
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelected(p)}
                          style={{ background: DS.cardBg, border: `1px solid ${DS.cardBorder}`, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s' }}
                          onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = DS.cardHover; el.style.boxShadow = '0 3px 10px rgba(29,158,117,0.10)'; el.style.transform = 'translateY(-1px)' }}
                          onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = DS.cardBorder; el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; el.style.transform = 'none' }}
                        >
                          <div style={{ height: 3, background: st.color, opacity: 0.6 }} />
                          <div style={{ padding: '11px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 3 }}>
                              <p style={{ fontSize: 12.5, fontWeight: 600, color: DS.bodyText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{p.company_name}</p>
                              {p.value > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: DS.primary }}>${p.value.toLocaleString()}</span>}
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
                                <button onClick={() => move(p, 'forward')} disabled={stageIdx >= FORWARD_LIMIT} style={{ ...arrBtn, color: stageIdx >= FORWARD_LIMIT ? DS.muted : DS.secondary, cursor: stageIdx >= FORWARD_LIMIT ? 'not-allowed' : 'pointer' }} aria-label="Move forward">
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
                                {stageIdx < FORWARD_LIMIT && (
                                  <button onClick={() => markLost(p)} style={{ ...arrBtn, gap: 3, padding: '0 7px', width: 'auto', fontSize: 10.5, fontWeight: 600, color: '#DC2626' }}>
                                    Lost
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <ProspectDetail
          prospect={selected}
          business={business}
          onClose={() => setSelected(null)}
          onUpdate={p => { updateLocal(p); setSelected(p) }}
        />
      )}

      {draftEmail && (
        <EmailModal
          email={draftEmail}
          businessId={business.id}
          onClose={() => { setDraftEmail(null); setDraftFor(null) }}
          onOpen={() => {
            if (!draftFor) return
            const p = draftFor
            ;(async () => {
              const result = await markProspectOutreachSent(p.id, business.id)
              if (result.stage) changeStage(p.id, result.stage, result.lastOutreachAt)
            })()
          }}
        />
      )}
    </>
  )
}
