'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import {
  LayoutDashboard, Search, GitBranch, List, FileText, Bot, Settings, Menu, X,
} from 'lucide-react'
import type { Business } from '@/lib/supabase'

// ── Design tokens ─────────────────────────────────────────────────────────────
const DS = {
  headerBg:        '#0F6E56',
  pageBg:          '#F7F9F8',
  sidebarBg:       '#FFFFFF',
  sidebarBorder:   '#E0EBE5',
  activeNavBg:     '#FFFFFF',
  activeNavBorder: '#1D9E75',
  activeNavText:   '#0F6E56',
  navText:         '#4A7A6A',
  navIcon:         '#9FD4C0',
  bodyText:        '#085041',
  secondary:       '#6B8C7E',
  muted:           '#9FD4C0',
  accentLight:     '#E1F5EE',
  accentMid:       '#F0F7F4',
}

// ── Nav config ────────────────────────────────────────────────────────────────

type NavEntry = { href: string; label: string; icon: React.ElementType }

const NAV_MAIN: NavEntry[] = [
  { href: '/dashboard',           label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/dashboard/prospects', label: 'AI Search',     icon: Search    },
  { href: '/dashboard/pipeline',  label: 'Pipeline',      icon: GitBranch },
  { href: '/dashboard/prospects', label: 'My Lists',      icon: List      },
]

const NAV_TOOLS: NavEntry[] = [
  { href: '/dashboard/pipeline',  label: 'Quote Builder', icon: FileText  },
  { href: '/dashboard/agent',     label: 'AI Assistant',  icon: Bot       },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function DashboardShell({
  business,
  children,
}: {
  business: Business
  children: React.ReactNode
}) {
  const pathname     = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const renderNavItem = ({ href, label, icon: Icon }: NavEntry, key: string) => {
    const active = isActive(href)
    return (
      <Link
        key={key}
        href={href}
        onClick={() => setSidebarOpen(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 9px',
          borderRadius: 6,
          background:  active ? DS.activeNavBg  : 'transparent',
          borderLeft:  `2px solid ${active ? DS.activeNavBorder : 'transparent'}`,
          color:       active ? DS.activeNavText : DS.navText,
          fontWeight:  active ? 600 : 500,
          fontSize:    12.5,
          textDecoration: 'none',
          transition:  'all 0.15s',
          boxShadow:   active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
        }}
        onMouseEnter={e => {
          if (!active) (e.currentTarget as HTMLAnchorElement).style.background = DS.accentMid
        }}
        onMouseLeave={e => {
          if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
        }}
      >
        <Icon size={13} color={active ? DS.activeNavBorder : DS.navIcon} />
        {label}
      </Link>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        html, body { height: 100%; overflow: hidden; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #C2D6CC; border-radius: 3px; }
        .shell-overlay { display: none; }
        @media (max-width: 768px) {
          .shell-sidebar {
            position: fixed !important; left: 0; top: 0; bottom: 0;
            z-index: 300; transform: translateX(-100%); transition: transform 0.25s ease;
          }
          .shell-sidebar.open { transform: translateX(0); }
          .shell-overlay {
            display: block; position: fixed; inset: 0;
            background: rgba(15,110,86,0.35); backdrop-filter: blur(3px); z-index: 299;
          }
          .mobile-menu-btn { display: flex !important; }
          .mobile-close    { display: block !important; }
        }
      `}</style>

      <div style={{
        display:             'grid',
        gridTemplateColumns: '168px 1fr',
        gridTemplateRows:    '46px 1fr',
        height:              '100vh',
        overflow:            'hidden',
        background:          DS.pageBg,
        fontFamily:          "'Plus Jakarta Sans', system-ui, sans-serif",
      }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          gridColumn:     '1 / -1',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '0 16px',
          background:     DS.headerBg,
          zIndex:         100,
        }}>
          {/* Left: hamburger (mobile) + logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 168 }}>
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="mobile-menu-btn"
              style={{
                display: 'none', width: 30, height: 30,
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.15)', border: 'none',
                cursor: 'pointer', borderRadius: 6, color: 'white',
              }}
            >
              <Menu size={15} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 6,
                background: 'rgba(255,255,255,0.20)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'white', lineHeight: 1, letterSpacing: '-0.5px', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
                  S
                </span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'white', letterSpacing: '-0.3px' }}>
                Salevo
              </span>
            </div>
          </div>

          {/* Right: business name + avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,0.75)' }}>
              {business.name}
            </span>
            <UserButton />
          </div>
        </div>

        {/* ── Mobile overlay ──────────────────────────────────────────────── */}
        {sidebarOpen && (
          <div className="shell-overlay" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside
          className={`shell-sidebar ${sidebarOpen ? 'open' : ''}`}
          style={{
            background:   DS.sidebarBg,
            borderRight:  `1px solid ${DS.sidebarBorder}`,
            display:      'flex',
            flexDirection:'column',
            width:        168,
            overflow:     'hidden',
          }}
        >
          {/* Mobile close */}
          <div
            className="mobile-close"
            style={{ display: 'none', padding: '10px 12px', borderBottom: `1px solid ${DS.sidebarBorder}` }}
          >
            <button
              onClick={() => setSidebarOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: DS.navText, display: 'flex' }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Business name card */}
          <div style={{
            padding:      '12px 12px 10px',
            borderBottom: `1px solid ${DS.sidebarBorder}`,
          }}>
            <div style={{
              fontSize:    12.5, fontWeight: 700, color: DS.bodyText,
              overflow:    'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              letterSpacing: '-0.2px',
            }}>
              {business.name}
            </div>
            <div style={{ fontSize: 10, color: DS.muted, marginTop: 2 }}>Free plan</div>
          </div>

          {/* Navigation */}
          <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <p style={{
              fontSize: 9.5, fontWeight: 700, color: DS.muted,
              letterSpacing: '0.8px', textTransform: 'uppercase',
              padding: '0 7px', marginBottom: 4,
            }}>
              Main
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 16 }}>
              {NAV_MAIN.map((item, i) => renderNavItem(item, `main-${i}`))}
            </div>

            <p style={{
              fontSize: 9.5, fontWeight: 700, color: DS.muted,
              letterSpacing: '0.8px', textTransform: 'uppercase',
              padding: '0 7px', marginBottom: 4,
            }}>
              Tools
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {NAV_TOOLS.map((item, i) => renderNavItem(item, `tools-${i}`))}
            </div>
          </nav>

          {/* Settings at bottom */}
          <div style={{ padding: '8px 8px 10px', borderTop: `1px solid ${DS.sidebarBorder}` }}>
            {renderNavItem({ href: '/dashboard/settings', label: 'Settings', icon: Settings }, 'settings')}
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <main style={{
          overflow:       'hidden',
          display:        'flex',
          flexDirection:  'column',
          background:     DS.pageBg,
        }}>
          {children}
        </main>
      </div>
    </>
  )
}
