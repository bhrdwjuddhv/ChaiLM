import { useEffect, useRef, useState } from 'react'
import api from '../../api/client'

const clock = (sec = 0) =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

// Plain text: highlight the exact character range the citation points at.
function TextBody({ content, position }) {
  const markRef = useRef(null)
  useEffect(() => {
    markRef.current?.scrollIntoView({ block: 'center' })
  }, [position?.charStart])

  const { charStart, charEnd } = position || {}
  const valid = Number.isInteger(charStart) && Number.isInteger(charEnd) && charEnd > charStart

  if (!valid) {
    return <pre className="p-5 text-sm whitespace-pre-wrap text-slate-700">{content}</pre>
  }

  return (
    <pre className="p-5 text-sm whitespace-pre-wrap text-slate-700">
      {content.slice(0, charStart)}
      <mark ref={markRef} className="bg-amber-200/70">
        {content.slice(charStart, charEnd)}
      </mark>
      {content.slice(charEnd)}
    </pre>
  )
}

// Captions: the cue is the unit of citation, so render cue by cue.
function CueBody({ sourceId, position }) {
  const [cues, setCues] = useState(null)
  const activeRef = useRef(null)

  useEffect(() => {
    api
      .get(`/sources/${sourceId}/chunks`)
      .then(({ data }) => setCues(data))
      .catch(() => setCues([]))
  }, [sourceId])

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center' })
  }, [cues, position?.startSec])

  if (cues === null) return <p className="p-5 text-sm text-slate-400">Loading transcript…</p>
  if (!cues.length) return <p className="p-5 text-sm text-slate-400">Nothing stored for this source.</p>

  return (
    <ul className="space-y-0.5 p-3">
      {cues.map((cue) => {
        const active = position?.startSec !== undefined && cue.position?.startSec === position.startSec
        return (
          <li
            key={cue.chunkIndex}
            ref={active ? activeRef : null}
            className={`flex gap-3 rounded-lg px-2 py-1.5 text-sm ${
              active ? 'bg-amber-100 text-slate-900' : 'text-slate-600'
            }`}
          >
            <span className="shrink-0 pt-0.5 font-mono text-xs text-slate-400">
              {clock(cue.position?.startSec)}
            </span>
            <span className="min-w-0 flex-1">{cue.text}</span>
          </li>
        )
      })}
    </ul>
  )
}

export default function TextViewer({ source, position }) {
  const [content, setContent] = useState(source.metadata?.content ?? null)
  const [error, setError] = useState('')

  const needsFetch = source.type === 'text' && content === null && source.storageUrl

  useEffect(() => {
    if (!needsFetch) return
    fetch(source.storageUrl)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`Could not load file (${r.status})`))))
      .then(setContent)
      .catch((e) => setError(e.message))
  }, [needsFetch, source.storageUrl])

  return (
    <div className="h-full overflow-y-auto">
      {source.type === 'vtt' ? (
        <CueBody sourceId={source._id} position={position} />
      ) : error ? (
        <p className="p-5 text-sm text-red-600">{error}</p>
      ) : content === null ? (
        <p className="p-5 text-sm text-slate-400">Loading…</p>
      ) : (
        <TextBody content={content} position={position} />
      )}
    </div>
  )
}
