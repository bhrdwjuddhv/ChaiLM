import { useEffect, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'

// Vite resolves this to a hashed asset URL at build time — no CDN, no CSP surprises.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

// Match the first handful of cited words against the page's text layer. Exact
// full-snippet matching fails constantly — pdf.js splits text into arbitrary spans.
function makeHighlighter(snippet) {
  const needle = (snippet || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 6)
    .join(' ')
    .toLowerCase()

  if (needle.length < 8) return undefined

  return ({ str }) => {
    if (!str?.toLowerCase().includes(needle.slice(0, 20))) return str
    return `<mark class="bg-amber-200/70">${str}</mark>`
  }
}

export default function PdfViewer({ source, position, snippet }) {
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(position?.page || 1)
  const [width, setWidth] = useState(520)
  const [error, setError] = useState('')

  // Clicking a different citation jumps the page, but paging by hand still works.
  // Adjusting during render (not in an effect) avoids a wasted render pass.
  const [citedPage, setCitedPage] = useState(position?.page)
  if (position?.page !== citedPage) {
    setCitedPage(position?.page)
    setPage(position?.page || 1)
  }

  useEffect(() => {
    const measure = () => setWidth(Math.min(520, window.innerWidth * 0.32))
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  if (!source.storageUrl) {
    return <p className="p-6 text-sm text-slate-400">This PDF is still uploading.</p>
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-center gap-3 border-b border-slate-200 px-4 py-2 text-sm">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
        >
          ←
        </button>
        <span className="text-slate-500">
          Page {page}
          {pages ? ` of ${pages}` : ''}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(pages || p, p + 1))}
          disabled={pages > 0 && page >= pages}
          className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
        >
          →
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-slate-100 p-4">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <Document
            file={source.storageUrl}
            onLoadSuccess={({ numPages }) => setPages(numPages)}
            onLoadError={(e) => setError(`Could not load PDF: ${e.message}`)}
            loading={<p className="text-sm text-slate-400">Loading PDF…</p>}
          >
            <Page
              pageNumber={page}
              width={width}
              customTextRenderer={makeHighlighter(snippet)}
              className="mx-auto shadow-sm"
            />
          </Document>
        )}
      </div>
    </div>
  )
}
