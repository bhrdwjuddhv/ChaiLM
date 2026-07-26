import { useEffect, useRef, useState } from 'react'
import api, { errorMessage } from '../api/client'

const clock = (sec) =>
  sec == null ? null : `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

function Roadmap({ notebookId, initial }) {
  const [roadmap, setRoadmap] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const build = async () => {
    setError('')
    setBusy(true)
    try {
      const { data } = await api.post(`/notebooks/${notebookId}/roadmap`)
      setRoadmap(data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <button
        onClick={build}
        disabled={busy}
        className="w-full rounded-xl border border-slate-200 py-2.5 text-sm text-slate-700 transition hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {busy ? 'Building roadmap…' : roadmap ? 'Rebuild roadmap' : 'Build a learning roadmap'}
      </button>

      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}

      {roadmap && (
        <div className="mt-4">
          <h3 className="font-medium text-slate-900">{roadmap.title}</h3>
          {roadmap.summary && <p className="mt-1 text-sm text-slate-500">{roadmap.summary}</p>}

          <ol className="mt-4 space-y-3">
            {(roadmap.steps || []).map((step, i) => (
              <li key={i} className="rounded-xl border border-slate-200 p-3.5">
                <div className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent/10 text-xs font-medium text-accent">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-sm font-medium text-slate-900">{step.title}</h4>
                    <p className="mt-1 text-sm text-slate-600">{step.detail}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {[
                        step.sourceTitle,
                        clock(step.startSec),
                        step.estimatedMinutes && `~${step.estimatedMinutes} min`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

function Podcast({ notebookId, initial }) {
  const [voice, setVoice] = useState('female')
  const [job, setJob] = useState(initial ? { status: 'completed', ...initial } : null)
  const [error, setError] = useState('')
  const jobId = useRef(null)

  const running = job?.status && !['completed', 'failed'].includes(job.status)

  const start = async () => {
    setError('')
    try {
      const { data } = await api.post(`/notebooks/${notebookId}/podcast`, { voice })
      jobId.current = data.jobId
      setJob({ status: 'queued', progress: 0 })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  useEffect(() => {
    if (!running || !jobId.current) return
    const timer = setInterval(async () => {
      try {
        const { data } = await api.get(`/notebooks/${notebookId}/podcast/${jobId.current}`)
        setJob(data)
      } catch (err) {
        setError(errorMessage(err))
        setJob(null)
      }
    }, 3000)
    return () => clearInterval(timer)
  }, [running, notebookId])

  return (
    <div>
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {['female', 'male'].map((v) => (
          <button
            key={v}
            onClick={() => setVoice(v)}
            className={`flex-1 rounded-lg py-1.5 text-sm capitalize transition ${
              voice === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            {v} voice
          </button>
        ))}
      </div>

      <button
        onClick={start}
        disabled={running}
        className="mt-2 w-full rounded-xl border border-slate-200 py-2.5 text-sm text-slate-700 transition hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {running
          ? `Generating… ${job.progress || 0}%`
          : job?.audioUrl
            ? 'Generate a new episode'
            : 'Generate a podcast'}
      </button>

      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      {job?.status === 'failed' && (
        <p role="alert" className="mt-3 text-sm text-red-600">{job.error}</p>
      )}
      {running && (
        <p className="mt-2 text-xs text-slate-400">
          Writing the script, then reading it aloud line by line. This takes a few minutes.
        </p>
      )}

      {job?.audioUrl && (
        <div className="mt-4 rounded-xl border border-slate-200 p-3.5">
          <h3 className="text-sm font-medium text-slate-900">{job.title}</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {job.lineCount} lines · {job.voice} voice
          </p>
          <audio controls src={job.audioUrl} className="mt-3 w-full">
            <a href={job.audioUrl}>Download the audio</a>
          </audio>
        </div>
      )}
    </div>
  )
}

const TABS = [
  ['roadmap', 'Roadmap'],
  ['podcast', 'Podcast'],
]

export default function ExtrasPanel({ notebook, onClose }) {
  const [tab, setTab] = useState('roadmap')

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-slate-900/30 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Notebook extras"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85svh] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-lg"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="font-medium text-slate-900">Make something from this notebook</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </header>

        <div className="px-6 pt-5">
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {TABS.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 rounded-lg py-1.5 text-sm transition ${
                  tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-6">
          {tab === 'roadmap' ? (
            <Roadmap notebookId={notebook._id} initial={notebook.roadmap} />
          ) : (
            <Podcast notebookId={notebook._id} initial={notebook.podcast} />
          )}
        </div>
      </div>
    </div>
  )
}
