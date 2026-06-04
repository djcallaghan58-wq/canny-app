'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  UserPlus, FileText, Clock, CheckCircle,
  AlertTriangle, Bell, Plus, Search, GitBranch,
} from 'lucide-react'
import type { Business, Lead } from '@/lib/supabase'
import type { BriefingData } from '@/app/actions/leads'

// ── Design tokens ─────────────────────────────────────────────────────────────
const DS = {
  pageBg:      '#F7F9F8',
  cardBg:      '#FFFFFF',
  cardBorder:  '#E0EBE5',
  bodyText:    '#085041',
  secondary:   '#6B8C7E',
  muted:       '#9FD4C0',
  primary:     '#1D9E75',
  primaryGlow: 'rgba(29,158,117,0.15)',
  accentLight: '#E1F5EE',
  accentMid:   '#F0F7F4',
  outlineBorder:'#C2D6CC',
  outlineText: '#4A7A6A',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function getDateStr(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

// ── Lead row ──────────────────────────────────────────────────────────────────

function LeadRow({
  lead, badgeColor, badgeBg, isLast,
}: {
  lead: Lead
  badgeColor: string
  badgeBg: string
  isLast: boolean
}) {
  const contactTime = lead.last_contacted_at ?? lead.created_at
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 18px',
      borderBottom: isLast ? 'none' : `1px solid ${DS.cardBorder}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: DS.bodyText, marginBottom: 2 }}>
          {lead.customer_name}
        </div>
        <div style={{ fontSize: 12, color: DS.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lead.service_type || 'General service'}
          {lead.value > 0 ? ` · $${Number(lead.value).toLocaleString()}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }} className="lead-row-meta">
        <span style={{ fontSize: 11, fontWeight: 600, color: badgeColor, background: badgeBg, padding: '2px 8px', borderRadius: 5 }}>
          {timeAgo(contactTime)}
        </span>
        <span style={{ fontSize: 11, fontWeight: 500, color: DS.secondary, background: DS.accentMid, padding: '2px 8px', borderRadius: 5, border: `1px solid ${DS.cardBorder}` }}>
          {lead.stage}
        </span>
        <Link href="/dashboard/pipeline" style={{ fontSize: 12, fontWeight: 600, color: DS.primary, textDecoration: 'none' }}>
          View →
        </Link>
      </div>
    </div>
  )
}

// ── Briefing view ─────────────────────────────────────────────────────────────

