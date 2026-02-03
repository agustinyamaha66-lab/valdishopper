import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home as HomeIcon,
  Truck,
  Car,
  Map,
  RotateCcw,
  ClipboardList,
  BarChart2,
  DollarSign,
  Users,
  X,
  PieChart,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Layers,
  Settings,
  TrendingUp
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function Sidebar({ sidebarOpen, setSidebarOpen }) {
  const location = useLocation();
  const { role } = useAuth();

  const isOpen = typeof sidebarOpen === "boolean" ? sidebarOpen : true;
  const toggle = typeof setSidebarOpen === "function" ? () => setSidebarOpen((v) => !v) : () => {};

  // Roles
  const esAdmin = role === "admin";
  const esFinanzas = ["admin", "jefe_finanzas", "analista_finanzas"].includes(role);
  const esRuteo = ["admin", "cco"].includes(role);

  const handleMouseLeave = () => {
    if (window.innerWidth >= 768 && typeof setSidebarOpen === "function") {
      setSidebarOpen(false);
    }
  };

  const closeOnMobile = () => {
    if (typeof setSidebarOpen === "function") setSidebarOpen(false);
  };

  // --- COMPONENTES INTERNOS PARA ORDEN Y ESTILO ---

  // 1. Link Individual (Hoja del árbol)
  const NavItem = ({ to, icon: Icon, label }) => {
    const isActive = location.pathname === to;
    return (
      <Link
        to={to}
        onClick={closeOnMobile}
        className={`
          flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-xs font-bold mb-1
          ${isActive 
            ? "bg-[#d63384] text-white shadow-lg shadow-pink-900/20 translate-x-1" 
            : "text-blue-200/70 hover:text-white hover:bg-white/5 hover:pl-5"
          }
        `}
      >
        <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
        <span>{label}</span>
      </Link>
    );
  };

  // 2. Grupo Desplegable (Accordion)
  const NavGroup = ({ title, icon: Icon, children, activePaths = [] }) => {
    // Auto-abrir si alguna ruta hija está activa
    const isActiveGroup = activePaths.includes(location.pathname);
    const [isExpanded, setIsExpanded] = useState(isActiveGroup);

    // Efecto para abrir automáticamente si navegamos a una ruta interna
    useEffect(() => {
      if (isActiveGroup) setIsExpanded(true);
    }, [location.pathname]);

    return (
      <div className="mb-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`
            w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors duration-200
            ${isExpanded ? "bg-white/5 text-white" : "text-blue-100/80 hover:bg-white/5 hover:text-white"}
          `}
        >
          <div className="flex items-center gap-3">
            <Icon size={18} className={isExpanded ? "text-[#d63384]" : "text-slate-400"} />
            <span className="text-xs font-bold uppercase tracking-wide">{title}</span>
          </div>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        <div
          className={`
            overflow-hidden transition-all duration-300 ease-in-out
            ${isExpanded ? "max-h-96 opacity-100 mt-1" : "max-h-0 opacity-0"}
          `}
        >
          <div className="pl-3 border-l border-white/10 ml-6 space-y-1">
            {children}
          </div>
        </div>
      </div>
    );
  };

  // 3. Título de Sección (Separador visual)
  const NavSectionTitle = ({ label }) => (
    <div className="px-6 mt-6 mb-2 text-[9px] font-black text-blue-300/30 uppercase tracking-[0.2em]">
      {label}
    </div>
  );

  return (
    <>
      <div
        className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={toggle}
      />

      <aside
        onMouseLeave={handleMouseLeave}
        className={`
            fixed top-0 left-0 z-50 h-full w-64 
            bg-[#0f254a]/95 backdrop-blur-xl border-r border-white/5
            shadow-2xl transition-transform duration-300 ease-in-out
            ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* HEADER */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-[#0f254a]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#d63384] rounded-lg shadow-lg shadow-pink-500/20">
              <Truck size={18} className="text-white" strokeWidth={3} />
            </div>
            <h1 className="text-lg font-black text-white tracking-tighter leading-none">
              VALDI<span className="text-[#d63384]">SHOPPER</span>
            </h1>
          </div>
          <button type="button" onClick={toggle} className="md:hidden text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* NAVEGACIÓN */}
        <nav className="p-3 overflow-y-auto h-[calc(100vh-64px)] scrollbar-hide">

          {/* DASHBOARD PRINCIPAL */}
          <NavItem to="/" icon={HomeIcon} label="Inicio" />

          {/* === SECCIÓN OPERACIONES === */}
          <NavSectionTitle label="Operaciones" />

          {/* GRUPO CATEX */}
          <NavGroup
            title="Gestión CATEX"
            icon={Truck}
            activePaths={['/transporte', '/devoluciones', '/catastro-patentes']}
          >
            <NavItem to="/transporte" icon={Map} label="Torre de Control" />
            <NavItem to="/devoluciones" icon={RotateCcw} label="Devoluciones" />
            {esAdmin && (
              <NavItem to="/catastro-patentes" icon={Car} label="Catastro Patentes" />
            )}
          </NavGroup>

          {/* GRUPO HD (Solo si tiene permisos) */}
          {esRuteo && (
            <NavGroup
              title="Gestión HD"
              icon={Layers}
              activePaths={['/ruteo']}
            >
              <NavItem to="/ruteo" icon={Map} label="Ruteador Inteligente" />
            </NavGroup>
          )}

          {/* GRUPO GENERAL */}
          <NavGroup
            title="Control General"
            icon={ClipboardList}
            activePaths={['/bitacora-operacion', '/bitacora-dashboard']}
          >
            <NavItem to="/bitacora-operacion" icon={ClipboardList} label="Bitácora Operativa" />
            {esAdmin && (
              <NavItem to="/bitacora-dashboard" icon={BarChart2} label="Dashboard Incidencias" />
            )}
          </NavGroup>

          {/* === SECCIÓN ADMINISTRATIVA === */}
          {(esFinanzas || esAdmin) && <NavSectionTitle label="Administración" />}

          {/* GRUPO FINANZAS */}
          {esFinanzas && (
            <NavGroup
              title="Finanzas"
              icon={TrendingUp}
              activePaths={['/finanzas', '/reportes-financieros']}
            >
              <NavItem to="/finanzas" icon={DollarSign} label="Gestión de Costos" />
              <NavItem to="/reportes-financieros" icon={PieChart} label="Reportes Financieros" />
            </NavGroup>
          )}

          {/* GRUPO ADMIN */}
          {esAdmin && (
            <NavGroup
              title="Configuración"
              icon={Settings}
              activePaths={['/usuarios']}
            >
              <NavItem to="/usuarios" icon={Users} label="Usuarios y Permisos" />
            </NavGroup>
          )}

          {/* FOOTER */}
          <div className="mt-8 px-2 mb-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center backdrop-blur-sm">
              <ShieldCheck size={24} className="mx-auto text-blue-300/50 mb-2" />
              <p className="text-[10px] text-blue-200/40 font-mono tracking-wider">
                SISTEMA INTEGRADO v1.2
              </p>
            </div>
          </div>

        </nav>
      </aside>
    </>
  );
}