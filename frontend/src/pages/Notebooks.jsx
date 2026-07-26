import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { errorMessage } from '../api/client'
import { useAuth } from '../context/authContextObject'

const dateOf = (n) => new Date(n.updatedAt).toLocaleDateString()

export default function Notebooks() {
  const { user, logout } = useAuth()
  const [notebooks, setNotebooks] = useState(null)
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/notebooks')
      .then(({ data }) => setNotebooks(data))
      .catch((err) => {
        setError(errorMessage(err))
        setNotebooks([])
      })
  }, [])

  const create = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    setError('')
    try {
      const { data } = await api.post('/notebooks', { title })
      setNotebooks([data, ...notebooks])
      setTitle('')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const remove = async (id) => {
    if (!confirm('Delete this notebook and everything in it?')) return
    const previous = notebooks
    setNotebooks(notebooks.filter((n) => n._id !== id))
    try {
      await api.delete(`/notebooks/${id}`)
    } catch (err) {
      setError(errorMessage(err))
      setNotebooks(previous)
    }
  }

  return (
    <div className="min-h-svh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-medium text-slate-800">
            chai<span className="text-accent">LLM</span>
          </span>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500">{user?.name}</span>
            <button onClick={logout} className="text-slate-500 hover:text-slate-900">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-medium text-slate-900">Your notebooks</h1>
        <p className="mt-1 text-sm text-slate-500">
          Each notebook is its own knowledge base. Sources never cross between them.
        </p>

        <form onSubmit={create} className="mt-6 flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name a new notebook…"
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
          <button
            type="submit"
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            Create
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {notebooks === null ? (
          <p className="mt-10 text-sm text-slate-400">Loading…</p>
        ) : notebooks.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-dashed border-slate-300 px-6 py-14 text-center text-sm text-slate-400">
            No notebooks yet. Create one above to get started.
          </p>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {notebooks.map((n) => (
              <li
                key={n._id}
                className="group relative rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-accent/40 hover:shadow-sm"
              >
                <Link to={`/app/notebook/${n._id}`} className="block">
                  <h2 className="pr-6 font-medium text-slate-900">{n.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                    {n.description || 'No description'}
                  </p>
                  <p className="mt-4 text-xs text-slate-400">Updated {dateOf(n)}</p>
                </Link>
                <button
                  onClick={() => remove(n._id)}
                  aria-label={`Delete ${n.title}`}
                  className="absolute top-4 right-4 rounded-md px-1.5 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-600 focus:opacity-100"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
