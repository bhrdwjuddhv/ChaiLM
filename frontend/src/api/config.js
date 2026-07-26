// Single source for the backend origin. Both the axios client and the SSE helper
// read it here so a deploy only has to set VITE_API_BASE_URL.
const origin = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

export const API_BASE = `${origin.replace(/\/+$/, '')}/api`
export const TOKEN_KEY = 'chaillm_token'
