'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Mail, Bot, Loader2, ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { Business, Prospect } from '@/lib/supabase'
import type { Deal, DealStage } from '@/types/deals'
import { touchDeal, updateDealStage, markDealLost, updateDeal } from '@/app/actions/deals'
import { FollowupsTab } from '@/app/components/followups-tab'
import { EmailModal, PIPELINE_STAGES, STAGE_STYLE, type DraftEmail } from '@/app/components/prospects-view'

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
// Contacted prospects live in Prospecting > Outreach instead. This board
// reads and writes the deals table exclusively; prospects are only looked
// up (via deal.prospect_id) for read-only research context - pain points,
// pitch angle - when drafting an email or opening detail.
export function SalesPipelineView({
  business, initialDeals, initialProspects,
}: {
  business: Business
  initialDeals: Deal[]
  initialProspects: Prospect[]
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('pipeline')
  const [deals,    setDeals]    = useState<Deal[]>(initialDeals)
  const [selected, setSelected] = useState<Deal | null>(null)

  const prospectsById = new Map(initialProspects.map(p => [p.id, p]))
  const researchFor = (d: Deal): Prospect | null => (d.prospect_id && prospectsById.get(d.prospect_id)) || null

  const patchDeal = (id: string, patch: Partial<Deal>) =>
    setDeals(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d))

  const openStages: DealStage[] = PIPELINE_STAGES.filter(s => s !== 'Closed Won' && s !== 'Closed Lost')
  const openDeals   = deals.filter(d => openStages.includes(d.stage))
  const openValue   = openDeals.reduce((sum, d) => sum + (d.value || 0), 0)
  const won         = deals.filter(d => d.stage === 'Closed Won')
  const wonValue    = won.reduce((sum, d) => sum + (d.value || 0), 0)
  const lost        = deals.filter(d => d.stage === 'Closed Lost')
  const decided     = won.length + lost.length
  const winRate     = decided > 0 ? Math.round((won.length / decided) * 100) : null

  // "Closed Won" is the end of the normal forward flow - "Closed Lost" is a
  // branch you opt into explicitly, not something you nudge into.
  const FORWARD_LIMIT = PIPELINE_STAGES.indexOf('Closed Won')

  const [savingId, setSavingId] = useState<string | null>(null)
  const [errorToast, setErrorToast] = useState<string | null>(null)
  const showError = (msg: string) => { setErrorToast(msg); setTimeout(() => setErrorToast(null), 6000) }

  const move = async (d: Deal, dir: 'back' | 'forward') => {
    const idx  = PIPELINE_STAGES.indexOf(d.stage)
    const next = dir === 'forward' ? idx + 1 : idx - 1
    if (next < 0 || next > FORWARD_LIMIT) return
    const newStage = PIPELINE_STAGES[next]
    setSavingId(d.id)
    const result = await updateDealStage(d.id, business.id, newStage)
    if (result.success && result.deal) patchDeal(d.id, result.deal)
    else showError(`Couldn't update ${d.company_name}: ${result.error ?? 'unknown error'}`)
    setSavingId(null)
  }

  const markLost = async (d: Deal) => {
    setSavingId(d.id)
    const result = await markDealLost(d.id, business.id)
    if (result.success && result.deal) patchDeal(d.id, result.deal)
    else showError(`Couldn't mark ${d.company_name} lost: ${result.error ?? 'unknown error'}`)
    setSavingId(null)
  }

  const openCoach = (d: Deal) => {
    const p = researchFor(d)
    const prompt = [
      `Help me with this deal:`,
      `Company: ${d.company_name}`,
      d.contact_name ? `Contact: ${d.contact_name}` : '',
      `Stage: ${d.stage}`,
      p?.pain_points ? `Pain points: ${p.pain_points}` : '',
      p?.pitch_angle ? `Pitch angle: ${p.pitch_angle}` : '',
      `\nWhat's my best next move to close this?`,
    ].filter(Boolean).join('\n')
    router.push(`/dashboard/agent?prompt=${encodeURIComponent(prompt)}`)
  }

  const [draftFor,     setDraftFor]     = useState<Deal | null>(null)
  const [draftEmail,   setDraftEmail]   = useState<DraftEmail | null>(null)
  const [draftLoading, setDraftLoading] = useState(false)

  const draftEmailFor = async (d: Deal) => {
    setDraftFor(d); setDraftLoading(true)
    const p = researchFor(d)
    const payload = {
      ...(p ?? {}),
      company_name: d.company_name,
      contact_name: d.contact_name ?? p?.contact_name ?? '',
      email:        d.contact_email ?? p?.email ?? '',
      stage:        d.stage,
      value:        d.value ?? 0,
    }
    const res = await fetch('/api/prospect/draft-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospect: payload, business }),
    })
    const data = await res.json()
    if (data.subject) setDraftEmail({ ...data, email: d.contact_email || p?.email || p?.email_format || '' })
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

          {deals.length === 0 && (
            <div style={{ border: `2px dashed ${DS.cardBorder}`, borderRadius: 12, padding: '32px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: DS.bodyText, marginBottom: 5 }}>Nothing in your pipeline yet</p>
              <p style={{ fontSize: 12.5, color: DS.secondary }}>
                Prospects show up here once you mark them Replied from Prospecting &gt; Outreach.
              </p>
            </div>
          )}

          {PIPELINE_STAGES.map(stage => {
            const stageDeals = deals.filter(d => d.stage === stage)
            const st = STAGE_STYLE[stage]
            if (deals.length === 0) return null
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
                    {stageDeals.map(d => {
                      const stageIdx = PIPELINE_STAGES.indexOf(d.stage)
                      const p = researchFor(d)
                      return (
                        <div
                          key={d.id}
                          onClick={() => setSelected(d)}
                          style={{ background: DS.cardBg, border: `1px solid ${DS.cardBorder}`, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s' }}
                          onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = DS.cardHover; el.style.boxShadow = '0 3px 10px rgba(29,158,117,0.10)'; el.style.transform = 'translateY(-1px)' }}
                          onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = DS.cardBorder; el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; el.style.transform = 'none' }}
                        >
                          <div style={{ height: 3, background: st.color, opacity: 0.6 }} />
                          <div style={{ padding: '11px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 3 }}>
                              <p style={{ fontSize: 12.5, fontWeight: 600, color: DS.bodyText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{d.company_name}</p>
                              {!!d.value && d.value > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: DS.primary }}>${d.value.toLocaleString()}</span>}
                            </div>
                            {d.contact_name && (
                              <p style={{ fontSize: 11, color: DS.secondary, marginBottom: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {d.contact_name}{p?.contact_title ? ` · ${p.contact_title}` : ''}
                              </p>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 5 }} onClick={e => e.stopPropagation()}>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button onClick={() => move(d, 'back')} disabled={stageIdx === 0 || savingId === d.id} style={{ ...arrBtn, color: stageIdx === 0 ? DS.muted : DS.secondary, cursor: stageIdx === 0 ? 'not-allowed' : 'pointer' }} aria-label="Move back">
                                  <ChevronLeft size={11} />
                                </button>
                                <button onClick={() => move(d, 'forward')} disabled={stageIdx >= FORWARD_LIMIT || savingId === d.id} style={{ ...arrBtn, color: stageIdx >= FORWARD_LIMIT ? DS.muted : DS.secondary, cursor: stageIdx >= FORWARD_LIMIT ? 'not-allowed' : 'pointer' }} aria-label="Move forward">
                                  <ChevronRight size={11} />
                                </button>
                              </div>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button onClick={() => draftEmailFor(d)} disabled={draftLoading && draftFor?.id === d.id}
                                  style={{ ...arrBtn, gap: 3, padding: '0 7px', width: 'auto', fontSize: 10.5, fontWeight: 600 }}>
                                  {draftLoading && draftFor?.id === d.id ? <Loader2 size={9} style={{ animation: 'spin 1s linear infinite' }} /> : <Mail size={9} />}
                                  Email
                                </button>
                                <button onClick={() => openCoach(d)} style={{ ...arrBtn, gap: 3, padding: '0 7px', width: 'auto', fontSize: 10.5, fontWeight: 600 }}>
                                  <Bot size={9} /> Coach
                                </button>
                                {stageIdx < FORWARD_LIMIT && (
                                  <button onClick={() => markLost(d)} disabled={savingId === d.id} style={{ ...arrBtn, gap: 3, padding: '0 7px', width: 'auto', fontSize: 10.5, fontWeight: 600, color: '#DC2626' }}>
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

      {errorToast && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, background: '#DC2626', color: '#fff', padding: '10px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', zIndex: 1000, maxWidth: 360 }}>
          {errorToast}
        </div>
      )}

      {selected && (
        <DealDetail
          deal={selected}
          research={researchFor(selected)}
          onClose={() => setSelected(null)}
          onSave={async (patch) => {
            const result = await updateDeal(selected.id, business.id, patch)
            if (result.success && result.deal) {
              patchDeal(selected.id, result.deal)
              setSelected(result.deal)
            }
            return result.success
          }}
        />
      )}

      {draftEmail && (
        <EmailModal
          email={draftEmail}
          businessId={business.id}
          onClose={() => { setDraftEmail(null); setDraftFor(null) }}
          onOpen={() => {
            if (!draftFor) return
            void touchDeal(draftFor.id, business.id)
          }}
        />
      )}
    </>
  )
}

// Lightweight deal detail panel - value editing writes to the deal, research
// context (pain points, pitch angle, notes) is read-only from the linked
// prospect since that's where it was researched.
function DealDetail({
  deal, research, onClose, onSave,
}: {
  deal: Deal
  research: Prospect | null
  onClose: () => void
  onSave: (patch: Partial<Pick<Deal, 'value' | 'contact_name' | 'contact_email' | 'contact_phone'>>) => Promise<boolean>
}) {
  const [value, setValue] = useState(deal.value ?? 0)
  const [saving, setSaving] = useState(false)
  const st = STAGE_STYLE[deal.stage]

  const saveValue = async () => {
    setSaving(true)
    await onSave({ value })
    setSaving(false)
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

        <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid ${DS.cardBorder}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 15.5, fontWeight: 700, color: DS.bodyText, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {deal.company_name}
              </p>
              <span style={{ fontSize: 10, fontWeight: 700, color: st.color, background: st.bg, padding: '2px 9px', borderRadius: 20 }}>
                {deal.stage}
              </span>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: DS.muted, padding: 3, display: 'flex' }}>
              <X size={17} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', scrollbarWidth: 'thin', scrollbarColor: `${DS.muted} transparent` }}>
          <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
            <div style={{ flex: 1 }}>
              <p style={lbl}>Deal Value {saving && <Loader2 size={9} style={{ animation: 'spin 1s linear infinite', display: 'inline', marginLeft: 4 }} />}</p>
              <input
                type="number"
                value={value}
                onChange={e => setValue(Number(e.target.value))}
                onBlur={saveValue}
                placeholder="0"
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 7,
                  border: `1.5px solid ${DS.outlineBorder}`, background: DS.inputBg,
                  fontSize: 13, color: DS.bodyText, fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <p style={lbl}>Contact</p>
              <p style={{ fontSize: 13, color: deal.contact_name ? DS.bodyText : DS.muted, padding: '6px 0' }}>
                {deal.contact_name || 'No contact on file'}{research?.contact_title ? ` · ${research.contact_title}` : ''}
              </p>
            </div>
          </div>

          {deal.contact_email && (
            <div style={{ marginBottom: 18 }}>
              <p style={lbl}>Email</p>
              <p style={{ fontSize: 13, color: DS.bodyText }}>{deal.contact_email}</p>
            </div>
          )}

          {research && (research.pain_points || research.pitch_angle || research.company_overview) && (
            <div style={{ marginBottom: 18 }}>
              <p style={lbl}>Research (from prospecting)</p>
              {research.company_overview && (
                <p style={{ fontSize: 12.5, color: DS.secondary, marginBottom: 8, lineHeight: 1.5 }}>{research.company_overview}</p>
              )}
              {research.pain_points && (
                <p style={{ fontSize: 12.5, color: DS.bodyText, marginBottom: 6, lineHeight: 1.5 }}><strong>Pain points:</strong> {research.pain_points}</p>
              )}
              {research.pitch_angle && (
                <p style={{ fontSize: 12.5, color: DS.bodyText, lineHeight: 1.5 }}><strong>Pitch angle:</strong> {research.pitch_angle}</p>
              )}
            </div>
          )}

          {deal.loss_reason && (
            <div style={{ marginBottom: 18 }}>
              <p style={lbl}>Loss reason</p>
              <p style={{ fontSize: 13, color: DS.bodyText }}>{deal.loss_reason}</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
