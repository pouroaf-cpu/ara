'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import type { Contact } from '@/lib/sheets'

const STAGES = ['Cold', 'Contacted', 'Interested', 'Follow-up Booked', 'Closed', 'Not Interested']
const OUTCOMES = ['No Answer', 'Left Voicemail', 'Not Interested', 'Call Back', 'Interested', 'Closed']

const STAGE_COLORS: Record<string, string> = {
  'Cold': '#64748b',
  'Contacted': '#3b82f6',
  'Interested': '#f59e0b',
  'Follow-up Booked': '#8b5cf6',
  'Closed': '#22c55e',
  'Not Interested': '#ef4444',
}

function formatNotes(raw: string): { text: string; ts: string }[] {
  if (!raw) return []
  const entries = raw.split(/(?=\[\d{4}-\d{2}-\d{2})/)
  return entries
    .map(e => e.trim())
    .filter(Boolean)
    .reverse()
    .map(e => {
      const match = e.match(/^\[(.+?)\]\s*(.*)$/s)
      if (match) return { ts: match[1], text: match[2].trim() }
      return { ts: '', text: e }
    })
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
      body: JSON.stringify({
        rowIndex,
        pipelineStage: stage,
        callOutcome: outcome,
        lastCall: today,
        nextActionDate,
        attempts,
        notes: updatedNotes,
      }),
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
      body: JSON.stringify({
        rowIndex,
        pipelineStage: stage,
        callOutcome: outcome,
        lastCall: today,
        nextActionDate,
        notes: updatedNotes,
      }),
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

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '5rem' }}>
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0.85rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <button className="btn-ghost" onClick={() => router.push('/dashboard')} style={{ padding: '5px 10px', fontSize: 13 }}>
          ← Back
        </button>
        {queue.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {currentIndex + 1} / {queue.length} in queue
          </span>
        )}
        <div style={{ flex: 1 }} />
        {prevInQueue && (
          <button className="btn-ghost" onClick={() => router.push(`/contact/${prevInQueue}?queue=${queueParam}`)} style={{ fontSize: 12, padding: '5px 10px' }}>
            ← Prev
          </button>
        )}
        {nextInQueue && (
          <button className="btn-ghost" onClick={() => router.push(`/contact/${nextInQueue}?queue=${queueParam}`)} style={{ fontSize: 12, padding: '5px 10px' }}>
            Next →
          </button>
        )}
      </div>

      <div style={{ padding: '1.25rem', maxWidth: 600, margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>{contact.name}</h1>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 13, color: 'var(--muted)' }}>
                {contact.tradeType && <span>{contact.tradeType}</span>}
                {contact.region && <span>📍 {contact.region}</span>}
                {contact.decisionMaker && <span>👤 {contact.decisionMaker}</span>}
                {contact.attempts && contact.attempts !== '0' && <span>{contact.attempts} previous attempts</span>}
              </div>
            </div>
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '4px 12px',
              borderRadius: 20,
              background: STAGE_COLORS[contact.pipelineStage] || '#333',
              color: ['Cold', 'Contacted'].includes(contact.pipelineStage) ? '#fff' : '#000',
              flexShrink: 0,
            }}>
              {contact.pipelineStage || 'Cold'}
            </span>
          </div>
        </div>

        {dialNumber && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '1.1rem 1.25rem',
            marginBottom: '1.25rem',
          }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
              {contact.mobile ? 'Mobile (preferred)' : 'Phone'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '0.02em' }}>{dialNumber}</span>
              <a href={`tel:${dialNumber.replace(/\s/g, '')}`} className="btn-call">
                📞 Call now
              </a>
              {contact.mobile && contact.phone && (
                <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="btn-ghost" style={{ fontSize: 13, padding: '8px 14px', textDecoration: 'none', borderRadius: 8 }}>
                  Alt: {contact.phone}
                </a>
              )}
            </div>
            {contact.lastCall && (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Last called: {contact.lastCall}</div>
            )}
          </div>
        )}

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '1.1rem 1.25rem',
          marginBottom: '1.25rem',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '1rem' }}>Log this call</div>
          <div style={{ display: 'grid', gap: '0.85rem' }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Outcome</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {OUTCOMES.map(o => (
                  <button
                    key={o}
                    onClick={() => setOutcome(o)}
                    style={{
                      fontSize: 12,
                      padding: '5px 11px',
                      borderRadius: 20,
                      border: `1px solid ${outcome === o ? 'var(--accent)' : 'var(--border)'}`,
                      background: outcome === o ? 'var(--accent-dim)' : 'transparent',
                      color: outcome === o ? 'var(--accent)' : 'var(--muted)',
                      fontWeight: outcome === o ? 600 : 400,
                    }}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Pipeline stage</label>
              <select value={stage} onChange={e => setStage(e.target.value)}>
                {STAGES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Next action date</label>
              <input type="date" value={nextActionDate} onChange={e => setNextActionDate(e.target.value)} />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Notes from this call</label>
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="What happened? Any key info..."
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: '1rem', flexWrap: 'wrap' }}>
            {queue.length > 0 && nextInQueue ? (
              <button className="btn-primary" onClick={saveAndNext} disabled={saving}>
                {saving ? 'Saving...' : 'Save & next →'}
              </button>
            ) : (
              <button className="btn-primary" onClick={saveOnly} disabled={saving}>
                {saving ? 'Saving...' : 'Save to sheet'}
              </button>
            )}
            <button className="btn-ghost" onClick={saveOnly} disabled={saving}>
              Save only
            </button>
          </div>
        </div>

        {notes.length > 0 && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '1.1rem 1.25rem',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: '0.85rem' }}>Call history</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {notes.map((n, i) => (
                <div key={i} style={{ borderLeft: '2px solid var(--border)', paddingLeft: 12 }}>
                  {n.ts && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>{n.ts}</div>}
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>{n.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}