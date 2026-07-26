import { useEffect, useState } from 'react'
import api, { TOKEN_KEY } from '../api/client'
import { AuthContext } from './authContextObject'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Nothing to restore without a token, so start settled rather than flashing a loader.
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)))

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return
    api
      .get('/auth/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false))
  }, [])

  const authenticate = async (path, payload) => {
    const { data } = await api.post(path, payload)
    localStorage.setItem(TOKEN_KEY, data.token)
    setUser(data.user)
  }

  const value = {
    user,
    loading,
    login: (payload) => authenticate('/auth/login', payload),
    register: (payload) => authenticate('/auth/register', payload),
    logout: () => {
      localStorage.removeItem(TOKEN_KEY)
      setUser(null)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
