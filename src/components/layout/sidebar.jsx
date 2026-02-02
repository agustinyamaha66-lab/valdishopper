import { useEffect, useMemo, useRef } from "react";
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
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function Sidebar({ sidebarOpen, setSidebarOpen }) {
  const location = useLocation();
  const { role } = useAuth();

  // Fallbacks seguros
  const isOpen = typeof sidebarOpen === "boolean" ? sidebarOpen : true;
  const canSetOpen = typeof setSidebarOpen === "function";

  const toggle = canSetOpen ? () => setSidebarOpen((v) => !v) : () => {};
  const close = canSetOpen ? () => setSidebarOpen(false) : () => {};
  const open = canSetOpen ? () => setSidebarOpen(true) : () => {};

  const esAdmin = role === "admin";
  const esFinanzas = ["admin", "jefe_finanzas", "analista_finanzas"].includes(role);

  // ===== Enterprise: estilos activos más sobrios (azul) =====
  const isActive = (path) =>
    location.pathname === path
      ? "bg-white/10 text-white border-l-2 border-cyan-200/70"
      : "text-slate-300 hover:text-white hover:bg-white/5";

  // ===== Auto-close (desktop) al salir el mouse =====
  const closeTimerRef = useRef(null);

  // helper: detectar desktop (md+)
  const isDesktop = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(min-width: 768px)")?.matches ?? false;
  }, []);

  const scheduleClose = () => {
    if (!canSetOpen) return;
    if (!isDesktop) return;
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);

    closeTimerRef.current = setTimeout(() => {
      setSidebarOpen(false);
    }, 350);
  };

  const cancelClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  // Mobile: cerrar sidebar al elegir link
  const closeOnMobile = () => {
    if (!canSetOpen) return;
    // Solo cierra en pantallas pequeñas
    if (window.matchMedia?.("(max-width: 767px)")?.matches) setSidebarOpen(false);
  };

  return (
    <>
      {/* Overlay mobile */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={toggle}
      />

      <aside
        onMouseEnter={() => {
          cancelClose();
          // opcional: si quieres que al acercar el mouse se abra solo:
          // open();
        }}
        onMouseLeave={() => {
          scheduleClose();
        }}
        className={`fixed top-0 left-0 z-50 h-full w-64 transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        bg-gradient-to-b from-[#0b1f44]/95 via-[#0b1f44]/90 to-[#07162f]/95
        backdrop-blur-xl
        border-r border-white/10
        shadow-[0_18px_45px_rgba(2,6,23,0.55)]`}
      >
        {/* Sheen difuminado */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-10 left-8 h-28 w-52 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute bottom-16 -right-10 h-32 w-56 rounded-full bg-cyan-300/10 blur-2xl" />
        </div>

        {/* Header */}
        <div className="relative h-16 flex items-center justify-between px-5 border-b border-white/10">
          <button
            type="button"
            onClick={() => {
              cancelClose();
              // al hacer click en logo, si está cerrado lo abre
              if (!isOpen) open();
            }}
            className="text-left focus:outline-none group"
            title="Valdishopper"
          >
            <div className="leading-tight">
              <h1 className="text-[15px] font-extrabold tracking-wide text-white/95 group-hover:text-white transition-colors">
                Valdishopper
              </h1>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/60 group-hover:text-white/80 transition-colors">
                Panel Ejecutivo
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={toggle}
            className="md:hidden text-white/70 hover:text-white rounded-lg p-2 hover:bg-white/10 transition"
            aria-label="Cerrar sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="relative p-3 space-y-1 overflow-y-auto h-[calc(100vh-64px)]">
          {/* Inicio */}
          <Link
            to="/"
            onClick={closeOnMobile}
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all ${isActive(
              "/"
            )}`}
          >
            <span className="flex items-center gap-3">
              <HomeIcon size={18} />
              <span className="font-semibold text-sm">Inicio</span>
            </span>
            <ChevronRight className="opacity-40" size={16} />
          </Link>

          <div className="pt-4 pb-2 px-4 text-[11px] font-bold text-white/45 uppercase tracking-widest">
            Operaciones
          </div>

          <Link
            to="/transporte"
            onClick={closeOnMobile}
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all ${isActive(
              "/transporte"
            )}`}
          >
            <span className="flex items-center gap-3">
              <Truck size={18} />
              <span className="font-semibold text-sm">Torre de Control</span>
            </span>
            <ChevronRight className="opacity-40" size={16} />
          </Link>

          <Link
            to="/ruteo"
            onClick={closeOnMobile}
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all ${isActive(
              "/ruteo"
            )}`}
          >
            <span className="flex items-center gap-3">
              <Map size={18} />
              <span className="font-semibold text-sm">Ruteo</span>
            </span>
            <ChevronRight className="opacity-40" size={16} />
          </Link>

          <Link
            to="/devoluciones"
            onClick={closeOnMobile}
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all ${isActive(
              "/devoluciones"
            )}`}
          >
            <span className="flex items-center gap-3">
              <RotateCcw size={18} />
              <span className="font-semibold text-sm">Devoluciones</span>
            </span>
            <ChevronRight className="opacity-40" size={16} />
          </Link>

          <Link
            to="/bitacora-operacion"
            onClick={closeOnMobile}
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all ${isActive(
              "/bitacora-operacion"
            )}`}
          >
            <span className="flex items-center gap-3">
              <ClipboardList size={18} />
              <span className="font-semibold text-sm">Bitácora Ops</span>
            </span>
            <ChevronRight className="opacity-40" size={16} />
          </Link>

          {esFinanzas && (
            <>
              <div className="pt-5 pb-2 px-4 text-[11px] font-bold text-white/45 uppercase tracking-widest">
                Gestión
              </div>

              <Link
                to="/finanzas"
                onClick={closeOnMobile}
                className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all ${isActive(
                  "/finanzas"
                )}`}
              >
                <span className="flex items-center gap-3">
                  <DollarSign size={18} />
                  <span className="font-semibold text-sm">Costos</span>
                </span>
                <ChevronRight className="opacity-40" size={16} />
              </Link>

              <Link
                to="/reportes-financieros"
                onClick={closeOnMobile}
                className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all ${isActive(
                  "/reportes-financieros"
                )}`}
              >
                <span className="flex items-center gap-3">
                  <BarChart2 size={18} />
                  <span className="font-semibold text-sm">Reportes</span>
                </span>
                <ChevronRight className="opacity-40" size={16} />
              </Link>
            </>
          )}

          {esAdmin && (
            <>
              <div className="pt-5 pb-2 px-4 text-[11px] font-bold text-white/45 uppercase tracking-widest">
                Admin
              </div>

              <Link
                to="/bitacora-dashboard"
                onClick={closeOnMobile}
                className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all ${isActive(
                  "/bitacora-dashboard"
                )}`}
              >
                <span className="flex items-center gap-3">
                  <BarChart2 size={18} />
                  <span className="font-semibold text-sm">Registro Incidencias</span>
                </span>
                <ChevronRight className="opacity-40" size={16} />
              </Link>

              <Link
                to="/usuarios"
                onClick={closeOnMobile}
                className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all ${isActive(
                  "/usuarios"
                )}`}
              >
                <span className="flex items-center gap-3">
                  <Users size={18} />
                  <span className="font-semibold text-sm">Usuarios</span>
                </span>
                <ChevronRight className="opacity-40" size={16} />
              </Link>
            </>
          )}

          {/* Espacio final */}
          <div className="h-6" />
        </nav>
      </aside>
    </>
  );
}
