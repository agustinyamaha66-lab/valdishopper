import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
// Usamos lucide-react para iconos más nítidos (estándar enterprise)
import { Menu, X, LogOut, Clock, Calendar, User } from "lucide-react";

export default function Topbar({ sidebarOpen, setSidebarOpen }) {
  const navigate = useNavigate();
  const { user, role, signOut } = useAuth();

  const userEmail = user?.email ?? "";
  const safeRole = role ?? "";

  const [hora, setHora] = useState(
    new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
  );
  const [fecha, setFecha] = useState(
    new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setHora(now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }));
      setFecha(
        now.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isOpen = typeof sidebarOpen === "boolean" ? sidebarOpen : true;
  const toggleSidebar =
    typeof setSidebarOpen === "function"
      ? () => setSidebarOpen((v) => !v)
      : () => {};

  const irInicio = () => navigate("/");

  const initials = useMemo(() => {
    if (!userEmail) return "U";
    return userEmail.substring(0, 2).toUpperCase();
  }, [userEmail]);

  return (
    <header
      className={`fixed top-0 right-0 h-16 z-40 flex items-center justify-between px-6 transition-all duration-300
      bg-[#1e3c72]/85 backdrop-blur-md border-b border-white/10 shadow-lg
      ${isOpen ? "left-64" : "left-0"}`}
    >
      {/* --- IZQUIERDA: Toggle y Marca --- */}
      <div className="flex items-center gap-5">
        <button
          type="button"
          onClick={toggleSidebar}
          className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-white/20"
        >
          {isOpen ? <X size={24} strokeWidth={1.5} /> : <Menu size={24} strokeWidth={1.5} />}
        </button>

        {/* Separador Vertical */}
        <div className="h-8 w-px bg-white/10 hidden sm:block"></div>

        <button
          type="button"
          onClick={irInicio}
          className="text-left group focus:outline-none"
          title="Ir al Inicio"
        >
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-white tracking-tight leading-none group-hover:text-blue-100 transition-colors">
              CCO <span className="font-light opacity-70">Panel</span>
            </h2>
            <p className="text-[10px] text-[#d63384] font-bold uppercase tracking-[0.2em] group-hover:text-pink-300 transition-colors mt-0.5">
              Valdishopper
            </p>
          </div>
        </button>
      </div>

      {/* --- DERECHA: Datos y Usuario --- */}
      <div className="flex items-center gap-6">

        {/* Widget de Fecha y Hora (Oculto en móvil) */}
        <div className="hidden md:flex items-center gap-4 text-right border-r border-white/10 pr-6">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2 text-white/90">
              <span className="text-lg font-mono font-medium leading-none">{hora}</span>
              <Clock size={14} className="text-[#d63384] opacity-80" />
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] font-medium text-white/60 uppercase tracking-wide">
                {fecha}
              </span>
            </div>
          </div>
        </div>

        {/* Perfil de Usuario */}
        <div className="flex items-center gap-4 pl-2">

          {/* Info Texto (Nombre y Rol) */}
          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold text-white leading-tight truncate max-w-[150px]">
              {userEmail}
            </p>
            <div className="flex items-center justify-end gap-2 mt-0.5">
              <div className="flex items-center gap-1">
                 <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-[9px] text-green-300 font-bold uppercase tracking-wide">Online</span>
              </div>
              <span className="text-[9px] px-1.5 py-px rounded bg-white/10 text-blue-100 border border-white/10 uppercase tracking-wider">
                 {safeRole ? safeRole.replace("_", " ") : "..."}
              </span>
            </div>
          </div>

          {/* Avatar y Dropdown */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#d63384] to-[#1e3c72] p-[2px] shadow-lg">
               <div className="h-full w-full rounded-full bg-[#1e3c72] flex items-center justify-center border border-white/20">
                  <span className="font-bold text-sm text-white">{initials}</span>
               </div>
            </div>

            {/* Botón Salir (Icono elegante) */}
            <button
              type="button"
              onClick={signOut}
              className="group flex items-center justify-center p-2 rounded-lg text-white/60 hover:text-red-400 hover:bg-white/5 transition-all"
              title="Cerrar Sesión"
            >
              <LogOut size={20} strokeWidth={1.5} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}