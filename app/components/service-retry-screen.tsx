'use client'

import { useEffect, useState } from 'react'

export function ServiceRetryScreen() {
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(n => {
        if (n <= 1) {
          clearInterval(tick)
          window.location.reload()
          return 0
        }
        return n - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F7F9F8', fontFamily: 'var(--font-plus-jakarta-sans, sans-serif)',
    }}>
      <div style={{
        background: '#FFFFFF', border: '1px solid #E0EBE5', borderRadius: 14,
        padding: '36px 40px', maxWidth: 400, width: '100%', textAlign: 'center',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%', background: '#E1F5EE',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: 20,
        }}>
          ⟳
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: '#085041', marginBottom: 8, letterSpacing: '-0.3px' }}>
          Having trouble connecting
        </h2>
        <p style={{ fontSize: 13, color: '#6B8C7E', lineHeight: 1.6, marginBottom: 20 }}>
          We couldn&apos;t reach the server. This is usually temporary.
        </p>
        <p style={{ fontSize: 12, color: '#9FD4C0', marginBottom: 20 }}>
          Retrying in {countdown}s…
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 20px', borderRadius: 7, border: 'none',
            background: '#1D9E75', color: 'white',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(29,158,117,0.25)',
            fontFamily: 'inherit',
          }}
        >
          Retry now
        </button>
      </div>
    </div>
  )
}
