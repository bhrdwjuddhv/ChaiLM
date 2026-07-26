import { useRef, useState } from 'react'
import api, { errorMessage } from '../api/client'

const TABS = [
  ['upload', 'Upload files'],
  ['paste', 'Paste text'],
]

export default function AddSourceModal({ notebookId, onClose, onAdded }) {
  const inputRef = useRef(null)
  const [tab, setTab] = useState('upload')
  const [dragging, setDragging] = useState(false)
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (request) => {
    setError('')
    setBusy(true)
    try {
      const { data } = await request()
      onAdded(data)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const sendFile = (file) => {
    if (!file) return
    const body = new FormData()
    body.append('file', file)
    return submit(() => api.post(`/notebooks/${notebookId}/sources/upload`, body))
  }

  const sendPaste = (e) => {
    e.preventDefault()
    if (!content.trim()) return
    return submit(() => api.post(`/notebooks/${notebookId}/sources/paste`, { content }))
  }

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-slate-900/30 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Add a source"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-medium text-slate-900">Add a source</h2>
            <p className="mt-1 text-sm text-slate-500">
              It gets indexed in the background — you can keep asking questions meanwhile.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        <div className="mt-5 flex gap-1 rounded-xl bg-slate-100 p-1">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 rounded-lg py-1.5 text-sm transition ${
                tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'upload' ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                sendFile(e.dataTransfer.files[0])
              }}
              className={`mt-4 w-full rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
                dragging ? 'border-accent bg-accent/5' : 'border-slate-200 hover:border-slate-300'
              } disabled:opacity-60`}
            >
              <span className="block text-sm font-medium text-slate-700">
                {busy ? 'Uploading…' : 'Upload files'}
              </span>
              <span className="mt-1 block text-xs text-slate-400">
                Drop a file here or click to browse · PDF, VTT, SRT, TXT
              </span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.vtt,.srt,.txt"
              className="hidden"
              onChange={(e) => sendFile(e.target.files[0])}
            />
          </>
        ) : (
          <form onSubmit={sendPaste} className="mt-4">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={7}
              placeholder="Paste text here — or a website link, a YouTube video, or a playlist."
              className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
            <p className="mt-2 text-xs text-slate-400">
              Links are detected automatically. YouTube links stay embeddable in the viewer.
            </p>
            <button
              type="submit"
              disabled={busy || !content.trim()}
              className="mt-3 w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
            >
              {busy ? 'Adding…' : 'Add source'}
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
