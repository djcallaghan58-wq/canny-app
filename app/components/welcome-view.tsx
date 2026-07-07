'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Users, Search as SearchIcon, Mail, ArrowRight, Clock } from 'lucide-react'
import type { Business } from '@/lib/supabase'
import type { WelcomeData } from '@/app/actions/welcome'

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

const STAGE_COLORS: Record<string, string> = {
  'New':         DS.muted,
  'Contacted':   '#F59E0B',
  'Replied':     '#7C3AED',
  'Meeting Set': DS.primary,
  'Proposal':    '#0891B2',
  'Closed Won':  '#16A34A',
  'Closed Lost': '#DC2626',
}

// ── Welcome view ──────────────────────────────────────────────────────────────

export function WelcomeView({
  business,
  data,
}: {
  business: Business
  data: WelcomeData
}) {
  const [greeting, setGreeting] = useState('Good morning')

  useEffect(() => { setGreeting(getGreeting()) }, [])

  const stats = [
    {
      label: 'Active Leads',
      value: data.activeLeads,
      sub:   'in your pipeline',
      icon:  Users,
      color: DS.primary,
      bg:    DS.accentLight,
      href:  '/dashboard/pipeline',
    },
    {
      label: 'Prospects Found',
      value: data.prospectsThisWeek,
      sub:   'this week',
      icon:  SearchIcon,
      color: '#0891B2',
      bg:    'rgba(8,145,178,0.10)',
      href:  '/dashboard/prospects',
    },
    {
      label: 'Emails Drafted',
      value: data.enrichedProspects,
      sub:   'via AI enrichment',
      icon:  Mail,
      color: '#7C3AED',
      bg:    'rgba(124,58,237,0.10)',
      href:  '/dashboard/prospects',
    },
  ]

  return (
    <>
      <style>{`
        .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        @media (max-width: 640px) { .stat-grid { grid-template-columns: 1fr; } }
        .stat-card { transition: box-shadow 0.15s, transform 0.15s; }
        .stat-card:hover { box-shadow: 0 4px 16px rgba(29,158,117,0.12) !important; transform: translateY(-1px); }
      `}</style>

      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: `${DS.muted} transparent`, background: DS.pageBg }}>
        <div style={{ padding: '32px 28px 48px', maxWidth: 860, margin: '0 auto' }}>

          {/* ── Greeting ── */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: DS.bodyText, letterSpacing: '-0.7px', lineHeight: 1.2, marginBottom: 6 }}>
              {greeting},{' '}
              <span style={{ color: DS.primary }}>{business.name}</span>
            </h1>
            <p style={{ fontSize: 14, color: DS.secondary }}>
              Here's a snapshot of your sales activity.
            </p>
          </div>

          {/* ── Stat cards ── */}
          <div className="stat-grid" style={{ marginBottom: 32 }}>
            {stats.map(({ label, value, sub, icon: Icon, color, bg, href }) => (
              <Link key={label} href={href} style={{ textDecoration: 'none' }}>
                <div className="stat-card" style={{
                  background:   DS.cardBg,
                  border:       `1px solid ${DS.cardBorder}`,
                  borderRadius: 12,
                  padding:      '20px 20px 18px',
                  boxShadow:    '0 1px 3px rgba(0,0,0,0.05)',
                  cursor:       'pointer',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: DS.secondary }}>{label}</span>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={14} color={color} />
                    </div>
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: DS.bodyText, letterSpacing: '-2px', lineHeight: 1 }}>
                    {value}
                  </div>
                  <div style={{ fontSize: 11, color: DS.muted, marginTop: 6 }}>{sub}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* ── CTA ── */}
          <div style={{
            background:   `linear-gradient(135deg, ${DS.primary} 0%, #0F6E56 100%)`,
            borderRadius: 14,
            padding:      '24px 28px',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'space-between',
            gap:          16,
            marginBottom: 28,
            boxShadow:    `0 4px 20px ${DS.primaryGlow}`,
          }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'white', letterSpacing: '-0.3px', marginBottom: 4 }}>
                Find your next customers
              </h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
                Use AI to research and discover prospects that match your ideal customer profile.
              </p>
            </div>
            <Link
              href="/dashboard/prospects"
              style={{
                display:        'flex',
                alignItems:     'center',
                gap:            7,
                padding:        '10px 20px',
                borderRadius:   8,
                background:     'white',
                color:          DS.primary,
                fontSize:       13,
                fontWeight:     700,
                textDecoration: 'none',
                whiteSpace:     'nowrap',
                flexShrink:     0,
                boxShadow:      '0 2px 8px rgba(0,0,0,0.12)',
                transition:     'opacity 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.9' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
            >
              Start searching <ArrowRight size={14} />
            </Link>
          </div>

          {/* ── Recent activity ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <Clock size={13} color={DS.muted} />
              <span style={{ fontSize: 11, fontWeight: 700, color: DS.muted, letterSpacing: '0.7px', textTransform: 'uppercase' }}>
                Recent Prospects
              </span>
            </div>

            <div style={{
              background:   DS.cardBg,
              border:       `1px solid ${DS.cardBorder}`,
              borderRadius: 12,
              overflow:     'hidden',
              boxShadow:    '0 1px 3px rgba(0,0,0,0.05)',
            }}>
              {data.recentProspects.length === 0 ? (
                <div style={{ padding: '28px', textAlign: 'center' }}>
                  <p style={{ fontSize: 13.5, color: DS.muted, marginBottom: 12 }}>
                    No prospects yet — search to get started.
                  </p>
                  <Link
                    href="/dashboard/prospects"
                    style={{
                      display:        'inline-flex',
                      alignItems:     'center',
                      gap:            6,
                      padding:        '8px 16px',
                      borderRadius:   7,
                      background:     DS.primary,
                      color:          'white',
                      fontSize:       12,
                      fontWeight:     600,
                      textDecoration: 'none',
                      boxShadow:      `0 2px 8px ${DS.primaryGlow}`,
                    }}
                  >
                    <SearchIcon size={12} /> Find Prospects
                  </Link>
                </div>
              ) : (
                data.recentProspects.map((p, i) => {
                  const stageColor = STAGE_COLORS[p.stage] ?? DS.muted
                  return (
                    <Link
                      key={p.id}
                      href="/dashboard/prospects"
                      style={{
                        display:         'flex',
                        alignItems:      'center',
                        gap:             12,
                        padding:         '12px 18px',
                        borderTop:       i > 0 ? `1px solid ${DS.cardBorder}` : 'none',
                        textDecoration:  'none',
                        transition:      'background 0.1s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = DS.accentMid }}
                      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
                    >
                      {/* Initials circle */}
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: DS.accentLight, color: DS.primary,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700,
                      }}>
                        {p.company_name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: DS.bodyText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.company_name}
                        </div>
                        {p.contact_name && (
                          <div style={{ fontSize: 11.5, color: DS.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.contact_name}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: stageColor,
                          background: `${stageColor}18`,
                          padding: '2px 8px', borderRadius: 20,
                        }}>
                          {p.stage}
                        </span>
                        <span style={{ fontSize: 11, color: DS.muted }}>{timeAgo(p.created_at)}</span>
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
