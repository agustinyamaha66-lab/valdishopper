import { useState } from 'react'

export default function Sidebar({ cambiarVista, vistaActual, isOpen, setIsOpen, role }) {
  const [menuAbierto, setMenuAbierto] = useState('OPERACIONES')

  const toggleMenu = (nombre) => {
    if (menuAbierto === nombre) setMenuAbierto('')
    else setMenuAbierto(nombre)
  }

  const SubMenuLink = ({ label, viewName }) => (
    <button
      onClick={() => { cambiarVista(viewName); setIsOpen(false); }}
      className={`w-full text-left pl-12 py-2 text-sm transition-colors border-l-4 ${
        vistaActual === viewName ? 'border-[#d63384] bg-[#14284d] text-white font-bold' : 'border-transparent text-gray-300 hover:text-white hover:bg-[#2a4d8c]'
      }`}
    >
      {label}
    </button>
  )

  // --- LÓGICA DE PERMISOS ---
  const canViewOps = ['admin', 'cco'].includes(role)
  const canViewFinanceGroup = ['admin', 'jefe_finanzas', 'cco'].includes(role)
  const canViewGestionCostos = ['admin', 'cco', 'jefe_finanzas'].includes(role)
  const canViewReportesFinancieros = ['admin', 'jefe_finanzas'].includes(role)
  const canViewAdminPanel = role === 'admin'

  return (
    <aside onMouseLeave={() => setIsOpen(false)} className={`fixed left-0 top-0 h-screen w-64 bg-[#1e3c72] text-white flex flex-col shadow-2xl z-50 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>

      {/* HEADER SIDEBAR */}
      <div className="h-16 flex items-center justify-center border-b border-[#2a4d8c] bg-[#14284d]">
        <div className="text-center">
          <h1 className="text-2xl font-black tracking-tighter">CCO HUB</h1>
          <p className="text-[10px] text-[#d63384] font-bold tracking-[0.2em] uppercase">{role?.replace('_', ' ')}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-2">

        {/* GRUPO OPERACIONES */}
        {canViewOps && (
          <div>
            <button onClick={() => toggleMenu('OPERACIONES')} className="w-full flex items-center justify-between px-6 py-3 hover:bg-[#2a4d8c] transition-colors">
              <div className="flex items-center gap-3 font-bold text-sm tracking-wide"><span></span> OPERACIONES</div>
              <span className={`transform transition-transform ${menuAbierto === 'OPERACIONES' ? 'rotate-180' : ''}`}>▼</span>
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${menuAbierto === 'OPERACIONES' ? 'max-h-80' : 'max-h-0'}`}>
              <SubMenuLink label="Torre de Control" viewName="transporte" />
              <SubMenuLink label="Devoluciones Bodega" viewName="devoluciones" />
              <SubMenuLink label="Registro de Incidencias" viewName="bitacora_ops" />

              {/* --- AQUÍ ESTÁ EL CAMBIO --- */}
              {/* Solo mostramos el Dashboard si el rol es 'admin'. El CCO no lo verá. */}
              {role === 'admin' && (
                  <SubMenuLink label="Dashboard Incidencias" viewName="bitacora_dash" />
              )}

              <SubMenuLink label="Ruteo Inteligente" viewName="ruteo" />
            </div>
          </div>
        )}

        {/* GRUPO FINANZAS */}
        {canViewFinanceGroup && (
          <div>
            <button onClick={() => toggleMenu('FINANZAS')} className="w-full flex items-center justify-between px-6 py-3 hover:bg-[#2a4d8c] transition-colors">
              <div className="flex items-center gap-3 font-bold text-sm tracking-wide"><span></span> FINANZAS</div>
              <span className={`transform transition-transform ${menuAbierto === 'FINANZAS' ? 'rotate-180' : ''}`}>▼</span>
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${menuAbierto === 'FINANZAS' ? 'max-h-40' : 'max-h-0'}`}>
              {canViewGestionCostos && <SubMenuLink label="Gestión Costos" viewName="finanzas" />}
              {canViewReportesFinancieros && <SubMenuLink label="Reporte de Costos" viewName="kpis" />}
            </div>
          </div>
        )}

        {/* GRUPO ADMINISTRACIÓN (NUEVO - SOLO ADMIN) */}
        {canViewAdminPanel && (
          <div className="mt-4 pt-4 border-t border-blue-800/50">
             <div className="px-6 pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sistema</div>
             <button
                onClick={() => { cambiarVista('admin_users'); setIsOpen(false); }}
                className={`w-full flex items-center gap-3 px-6 py-3 hover:bg-[#2a4d8c] transition-colors ${vistaActual === 'admin_users' ? 'bg-[#14284d] text-[#d63384] font-bold border-l-4 border-[#d63384]' : 'text-gray-300'}`}
             >
                <span>👥</span> Gestión Usuarios
             </button>
          </div>
        )}

      </div>

      {/* FOOTER USUARIO */}
      <div className="p-4 bg-[#14284d] border-t border-[#2a4d8c]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#d63384] to-blue-500 flex items-center justify-center font-bold text-lg text-white">
             {role ? role.substring(0,2).toUpperCase() : 'U'}
          </div>
          <div>
            <p className="text-sm font-bold text-white">Usuario</p>
            <p className="text-[10px] text-gray-400 uppercase">{role?.replace('_', ' ')}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}