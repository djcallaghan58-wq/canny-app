'use client'

import { useState, useEffect } from 'react'
import { Mail, Check, Loader2, RotateCcw } from 'lucide-react'
import type { Business } from '@/lib/supabase'
import {
  getFollowupData, markLeadContacted, markProspectContacted,
  type FollowupItem, type ReactivationItem,
} from '@/app/actions/followups'

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
}

const FOLLOW_UP_COLORS: Record<number, { color: string; bg: string; label: string }> = {
  1: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: '1st follow-up' },
  2: { color: '#DC7A00', bg: 'rgba(220,122,0,0.12)',  label: '2nd follow-up' },
  3: { color: '#DC2626', bg: 'rgba(220,38,38,0.10)',  label: '3rd follow-up' },
}

function openGmailCompose(email: string, subject: string, body: string) {
  const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  window.open(url, '_blank')
}

// ── Follow-up card ────────────────────────────────────────────────────────────

function FollowupCard({
  item, business, onMarked,
}: {
  item:      FollowupItem
  business:  Business
  onMarked:  () => void
}) {
  const [drafting,  setDrafting]  = useState(false)
  const [marking,   setMarking]   = useState(false)
  const fu = FOLLOW_UP_COLORS[item.follow_up_number] ?? FOLLOW_UP_COLORS[1]

  const draftEmail = async () => {
    setDrafting(true)
    try {
      const res = await fetch('/api/followup/draft', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          item,
          business: { name: business.name, industry: business.industry, main_service: business.main_service, business_description: business.business_description },
          isReactivation: false,
          followUpNumber: item.follow_up_number,
        }),
      })
      const { subject, body } = await res.json()
      openGmailCompose(item.email ?? '', subject ?? '', body ?? '')
    } catch {}
    setDrafting(false)
  }

  const markContacted = async () => {
    setMarking(true)
    if (item.type === 'lead') await markLeadContacted(item.id)
    else await markProspectContacted(item.id)
    setMarking(false)
    onMarked()
  }

  return (
    <div style={{
      background:   DS.cardBg,
      border:       `1px solid ${DS.cardBorder}`,
      borderRadius: 10,
      padding:      '14px 16px',
      boxShadow:    '0 1px 3px rgba(0,0,0,0.05)',
      transition:   'border-color 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: DS.bodyText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.company_name}
          </div>
          {item.contact_name && (
            <div style={{ fontSize: 11.5, color: DS.secondary, marginTop: 1 }}>{item.contact_name}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: fu.color, background: fu.bg, padding: '2px 8px', borderRadius: 20 }}>
            {fu.label}
          </span>
          <span style={{ fontSize: 10, color: DS.muted, background: DS.pageBg, padding: '2px 8px', borderRadius: 20, border: `1px solid ${DS.cardBorder}` }}>
            {item.stage}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        {item.service_type && (
          <span style={{ fontSize: 11.5, color: DS.secondary }}>{item.service_type}</span>
        )}
        <span style={{ fontSize: 11.5, fontWeight: 600, color: fu.color }}>
          {item.days_overdue}d overdue
        </span>
        {item.email && (
          <span style={{ fontSize: 11, color: DS.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.email}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 7 }}>
        <button
          onClick={draftEmail}
          disabled={drafting}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', borderRadius: 6, border: 'none',
            background: drafting ? '#E4E4E7' : DS.primary,
            color: 'white', fontSize: 12, fontWeight: 600,
            cursor: drafting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            boxShadow: drafting ? 'none' : `0 2px 6px ${DS.primaryGlow}`,
            transition: 'all 0.15s',
          }}
        >
          {drafting
            ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Drafting…</>
            : <><Mail size={11} /> Draft follow-up</>
          }
        </button>
        <button
          onClick={markContacted}
          disabled={marking}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', borderRadius: 6,
            border: `1.5px solid ${DS.outlineBorder}`,
            background: 'white', color: DS.outlineText,
            fontSize: 12, fontWeight: 600,
            cursor: marking ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
        >
          {marking
            ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
            : <Check size={11} />
          }
          Mark contacted
        </button>
      </div>
    </div>
  )
}

// ── Reactivation card ─────────────────────────────────────────────────────────

