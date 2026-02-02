import React from "react";
import { useNavigate } from "react-router-dom";
import bannerImg from "../assets/Valdishopper-inicio.png";
import {
  Truck,
  Map,
  RotateCcw,
  ClipboardList,
  DollarSign,
  Users,
  BarChart2,
  ChevronRight,
  ShieldCheck,
  LayoutGrid
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const navigate = useNavigate();
  const { role, user } = useAuth();

  const displayName = user?.email ? user.email.split("@")[0] : "Usuario";

  // --- COMPONENTE CARD "ENTERPRISE" ---
  // Combina la limpieza del diseño minimalista con la utilidad de los Tags
  const ActionCard = ({ title, icon: Icon, path, desc, tag }) => (
    <button
      type="button"
      onClick={() => navigate(path)}
      className="
        group relative w-full text-left
        bg-white rounded-xl p-6
        shadow-sm hover:shadow-xl hover:-translate-y-1
        border border-slate-200 hover:border-blue-900/20
        transition-all duration-300 ease-out
        flex flex-col h-full justify-between
      "
    >
      {/* Cabecera de la tarjeta */}
      <div className="flex justify-between items-start w-full mb-4">
        <div className="p-3 rounded-lg bg-slate-50 text-slate-600 group-hover:bg-[#1e3c72] group-hover:text-white transition-colors duration-300">
          <Icon size={24} strokeWidth={1.5} />
        </div>

        {/* Tag Pill (Categoría) */}
        {tag && (
          <span className="px-2 py-1 rounded-md bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500 border border-slate-200 group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors">
            {tag}
          </span>
        )}
      </div>

      {/* Contenido */}
      <div>
        <h3 className="font-bold text-slate-800 text-lg group-hover:text-[#1e3c72] transition-colors">
          {title}
        </h3>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed font-medium">
          {desc}
        </p>
      </div>

      {/* Footer sutil de la tarjeta */}
      <div className="mt-6 flex items-center text-xs font-semibold text-[#d63384] opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
        Acceder al módulo <ChevronRight size={14} className="ml-1" />
      </div>
    </button>
  );

  const esFinanzas = ["admin", "jefe_finanzas", "analista_finanzas"].includes(role);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-12">

      {/* --- HERO SECTION (Banner Estilo Premium) --- */}
      {/* Ocupa un buen espacio vertical para dar presencia */}
      <div className="relative h-[380px] w-full overflow-hidden bg-slate-900">

        {/* 1. Imagen de fondo */}
        <div className="absolute inset-0">
          <img
            src={bannerImg}
            alt="Valdishopper Operations"
            className="w-full h-full object-cover object-center opacity-90"
          />
          {/* 2. Degradados Corporativos (Clave para que se vea Pro) */}
          {/* Capa oscura general para contraste */}
          <div className="absolute inset-0 bg-slate-900/40 mix-blend-multiply" />
          {/* Degradado lateral para que el texto sea siempre legible */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/80 to-transparent" />
          {/* Degradado inferior para fusionar con el grid */}
          <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-slate-50/50 to-transparent" />
        </div>

        {/* 3. Contenido del Banner */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 h-full flex flex-col justify-center pb-16">
          <div className="inline-flex items-center w-fit gap-2 px-3 py-1 rounded-full border border-white/20 bg-white/10 text-blue-100 text-xs font-bold uppercase tracking-widest backdrop-blur-sm mb-6 animate-fade-in">
            <ShieldCheck size={14} /> Sistema de Control Operacional
          </div>

          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight max-w-2xl drop-shadow-lg">
            Hola, {displayName}.
          </h1>
          <p className="mt-4 text-lg text-slate-300 max-w-xl font-light leading-relaxed">
            Bienvenido al panel central de <span className="text-white font-semibold">Valdishopper</span>.
            Selecciona un módulo a continuación para gestionar la operación diaria.
          </p>
        </div>
      </div>

      {/* --- GRID DE MÓDULOS (Layout Superpuesto) --- */}
      {/* El margen negativo (-mt-24) hace que las tarjetas suban sobre el banner */}
      <div className="relative z-20 max-w-7xl mx-auto px-6 -mt-24">

        {/* Cabecera del Grid (Opcional, para dar contexto) */}
        <div className="flex items-center gap-2 mb-4 text-white/90">
            <LayoutGrid size={18} />
            <span className="text-sm font-semibold tracking-wide uppercase">Aplicaciones Disponibles</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ActionCard
            title="Torre de Control"
            desc="Monitoreo en tiempo real de flota, despachos y estados de entrega."
            icon={Truck}
            path="/transporte"
            tag="Logística"
          />
          <ActionCard
            title="Ruteo Inteligente"
            desc="Planificación de mapas, optimización de rutas y asignación de choferes."
            icon={Map}
            path="/ruteo"
            tag="Planificación"
          />
          <ActionCard
            title="Devoluciones"
            desc="Control de logística inversa, reingresos al inventario y gestión de fallidos."
            icon={RotateCcw}
            path="/devoluciones"
            tag="Logistica"
          />
          <ActionCard
            title="Bitácora Operativa"
            desc="Registro oficial de incidencias, novedades y reportes diarios."
            icon={ClipboardList}
            path="/bitacora-operacion"
            tag="Control"
          />

          {esFinanzas && (
            <ActionCard
              title="Gestión de Costos"
              desc="Rendición de gastos, control de presupuestos y análisis financiero."
              icon={DollarSign}
              path="/finanzas"
              tag="Finanzas"
            />
          )}

          {role === "admin" && (
            <>
              <ActionCard
                title="Usuarios y Accesos"
                desc="Administración de perfiles, roles y permisos del sistema."
                icon={Users}
                path="/usuarios"
                tag="Admin"
              />
              <ActionCard
                title="Dashboard Ejecutivo"
                desc="Visualización de KPIs, métricas de rendimiento y estadísticas globales."
                icon={BarChart2}
                path="/bitacora-dashboard"
                tag="Analitica"
              />
            </>
          )}
        </div>

        {/* Footer simple integrado */}
        <div className="py-12 text-center">
            <p className="text-slate-400 text-xs font-medium">
                © 2026 Valdishopper SpA • Plataforma Segura v2.0
            </p>
        </div>
      </div>
    </div>
  );
}