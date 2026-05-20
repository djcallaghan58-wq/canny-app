'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import {
  LayoutGrid, GitBranch, Bot, Building2, Settings, Menu, X, Sparkles,
} from 'lucide-react'
import { getAccent, getGlow } from '@/lib/supabase'
import type { Business } from '@/lib/supabase'

const NAV = [
  { href: '/dashboard',                  label: 'Dashboard',    icon: LayoutGrid  },
  { href: '/dashboard/pipeline',         label: 'Pipeline',     icon: GitBranch   },
  { href: '/dashboard/agent',            label: 'AI Assistant', icon: Bot         },
  { href: '/dashboard/prospects',        label: 'Prospects',    icon: Building2   },
  { href: '/dashboard/settings',         label: 'Settings',     icon: Settings    },
  { href: '/dashboard/settings/style',   label: 'Writing Style',icon: Sparkles    },
]

export function DashboardShell({
  business,
  children,
}: {
  business: Business
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const accent = getAccent(business.trade_type)
  const glow   = getGlow(business.trade_type)

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        html, body { height: 100%; overflow: hidden; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 3px; }

        .shell-overlay {
          display: none;
        }
        @media (max-width: 768px) {
          .shell-sidebar {
            position: fixed !important;
            left: 0; top: 0; bottom: 0;
            z-index: 300;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
          }
          .shell-sidebar.open {
            transform: translateX(0);
          }
          .shell-overlay {
            display: block;
            position: fixed; inset: 0;
            background: rgba(9,9,11,0.5);
            backdrop-filter: blur(4px);
            z-index: 299;
          }
        }
      `}</style>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '256px 1fr',
        gridTemplateRows: '60px 1fr',
        height: '100vh',
        overflow: 'hidden',
        background: '#FAFAFA',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}>

        {/* ── Topbar ──────────────────────────────────────────── */}
        <div style={{
          gridColumn: '1 / -1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          background: 'rgba(250,250,250,0.85)',
          backdropFilter: 'saturate(180%) blur(24px)',
          WebkitBackdropFilter: 'saturate(180%) blur(24px)',
          borderBottom: '1px solid rgba(0,0,0,0.07)',
          position: 'relative',
          zIndex: 100,
        }}>
          {/* Left: hamburger (mobile) + logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: 256 }}>
            <button
              onClick={() => setSidebarOpen(o => !o)}
              style={{
                display: 'none',
                width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderRadius: 8, color: '#52525B',
              }}
              className="mobile-menu-btn"
            >
              <Menu size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 2px 8px ${glow}`,
              }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8L7 12L13 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#09090B', letterSpacing: '-0.4px' }}>
                Salevo
              </span>
            </div>
          </div>

          {/* Center: business name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: '#52525B' }}>
              {business.name}
            </span>
          </div>

          {/* Right: user button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: 'auto', minWidth: 80 }}>
            <UserButton />
          </div>
        </div>

        {/* ── Sidebar overlay (mobile) ─────────────────────────── */}
        {sidebarOpen && (
          <div className="shell-overlay" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ── Sidebar ─────────────────────────────────────────── */}
        <aside
          className={`shell-sidebar ${sidebarOpen ? 'open' : ''}`}
          style={{
            background: '#FFFFFF',
            borderRight: '1px solid rgba(0,0,0,0.07)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            width: 256,
          }}
        >
          {/* Mobile close */}
          <div style={{ display: 'none', padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }} className="mobile-close">
            <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525B' }}>
              <X size={18} />
            </button>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{
              fontSize: 10, fontWeight: 600, color: '#A1A1AA',
              letterSpacing: '0.6px', textTransform: 'uppercase',
              padding: '0 10px', marginBottom: 6,
            }}>
              Menu
            </div>

            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSidebarOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 10px',
                    borderRadius: 9,
                    background: active ? `${glow}` : 'transparent',
                    color: active ? accent : '#71717A',
                    fontWeight: active ? 600 : 500,
                    fontSize: 13.5,
                    textDecoration: 'none',
                    position: 'relative',
                    transition: 'all 0.15s',
                    minHeight: 44,
                  }}
                >
                  {/* Active indicator */}
                  {active && (
                    <span style={{
                      position: 'absolute', left: 0, top: '20%', bottom: '20%',
                      width: 2.5, borderRadius: '0 2px 2px 0',
                      background: accent,
                    }} />
                  )}
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: active ? glow : 'transparent',
                    flexShrink: 0,
                    transition: 'background 0.15s',
                  }}>
                    <Icon size={16} />
                  </div>
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div style={{
            padding: '14px 16px',
            borderTop: '1px solid rgba(0,0,0,0.06)',
            background: '#FAFAFA',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#A1A1AA', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 8 }}>
              Your Business
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#09090B', marginBottom: 2 }}>
              {business.name}
            </div>
            <div style={{ fontSize: 11.5, color: '#A1A1AA' }}>
              {business.city}
            </div>
            <div style={{ fontSize: 11.5, color: '#A1A1AA', marginTop: 1 }}>
              {business.phone}
            </div>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────── */}
        <main style={{
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: '#FAFAFA',
        }}>
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex !important; }
          .mobile-close    { display: block !important; }
        }
      `}</style>
    </>
  )
}
