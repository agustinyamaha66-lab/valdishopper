import React from 'react'
import bannerImg from '../assets/banner_valdishopper.jpg'
// Importamos iconos profesionales (si no usas lucide, puedes cambiar esto por emojis o SVGs)
import {
  PieChart,
  Users,
  DollarSign,
  ShoppingCart,
  Settings,
  Activity,
  FileText,
  ShieldCheck
} from 'lucide-react'

export default function Home({ role, cambiarVista }) {

  const formatRole = (r) => {
    if (!r) return 'Invitado'
    return r.replace('_', ' ').toUpperCase()
  }

  // Permisos
  const isAdmin = role === 'admin'
  const isOps = ['admin', 'cco'].includes(role)
  const isFinanceHead = ['admin', 'jefe_finanzas'].includes(role)
  const isFinanceUser = ['admin', 'jefe_finanzas', 'analista_finanzas'].includes(role)

  // Componente de Tarjeta Mejorado
  const ActionCard = ({ title, icon: Icon, color, onClick, desc, count }) => (
    <button
      onClick={onClick}
      className="group relative bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-100 overflow-hidden text-left w-full"
    >
      {/* Barra de color superior */}
      <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: color }}></div>

      <div className="flex justify-between items-start relative z-10">
        <div className="space-y-3">
          <div className="p-3 rounded-xl w-fit transition-colors group-hover:text-white" style={{ backgroundColor: `${color}15`, color: color }}>
             {/* Icono dinámico */}
             <Icon size={24} className="group-hover:text-current" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-lg group-hover:text-blue-900 transition-colors">{title}</h3>
            <p className="text-sm text-gray-500 mt-1 font-medium">{desc}</p>
          </div>
        </div>

        {/* Badge de contador (Opcional) */}
        {count && (
          <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">
            {count}
          </span>
        )}
      </div>

      {/* Decoración de fondo */}
      <div className="absolute -right-6 -bottom-6 opacity-0 group-hover:opacity-10 transition-opacity duration-500">
         <Icon size={100} style={{ color: color }} />
      </div>
    </button>
  )

  // Widget de estadísticas rápidas (simulado)
  const StatWidget = ({ label, value, trend, positive }) => (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
      <div>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-black text-[#1e3c72] mt-1">{value}</p>
      </div>
      <div className={`text-xs font-bold px-2 py-1 rounded-lg ${positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
        {trend}
      </div>
    </div>
  )

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-8 pb-12">

      {/* 1. HEADER & BANNER COMPACTO */}
      {/* Dividimos el header para que sea más funcional y menos "póster" */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Columna Izquierda: Bienvenida y Contexto */}
        <div className="lg:col-span-1 flex flex-col justify-center space-y-4 p-2">
          <div>
            <h1 className="text-3xl font-black text-[#1e3c72] leading-tight">
              Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">{formatRole(role)}</span>
            </h1>
            <p className="text-gray-500 mt-2 text-sm leading-relaxed">
              Bienvenido al panel de control de <strong>ValdiShopper</strong>. Selecciona una acción rápida o revisa las métricas del día.
            </p>
          </div>

          {/* Tarjeta de Rol Minimalista */}
          <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-xl shadow-sm border border-gray-100 w-fit">
            <div className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-red-500' : 'bg-green-500'} animate-pulse`}></div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sistema Operativo</p>
          </div>
        </div>

        {/* Columna Derecha: El Banner (Más panorámico y controlado) */}
        <div className="lg:col-span-2 relative h-48 lg:h-56 rounded-3xl overflow-hidden shadow-lg border-2 border-white group">
            <img
              src={bannerImg}
              alt="ValdiShopper Banner"
              className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-[3s]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1e3c72]/60 to-transparent pointer-events-none"></div>
            <div className="absolute bottom-4 left-6 text-white pointer-events-none">
              <p className="font-bold text-lg">Panel de Gestión</p>
              <p className="text-xs opacity-80">v2.4.0 Stable</p>
            </div>
        </div>
      </div>

      {/* 2. RESUMEN RÁPIDO (Solo visible para roles relevantes) */}
      {(isOps || isFinanceUser) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatWidget label="Ventas Hoy" value="$1.2M" trend="+12%" positive={true} />
          <StatWidget label="Pedidos Activos" value="34" trend="+5" positive={true} />
          <StatWidget label="Tasa Conversión" value="4.2%" trend="-0.4%" positive={false} />
          <StatWidget label="Usuarios Nuevos" value="12" trend="+2" positive={true} />
        </div>
      )}

      <div className="h-px bg-gray-200 w-full my-6"></div>

      {/* 3. GRID DE ACCIONES (Organizado por áreas) */}
      <div className="space-y-8">

        {/* OPERACIONES */}
        {isOps && (
          <section>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 ml-1 flex items-center gap-2">
              <Activity size={16} /> Operaciones & Gestión
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <ActionCard
                title="Nueva Solicitud"
                desc="Crear orden de compra o servicio"
                icon={ShoppingCart}
                color="#2563eb" // Blue
                onClick={() => cambiarVista('solicitudes')}
              />
              <ActionCard
                title="Métricas"
                desc="KPIs y rendimiento operativo"
                icon={PieChart}
                color="#7c3aed" // Violet
                onClick={() => cambiarVista('metricas')}
              />
               <ActionCard
                title="Inventario"
                desc="Gestión de stock y productos"
                icon={FileText}
                color="#0891b2" // Cyan
                onClick={() => cambiarVista('inventario')}
              />
            </div>
          </section>
        )}

        {/* FINANZAS */}
        {isFinanceUser && (
          <section>
             <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 ml-1 flex items-center gap-2">
              <DollarSign size={16} /> Área Financiera
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <ActionCard
                title="Reportes Financieros"
                desc="Balances y estado de resultados"
                icon={DollarSign}
                color="#16a34a" // Green
                onClick={() => cambiarVista('finanzas')}
              />
              {isFinanceHead && (
                <ActionCard
                  title="Aprobar Presupuestos"
                  desc="Revisión de flujo de caja"
                  icon={ShieldCheck}
                  color="#ea580c" // Orange
                  count="3"
                  onClick={() => cambiarVista('presupuestos')}
                />
              )}
            </div>
          </section>
        )}

        {/* ADMINISTRACIÓN */}
        {isAdmin && (
          <section>
             <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 ml-1 flex items-center gap-2">
              <Settings size={16} /> Administración
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <ActionCard
                title="Usuarios"
                desc="Gestión de roles y accesos"
                icon={Users}
                color="#dc2626" // Red
                onClick={() => cambiarVista('usuarios')}
              />
              <ActionCard
                title="Configuración"
                desc="Parámetros globales del sistema"
                icon={Settings}
                color="#4b5563" // Gray
                onClick={() => cambiarVista('config')}
              />
            </div>
          </section>
        )}
      </div>

    </div>
  )
}