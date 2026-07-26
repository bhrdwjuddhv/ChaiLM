import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/authContextObject'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-10 text-sm text-slate-400">Loading…</div>
  return user ? <Outlet /> : <Navigate to="/login" replace />
}
