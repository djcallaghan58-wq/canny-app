'use client'

import { useState, useEffect, useRef } from 'react'
import { Bot, Send } from 'lucide-react'
import { getAccent, getGlow } from '@/lib/supabase'
import type { Business } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'agent'
  content: string
}

interface HistoryEntry {
  role: 'user' | 'assistant'
  content: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(text: string, accent: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('→'))
      return <p key={i} style={{ color: accent, margin: '3px 0', fontWeight: 500 }}>{line}</p>
    if (line.startsWith('⚠'))
      return <p key={i} style={{ color: '#DC2626', margin: '3px 0', fontWeight: 500 }}>{line}</p>
    if (line.startsWith('✦'))
      return <p key={i} style={{ color: '#92400E', margin: '3px 0', fontWeight: 500 }}>{line}</p>
    if (!line.trim())
      return <div key={i} style={{ height: 8 }} />
    return <p key={i} style={{ margin: '2px 0' }}>{line}</p>
  })
}

// ─── Agent view ───────────────────────────────────────────────────────────────

export function AgentView({
  business,
  initialPrompt,
}: {
  business: Business
  initialPrompt?: string
}) {
  const accent = getAccent(business.trade_type)
  const glow   = getGlow(business.trade_type)

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
  const endRef        = useRef<HTMLDivElement>(null)
  const hasSentInitial = useRef(false)
  const textareaRef   = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  // Auto-send coach prompt from pipeline page
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
          business: {
            name:       business.name,
            trade_type: business.trade_type,
            city:       business.city,
          },
        }),
      })
      const data = await res.json()
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Page header */}
      <div style={{
        padding: '20px 28px 16px', flexShrink: 0,
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        background: '#FFFFFF',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: glow, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Bot size={18} color={accent} />
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#A1A1AA', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 2 }}>
            {business.name}
          </p>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#09090B', letterSpacing: '-0.4px', lineHeight: 1 }}>
            AI Assistant
          </h1>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 12, color: '#71717A', fontWeight: 500 }}>Web search enabled</span>
        </div>
      </div>

      {/* Quick commands */}
      <div style={{
        padding: '12px 28px', flexShrink: 0,
        display: 'flex', gap: 8, flexWrap: 'wrap',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        background: '#FFFFFF',
      }}>
        {quickCmds.map(cmd => (
          <button
            key={cmd}
            disabled={thinking}
            onClick={() => send(cmd)}
            style={{
              padding: '6px 14px', borderRadius: 20,
              border: '1px solid rgba(0,0,0,0.10)',
              background: '#FAFAFA', color: '#52525B',
              fontSize: 12, fontWeight: 500,
              cursor: thinking ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'all 0.15s',
              opacity: thinking ? 0.4 : 1,
              whiteSpace: 'nowrap', minHeight: 32,
            }}
            onMouseEnter={e => {
              if (!thinking) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = accent
                ;(e.currentTarget as HTMLButtonElement).style.color = accent
                ;(e.currentTarget as HTMLButtonElement).style.background = glow
              }
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,0,0,0.10)'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#52525B'
              ;(e.currentTarget as HTMLButtonElement).style.background = '#FAFAFA'
            }}
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '20px 28px',
        display: 'flex', flexDirection: 'column', gap: 14,
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.1) transparent',
      }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '78%',
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              animation: 'slideUp 0.22s ease-out',
            }}
          >
            <span style={{
              fontSize: 10, fontWeight: 600, color: '#A1A1AA',
              letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 5,
            }}>
              {m.role === 'user' ? 'You' : 'AI Assistant'}
            </span>
            <div style={{
              padding: '12px 16px', borderRadius: 14, fontSize: 13, lineHeight: 1.65,
              ...(m.role === 'user'
                ? {
                    background: accent,
                    color: 'white',
                    borderBottomRightRadius: 4,
                    boxShadow: `0 2px 10px ${glow}`,
                  }
                : {
                    background: '#FFFFFF',
                    color: '#09090B',
                    border: '1px solid rgba(0,0,0,0.08)',
                    borderBottomLeftRadius: 4,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
                  }),
            }}>
              {m.role === 'agent' ? fmt(m.content, accent) : m.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {thinking && (
          <div style={{
            alignSelf: 'flex-start',
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '12px 16px',
            background: '#FFFFFF',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 14, borderBottomLeftRadius: 4,
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
            animation: 'slideUp 0.2s ease-out',
          }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: '50%',
                background: '#A1A1AA',
                animation: `typingDot 1.3s infinite ${i * 0.2}s`,
              }} />
            ))}
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input dock */}
      <div style={{
        padding: '12px 28px 16px', flexShrink: 0,
        background: '#FFFFFF',
        borderTop: '1px solid rgba(0,0,0,0.07)',
      }}>
        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-end',
          background: '#F4F4F5',
          border: '1.5px solid rgba(0,0,0,0.10)',
          borderRadius: 12, padding: '10px 14px',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
          onFocusCapture={e => {
            const wrap = e.currentTarget as HTMLDivElement
            wrap.style.borderColor = accent
            wrap.style.boxShadow = `0 0 0 3px ${glow}`
            wrap.style.background = '#fff'
          }}
          onBlurCapture={e => {
            const wrap = e.currentTarget as HTMLDivElement
            if (!wrap.contains(e.relatedTarget as Node)) {
              wrap.style.borderColor = 'rgba(0,0,0,0.10)'
              wrap.style.boxShadow = 'none'
              wrap.style.background = '#F4F4F5'
            }
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask about ${business.trade_type.toLowerCase()} jobs, prospects, follow-ups…`}
            disabled={thinking}
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none',
              outline: 'none', resize: 'none', fontSize: 13.5,
              color: '#09090B', fontFamily: 'inherit',
              lineHeight: 1.55, maxHeight: 120,
              opacity: thinking ? 0.5 : 1,
            }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || thinking}
            style={{
              width: 34, height: 34, borderRadius: 8, border: 'none',
              background: input.trim() && !thinking ? accent : '#D4D4D8',
              color: 'white', cursor: input.trim() && !thinking ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background 0.15s',
            }}
          >
            <Send size={14} />
          </button>
        </div>
        <p style={{ fontSize: 10.5, color: '#C4C4C8', marginTop: 8, textAlign: 'center', fontWeight: 500 }}>
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
      `}</style>
    </div>
  )
}
