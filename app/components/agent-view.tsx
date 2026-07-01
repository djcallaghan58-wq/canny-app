'use client'

import { useState, useEffect, useRef } from 'react'
import { Bot, Send } from 'lucide-react'
import type { Business } from '@/lib/supabase'

// ── Design tokens ─────────────────────────────────────────────────────────────
const DS = {
  pageBg:       '#F7F9F8',
  cardBg:       '#FFFFFF',
  cardBorder:   '#E0EBE5',
  bodyText:     '#085041',
  secondary:    '#6B8C7E',
  muted:        '#9FD4C0',
  primary:      '#1D9E75',
  primaryGlow:  'rgba(29,158,117,0.15)',
  accentLight:  '#E1F5EE',
  accentMid:    '#F0F7F4',
  outlineBorder:'#C2D6CC',
  outlineText:  '#4A7A6A',
  inputBg:      '#F7F9F8',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message { role: 'user' | 'agent'; content: string }
interface HistoryEntry { role: 'user' | 'assistant'; content: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('→'))
      return <p key={i} style={{ color: DS.primary, margin: '3px 0', fontWeight: 500 }}>{line}</p>
    if (line.startsWith('⚠'))
      return <p key={i} style={{ color: '#DC2626', margin: '3px 0', fontWeight: 500 }}>{line}</p>
    if (line.startsWith('✦'))
      return <p key={i} style={{ color: '#92400E', margin: '3px 0', fontWeight: 500 }}>{line}</p>
    if (!line.trim())
      return <div key={i} style={{ height: 8 }} />
    return <p key={i} style={{ margin: '2px 0' }}>{line}</p>
  })
}

// ── Agent view ────────────────────────────────────────────────────────────────

