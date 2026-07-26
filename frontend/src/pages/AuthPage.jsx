import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authContextObject'
import { errorMessage } from '../api/client'

const copy = {
  login: {
    heading: 'Welcome back',
    sub: 'Sign in to your notebooks.',
    cta: 'Sign in',
    footer: ['New here?', 'Create an account', '/register'],
  },
  register: {
    heading: 'Create your account',
    sub: 'Start turning sources into answers.',
    cta: 'Create account',
    footer: ['Already have an account?', 'Sign in', '/login'],
  },
}

const field =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/15'

function AuthPage({ mode }) {
  const { user, login, register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/app" replace />

  const t = copy[mode]
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await (mode === 'login' ? login : register)(form)
      navigate('/app', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-svh place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 block text-center text-lg font-medium text-slate-800">
          chai<span className="text-accent">LLM</span>
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <h1 className="text-xl font-medium text-slate-900">{t.heading}</h1>
          <p className="mt-1 text-sm text-slate-500">{t.sub}</p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            {mode === 'register' && (
              <input
                className={field}
                placeholder="Name"
                value={form.name}
                onChange={set('name')}
                autoComplete="name"
                required
              />
            )}
            <input
              className={field}
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
              required
            />
            <input
              className={field}
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={set('password')}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'register' ? 8 : undefined}
              required
            />

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Please wait…' : t.cta}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-slate-500">
          {t.footer[0]}{' '}
          <Link to={t.footer[2]} className="font-medium text-accent hover:underline">
            {t.footer[1]}
          </Link>
        </p>
      </div>
    </main>
  )
}

export const Login = () => <AuthPage mode="login" />
export const Register = () => <AuthPage mode="register" />
