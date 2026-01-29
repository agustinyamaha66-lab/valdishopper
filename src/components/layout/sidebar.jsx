import { Link, useLocation } from 'react-router-dom'
import { Home, Truck, Map, RotateCcw, ClipboardList, BarChart2, DollarSign, Users, X } from 'lucide-react'

export default function Sidebar({ role, isOpen, toggle }) {
  const location = useLocation()
  const isActive = (path) => location.pathname === path ? 'bg-white/10 border-l-4 border-[#d63384] text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={toggle}
      />

      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-[#0f172a] shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        <div className="h-16 flex items-center justify-between px-6 bg-[#1e293b] border-b border-gray-700">
          <h1 className="text-xl font-black text-white tracking-tighter">
            VALDI<span className="text-[#d63384]">SHOPPER</span>
          </h1>
          <button onClick={toggle} className="md:hidden text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="p-4 space-y-2 overflow-y-auto h-[calc(100vh-64px)]">

            <Link to="/" className={`flex items-center gap-3 px-4 py-3 rounded-r-lg transition-all ${isActive('/')}`}>
              <Home size={20} /> <span className="font-bold text-sm">Inicio</span>
            </Link>

            <div className="pt-4 pb-2 px-4 text-xs font-bold text-gray-600 uppercase tracking-wider">Operaciones</div>

            <Link to="/transporte" className={`flex items-center gap-3 px-4 py-3 rounded-r-lg transition-all ${isActive('/transporte')}`}>
              <Truck size={20} /> <span className="font-bold text-sm">Torre de Control</span>
            </Link>

            <Link to="/ruteo" className={`flex items-center gap-3 px-4 py-3 rounded-r-lg transition-all ${isActive('/ruteo')}`}>
              <Map size={20} /> <span className="font-bold text-sm">Ruteo</span>
            </Link>

            <Link to="/devoluciones" className={`flex items-center gap-3 px-4 py-3 rounded-r-lg transition-all ${isActive('/devoluciones')}`}>
              <RotateCcw size={20} /> <span className="font-bold text-sm">Devoluciones</span>
            </Link>

            <Link to="/bitacora-operacion" className={`flex items-center gap-3 px-4 py-3 rounded-r-lg transition-all ${isActive('/bitacora-operacion')}`}>
              <ClipboardList size={20} /> <span className="font-bold text-sm">Bitácora Ops</span>
            </Link>

            {['admin', 'jefe_finanzas', 'analista_finanzas'].includes(role) && (
              <>
                <div className="pt-4 pb-2 px-4 text-xs font-bold text-gray-600 uppercase tracking-wider">Gestión</div>

                <Link to="/finanzas" className={`flex items-center gap-3 px-4 py-3 rounded-r-lg transition-all ${isActive('/finanzas')}`}>
                  <DollarSign size={20} /> <span className="font-bold text-sm">Costos</span>
                </Link>

                <Link to="/reportes" className={`flex items-center gap-3 px-4 py-3 rounded-r-lg transition-all ${isActive('/reportes')}`}>
                  <BarChart2 size={20} /> <span className="font-bold text-sm">Reportes</span>
                </Link>
              </>
            )}

            {role === 'admin' && (
              <>
                <div className="pt-4 pb-2 px-4 text-xs font-bold text-gray-600 uppercase tracking-wider">Admin</div>

                <Link to="/bitacora-dashboard" className={`flex items-center gap-3 px-4 py-3 rounded-r-lg transition-all ${isActive('/bitacora-dashboard')}`}>
                  <BarChart2 size={20} /> <span className="font-bold text-sm">Dash Bitácora</span>
                </Link>

                <Link to="/usuarios" className={`flex items-center gap-3 px-4 py-3 rounded-r-lg transition-all ${isActive('/usuarios')}`}>
                  <Users size={20} /> <span className="font-bold text-sm">Usuarios</span>
                </Link>
              </>
            )}
        </nav>
      </aside>
    </>
  )
}