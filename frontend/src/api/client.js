import axios from 'axios'
import { API_BASE, TOKEN_KEY } from './config'

export { TOKEN_KEY }

const api = axios.create({ baseURL: API_BASE })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// An expired token should log you out, but a failed login attempt shouldn't bounce you.
api.interceptors.response.use(
  (r) => r,
  (error) => {
    const hadToken = Boolean(localStorage.getItem(TOKEN_KEY))
    const isAuthAttempt = error.config?.url?.startsWith('/auth/')
    if (error.response?.status === 401 && hadToken && !isAuthAttempt) {
      localStorage.removeItem(TOKEN_KEY)
      window.location.assign('/login')
    }
    return Promise.reject(error)
  },
)

export const errorMessage = (error, fallback = 'Something went wrong') =>
  error?.response?.data?.error || error?.message || fallback

export default api
