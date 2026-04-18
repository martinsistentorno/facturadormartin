import { useAuth } from './context/AuthContext'
import Home from './pages/Home'
import Login from './pages/Login'

export default function App() {
  const { user, loading } = useAuth()

  // ─── Loading state ───
  /* if (loading) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="inline-block w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-text-muted text-sm">Cargando...</p>
        </div>
      </div>
    )
  } */

  // ─── Not authenticated ───
  /* if (!user) {
    return <Login />
  } */

  // ─── Authenticated ───
  return <Home />
}
