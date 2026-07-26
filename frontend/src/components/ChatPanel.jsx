import { useEffect, useRef, useState } from 'react'

// ponytail: MessageBubble, CitationChip and QueryInput are here rather than in
// four files — they only ever render inside this panel.

function CitationChip({ citation, onOpen }) {
  return (
    <button
      onClick={() => onOpen(citation)}
      title={citation.snippet}
      className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-accent/30 bg-accent/10 px-1 align-[2px] text-[11px] font-medium text-accent transition hover:bg-accent/20"
    >
      {citation.id}
    </button>
  )
}

// Splits "…claim [1] and more" into text and clickable chips.
function renderWithCitations(content, citations, onOpen) {
  const byId = new Map(citations.map((c) => [c.id, c]))
  return content.split(/(\[\d+\])/g).map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/)
    const citation = match && byId.get(match[1])
    return citation ? (
      <CitationChip key={i} citation={citation} onOpen={onOpen} />
    ) : (
      <span key={i}>{part}</span>
    )
  })
}

function MessageBubble({ message, onOpenCitation }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[80%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm whitespace-pre-wrap text-white">
          {message.content}
        </p>
      </div>
    )
  }

  const sources = [...new Map((message.citations || []).map((c) => [c.sourceId, c])).values()]

  return (
    <div className="max-w-[85%]">
      <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-slate-800">
        {message.citations?.length
          ? renderWithCitations(message.content, message.citations, onOpenCitation)
          : message.content}
        {message.streaming && <span className="ml-0.5 animate-pulse text-slate-400">▍</span>}
      </p>
      {sources.length > 0 && (
        <p className="mt-2 text-xs text-slate-400">
          From {sources.map((s) => s.title).join(', ')}
        </p>
      )}
    </div>
  )
}

export default function ChatPanel({ messages, busy, error, onAsk, onOpenCitation }) {
  const [question, setQuestion] = useState('')
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const submit = (e) => {
    e.preventDefault()
    const q = question.trim()
    if (!q || busy) return
    setQuestion('')
    onAsk(q)
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-white">
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="mx-auto max-w-2xl space-y-6">
          {messages.length === 0 && (
            <div className="pt-24 text-center">
              <h2 className="text-lg font-medium text-slate-800">Ask your sources</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                Answers come only from this notebook, and every claim links back to where it
                came from.
              </p>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble key={m._id} message={m} onOpenCitation={onOpenCitation} />
          ))}

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <form onSubmit={submit} className="border-t border-slate-200 px-8 py-4">
        <div className="mx-auto flex max-w-2xl gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Type a query here…"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
          <button
            type="submit"
            disabled={busy || !question.trim()}
            className="rounded-xl bg-accent px-5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {busy ? '…' : 'Ask'}
          </button>
        </div>
      </form>
    </section>
  )
}
