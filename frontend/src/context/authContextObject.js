import { createContext, useContext } from 'react'

// Split from AuthContext.jsx so that file only exports components (react-refresh rule).
export const AuthContext = createContext(null)

export const useAuth = () => useContext(AuthContext)