export function AgentView({
  business,
  initialPrompt,
}: {
  business: Business
  initialPrompt?: string
}) {
  const welcome = [
    `Ready to help ${business.name}.`,
    '',
    `→ Use quick commands or ask anything`,
    `→ Click "Coach" on any pipeline card for job-specific advice`,
    `✦ I can search the web for current prospects and market data`,
  ].join('\n')

  const quickCmds = [
    'Draft a follow-up for my quoted jobs',
    `Find commercial prospects in ${business.city}`,
    'Write a quote follow-up text message',
    'How do I handle a price objection?',
  ]

  const [messages,  setMessages]  = useState<Message[]>([{ role: 'agent', content: welcome }])
  const [history,   setHistory]   = useState<HistoryEntry[]>([])
  const [input,     setInput]     = useState('')
  const [thinking,  setThinking]  = useState(false)
  const endRef         = useRef<HTMLDivElement>(null)
  const hasSentInitial = useRef(false)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  useEffect(() => {
    if (initialPrompt && !hasSentInitial.current) {
      hasSentInitial.current = true
      send(initialPrompt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const send = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || thinking) return

    setInput('')
    setThinking(true)
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    const newHistory: HistoryEntry[] = [...history, { role: 'user', content: msg }]
    setHistory(newHistory)

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory,
          business: { name: business.name, trade_type: business.trade_type, city: business.city },
        }),
      })
      const data  = await res.json()
      const reply = data.reply || 'Something went wrong. Try again.'
      setMessages(prev => [...prev, { role: 'agent', content: reply }])
      setHistory(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'agent', content: '⚠ Connection issue. Please try again.' }])
    } finally {
      setThinking(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Page header */}
      <div style={{
        padding: '14px 24px 12px', flexShrink: 0,
        borderBottom: `1px solid ${DS.cardBorder}`,
        background: DS.cardBg,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: DS.accentLight,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Bot size={16} color={DS.primary} />
        </div>
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, color: DS.muted, letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 1 }}>
            {business.name}
          </p>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: DS.bodyText, letterSpacing: '-0.3px', lineHeight: 1 }}>
            AI Assistant
          </h1>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: DS.primary, display: 'inline-block', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 11.5, color: DS.secondary, fontWeight: 500 }}>Web search enabled</span>
        </div>
      </div>

      {/* Quick commands */}
      <div style={{
        padding: '10px 24px', flexShrink: 0,
        display: 'flex', gap: 7, flexWrap: 'wrap',
        borderBottom: `1px solid ${DS.cardBorder}`,
        background: DS.cardBg,
      }}>
        {quickCmds.map(cmd => (
          <button
            key={cmd}
            disabled={thinking}
            onClick={() => send(cmd)}
            style={{
              padding: '5px 12px', borderRadius: 20,
              border: `1px solid ${DS.outlineBorder}`,
              background: DS.accentLight, color: DS.outlineText,
              fontSize: 11.5, fontWeight: 500,
              cursor: thinking ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'all 0.15s',
              opacity: thinking ? 0.4 : 1,
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              if (!thinking) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = DS.primary
                ;(e.currentTarget as HTMLButtonElement).style.color       = DS.primary
              }
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = DS.outlineBorder
              ;(e.currentTarget as HTMLButtonElement).style.color       = DS.outlineText
            }}
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Thin indeterminate bar while AI is thinking */}
      {thinking && (
        <div style={{ height: 2, background: 'rgba(29,158,117,0.12)', flexShrink: 0, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '35%', background: DS.primary, animation: 'agentBar 1.4s ease-in-out infinite' }} />
        </div>
      )}

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '18px 24px',
        display: 'flex', flexDirection: 'column', gap: 12,
        scrollbarWidth: 'thin', scrollbarColor: `${DS.muted} transparent`,
        background: DS.pageBg,
      }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex', flexDirection: 'column',
              alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '78%',
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              animation: 'slideUp 0.22s ease-out',
            }}
          >
            <span style={{ fontSize: 9.5, fontWeight: 600, color: DS.muted, letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 4 }}>
              {m.role === 'user' ? 'You' : 'AI Assistant'}
            </span>
            <div style={{
              padding: '11px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.65,
              ...(m.role === 'user'
                ? {
                    background:            DS.primary,
                    color:                 'white',
                    borderBottomRightRadius: 3,
                    boxShadow:             `0 2px 10px ${DS.primaryGlow}`,
                  }
                : {
                    background:           DS.cardBg,
                    color:                DS.bodyText,
                    border:               `1px solid ${DS.cardBorder}`,
                    borderBottomLeftRadius: 3,
                    boxShadow:            '0 1px 3px rgba(0,0,0,0.05)',
                  }),
            }}>
              {m.role === 'agent' ? fmt(m.content) : m.content}
            </div>
          </div>
        ))}

        {thinking && (
          <div style={{
            alignSelf: 'flex-start',
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '11px 14px',
            background: DS.cardBg,
            border: `1px solid ${DS.cardBorder}`,
            borderRadius: 12, borderBottomLeftRadius: 3,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            animation: 'slideUp 0.2s ease-out',
          }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: '50%',
                background: DS.muted,
                animation: `typingDot 1.3s infinite ${i * 0.2}s`,
              }} />
            ))}
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input dock */}
      <div style={{
        padding: '10px 24px 14px', flexShrink: 0,
        background: DS.cardBg,
        borderTop: `1px solid ${DS.cardBorder}`,
      }}>
        <div
          style={{
            display: 'flex', gap: 10, alignItems: 'flex-end',
            background: DS.inputBg,
            border: `1.5px solid ${DS.outlineBorder}`,
            borderRadius: 10, padding: '9px 12px',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
          onFocusCapture={e => {
            const wrap = e.currentTarget as HTMLDivElement
            wrap.style.borderColor = DS.primary
            wrap.style.boxShadow   = `0 0 0 3px ${DS.primaryGlow}`
            wrap.style.background  = '#fff'
          }}
          onBlurCapture={e => {
            const wrap = e.currentTarget as HTMLDivElement
            if (!wrap.contains(e.relatedTarget as Node)) {
              wrap.style.borderColor = DS.outlineBorder
              wrap.style.boxShadow   = 'none'
              wrap.style.background  = DS.inputBg
            }
          }}
        >
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask about jobs, prospects, follow-ups…`}
            disabled={thinking}
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none',
              outline: 'none', resize: 'none', fontSize: 13.5,
              color: DS.bodyText, fontFamily: 'inherit',
              lineHeight: 1.55, maxHeight: 120,
              opacity: thinking ? 0.5 : 1,
            }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || thinking}
            style={{
              width: 32, height: 32, borderRadius: 7, border: 'none',
              background: input.trim() && !thinking ? DS.primary : DS.muted,
              color: 'white', cursor: input.trim() && !thinking ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background 0.15s',
            }}
          >
            <Send size={13} />
          </button>
        </div>
        <p style={{ fontSize: 10, color: DS.muted, marginTop: 6, textAlign: 'center', fontWeight: 500 }}>
          Powered by Claude · Web search enabled · Press Enter to send
        </p>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes typingDot {
          0%, 100% { opacity: 0.25; transform: scale(0.75); }
          50%       { opacity: 1;    transform: scale(1.15); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes agentBar {
          0%   { margin-left: -35%; }
          100% { margin-left: 135%; }
        }
      `}</style>
    </div>
  )
}