export function BriefingView({ business, data }: { business: Business; data: BriefingData }) {
  const [greeting, setGreeting] = useState('Good morning')
  const [dateStr,  setDateStr]  = useState('')

  useEffect(() => {
    setGreeting(getGreeting())
    setDateStr(getDateStr())
  }, [])

  const stats = [
    {
      label: 'Leads Today',
      value: data.leadsToday,
      sub:   'added in last 24h',
      icon:  UserPlus,
      color: DS.primary,
      bg:    DS.accentLight,
    },
    {
      label: 'Quotes Pending',
      value: data.quotesPending,
      sub:   'awaiting decisions',
      icon:  FileText,
      color: '#F59E0B',
      bg:    'rgba(245,158,11,0.12)',
    },
    {
      label: 'Follow-Ups Due',
      value: data.followUpsDue,
      sub:   'no contact in 3+ days',
      icon:  Clock,
      color: data.followUpsDue > 0 ? '#DC2626' : DS.muted,
      bg:    data.followUpsDue > 0 ? 'rgba(220,38,38,0.09)' : DS.accentMid,
    },
    {
      label: 'Booked This Week',
      value: data.bookedThisWeek,
      sub:   'confirmed jobs',
      icon:  CheckCircle,
      color: DS.primary,
      bg:    DS.accentLight,
    },
  ]

  const card: React.CSSProperties = {
    background:   DS.cardBg,
    border:       `1px solid ${DS.cardBorder}`,
    borderRadius: 10,
    overflow:     'hidden',
    boxShadow:    '0 1px 3px rgba(0,0,0,0.05)',
  }

  return (
    <>
      <style>{`
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        @media (max-width: 900px) { .stat-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .stat-grid { grid-template-columns: 1fr 1fr; } }
        .action-row { display: flex; gap: 10px; flex-wrap: wrap; }
        .action-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 9px 18px; border-radius: 6px;
          font-size: 12px; font-weight: 600; text-decoration: none;
          min-height: 36px; transition: opacity 0.15s, transform 0.15s;
          font-family: inherit; cursor: pointer; white-space: nowrap; border: none;
        }
        .action-btn:hover { opacity: 0.88; transform: translateY(-1px); }
        @media (max-width: 560px) { .lead-row-meta { display: none !important; } }
      `}</style>

      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: `${DS.muted} transparent`, background: DS.pageBg }}>
        <div style={{ padding: '28px 28px 44px', maxWidth: 960, margin: '0 auto' }}>

          {/* ── Header ── */}
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 10.5, fontWeight: 600, color: DS.muted, letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 4 }}>
              {dateStr || 'Daily Briefing'}
            </p>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: DS.bodyText, letterSpacing: '-0.6px', lineHeight: 1.15, marginBottom: 4 }}>
              {greeting}, {business.name}
            </h1>
            <p style={{ fontSize: 14, color: DS.secondary }}>
              Here's what needs your attention today.
            </p>
          </div>

          {/* ── Stat cards ── */}
          <div className="stat-grid" style={{ marginBottom: 28 }}>
            {stats.map(({ label, value, sub, icon: Icon, color, bg }) => (
              <div key={label} style={{
                background:   DS.cardBg,
                border:       `1px solid ${DS.cardBorder}`,
                borderRadius: 10,
                padding:      '16px 18px',
                boxShadow:    '0 1px 3px rgba(0,0,0,0.05)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: DS.secondary }}>{label}</span>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={14} color={color} />
                  </div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: DS.bodyText, letterSpacing: '-1.5px', lineHeight: 1 }}>
                  {value}
                </div>
                <div style={{ fontSize: 11, color: DS.muted, marginTop: 6 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* ── Urgent section ── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <AlertTriangle size={13} color="#DC2626" />
              <span style={{ fontSize: 13, fontWeight: 700, color: DS.bodyText }}>
                Urgent — No response in 24+ hours
              </span>
              {data.urgentLeads.length > 0 && (
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.1)', padding: '1px 7px', borderRadius: 20 }}>
                  {data.urgentLeads.length}
                </span>
              )}
            </div>
            <div style={card}>
              {data.urgentLeads.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: DS.muted, fontSize: 13.5 }}>
                  ✓ No urgent leads — you're on top of it!
                </div>
              ) : (
                data.urgentLeads.map((lead, i) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    badgeColor="#DC2626"
                    badgeBg="rgba(220,38,38,0.1)"
                    isLast={i === data.urgentLeads.length - 1}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Attention section ── */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Bell size={13} color="#F59E0B" />
              <span style={{ fontSize: 13, fontWeight: 700, color: DS.bodyText }}>
                Attention — Quotes with no follow-up in 3+ days
              </span>
              {data.attentionLeads.length > 0 && (
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.12)', padding: '1px 7px', borderRadius: 20 }}>
                  {data.attentionLeads.length}
                </span>
              )}
            </div>
            <div style={card}>
              {data.attentionLeads.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: DS.muted, fontSize: 13.5 }}>
                  ✓ All quotes are being followed up on time.
                </div>
              ) : (
                data.attentionLeads.map((lead, i) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    badgeColor="#F59E0B"
                    badgeBg="rgba(245,158,11,0.12)"
                    isLast={i === data.attentionLeads.length - 1}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Quick actions ── */}
          <div>
            <p style={{ fontSize: 10.5, fontWeight: 600, color: DS.muted, letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 12 }}>
              Quick Actions
            </p>
            <div className="action-row">
              <Link
                href="/dashboard/pipeline"
                className="action-btn"
                style={{ background: DS.primary, color: 'white', boxShadow: `0 2px 10px ${DS.primaryGlow}` }}
              >
                <Plus size={14} />
                New Lead
              </Link>
              <Link
                href="/dashboard/prospects"
                className="action-btn"
                style={{ background: DS.cardBg, color: DS.outlineText, border: `1.5px solid ${DS.outlineBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                <Search size={14} />
                Find Prospects
              </Link>
              <Link
                href="/dashboard/pipeline"
                className="action-btn"
                style={{ background: DS.cardBg, color: DS.outlineText, border: `1.5px solid ${DS.outlineBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                <GitBranch size={14} />
                Open Pipeline
              </Link>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
