import { useEffect, useState } from 'react'
import { prepareSnapshot } from './prepareSnapshot'

// The snapshot is cross-origin, so a plain <iframe src> can't be scripted or
// scrolled into position. Fetch it, rewrite it, render via srcdoc — without
// allow-same-origin the frame stays on an opaque origin.

export default function WebViewer({ source, position }) {
  const [html, setHtml] = useState(null)
  const [fetchError, setFetchError] = useState('')
  const snapshotUrl = position?.snapshotUrl || source.metadata?.snapshotUrl || source.storageUrl
  const error = snapshotUrl ? fetchError : 'No snapshot was stored for this page.'

  useEffect(() => {
    if (!snapshotUrl) return
    const abort = new AbortController()
    fetch(snapshotUrl, { signal: abort.signal })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`Snapshot unavailable (${r.status})`))))
      .then((raw) => setHtml(prepareSnapshot(raw, position?.anchorText).html))
      .catch((e) => {
        if (!abort.signal.aborted) setFetchError(e.message)
      })
    return () => abort.abort()
  }, [snapshotUrl, position?.anchorText])

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-4 py-2">
        <a
          href={source.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs break-all text-accent hover:underline"
        >
          {source.sourceUrl}
        </a>
        <p className="mt-0.5 text-xs text-slate-400">Saved snapshot — the live page may have changed.</p>
      </div>

      {error ? (
        <p className="p-6 text-sm text-red-600">{error}</p>
      ) : html === null ? (
        <p className="p-6 text-sm text-slate-400">Loading snapshot…</p>
      ) : (
        <iframe
          srcDoc={html}
          title={source.title}
          sandbox="allow-scripts"
          className="flex-1 border-0 bg-white"
        />
      )}
    </div>
  )
}
