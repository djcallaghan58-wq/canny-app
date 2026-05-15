'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  UserPlus, FileText, Clock, CheckCircle,
  AlertTriangle, Bell, Plus, Search, GitBranch,
} from 'lucide-react'
import { getAccent, getGlow } from '@/lib/supabase'
import type { Business, Lead } from '@/lib/supabase'
import type { BriefingData } from '@/app/actions/leads'

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Lead row ────────────────────────────────────────────────────────────────

function LeadRow({
  lead, badgeColor, badgeBg, accent, isLast,
}: {
  lead: Lead
  badgeColor: string
  badgeBg: string
  accent: string
  isLast: boolean
}) {
  const contactTime = lead.last_contacted_at ?? lead.created_at
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 18px',
      borderBottom: isLast ? 'none' : '1px solid rgba(0,0,0,0.045)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: '#09090B', marginBottom: 2 }}>
          {lead.customer_name}
        </div>
        <div style={{ fontSize: 12, color: '#71717A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lead.service_type || 'General service'}
          {lead.value > 0 ? ` · $${Number(lead.value).toLocaleString()}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: badgeColor, background: badgeBg, padding: '2px 8px', borderRadius: 5 }}>
          {timeAgo(contactTime)}
        </span>
        <span style={{ fontSize: 11, fontWeight: 500, color: '#52525B', background: '#F4F4F5', padding: '2px 8px', borderRadius: 5, border: '1px solid rgba(0,0,0,0.06)' }}>
          {lead.stage}
        </span>
        <Link href="/dashboard/pipeline" style={{ fontSize: 12, fontWeight: 600, color: accent, textDecoration: 'none' }}>
          View →
        </Link>
      </div>
    </div>
  )
}

// ─── Briefing view ────────────────────────────────────────────────────────────

export function BriefingView({ business, data }: { business: Business; data: BriefingData }) {
  const [greeting, setGreeting] = useState('Good morning')
  const [dateStr,  setDateStr]  = useState('')

  useEffect(() => {
    setGreeting(getGreeting())
    setDateStr(getDateStr())
  }, [])

  const accent = getAccent(business.trade_type)
  const glow   = getGlow(business.trade_type)

  const stats = [
    { label: 'Leads Today',       value: data.leadsToday,     sub: 'added in last 24h',       icon: UserPlus,    color: accent,    bg: glow },
    { label: 'Quotes Pending',    value: data.quotesPending,  sub: 'awaiting decisions',       icon: FileText,    color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    { label: 'Follow-Ups Due',    value: data.followUpsDue,   sub: 'no contact in 3+ days',    icon: Clock,       color: data.followUpsDue > 0 ? '#DC2626' : '#A1A1AA', bg: data.followUpsDue > 0 ? 'rgba(220,38,38,0.09)' : 'rgba(161,161,170,0.1)' },
    { label: 'Booked This Week',  value: data.bookedThisWeek, sub: 'confirmed jobs',           icon: CheckCircle, color: '#059669', bg: 'rgba(5,150,105,0.12)' },
  ]

  const card: React.CSSProperties = {
    background: '#FFFFFF',
    border: '1px solid rgba(0,0,0,0.07)',
    borderRadius: 14,
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
  }

  return (
    <>
      <style>{`
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        @media (max-width: 900px) { .stat-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .stat-grid { grid-template-columns: 1fr 1fr; } }
        .action-row { display: flex; gap: 10px; flex-wrap: wrap; }
        .action-btn { display: flex; align-items: center; gap: 7px; padding: 10px 18px; border-radius: 9px; font-size: 13.5px; font-weight: 600; text-decoration: none; min-height: 44px; transition: opacity 0.15s, transform 0.15s; font-family: inherit; cursor: pointer; white-space: nowrap; }
        .action-btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .lead-row-wrap { display: flex; align-items: center; gap: 12px; padding: 13px 18px; }
        @media (max-width: 560px) {
          .lead-row-meta { display: none !important; }
        }
      `}</style>

      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.1) transparent' }}>
        <div style={{ padding: '28px 28px 44px', maxWidth: 960, margin: '0 auto' }}>

          {/* ── Header ── */}
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#A1A1AA', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 4 }}>
              {dateStr || 'Daily Briefing'}
            </p>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#09090B', letterSpacing: '-0.6px', lineHeight: 1.15, marginBottom: 4 }}>
              {greeting}, {business.name}
            </h1>
            <p style={{ fontSize: 14, color: '#71717A' }}>
              Here's what needs your attention today.
            </p>
          </div>

          {/* ── Stat cards ── */}
          <div className="stat-grid" style={{ marginBottom: 28 }}>
            {stats.map(({ label, value, sub, icon: Icon, color, bg }) => (
              <div key={label} style={{
                background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)',
                borderRadius: 14, padding: '18px 20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#71717A' }}>{label}</span>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={15} color={color} />
                  </div>
                </div>
                <div style={{ fontSize: 30, fontWeight: 700, color: '#09090B', letterSpacing: '-1.5px', lineHeight: 1 }}>
                  {value}
                </div>
                <div style={{ fontSize: 11.5, color: '#A1A1AA', marginTop: 7 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* ── Urgent section ── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <AlertTriangle size={14} color="#DC2626" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#09090B' }}>
                Urgent — No response in 24+ hours
              </span>
              {data.urgentLeads.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.1)', padding: '1px 7px', borderRadius: 20 }}>
                  {data.urgentLeads.length}
                </span>
              )}
            </div>
            <div style={card}>
              {data.urgentLeads.length === 0 ? (
                <div style={{ padding: '22px', textAlign: 'center', color: '#A1A1AA', fontSize: 13.5 }}>
                  ✓ No urgent leads — you're on top of it!
                </div>
              ) : (
                data.urgentLeads.map((lead, i) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    badgeColor="#DC2626"
                    badgeBg="rgba(220,38,38,0.1)"
                    accent={accent}
                    isLast={i === data.urgentLeads.length - 1}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Attention section ── */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Bell size={14} color="#F59E0B" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#09090B' }}>
                Attention — Quotes with no follow-up in 3+ days
              </span>
              {data.attentionLeads.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.12)', padding: '1px 7px', borderRadius: 20 }}>
                  {data.attentionLeads.length}
                </span>
              )}
            </div>
            <div style={card}>
              {data.attentionLeads.length === 0 ? (
                <div style={{ padding: '22px', textAlign: 'center', color: '#A1A1AA', fontSize: 13.5 }}>
                  ✓ All quotes are being followed up on time.
                </div>
              ) : (
                data.attentionLeads.map((lead, i) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    badgeColor="#F59E0B"
                    badgeBg="rgba(245,158,11,0.12)"
                    accent={accent}
                    isLast={i === data.attentionLeads.length - 1}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Quick actions ── */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#A1A1AA', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 12 }}>
              Quick Actions
            </p>
            <div className="action-row">
              <Link
                href="/dashboard/pipeline"
                className="action-btn"
                style={{ background: accent, color: 'white', border: 'none', boxShadow: `0 2px 10px ${glow}` }}
              >
                <Plus size={15} />
                New Lead
              </Link>
              <Link
                href="/dashboard/prospects"
                className="action-btn"
                style={{ background: '#FFFFFF', color: '#09090B', border: '1.5px solid rgba(0,0,0,0.10)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
              >
                <Search size={15} />
                Find Prospects
              </Link>
              <Link
                href="/dashboard/pipeline"
                className="action-btn"
                style={{ background: '#FFFFFF', color: '#09090B', border: '1.5px solid rgba(0,0,0,0.10)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
              >
                <GitBranch size={15} />
                Open Pipeline
              </Link>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
