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
  Car, // ✅ NUEVO
  ArrowUpRight,
  ShieldCheck,
  Package, // ✅ NUEVO: Entrega Bolso
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const navigate = useNavigate();
  const { role, user } = useAuth();

  const displayName = user?.email ? user.email.split("@")[0] : "Usuario";
  const esFinanzas = ["admin", "jefe_finanzas", "analista_finanzas"].includes(role);

  const ActionCard = ({ title, icon: Icon, path, desc, tag }) => (
    <button
      type="button"
      onClick={() => navigate(path)}
      className="
        group w-full text-left
        bg-white/90 backdrop-blur
        border border-slate-200/80
        rounded-2xl p-6
        shadow-sm hover:shadow-lg
        hover:-translate-y-0.5 transition-all duration-300
        focus:outline-none focus:ring-2 focus:ring-slate-300
      "
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-slate-900 text-white shadow-sm">
            <Icon size={22} strokeWidth={1.8} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              {tag && (
                <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {tag}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-600 leading-snug">{desc}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-500">
          <span className="text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
            Ir al módulo
          </span>
          <ArrowUpRight
            size={18}
            className="opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
          />
        </div>
      </div>
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto pb-12 px-3 md:px-6">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50" />
        <div className="absolute top-[-12%] right-[-10%] w-[560px] h-[560px] bg-slate-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-[-18%] left-[-12%] w-[640px] h-[640px] bg-slate-200/30 rounded-full blur-3xl" />
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-slate-200 shadow-xl">
        <div className="absolute inset-0">
          <img
            src={bannerImg}
            alt="Valdishopper"
            className="w-full h-[320px] object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/60 to-slate-950/10" />
          <div className="absolute inset-0 bg-slate-900/15 mix-blend-multiply" />
        </div>

        <div className="relative z-10 px-7 md:px-10 py-10 md:py-12">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-white/90 text-xs font-semibold">
              <ShieldCheck size={16} />
              Centro de Control • Operaciones & Logística
            </div>

            <h1 className="mt-4 text-3xl md:text-5xl font-black text-white tracking-tight">
              Panel Ejecutivo
            </h1>

            <p className="mt-3 text-white/80 text-base md:text-lg">
              Bienvenido,{" "}
              <span className="font-semibold text-white">{displayName}</span>.
              Supervisa la operación, optimiza rutas y gestiona retornos con
              trazabilidad.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Módulos</h2>
            <p className="text-sm text-slate-600">
              Selecciona un área para gestionar.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          <ActionCard
            title="Torre de Control"
            desc="Monitoreo operacional, flota y eventos en tiempo real."
            icon={Truck}
            path="/transporte"
          />

          <ActionCard
            title="Ruteo Inteligente"
            desc="Optimización de rutas, asignación y seguimiento en mapa."
            icon={Map}
            path="/ruteo"
          />

          <ActionCard
            title="Devoluciones"
            desc="Gestión de retornos, estados y control de logística inversa."
            icon={RotateCcw}
            path="/devoluciones"
          />

          <ActionCard
            title="Bitácora Operacional"
            desc="Registro de incidencias, evidencias y trazabilidad diaria."
            icon={ClipboardList}
            path="/bitacora-operacion"
          />

          {esFinanzas && (
            <ActionCard
              title="Gestión de Costos"
              desc="Control financiero, rendiciones y visibilidad de gastos."
              icon={DollarSign}
              path="/finanzas"
            />
          )}

          {/* ✅ SOLO ADMIN */}
          {role === "admin" && (
            <>
              <ActionCard
                title="Usuarios y Roles"
                desc="Administración de accesos, permisos y perfiles."
                icon={Users}
                path="/usuarios"
              />

              <ActionCard
                title="Catastro Patentes"
                desc="Registro y clasificación CATEX (volumen, categoría, zona)."
                icon={Car}
                path="/catastro-patentes"
              />

              <ActionCard
                title="Dashboard de Bitácora"
                desc="KPIs, métricas y lectura ejecutiva de operación."
                icon={BarChart2}
                path="/bitacora-dashboard"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
