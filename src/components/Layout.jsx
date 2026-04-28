import { LogOut, Settings, Smartphone, Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useConfig } from '../context/ConfigContext'
import { useState, useEffect } from 'react'
import EmisorSetupModal from './EmisorSetupModal'
import { EMISOR } from '../config/emisor'
import { usePWA } from '../hooks/usePWA'

export default function Layout({ children, headerActions }) {
  const { user, signOut } = useAuth()
  const { emisor, saveConfig } = useConfig()
  const [afipStatus, setAfipStatus] = useState(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { isInstallable, installPWA } = usePWA()

  useEffect(() => {
    fetch('/api/afip-status')
      .then(r => r.json())
      .then(data => setAfipStatus(data))
      .catch(() => setAfipStatus({ connected: false, mode: 'error' }))
  }, [])

  return (
    <div className="min-h-screen bg-base pt-6 pb-5 px-4 md:px-8 flex flex-col">
      <div className="max-w-7xl mx-auto flex-1 w-full">
        
        {/* ─── Top Header ─── */}
        <header className="flex items-center justify-between mb-8 relative">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Command Logo" className="h-6 md:h-8 w-auto object-contain" />
            <span className="text-[10px] md:text-xs font-black text-text-primary uppercase tracking-widest ml-1 border-l-2 border-border pl-2 md:pl-3 hidden md:inline-block">
              Facturador
            </span>
          </div>
          
          {/* Mobile Menu Toggle */}
          <button 
            className="lg:hidden p-2 rounded-lg bg-white border border-border shadow-sm text-text-primary z-50"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Desktop/Tablet Menu */}
          <div className={`
            absolute top-full right-0 mt-2 z-50 lg:static lg:mt-0 lg:z-auto
            flex-col lg:flex-row items-stretch lg:items-center gap-4 
            bg-white lg:px-5 lg:py-2.5 p-4 lg:p-0 rounded-2xl lg:rounded-full border border-border shadow-lg lg:shadow-sm
            ${mobileMenuOpen ? 'flex' : 'hidden lg:flex'}
            min-w-[200px] lg:min-w-0
          `}>
            {/* AFIP Status Indicator */}
            {afipStatus && (
              <div className="flex items-center gap-2 pr-2 border-r border-border min-w-max">
                <div className={`w-2 h-2 rounded-full ${
                  afipStatus.connected ? 'bg-green animate-pulse' : 
                  (afipStatus.tests?.homologacion === 'EXITO' ? 'bg-yellow' : 'bg-red')
                }`} />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {afipStatus.connected
                    ? `AFIP ${afipStatus.mode === 'production' ? 'PROD' : 'HOM'}`
                    : (afipStatus.tests?.homologacion === 'EXITO' && afipStatus.mode === 'production')
                      ? 'CERT. PRUEBAS' 
                      : afipStatus.mode === 'sandbox' ? 'SANDBOX' : 'SIN CONEXIÓN'
                  }
                </span>
              </div>
            )}

            {/* MercadoLibre / MercadoPago Status Indicator */}
            <div className="flex flex-col gap-1 pr-3 border-r border-border min-w-max justify-center">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#FFE100]" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-text-secondary leading-none">M. LIBRE</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#009EE3]" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-text-secondary leading-none">M. PAGO</span>
              </div>
            </div>

            {isInstallable && (
              <button
                onClick={installPWA}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#7C4DFF]/10 text-[#7C4DFF] hover:bg-[#7C4DFF] hover:text-white transition-all cursor-pointer border border-[#7C4DFF]/20 group"
                title="Instalar como App"
              >
                <Smartphone size={14} className="group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Instalar App</span>
              </button>
            )}

            {headerActions}

            {/* Emisor name + config button */}
            <button
              onClick={() => setConfigOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer group"
              title="Editar datos fiscales"
            >
              <span className="truncate max-w-[140px]">{emisor?.razon_social || EMISOR.razonSocial}</span>
              <Settings size={12} className="text-text-muted group-hover:text-accent group-hover:rotate-90 transition-all duration-300" />
            </button>

            <div className="w-full h-[1px] md:w-[1px] md:h-4 bg-border"></div>
            <span className="text-xs font-semibold text-text-secondary truncate max-w-[200px]">
               {user?.email || 'usuario'}
            </span>
            <div className="w-full h-[1px] md:w-[1px] md:h-4 bg-border"></div>
            <button
              onClick={signOut}
              className="text-text-muted hover:text-card-red transition-colors cursor-pointer flex items-center gap-2"
              title="Cerrar sesión"
            >
              <span className="text-xs font-bold uppercase tracking-widest">Salir</span>
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* ─── Main Content ─── */}
        <main>
          {children}
        </main>

        {/* ─── Footer ─── */}
        <footer className="mt-10 pt-5 border-t border-border/30 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-4 mb-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col items-center md:items-start gap-0.5">
              <span className="text-[8px] font-medium italic text-text-muted">Hecho por</span>
              <a href="https://www.commandsoluciones.com.ar" target="_blank" rel="noopener noreferrer" className="hover:scale-105 transition-transform">
                <img src="/logo.png" alt="Command Soluciones" className="h-5 w-auto" />
              </a>
            </div>

            <a 
              href="https://wa.me/5491178959108" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-green/10 flex items-center justify-center text-green group-hover:bg-green group-hover:text-white transition-all shadow-sm">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted group-hover:text-text-primary transition-colors">
                ¡escribinos!
              </span>
            </a>
          </div>
        </footer>
      </div>

      {/* ─── Config Modal ─── */}
      <EmisorSetupModal
        isOpen={configOpen}
        onClose={() => setConfigOpen(false)}
        onSave={saveConfig}
        currentData={emisor}
        isFirstSetup={false}
      />
    </div>
  )
}
