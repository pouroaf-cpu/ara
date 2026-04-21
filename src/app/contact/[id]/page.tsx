'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import type { Contact } from '@/lib/sheets'

const STAGES = ['Cold', 'Contacted', 'Interested', 'Follow-up Booked', 'Closed', 'Not Interested']
const OUTCOMES = ['No Answer', 'Left Voicemail', 'Not Interested', 'Call Back', 'Interested', 'Closed']

const STAGE_COLORS: Record<string, { bg: string; color: string }> = {
  'Cold':              { bg: '#E2E8F0', color: '#475569' },
  'Contacted':         { bg: '#DBEAFE', color: '#1D4ED8' },
  'Interested':        { bg: '#FEF3C7', color: '#92400E' },
  'Follow-up Booked':  { bg: '#EDE9FE', color: '#5B21B6' },
  'Closed':            { bg: '#DCFCE7', color: '#15803D' },
  'Not Interested':    { bg: '#FEE2E2', color: '#B91C1C' },
}

function formatNotes(raw: string): { text: string; ts: string }[] {
  if (!raw) return []
  const entries = raw.split(/(?=\[\d{4}-\d{2}-\d{2})/)
  return entries
    .map(e => e.trim())
    .filter(Boolean)
    .reverse()
    .map(e => {
      const match = e.match(/^\[([\s\S]+?)\]\s*([\s\S]*)$/)
      if (match) return { ts: match[1], text: match[2].trim() }
      return { ts: '', text: e }
    })
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export default function ContactPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const rowIndex = Number(params.id)

  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [stage, setStage] = useState('')
  const [outcome, setOutcome] = useState('')
  const [nextActionDate, setNextActionDate] = useState('')
  const [newNote, setNewNote] = useState('')

  const queueParam = searchParams.get('queue')
  const queue = queueParam ? queueParam.split(',').map(Number) : []
  const currentIndex = queue.indexOf(rowIndex)
  const nextInQueue = currentIndex >= 0 && currentIndex < queue.length - 1 ? queue[currentIndex + 1] : null
  const prevInQueue = currentIndex > 0 ? queue[currentIndex - 1] : null

  const fetchContact = useCallback(async () => {
    const res = await fetch('/api/contacts')
    if (res.status === 401) { router.push('/login'); return }
    const data = await res.json()
    const found = data.contacts?.find((c: Contact) => c.rowIndex === rowIndex)
    if (!found) { router.push('/dashboard'); return }
    setContact(found)
    setStage(found.pipelineStage || 'Cold')
    setOutcome(found.callOutcome || '')
    setNextActionDate(found.nextActionDate || '')
    setLoading(false)
  }, [rowIndex, router])

  useEffect(() => { fetchContact() }, [fetchContact])

  async function saveAndNext() {
    if (!contact) return
    setSaving(true)
    const today = new Date().toISOString().slice(0, 10)
    const timestamp = new Date().toLocaleString('en-NZ', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
    let updatedNotes = contact.notes || ''
    if (newNote.trim()) {
      const noteEntry = `[${timestamp}] ${newNote.trim()}`
      updatedNotes = updatedNotes ? `${updatedNotes}\n${noteEntry}` : noteEntry
    }
    const attempts = String((parseInt(contact.attempts || '0') || 0) + 1)
    await fetch('/api/contact', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowIndex, pipelineStage: stage, callOutcome: outcome, lastCall: today, nextActionDate, attempts, notes: updatedNotes }),
    })
    setSaving(false)
    if (nextInQueue) {
      router.push(`/contact/${nextInQueue}?queue=${queueParam}`)
    } else {
      router.push('/dashboard')
    }
  }

  async function saveOnly() {
    if (!contact) return
    setSaving(true)
    const today = new Date().toISOString().slice(0, 10)
    const timestamp = new Date().toLocaleString('en-NZ', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
    let updatedNotes = contact.notes || ''
    if (newNote.trim()) {
      const noteEntry = `[${timestamp}] ${newNote.trim()}`
      updatedNotes = updatedNotes ? `${updatedNotes}\n${noteEntry}` : noteEntry
    }
    await fetch('/api/contact', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowIndex, pipelineStage: stage, callOutcome: outcome, lastCall: today, nextActionDate, notes: updatedNotes }),
    })
    setNewNote('')
    setSaving(false)
    fetchContact()
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--muted)' }}>
      Loading...
    </div>
  )

  if (!contact) return null

  const dialNumber = contact.mobile || contact.phone
  const notes = formatNotes(contact.notes)
  const stageStyle = STAGE_COLORS[contact.pipelineStage] || { bg: '#E2E8F0', color: '#475569' }

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Top nav */}
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0 1.25rem',
        height: 48,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <button className="btn-ghost" onClick={() => router.push('/dashboard')} style={{ padding: '4px 10px', fontSize: 13 }}>
          ← Back
        </button>
        {queue.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {currentIndex + 1} / {queue.length}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {prevInQueue && (
          <button className="btn-ghost" onClick={() => router.push(`/contact/${prevInQueue}?queue=${queueParam}`)} style={{ fontSize: 12, padding: '4px 10px' }}>
            ← Prev
          </button>
        )}
        {nextInQueue && (
          <button className="btn-ghost" onClick={() => router.push(`/contact/${nextInQueue}?queue=${queueParam}`)} style={{ fontSize: 12, padding: '4px 10px' }}>
            Next →
          </button>
        )}
      </div>

      {/* Two-column layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '300px 1fr',
        height: 'calc(100vh - 48px)',
        overflow: 'hidden',
      }}>

        {/* ── SIDEBAR ── */}
        <div style={{
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          padding: '28px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
          overflowY: 'auto',
        }}>

          {/* Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: '#DBEAFE', color: '#1D4ED8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 600, fontSize: 15, flexShrink: 0,
            }}>
              {initials(contact.name)}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{contact.name}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{contact.tradeType || '—'}</div>
            </div>
          </div>

          {/* Stage badge */}
          <div>
            <div style={sectionLabel}>Status</div>
            <span style={{
              display: 'inline-block',
              fontSize: 12, fontWeight: 600,
              padding: '4px 12px', borderRadius: 20,
              background: stageStyle.bg, color: stageStyle.color,
            }}>
              {contact.pipelineStage || 'Cold'}
            </span>
          </div>

          {/* Contact details */}
          <div>
            <div style={sectionLabel}>Contact</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[
                ['Mobile', contact.mobile || 'No mobile'],
                ['Phone', contact.phone || '—'],
                ['Region', contact.region || '—'],
                ['Decision maker', contact.decisionMaker || '—'],
                ['Attempts', contact.attempts && contact.attempts !== '0' ? contact.attempts : '0'],
                ['Last called', contact.lastCall || 'Never'],
              ].map(([label, value]) => (
                <div key={label} style={fieldRow}>
                  <span style={{ color: 'var(--muted)', fontSize: 13 }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Call button */}
          {dialNumber && (
            <div>
              <div style={sectionLabel}>Call</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <a
                  href={`tel:${dialNumber.replace(/\s/g, '')}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 16px', borderRadius: 8,
                    background: '#16a34a', color: '#fff',
                    textDecoration: 'none', fontSize: 14, fontWeight: 500,
                  }}
                >
                  <span style={{ fontSize: 16 }}>📞</span>
                  Call now — {dialNumber}
                </a>
                {contact.mobile && contact.phone && (
                  <a
                    href={`tel:${contact.phone.replace(/\s/g, '')}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 16px', borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'transparent', color: 'var(--muted)',
                      textDecoration: 'none', fontSize: 13,
                    }}
                  >
                    Alt: {contact.phone}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Call history */}
          {notes.length > 0 && (
            <div>
              <div style={sectionLabel}>Call history</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {notes.map((n, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: 'var(--border)', marginTop: 5, flexShrink: 0,
                    }} />
                    <div>
                      {n.ts && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>{n.ts}</div>}
                      <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>{n.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── MAIN ── */}
        <div style={{
          padding: '32px 40px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>

          <div>
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Log this call</div>
            <div style={{ fontSize: 14, color: 'var(--muted)' }}>
              {contact.name} · {new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>

          {/* Outcome */}
          <div style={card}>
            <div style={sectionLabel}>Outcome</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {OUTCOMES.map(o => (
                <button
                  key={o}
                  onClick={() => setOutcome(o)}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 8,
                    border: `1px solid ${outcome === o ? 'var(--accent)' : 'var(--border)'}`,
                    background: outcome === o ? 'var(--accent-dim)' : 'var(--bg)',
                    color: outcome === o ? 'var(--accent)' : 'var(--muted)',
                    fontWeight: outcome === o ? 600 : 400,
                    fontSize: 13,
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.12s',
                  }}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          {/* Stage + Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={card}>
              <div style={sectionLabel}>Pipeline stage</div>
              <select value={stage} onChange={e => setStage(e.target.value)} style={{ width: '100%' }}>
                {STAGES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={card}>
              <div style={sectionLabel}>Next action date</div>
              <input type="date" value={nextActionDate} onChange={e => setNextActionDate(e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>

          {/* Notes */}
          <div style={card}>
            <div style={sectionLabel}>Notes from this call</div>
            <textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="What happened? Any objections, commitments, or follow-up context..."
              rows={4}
              style={{ resize: 'vertical', width: '100%' }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Changes save to your call log</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-ghost" onClick={saveOnly} disabled={saving} style={{ fontSize: 13 }}>
                Save only
              </button>
              {queue.length > 0 && nextInQueue ? (
                <button className="btn-primary" onClick={saveAndNext} disabled={saving}>
                  {saving ? 'Saving...' : 'Save & next →'}
                </button>
              ) : (
                <button className="btn-primary" onClick={saveOnly} disabled={saving}>
                  {saving ? 'Saving...' : 'Save & close'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile fallback — stack vertically under 768px */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns: 300px"] {
            grid-template-columns: 1fr !important;
            height: auto !important;
            overflow: visible !important;
          }
          div[style*="gridTemplateColumns: 300px"] > div:first-child {
            border-right: none !important;
            border-bottom: 1px solid var(--border);
            height: auto !important;
            overflow: visible !important;
          }
          div[style*="gridTemplateColumns: 300px"] > div:last-child {
            padding: 20px 16px !important;
          }
          div[style*="gridTemplateColumns: repeat(3"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          div[style*="gridTemplateColumns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 10,
}

const fieldRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 0',
  borderBottom: '1px solid var(--border)',
}

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '16px 20px',
}
