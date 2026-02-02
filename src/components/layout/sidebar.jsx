import { Link, useLocation } from "react-router-dom";
import {
  Home as HomeIcon,
  Truck,
  Map,
  RotateCcw,
  ClipboardList,
  BarChart2,
  DollarSign,
  Users,
  X,
  PieChart,
  ShieldCheck
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function Sidebar({ sidebarOpen, setSidebarOpen }) {
  const location = useLocation();
  const { role } = useAuth();

  const isOpen = typeof sidebarOpen === "boolean" ? sidebarOpen : true;
  const toggle =
    typeof setSidebarOpen === "function"
      ? () => setSidebarOpen((v) => !v)
      : () => {};

  const esAdmin = role === "admin";
  const esFinanzas = ["admin", "jefe_finanzas", "analista_finanzas"].includes(role);

  // --- LÓGICA DE CIERRE AUTOMÁTICO ---
  const handleMouseLeave = () => {
    // Solo cerramos automáticamente en pantallas grandes (Desktop)
    // En móviles sería molesto porque no hay "mouse leave" real.
    if (window.innerWidth >= 768 && typeof setSidebarOpen === "function") {
      setSidebarOpen(false);
    }
  };

  // Estilos dinámicos para el link activo
  const getLinkClass = (path) => {
    const active = location.pathname === path;
    return `
      flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
      ${active 
        ? "bg-[#d63384] text-white shadow-lg shadow-pink-900/20 font-bold" 
        : "text-blue-100/70 hover:text-white hover:bg-white/10"
      }
    `;
  };

  const closeOnMobile = () => {
    if (typeof setSidebarOpen === "function") setSidebarOpen(false);
  };

  return (
    <>
      {/* Overlay mobile (Fondo oscuro al abrir en celular) */}
      <div
        className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={toggle}
      />

      {/* SIDEBAR */}
      <aside
        // Evento para cerrar al quitar el mouse
        onMouseLeave={handleMouseLeave}
        className={`
            fixed top-0 left-0 z-50 h-full w-64 
            bg-[#0f254a]/95 backdrop-blur-xl border-r border-white/5
            shadow-2xl transition-transform duration-300 ease-in-out
            ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Header del Sidebar */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-[#0f254a]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#d63384] rounded-lg">
                <Truck size={18} className="text-white" strokeWidth={3} />
            </div>
            <h1 className="text-lg font-black text-white tracking-tighter leading-none">
                VALDI<span className="text-[#d63384]">SHOPPER</span>
            </h1>
          </div>

          <button
            type="button"
            onClick={toggle}
            className="md:hidden text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Navegación con Scroll */}
        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-64px)] scrollbar-hide">

          <Link to="/" onClick={closeOnMobile} className={getLinkClass("/")}>
            <HomeIcon size={20} strokeWidth={1.5} />
            <span className="text-sm">Inicio</span>
          </Link>

          {/* SECCIÓN OPERACIONES */}
          <div className="mt-6 mb-2 px-4 flex items-center gap-2 text-[10px] font-bold text-blue-200/40 uppercase tracking-widest">
            <span className="w-full h-px bg-white/10"></span>
            <span>Operaciones</span>
            <span className="w-full h-px bg-white/10"></span>
          </div>

          <Link to="/transporte" onClick={closeOnMobile} className={getLinkClass("/transporte")}>
            <Truck size={20} strokeWidth={1.5} />
            <span className="text-sm">Torre de Control</span>
          </Link>

          <Link to="/ruteo" onClick={closeOnMobile} className={getLinkClass("/ruteo")}>
            <Map size={20} strokeWidth={1.5} />
            <span className="text-sm">Ruteo</span>
          </Link>

          <Link to="/devoluciones" onClick={closeOnMobile} className={getLinkClass("/devoluciones")}>
            <RotateCcw size={20} strokeWidth={1.5} />
            <span className="text-sm">Devoluciones</span>
          </Link>

          <Link to="/bitacora-operacion" onClick={closeOnMobile} className={getLinkClass("/bitacora-operacion")}>
            <ClipboardList size={20} strokeWidth={1.5} />
            <span className="text-sm">Bitácora Ops</span>
          </Link>

          {/* SECCIÓN FINANZAS */}
          {esFinanzas && (
            <>
              <div className="mt-6 mb-2 px-4 flex items-center gap-2 text-[10px] font-bold text-blue-200/40 uppercase tracking-widest">
                <span className="w-full h-px bg-white/10"></span>
                <span>Gestión</span>
                <span className="w-full h-px bg-white/10"></span>
              </div>

              <Link to="/finanzas" onClick={closeOnMobile} className={getLinkClass("/finanzas")}>
                <DollarSign size={20} strokeWidth={1.5} />
                <span className="text-sm">Costos</span>
              </Link>

              <Link to="/reportes-financieros" onClick={closeOnMobile} className={getLinkClass("/reportes-financieros")}>
                <PieChart size={20} strokeWidth={1.5} />
                <span className="text-sm">Reportes</span>
              </Link>
            </>
          )}

          {/* SECCIÓN ADMIN */}
          {esAdmin && (
            <>
              <div className="mt-6 mb-2 px-4 flex items-center gap-2 text-[10px] font-bold text-blue-200/40 uppercase tracking-widest">
                <span className="w-full h-px bg-white/10"></span>
                <span>Admin</span>
                <span className="w-full h-px bg-white/10"></span>
              </div>

              <Link to="/bitacora-dashboard" onClick={closeOnMobile} className={getLinkClass("/bitacora-dashboard")}>
                <BarChart2 size={20} strokeWidth={1.5} />
                <span className="text-sm">Registro Incidencias</span>
              </Link>

              <Link to="/usuarios" onClick={closeOnMobile} className={getLinkClass("/usuarios")}>
                <Users size={20} strokeWidth={1.5} />
                <span className="text-sm">Usuarios</span>
              </Link>
            </>
          )}

          {/* Footer decorativo (Opcional) */}
          <div className="mt-10 px-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-900/50 to-transparent border border-white/5 text-center">
                <ShieldCheck size={24} className="mx-auto text-blue-300 mb-2 opacity-50" />
                <p className="text-[10px] text-blue-200/60">Agustin W v1.0</p>
            </div>
          </div>

        </nav>
      </aside>
    </>
  );
}