function ReactivationCard({
  item, business,
}: {
  item:     ReactivationItem
  business: Business
}) {
  const [drafting, setDrafting] = useState(false)

  const draftEmail = async () => {
    setDrafting(true)
    try {
      const res = await fetch('/api/followup/draft', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          item,
          business: { name: business.name, industry: business.industry, main_service: business.main_service, business_description: business.business_description },
          isReactivation: true,
        }),
      })
      const { subject, body } = await res.json()
      openGmailCompose(item.email ?? '', subject ?? '', body ?? '')
    } catch {}
    setDrafting(false)
  }

  return (
    <div style={{
      background:   DS.cardBg,
      border:       `1px solid ${DS.cardBorder}`,
      borderRadius: 10,
      padding:      '14px 16px',
      boxShadow:    '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: DS.bodyText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.company_name}
          </div>
          {item.contact_name && (
            <div style={{ fontSize: 11.5, color: DS.secondary, marginTop: 1 }}>{item.contact_name}</div>
          )}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', background: 'rgba(124,58,237,0.10)', padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>
          Reactivation
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        {item.service_type && (
          <span style={{ fontSize: 11.5, color: DS.secondary }}>{item.service_type}</span>
        )}
        <span style={{ fontSize: 11.5, fontWeight: 600, color: DS.secondary }}>
          {item.days_since_contact}d since last contact
        </span>
      </div>

      <button
        onClick={draftEmail}
        disabled={drafting}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 14px', borderRadius: 6, border: 'none',
          background: drafting ? '#E4E4E7' : '#7C3AED',
          color: 'white', fontSize: 12, fontWeight: 600,
          cursor: drafting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          boxShadow: drafting ? 'none' : '0 2px 6px rgba(124,58,237,0.20)',
          transition: 'all 0.15s',
        }}
      >
        {drafting
          ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Drafting…</>
          : <><RotateCcw size={11} /> Draft reactivation email</>
        }
      </button>
    </div>
  )
}

// ── Follow-ups tab ────────────────────────────────────────────────────────────

export function FollowupsTab({ business }: { business: Business }) {
  const [loading,  setLoading]  = useState(true)
  const [followups,     setFollowups]     = useState<FollowupItem[]>([])
  const [reactivations, setReactivations] = useState<ReactivationItem[]>([])

  const load = async () => {
    setLoading(true)
    const data = await getFollowupData(business.id)
    setFollowups(data.followups)
    setReactivations(data.reactivations)
    setLoading(false)
  }

  useEffect(() => { load() }, [business.id])

  const sched = business.follow_up_schedule ?? { first: 3, second: 7, third: 14 }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 40px', scrollbarWidth: 'thin', scrollbarColor: `${DS.muted} transparent`, background: DS.pageBg }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: DS.muted }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          <p style={{ marginTop: 10, fontSize: 13 }}>Loading follow-ups…</p>
        </div>
      ) : (
        <>
          {/* ── Active follow-ups ── */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: DS.bodyText }}>
                Active Follow-ups
              </span>
              {followups.length > 0 && (
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.12)', padding: '1px 8px', borderRadius: 20 }}>
                  {followups.length}
                </span>
              )}
              <span style={{ fontSize: 11, color: DS.muted, marginLeft: 4 }}>
                Schedule: {sched.first}d / {sched.second}d / {sched.third}d
              </span>
            </div>

            {followups.length === 0 ? (
              <div style={{ background: DS.cardBg, border: `1px solid ${DS.cardBorder}`, borderRadius: 10, padding: '24px', textAlign: 'center' }}>
                <Check size={20} color={DS.primary} style={{ margin: '0 auto 8px' }} />
                <p style={{ fontSize: 13.5, fontWeight: 600, color: DS.bodyText, marginBottom: 3 }}>All caught up!</p>
                <p style={{ fontSize: 12.5, color: DS.secondary }}>No follow-ups are overdue right now.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {followups.map(item => (
                  <FollowupCard key={`${item.type}-${item.id}`} item={item} business={business} onMarked={load} />
                ))}
              </div>
            )}
          </div>

          {/* ── Reactivation section ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ flex: 1, height: 1, background: DS.cardBorder }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: DS.muted, letterSpacing: '0.7px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Reactivation
              </span>
              <div style={{ flex: 1, height: 1, background: DS.cardBorder }} />
            </div>

            <p style={{ fontSize: 12, color: DS.secondary, marginBottom: 14 }}>
              Past customers and closed prospects — {business.reactivation_days ?? 60} days since last contact.
            </p>

            {reactivations.length === 0 ? (
              <div style={{ background: DS.cardBg, border: `1.5px dashed ${DS.cardBorder}`, borderRadius: 10, padding: '20px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: DS.muted }}>No reactivation candidates yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {reactivations.map(item => (
                  <ReactivationCard key={`${item.type}-${item.id}`} item={item} business={business} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
