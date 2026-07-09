'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Clock, Flame, Sparkles, Mail, Loader2 } from 'lucide-react'
import type { Business, Prospect } from '@/lib/supabase'
import type { DealWithHealth } from '@/types/deals'
import type { BriefingActivity, BriefingData } from '@/app/actions/activities'
import { completeActivity, snoozeActivity } from '@/app/actions/activities'
import { markDealLost, touchDeal } from '@/app/actions/deals'
import { markProspectOutreachSent, dismissProspect } from '@/app/actions/prospects'
import { EmailModal, type DraftEmail } from '@/app/components/prospects-view'

const DS = {
  pageBg:        '#F7F9F8',
  cardBg:        '#FFFFFF',
  cardBorder:    '#E0EBE5',
  bodyText:      '#085041',
  secondary:     '#6B8C7E',
  muted:         '#9FD4C0',
  primary:       '#1D9E75',
  accentLight:   '#E1F5EE',
  inputBg:       '#F7F9F8',
}

type DraftTarget =
  | { kind: 'activity'; item: BriefingActivity }
  | { kind: 'rescue'; deal: DealWithHealth }
  | { kind: 'newProspect'; prospect: Prospect }

// The Daily Briefing - the whole pitch is that every item here resolves in
// two taps: Draft & Send, Snooze 3d, or Not a fit. No charts, no board to
// visit. See app/actions/activities.ts for why this deliberately doesn't
// pre-draft emails via a background cron.
export function BriefingView({ business, initial }: { business: Business; initial: BriefingData }) {
  const router = useRouter()
  const [overdue,      setOverdue]      = useState(initial.overdue)
  const [dueToday,     setDueToday]     = useState(initial.dueToday)
  const [rescue,       setRescue]       = useState(initial.rescue)
  const [newProspects, setNewProspects] = useState(initial.newProspects)

  const [draftTarget, setDraftTarget] = useState<DraftTarget | null>(null)
  const [draftEmail,  setDraftEmail]  = useState<DraftEmail | null>(null)
  const [draftLoading, setDraftLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errorToast, setErrorToast] = useState<string | null>(null)
  const showError = (msg: string) => { setErrorToast(msg); setTimeout(() => setErrorToast(null), 6000) }

  const removeActivity = (id: string) => {
    setOverdue(prev => prev.filter(a => a.id !== id))
    setDueToday(prev => prev.filter(a => a.id !== id))
  }
  const removeDealEverywhere = (dealId: string) => {
    setOverdue(prev => prev.filter(a => a.dealId !== dealId))
    setDueToday(prev => prev.filter(a => a.dealId !== dealId))
    setRescue(prev => prev.filter(d => d.id !== dealId))
  }
  const removeProspect = (id: string) => setNewProspects(prev => prev.filter(p => p.id !== id))

  const draftFor = async (target: DraftTarget) => {
    setDraftTarget(target); setDraftLoading(true)
    let payload: Record<string, unknown>
    let email = ''
    if (target.kind === 'activity') {
      payload = { company_name: target.item.companyName, contact_name: target.item.contactName, stage: target.item.stage, value: target.item.value }
      email = target.item.contactEmail || ''
    } else if (target.kind === 'rescue') {
      payload = { company_name: target.deal.company_name, contact_name: target.deal.contact_name, stage: target.deal.stage, value: target.deal.value }
      email = target.deal.contact_email || ''
    } else {
      payload = { ...target.prospect }
      email = target.prospect.email || target.prospect.email_format || ''
    }
    const res = await fetch('/api/prospect/draft-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospect: payload, business }),
    })
    const data = await res.json()
    if (data.subject) setDraftEmail({ ...data, email })
    setDraftLoading(false)
  }

  const onSent = async () => {
    if (!draftTarget) return
    if (draftTarget.kind === 'activity') {
      await completeActivity(draftTarget.item.id, business.id)
      removeActivity(draftTarget.item.id)
    } else if (draftTarget.kind === 'rescue') {
      await touchDeal(draftTarget.deal.id, business.id)
      setRescue(prev => prev.filter(d => d.id !== draftTarget.deal.id))
    } else {
      const result = await markProspectOutreachSent(draftTarget.prospect.id, business.id)
      if (!result.success) showError(`Couldn't mark ${draftTarget.prospect.company_name} contacted`)
      removeProspect(draftTarget.prospect.id)
    }
  }

  const snooze = async (item: BriefingActivity) => {
    setBusyId(item.id)
    const result = await snoozeActivity(item.id, business.id, 3)
    if (result.success) removeActivity(item.id)
    else showError(`Couldn't snooze ${item.companyName}: ${result.error ?? 'unknown error'}`)
    setBusyId(null)
  }

  const notAFitDeal = async (dealId: string, companyName: string) => {
    setBusyId(dealId)
    const result = await markDealLost(dealId, business.id, 'not_a_fit')
    if (result.success) removeDealEverywhere(dealId)
    else showError(`Couldn't update ${companyName}: ${result.error ?? 'unknown error'}`)
    setBusyId(null)
  }

  const notAFitProspect = async (p: Prospect) => {
    setBusyId(p.id)
    const result = await dismissProspect(p.id, 'not_a_fit')
    if (result.success) removeProspect(p.id)
    else showError(`Couldn't dismiss ${p.company_name}`)
    setBusyId(null)
  }

  const openCoach = (companyName: string, stage: string, contactName?: string | null) => {
    const prompt = `Help me with this deal:\nCompany: ${companyName}\n${contactName ? `Contact: ${contactName}\n` : ''}Stage: ${stage}\n\nWhat's my best next move?`
    router.push(`/dashboard/agent?prompt=${encodeURIComponent(prompt)}`)
  }

  const btn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 4, padding: '6px 11px',
    borderRadius: 6, border: `1px solid ${DS.cardBorder}`, background: DS.inputBg,
    cursor: 'pointer', color: DS.secondary, fontSize: 11, fontWeight: 600,
    fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s',
  }
  const sendBtn: React.CSSProperties = { ...btn, border: `1px solid ${DS.primary}`, color: DS.primary, background: DS.accentLight }
  const lbl = (icon: React.ReactNode, title: string, count: number, color: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      {icon}
      <span style={{ fontSize: 13, fontWeight: 700, color: DS.bodyText }}>{title}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}18`, padding: '1px 8px', borderRadius: 20 }}>{count}</span>
    </div>
  )

  const row = (
    key: string,
    company: string,
    subtitle: string,
    actions: React.ReactNode,
  ) => (
    <div key={key} style={{ background: DS.cardBg, border: `1px solid ${DS.cardBorder}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: DS.bodyText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{company}</p>
        <p style={{ fontSize: 11.5, color: DS.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</p>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>{actions}</div>
    </div>
  )

  const noneOpen = overdue.length === 0 && dueToday.length === 0 && rescue.length === 0 && newProspects.length === 0

  return (
    <>
      <div style={{ padding: '16px 24px', flexShrink: 0, borderBottom: `1px solid ${DS.cardBorder}`, background: DS.cardBg }}>
        <p style={{ fontSize: 10.5, fontWeight: 600, color: DS.muted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 2 }}>{business.name}</p>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: DS.bodyText, letterSpacing: '-0.4px', marginBottom: 6 }}>Today</h1>
        <p style={{ fontSize: 13, color: DS.secondary }}>{initial.summary}</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px 40px', scrollbarWidth: 'thin', scrollbarColor: `${DS.muted} transparent`, background: DS.pageBg }}>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

        {noneOpen && (
          <div style={{ border: `2px dashed ${DS.cardBorder}`, borderRadius: 12, padding: '32px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: DS.bodyText, marginBottom: 5 }}>All clear</p>
            <p style={{ fontSize: 12.5, color: DS.secondary }}>Nothing overdue, nothing cooling off, no new prospects waiting. Check back tomorrow.</p>
          </div>
        )}

        {overdue.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            {lbl(<AlertCircle size={14} color="#DC2626" />, 'Overdue', overdue.length, '#DC2626')}
            {overdue.map(item => row(item.id, item.companyName,
              `${item.contactName ? item.contactName + ' · ' : ''}${item.stage} · due ${new Date(item.dueAt).toLocaleDateString()}`,
              <>
                <button onClick={() => draftFor({ kind: 'activity', item })} disabled={draftLoading && draftTarget?.kind === 'activity' && draftTarget.item.id === item.id} style={sendBtn}>
                  {draftLoading && draftTarget?.kind === 'activity' && draftTarget.item.id === item.id ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Mail size={11} />} Draft &amp; Send
                </button>
                <button onClick={() => snooze(item)} disabled={busyId === item.id} style={btn}>Snooze 3d</button>
                <button onClick={() => notAFitDeal(item.dealId, item.companyName)} disabled={busyId === item.dealId} style={{ ...btn, color: '#DC2626' }}>Not a fit</button>
              </>,
            ))}
          </div>
        )}

        {dueToday.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            {lbl(<Clock size={14} color="#D97706" />, 'Due today', dueToday.length, '#D97706')}
            {dueToday.map(item => row(item.id, item.companyName,
              `${item.contactName ? item.contactName + ' · ' : ''}${item.stage}`,
              <>
                <button onClick={() => draftFor({ kind: 'activity', item })} disabled={draftLoading && draftTarget?.kind === 'activity' && draftTarget.item.id === item.id} style={sendBtn}>
                  {draftLoading && draftTarget?.kind === 'activity' && draftTarget.item.id === item.id ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Mail size={11} />} Draft &amp; Send
                </button>
                <button onClick={() => snooze(item)} disabled={busyId === item.id} style={btn}>Snooze 3d</button>
                <button onClick={() => notAFitDeal(item.dealId, item.companyName)} disabled={busyId === item.dealId} style={{ ...btn, color: '#DC2626' }}>Not a fit</button>
              </>,
            ))}
          </div>
        )}

        {rescue.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            {lbl(<Flame size={14} color="#D97706" />, 'Rescue - going cold', rescue.length, '#D97706')}
            {rescue.map(d => {
              const daysSilent = Math.floor((Date.now() - new Date(d.last_activity_at).getTime()) / 86400000)
              return row(d.id, d.company_name,
                `${d.contact_name ? d.contact_name + ' · ' : ''}${d.stage} · quiet ${daysSilent}d`,
                <>
                  <button onClick={() => draftFor({ kind: 'rescue', deal: d })} disabled={draftLoading && draftTarget?.kind === 'rescue' && draftTarget.deal.id === d.id} style={sendBtn}>
                    {draftLoading && draftTarget?.kind === 'rescue' && draftTarget.deal.id === d.id ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Mail size={11} />} Draft &amp; Send
                  </button>
                  <button onClick={() => openCoach(d.company_name, d.stage, d.contact_name)} style={btn}>Coach</button>
                  <button onClick={() => notAFitDeal(d.id, d.company_name)} disabled={busyId === d.id} style={{ ...btn, color: '#DC2626' }}>Not a fit</button>
                </>,
              )
            })}
          </div>
        )}

        {newProspects.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            {lbl(<Sparkles size={14} color={DS.primary} />, 'New prospects to reach out to', newProspects.length, DS.primary)}
            {newProspects.map(p => row(p.id, p.company_name,
              `${p.contact_name || 'No contact yet'}${p.contact_title ? ' · ' + p.contact_title : ''}`,
              <>
                <button onClick={() => draftFor({ kind: 'newProspect', prospect: p })} disabled={draftLoading && draftTarget?.kind === 'newProspect' && draftTarget.prospect.id === p.id} style={sendBtn}>
                  {draftLoading && draftTarget?.kind === 'newProspect' && draftTarget.prospect.id === p.id ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Mail size={11} />} Draft &amp; Send
                </button>
                <button onClick={() => notAFitProspect(p)} disabled={busyId === p.id} style={{ ...btn, color: '#DC2626' }}>Not a fit</button>
              </>,
            ))}
          </div>
        )}
      </div>

      {errorToast && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, background: '#DC2626', color: '#fff', padding: '10px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', zIndex: 1000, maxWidth: 360 }}>
          {errorToast}
        </div>
      )}

      {draftEmail && (
        <EmailModal
          email={draftEmail}
          businessId={business.id}
          onClose={() => { setDraftEmail(null); setDraftTarget(null) }}
          onOpen={() => { void onSent() }}
        />
      )}
    </>
  )
}
