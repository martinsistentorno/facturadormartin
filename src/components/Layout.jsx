import { LogOut, Settings, Menu, X, ChevronDown, RefreshCw, Database, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useConfig } from '../context/ConfigContext'
import { useState, useEffect } from 'react'
import EmisorSetupModal from './EmisorSetupModal'
import { EMISOR } from '../config/emisor'
import Sidebar from './Sidebar'

export default function Layout({ 
  children, 
  onSyncMeli, 
  onRecoverCAEs,
  // Sidebar props
  activeView,
  onViewChange,
  ventas,
  customFolders,
  labels,
  onCreateFolder,
  onDeleteFolder,
  onCreateLabel,
  onDeleteLabel,
  onNewVenta,
  activeFilter,
}) {
  const { user, signOut } = useAuth()
  const { emisor, saveConfig } = useConfig()
  const [afipStatus, setAfipStatus] = useState(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    // Mock AFIP status for the demo
    setAfipStatus({
      connected: true,
      mode: 'production',
      tests: { homologacion: 'EXITO' }
    });
  }, [])

  // Close mobile sidebar when view changes
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [activeView, activeFilter])

  return (
    <div className="min-h-screen bg-base flex flex-col">
      
      {/* ─── Top Header (full width) ─── */}
      <header className="flex items-center justify-between px-4 md:px-8 py-4 relative z-20">
        <div className="flex items-center gap-2">
          {/* Mobile sidebar toggle */}
          <button 
            className="lg:hidden p-2 rounded-lg bg-white border border-border shadow-sm text-text-primary mr-2"
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          >
            {mobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <img src="/logo-comand.png" alt="Command Logo" className="h-6 md:h-8 w-auto object-contain" />
          <span className="text-[10px] md:text-xs font-black text-text-primary uppercase tracking-widest ml-1 border-l-2 border-border pl-2 md:pl-3 hidden md:inline-block">
            Facturador
          </span>
        </div>
        
        {/* Desktop/Tablet Menu */}
        <div className={`
          absolute top-full right-4 mt-2 z-50 lg:static lg:mt-0 lg:z-auto
          flex-col lg:flex-row items-stretch lg:items-center gap-4 
          bg-white lg:px-5 lg:py-2.5 p-4 lg:p-0 rounded-2xl lg:rounded-full border border-border shadow-lg lg:shadow-sm
          ${mobileMenuOpen ? 'flex' : 'hidden lg:flex'}
          min-w-[200px] lg:min-w-0
        `}>

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
          
          {/* User Dropdown Menu */}
          <div className="relative">
            <button 
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-accent transition-colors cursor-pointer group py-1"
            >
              <div className="w-6 h-6 rounded-full bg-surface-alt flex items-center justify-center text-text-muted group-hover:bg-accent/10 group-hover:text-accent transition-all">
                <User size={14} />
              </div>
              <span className="truncate max-w-[150px]">{user?.email || 'Usuario'}</span>
              <ChevronDown size={12} className={`transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 mt-2 bg-white border border-border/40 rounded-xl shadow-xl z-50 min-w-[220px] overflow-hidden animate-slide-down py-1">
                  {/* Status Indicators Section */}
                  <div className="px-4 py-3 bg-surface-alt/30 border-b border-border/20">
                    <h4 className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted mb-3">Conexiones</h4>
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${afipStatus?.connected ? 'bg-green animate-pulse' : 'bg-red'}`} />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-text-primary">AFIP</span>
                        </div>
                        <span className="text-[8px] font-bold text-text-muted uppercase">{afipStatus?.mode === 'production' ? 'Producción' : 'Pruebas'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-[#FFE100]" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-text-primary">Mercado Libre</span>
                        </div>
                        <span className="text-[8px] font-bold text-green uppercase">Online</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-[#009EE3]" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-text-primary">Mercado Pago</span>
                        </div>
                        <span className="text-[8px] font-bold text-green uppercase">Online</span>
                      </div>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => { onSyncMeli?.(); setUserMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                    >
                      <RefreshCw size={14} className="text-yellow" />
                      Sincronizar Meli
                    </button>
                    
                    <button
                      onClick={() => { onRecoverCAEs?.(); setUserMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                    >
                      <Database size={14} className="text-blue" />
                      Recuperar CAEs
                    </button>
                  </div>

                  <div className="h-px bg-border/20 mx-2 my-1" />

                  <button
                    onClick={() => { setUserMenuOpen(false); signOut(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-card-red hover:bg-red-subtle transition-colors cursor-pointer"
                  >
                    <LogOut size={14} />
                    Salir
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── Body: Sidebar + Main Content ─── */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Mobile Sidebar Overlay */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setMobileSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <div className={`
          fixed top-0 left-0 h-full z-40 bg-base
          lg:static lg:z-auto
          transition-transform duration-300
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <Sidebar
            activeView={activeView}
            onViewChange={(view, filter) => { onViewChange(view, filter); setMobileSidebarOpen(false) }}
            ventas={ventas}
            customFolders={customFolders}
            labels={labels}
            onCreateFolder={onCreateFolder}
            onDeleteFolder={onDeleteFolder}
            onCreateLabel={onCreateLabel}
            onDeleteLabel={onDeleteLabel}
            onNewVenta={() => { onNewVenta?.(); setMobileSidebarOpen(false) }}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            activeFilter={activeFilter}
          />
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 pb-20">
          <div className="w-full">
            {children}
          </div>

          {/* ─── Footer ─── */}
          <footer className="mt-10 pt-5 border-t border-border/30 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-4 mb-4">
            
            {/* Tablet & Desktop Layout (md+) */}
            <div className="hidden md:flex flex-row items-center justify-between gap-6">
              {/* Left: Install Button */}
              <div className="flex-1 flex justify-start">
                <button 
                  className="px-4 py-1.5 rounded-lg border border-border bg-white text-text-secondary text-[10px] font-bold hover:bg-surface-alt hover:border-text-muted/30 transition-all shadow-sm cursor-pointer uppercase tracking-wider"
                  onClick={() => alert('la versión DEMO no se puede descargar')}
                >
                  Instalar App
                </button>
              </div>

              {/* Center: Brand */}
              <div className="flex-1 flex flex-col items-center gap-0.5">
                <span className="text-[8px] font-medium italic text-text-muted">Hecho por</span>
                <a href="https://www.commandsoluciones.com.ar" target="_blank" rel="noopener noreferrer" className="hover:scale-105 transition-transform">
                  <img src="/logo-comand.png" alt="Command Soluciones" className="h-5 w-auto" />
                </a>
              </div>

              {/* Right: WhatsApp */}
              <div className="flex-1 flex justify-end">
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
            </div>

            {/* Mobile Layout (default) */}
            <div className="flex md:hidden flex-col items-center gap-6">
              {/* Top: Install Button */}
              <button 
                className="px-4 py-1.5 rounded-lg border border-border bg-white text-text-secondary text-[10px] font-bold hover:bg-surface-alt transition-all shadow-sm cursor-pointer uppercase tracking-wider"
                onClick={() => alert('la versión DEMO no se puede descargar')}
              >
                Instalar App
              </button>

              {/* Bottom: Brand & WhatsApp side-by-side */}
              <div className="flex flex-row items-center justify-between w-full">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[8px] font-medium italic text-text-muted">Hecho por</span>
                  <a href="https://www.commandsoluciones.com.ar" target="_blank" rel="noopener noreferrer">
                    <img src="/logo-comand.png" alt="Command Soluciones" className="h-5 w-auto" />
                  </a>
                </div>

                <a 
                  href="https://wa.me/5491178959108" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <div className="w-8 h-8 rounded-full bg-green/10 flex items-center justify-center text-green shadow-sm">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted">
                    ¡escribinos!
                  </span>
                </a>
              </div>
            </div>

          </footer>
        </main>
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
