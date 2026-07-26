import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/authContextObject'

const steps = [
  ['Add sources', 'PDFs, websites, plain text, YouTube videos and playlists, transcripts.'],
  ['Ask questions', 'Ask in plain language. Answers stream back as they are written.'],
  ['Get cited answers', 'Every claim carries a citation that opens the exact spot in the source.'],
]

const features = [
  ['Isolated notebooks', 'A question in one notebook can only ever reach that notebook’s sources.'],
  ['Cited answers', 'Grounded in your sources — or it tells you the answer is not there.'],
  ['Source viewer', 'Jump to the PDF page, the video timestamp, or the highlighted passage.'],
  ['Learning roadmaps', 'Turn a playlist into an ordered path through the material.'],
  ['Podcast mode', 'Generate a two-speaker audio rundown of everything in a notebook.'],
]

export default function Landing() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/app" replace />

  return (
    <div className="min-h-svh bg-slate-50 text-slate-700">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-medium text-slate-800">
          chai<span className="text-accent">LLM</span>
        </span>
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/login" className="rounded-lg px-3 py-2 text-slate-600 hover:text-slate-900">
            Login
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-slate-900 px-3.5 py-2 font-medium text-white transition hover:bg-slate-700"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="py-20 text-center sm:py-28">
          <h1 className="mx-auto max-w-3xl text-4xl leading-tight font-medium text-slate-900 sm:text-5xl">
            Turn any PDF, website, or video into a source you can ask questions
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-500">
            chaiLLM builds a private knowledge base per notebook, then answers from it — with
            citations that take you straight back to the source.
          </p>
          <Link
            to="/register"
            className="mt-9 inline-block rounded-xl bg-accent px-6 py-3 text-sm font-medium text-white transition hover:opacity-90"
          >
            Create your first notebook
          </Link>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {steps.map(([title, body], i) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6">
              <span className="text-xs font-medium text-accent">Step {i + 1}</span>
              <h2 className="mt-2 font-medium text-slate-900">{title}</h2>
              <p className="mt-1.5 text-sm text-slate-500">{body}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 py-20 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white/60 p-6">
              <h3 className="font-medium text-slate-900">{title}</h3>
              <p className="mt-1.5 text-sm text-slate-500">{body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-400">
        chaiLLM
      </footer>
    </div>
  )
}
