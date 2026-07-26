import { Link } from 'react-router-dom'

// ponytail: StatusDot and SourceRow live here rather than in their own files —
// they are a dozen lines each and have exactly one caller.
const DOT = {
  pending: 'bg-amber-400',
  processing: 'bg-amber-400 animate-pulse',
  indexed: 'bg-emerald-500',
  failed: 'bg-red-500',
}

const TYPE_LABEL = {
  pdf: 'PDF',
  website: 'Web',
  text: 'Text',
  youtube: 'Video',
  playlist: 'Playlist',
  vtt: 'Transcript',
}

const isBusy = (s) => s.status === 'pending' || s.status === 'processing'

function StatusDot({ status }) {
  return (
    <span
      title={status}
      aria-label={status}
      className={`mt-1.5 size-2 shrink-0 rounded-full ${DOT[status] || 'bg-slate-300'}`}
    />
  )
}

function SourceRow({ source, onSelect, onReindex, onDelete }) {
  const busy = isBusy(source)

  return (
    <li className="group relative rounded-xl transition hover:bg-white">
      <button onClick={() => onSelect(source)} className="flex w-full gap-2.5 px-3 py-2.5 text-left">
        <StatusDot status={source.status} />
        <span className="min-w-0 flex-1">
          <span className="block truncate pr-12 text-sm text-slate-800">{source.title}</span>
          <span className="mt-0.5 block text-xs text-slate-400">
            {TYPE_LABEL[source.type] || source.type}
            {source.status === 'pending' && ' · queued'}
            {source.status === 'processing' && ` · indexing ${source.progress}%`}
            {source.status === 'indexed' && ` · ${source.chunkCount} chunks`}
            {source.status === 'failed' && ' · failed'}
          </span>

          {busy && (
            <span
              role="progressbar"
              aria-valuenow={source.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-2 block h-1 overflow-hidden rounded-full bg-slate-200"
            >
              <span
                className="block h-full rounded-full bg-amber-400 transition-[width] duration-500"
                style={{ width: `${Math.max(4, source.progress)}%` }}
              />
            </span>
          )}

          {source.status === 'failed' && source.error && (
            <span className="mt-1 block text-xs break-words text-red-600">{source.error}</span>
          )}
        </span>
      </button>

      <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        {!busy && (
          <button
            onClick={() => onReindex(source)}
            title={source.status === 'failed' ? 'Retry indexing' : 'Re-index'}
            aria-label={`Re-index ${source.title}`}
            className="rounded-md px-1.5 py-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ↻
          </button>
        )}
        <button
          onClick={() => onDelete(source)}
          aria-label={`Delete ${source.title}`}
          className="rounded-md px-1.5 py-0.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
        >
          ✕
        </button>
      </div>
    </li>
  )
}

export default function Sidebar({ notebook, sources, onAdd, onSelect, onReindex, onDelete, onExtras }) {
  const indexing = sources?.filter(isBusy).length || 0

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-50">
      <div className="border-b border-slate-200 px-4 py-4">
        <Link to="/app" className="text-xs text-slate-400 hover:text-slate-600">
          ← All notebooks
        </Link>
        <h1 className="mt-2 truncate font-medium text-slate-900">{notebook?.title || '…'}</h1>
        {indexing > 0 && (
          <p className="mt-1 text-xs text-amber-600">
            {indexing} indexing — you can still ask about the rest
          </p>
        )}
      </div>

      <div className="px-3 pt-3">
        <button
          onClick={onAdd}
          className="w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-sm text-slate-600 transition hover:border-accent hover:text-accent"
        >
          + Add source
        </button>
      </div>

      <ul className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {sources === null ? (
          <li className="px-3 py-2 text-sm text-slate-400">Loading…</li>
        ) : sources.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-slate-400">
            No sources yet. Add one to get started.
          </li>
        ) : (
          sources.map((s) => (
            <SourceRow
              key={s._id}
              source={s}
              onSelect={onSelect}
              onReindex={onReindex}
              onDelete={onDelete}
            />
          ))
        )}
      </ul>

      <div className="border-t border-slate-200 p-3">
        <button
          onClick={onExtras}
          disabled={!sources?.some((s) => s.status === 'indexed')}
          className="w-full rounded-xl py-2 text-sm text-slate-600 transition hover:bg-white disabled:opacity-40"
        >
          Roadmap &amp; podcast
        </button>
      </div>
    </aside>
  )
}
