import { lazy, Suspense } from 'react'
import YoutubeViewer from './YoutubeViewer'
import WebViewer from './WebViewer'
import TextViewer from './TextViewer'

// pdf.js is ~430 kB — keep it out of the initial bundle until a PDF is opened.
const PdfViewer = lazy(() => import('./PdfViewer'))

const VIEWERS = {
  pdf: PdfViewer,
  youtube: YoutubeViewer,
  playlist: YoutubeViewer,
  website: WebViewer,
  text: TextViewer,
  vtt: TextViewer,
}

export default function SourceViewer({ source, position, snippet, onClose }) {
  // A text source with a YouTube link pasted inside it should still play.
  const Viewer =
    source.type === 'text' && source.metadata?.embeddedVideoId ? YoutubeViewer : VIEWERS[source.type]

  return (
    <aside className="flex w-[38%] min-w-[360px] shrink-0 animate-[slidein_180ms_ease-out] flex-col border-l border-slate-200 bg-white">
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium text-slate-900">{source.title}</h2>
          {source.status !== 'indexed' && (
            <p className="mt-0.5 text-xs text-amber-600">
              {source.status === 'failed' ? source.error || 'Indexing failed' : 'Still indexing…'}
            </p>
          )}
        </div>
        <button onClick={onClose} aria-label="Close viewer" className="text-slate-400 hover:text-slate-700">
          ✕
        </button>
      </header>

      <div className="min-h-0 flex-1">
        {Viewer ? (
          <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading viewer…</p>}>
            <Viewer source={source} position={position} snippet={snippet} />
          </Suspense>
        ) : (
          <p className="p-6 text-sm text-slate-400">No viewer for “{source.type}” sources.</p>
        )}
      </div>
    </aside>
  )
}
