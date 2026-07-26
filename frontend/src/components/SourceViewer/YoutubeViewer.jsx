import { useEffect, useRef, useState } from 'react'
import api from '../../api/client'

const clock = (sec = 0) =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

export default function YoutubeViewer({ source, position }) {
  const [transcript, setTranscript] = useState(null)
  const [seekTo, setSeekTo] = useState(position?.startSec ?? 0)
  const activeRef = useRef(null)

  // A playlist source holds many videos, so the citation decides which one plays.
  const videoId =
    position?.videoId || source.metadata?.videoId || source.metadata?.embeddedVideoId

  // Same as PdfViewer: a new citation re-seeks, but clicking a transcript line
  // still wins until the next citation arrives.
  const [citedAt, setCitedAt] = useState(position?.startSec)
  if (position?.startSec !== citedAt) {
    setCitedAt(position?.startSec)
    setSeekTo(position?.startSec ?? 0)
  }

  useEffect(() => {
    api
      .get(`/sources/${source._id}/chunks`)
      .then(({ data }) => setTranscript(data))
      .catch(() => setTranscript([]))
  }, [source._id])

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [transcript, seekTo])

  if (!videoId) {
    return <p className="p-6 text-sm text-slate-400">No video is attached to this source.</p>
  }

  const lines = (transcript || []).filter((c) => !position?.videoId || c.position?.videoId === position.videoId)

  return (
    <div className="flex h-full flex-col">
      <div className="aspect-video w-full shrink-0 bg-black">
        <iframe
          key={`${videoId}-${seekTo}`}
          src={`https://www.youtube.com/embed/${videoId}?start=${Math.floor(seekTo)}&autoplay=0`}
          title={source.title}
          allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          className="size-full border-0"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {transcript === null ? (
          <p className="px-2 text-sm text-slate-400">Loading transcript…</p>
        ) : lines.length === 0 ? (
          <p className="px-2 text-sm text-slate-400">No transcript stored for this video.</p>
        ) : (
          <ul className="space-y-0.5">
            {lines.map((line) => {
              const active =
                position?.startSec !== undefined &&
                line.position?.startSec <= position.startSec &&
                line.position?.endSec >= position.startSec

              return (
                <li key={line.chunkIndex} ref={active ? activeRef : null}>
                  <button
                    onClick={() => setSeekTo(line.position?.startSec ?? 0)}
                    className={`flex w-full gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                      active ? 'bg-amber-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="shrink-0 pt-0.5 font-mono text-xs text-slate-400">
                      {clock(line.position?.startSec)}
                    </span>
                    <span className="min-w-0 flex-1">{line.text}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
