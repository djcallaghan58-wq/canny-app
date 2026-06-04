'use client'

import Link from 'next/link'
import { Download, TrendingUp, Search, Bell } from 'lucide-react'
import type { Business } from '@/lib/supabase'
import type { ReportsData } from '@/app/actions/reports'

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

const STAGE_ORDER = ['New Lead', 'Quoted', 'Following Up', 'Booked', 'Scheduled', 'Complete']

// ── CSV Export ────────────────────────────────────────────────────────────────

function exportCSV(data: ReportsData, businessName: string) {
  const headers = ['Customer Name', 'Phone', 'Email', 'Service Type', 'Urgency', 'Stage', 'Value', 'Notes', 'Created', 'Last Contacted']
  const rows = data.leads.map(l => [
    l.customer_name,
    l.customer_phone ?? '',
    l.customer_email ?? '',
    l.service_type   ?? '',
    l.urgency        ?? '',
    l.stage          ?? '',
    l.value          ?? 0,
    (l.notes ?? '').replace(/"/g, '""'),
    l.created_at     ? new Date(l.created_at).toLocaleDateString() : '',
    l.last_contacted_at ? new Date(l.last_contacted_at).toLocaleDateString() : '',
  ])

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${businessName.replace(/\s+/g, '_')}_pipeline_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Stat mini card ────────────────────────────────────────────────────────────

function Stat({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, color: DS.secondary, letterSpacing: '0.3px' }}>{label}</span>
      <span style={{ fontSize: 26, fontWeight: 700, color: color ?? DS.bodyText, letterSpacing: '-1.5px', lineHeight: 1 }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: 10.5, color: DS.muted }}>{sub}</span>}
    </div>
  )
}

// ── Section card ──────────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background:   DS.cardBg,
      border:       `1px solid ${DS.cardBorder}`,
      borderRadius: 12,
      overflow:     'hidden',
      boxShadow:    '0 1px 3px rgba(0,0,0,0.05)',
      marginBottom: 16,
    }}>
      <div style={{
        padding: '14px 20px',
        borderBottom: `1px solid ${DS.cardBorder}`,
        display: 'flex', alignItems: 'center', gap: 8,
        background: DS.accentMid,
      }}>
        <Icon size={14} color={DS.primary} />
        <span style={{ fontSize: 13, fontWeight: 700, color: DS.bodyText }}>{title}</span>
      </div>
      <div style={{ padding: '20px' }}>
        {children}
      </div>
    </div>
  )
}

// ── Reports view ──────────────────────────────────────────���───────────────────

export function ReportsView({ business, data }: { business: Business; data: ReportsData }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: `${DS.muted} transparent`, background: DS.pageBg }}>

      {/* Header */}
      <div style={{
        padding: '16px 24px 14px', flexShrink: 0,
        borderBottom: `1px solid ${DS.cardBorder}`,
        background: DS.cardBg,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, color: DS.muted, letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 1 }}>
            {business.name}
          </p>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: DS.bodyText, letterSpacing: '-0.4px' }}>
            Reports
          </h1>
        </div>
        <button
          onClick={() => exportCSV(data, business.name)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 6,
            border: `1.5px solid ${DS.outlineBorder}`,
            background: DS.cardBg, color: DS.outlineText,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = DS.accentMid }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = DS.cardBg }}
        >
          <Download size={13} /> Export CSV
        </button>
      </div>

      <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>

        {/* ── Section 1: Pipeline Summary ── */}
        <Section icon={TrendingUp} title="Pipeline Summary">
          {/* Stage breakdown */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 10.5, fontWeight: 700, color: DS.muted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 12 }}>
              Leads by Stage
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {STAGE_ORDER.map(stage => {
                const count = data.leadsByStage[stage] ?? 0
                return (
                  <div key={stage} style={{
                    background: count > 0 ? DS.accentLight : DS.pageBg,
                    border: `1px solid ${DS.cardBorder}`,
                    borderRadius: 8, padding: '8px 14px',
                    minWidth: 100, textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: count > 0 ? DS.primary : DS.muted, letterSpacing: '-1px', lineHeight: 1, marginBottom: 3 }}>
                      {count}
                    </div>
                    <div style={{ fontSize: 10.5, color: DS.secondary, fontWeight: 500 }}>{stage}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            <Stat label="Active Pipeline Value" value={`$${data.totalValue.toLocaleString()}`} color={DS.primary} />
            <Stat label="Total Leads" value={data.leads.length} />
            <Stat label="Avg Days to Close" value={data.avgDaysToClose > 0 ? `${data.avgDaysToClose}d` : '—'} sub="for completed jobs" />
          </div>
        </Section>

        {/* ── Section 2: Prospecting Activity ── */}
        <Section icon={Search} title="Prospecting Activity">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 24 }}>
            <Stat label="Total Prospects" value={data.totalProspects} />
            <Stat label="Found Last 30 Days" value={data.prospectsLast30d} color={DS.primary} />
            <Stat label="Emails Drafted" value={data.enrichedCount} />
            <Stat label="Added to Pipeline" value={data.inPipelineCount} />
          </div>

          {data.recentSearches.length > 0 && (
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: DS.muted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 10 }}>
                Recent Searches
              </p>
              <div style={{ border: `1px solid ${DS.cardBorder}`, borderRadius: 8, overflow: 'hidden' }}>
                {data.recentSearches.map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 13px',
                    borderTop: i > 0 ? `1px solid ${DS.cardBorder}` : 'none',
                    gap: 12,
                  }}>
                    <span style={{ fontSize: 12.5, color: DS.bodyText, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.query}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: DS.primary, background: DS.accentLight, padding: '1px 8px', borderRadius: 20, flexShrink: 0 }}>
                      {s.results_count} results
                    </span>
                    <span style={{ fontSize: 11, color: DS.muted, flexShrink: 0 }}>
                      {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* ── Section 3: Follow-up Performance ── */}
        <Section icon={Bell} title="Follow-up Performance">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 20 }}>
            <Stat
              label="Overdue Follow-ups"
              value={data.overdueCount}
              color={data.overdueCount > 0 ? '#F59E0B' : DS.primary}
              sub="leads needing contact"
            />
            <Stat
              label="Stale Leads"
              value={data.staleCount}
              color={data.staleCount > 0 ? '#DC2626' : DS.primary}
              sub="no contact in 14+ days"
            />
            <Stat
              label="Avg Response Time"
              value={data.avgResponseDays > 0 ? `${data.avgResponseDays}d` : '—'}
              sub="days to first contact"
            />
          </div>

          {data.overdueCount > 0 && (
            <Link
              href="/dashboard/pipeline"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 6,
                background: DS.primary, color: 'white',
                fontSize: 12, fontWeight: 600, textDecoration: 'none',
                boxShadow: `0 2px 8px ${DS.primaryGlow}`,
              }}
            >
              <Bell size={12} /> View Follow-ups
            </Link>
          )}
        </Section>

      </div>
    </div>
  )
}
