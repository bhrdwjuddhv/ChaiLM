import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import api, { errorMessage } from '../api/client'
import { streamChat } from '../api/sse'
import Sidebar from '../components/Sidebar'
import AddSourceModal from '../components/AddSourceModal'
import ChatPanel from '../components/ChatPanel'
import SourceViewer from '../components/SourceViewer'
import ExtrasPanel from '../components/ExtrasPanel'

const isBusy = (s) => s.status === 'pending' || s.status === 'processing'

export default function Workspace() {
  const { id } = useParams()
  const [notebook, setNotebook] = useState(null)
  const [sources, setSources] = useState(null)
  const [messages, setMessages] = useState([])
  const [adding, setAdding] = useState(false)
  const [viewing, setViewing] = useState(null) // { sourceId, position, snippet }
  const [extras, setExtras] = useState(false)
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState('')
  const streamId = useRef(null)

  const loadSources = useCallback(
    () => api.get(`/notebooks/${id}/sources`).then(({ data }) => setSources(data)),
    [id],
  )

  useEffect(() => {
    api.get(`/notebooks/${id}`).then(({ data }) => setNotebook(data)).catch(() => {})
    api.get(`/notebooks/${id}/messages`).then(({ data }) => setMessages(data)).catch(() => {})
    loadSources().catch((err) => {
      setError(errorMessage(err))
      setSources([])
    })
  }, [id, loadSources])

  // Poll only while something is actually indexing. Depending on the boolean
  // rather than the array keeps each poll from tearing down and rebuilding the timer.
  const anyIndexing = sources?.some(isBusy) ?? false
  useEffect(() => {
    if (!anyIndexing) return
    const timer = setInterval(() => loadSources().catch(() => {}), 2000)
    return () => clearInterval(timer)
  }, [anyIndexing, loadSources])

  const ask = async (question) => {
    setError('')
    setAsking(true)
    streamId.current = `streaming-${Date.now()}`

    setMessages((prev) => [
      ...prev,
      { _id: `user-${Date.now()}`, role: 'user', content: question },
      { _id: streamId.current, role: 'assistant', content: '', citations: [], streaming: true },
    ])

    const patchStream = (patch) =>
      setMessages((prev) =>
        prev.map((m) => (m._id === streamId.current ? { ...m, ...patch(m) } : m)),
      )

    try {
      await streamChat(id, question, {
        token: ({ t }) => patchStream((m) => ({ content: m.content + t })),
        done: ({ content, citations }) => patchStream(() => ({ content, citations, streaming: false })),
        error: ({ error: message }) => {
          setError(message)
          patchStream(() => ({ streaming: false }))
        },
      })
    } catch (err) {
      setError(errorMessage(err))
      patchStream(() => ({ streaming: false }))
    } finally {
      setAsking(false)
    }
  }

  const reindexSource = async (source) => {
    setError('')
    try {
      const { data } = await api.post(`/sources/${source._id}/reindex`)
      setSources((prev) => prev.map((s) => (s._id === data._id ? data : s)))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const deleteSource = async (source) => {
    if (!confirm(`Delete “${source.title}”? Its indexed content goes too.`)) return
    const previous = sources
    setSources((prev) => prev.filter((s) => s._id !== source._id))
    setViewing((v) => (v?.sourceId === source._id ? null : v))
    try {
      await api.delete(`/sources/${source._id}`)
    } catch (err) {
      setError(errorMessage(err))
      setSources(previous)
    }
  }

  // A sidebar row opens the source plain; a citation chip opens it at its exact spot.
  const openSource = (source) => setViewing({ sourceId: source._id })
  const openCitation = (citation) =>
    setViewing({
      sourceId: citation.sourceId,
      position: citation.position,
      snippet: citation.snippet,
    })

  const viewedSource = viewing && sources?.find((s) => s._id === viewing.sourceId)

  return (
    <div className="flex h-svh bg-white">
      <Sidebar
        notebook={notebook}
        sources={sources}
        onAdd={() => setAdding(true)}
        onSelect={openSource}
        onReindex={reindexSource}
        onDelete={deleteSource}
        onExtras={() => setExtras(true)}
      />
      <ChatPanel
        messages={messages}
        busy={asking}
        error={error}
        onAsk={ask}
        onOpenCitation={openCitation}
      />
      {viewedSource && (
        <SourceViewer
          key={viewedSource._id}
          source={viewedSource}
          position={viewing.position}
          snippet={viewing.snippet}
          onClose={() => setViewing(null)}
        />
      )}
      {extras && notebook && (
        <ExtrasPanel notebook={notebook} onClose={() => setExtras(false)} />
      )}
      {adding && (
        <AddSourceModal
          notebookId={id}
          onClose={() => setAdding(false)}
          onAdded={(source) => setSources((prev) => [...(prev || []), source])}
        />
      )}
    </div>
  )
}
