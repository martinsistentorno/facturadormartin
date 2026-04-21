import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Loader2, AlertCircle } from 'lucide-react'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await signIn(email, password)
    } catch (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Email o contraseña incorrectos'
          : err.message
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-base flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo Text Match Screenshot Style */}
        <div className="text-center mb-8 flex justify-center items-baseline gap-[1px]">
          <h1 className="text-4xl font-extrabold text-card-red uppercase tracking-tighter" style={{fontFamily: 'var(--font-montserrat)'}}>
            C<span className="text-text-primary">OMMAND</span>
          </h1>
        </div>

        {/* Text Above Form */}
        <div className="text-center mb-8">
           <h2 className="text-2xl font-black text-text-primary uppercase tracking-tight" style={{fontFamily: 'var(--font-montserrat)'}}>
              INICIAR <span className="text-card-red">SESIÓN</span>
           </h2>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-[32px] p-8 md:p-10 shadow-sm border border-border space-y-6"
        >
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-card-red/20 rounded-2xl px-4 py-3 text-card-red text-sm animate-slide-down">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="block text-xs font-bold text-text-secondary uppercase tracking-widest ml-1" style={{fontFamily: 'var(--font-outfit)'}}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              className="w-full input-soft"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-xs font-bold text-text-secondary uppercase tracking-widest ml-1" style={{fontFamily: 'var(--font-outfit)'}}>
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full input-soft"
            />
          </div>

          <div className="pt-4 flex justify-center">
            <button
              id="btn-login"
              type="submit"
              disabled={loading}
              className="btn-accent w-full max-w-[280px]"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin text-white" />
              ) : (
                'INGRESAR'
              )}
            </button>
          </div>
        </form>

        <p className="text-center text-text-muted text-[10px] mt-8 tracking-widest uppercase font-bold" style={{fontFamily: 'var(--font-outfit)'}}>
          Acceso privado - Command Soluciones
        </p>
      </div>
    </div>
  )
}
