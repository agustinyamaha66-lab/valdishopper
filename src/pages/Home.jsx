import React from 'react'
import { useNavigate } from 'react-router-dom'
import bannerImg from '../assets/banner_valdishopper.jpg'
import { Truck, Map, RotateCcw, ClipboardList, DollarSign, Users, BarChart2 } from 'lucide-react'

export default function Home({ role }) {
  const navigate = useNavigate()

  const formatRole = (r) => {
    if (!r) return '...'
    return r?.replace('_', ' ').toUpperCase()
  }

  const ActionCard = ({ title, icon: Icon, color, path, desc }) => (
    <button
      onClick={() => navigate(path)}
      className="group relative bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-100 overflow-hidden text-left w-full"
    >
      <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: color }}></div>
      <div className="flex justify-between items-start relative z-10">
        <div className="space-y-3">
          <div className="p-3 rounded-xl w-fit transition-colors group-hover:text-white" style={{ backgroundColor: `${color}15`, color: color }}>
             <Icon size={24} className="group-hover:text-current" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-lg group-hover:text-blue-900 transition-colors">{title}</h3>
            <p className="text-sm text-gray-500 mt-1 font-medium">{desc}</p>
          </div>
        </div>
      </div>
    </button>
  )

  return (
    <div className="animate-fade-in max-w-7xl mx-auto space-y-8 pb-12">
      {/* HEADER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 flex flex-col justify-center space-y-4 p-2">
          <div>
            <h1 className="text-3xl font-black text-[#1e3c72] leading-tight">
              Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">{formatRole(role)}</span>
            </h1>
            <p className="text-gray-500 mt-2 text-sm leading-relaxed">
              Bienvenido al panel. Selecciona un módulo operativo.
            </p>
          </div>
        </div>
        <div className="lg:col-span-2 relative h-48 lg:h-56 rounded-3xl overflow-hidden shadow-lg border-2 border-white group">
            <img src={bannerImg} alt="Banner" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1e3c72]/60 to-transparent"></div>
        </div>
      </div>

      <div className="h-px bg-gray-200 w-full my-6"></div>

      {/* ACCIONES REALES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

        {/* TODOS PUEDEN VER */}
        <ActionCard
          title="Torre de Control"
          desc="Gestión de transporte"
          icon={Truck}
          color="#d63384"
          path="/transporte"
        />

        <ActionCard
          title="Ruteo"
          desc="Mapas y rutas"
          icon={Map}
          color="#2563eb"
          path="/ruteo"
        />

        <ActionCard
          title="Devoluciones"
          desc="Control de retornos"
          icon={RotateCcw}
          color="#f59e0b"
          path="/devoluciones"
        />

        <ActionCard
          title="Bitácora Ops"
          desc="Registro diario"
          icon={ClipboardList}
          color="#10b981"
          path="/bitacora-operacion"
        />

        {/* SOLO FINANZAS/ADMIN */}
        {['admin', 'jefe_finanzas'].includes(role) && (
          <ActionCard
            title="Gestión Costos"
            desc="Finanzas operativas"
            icon={DollarSign}
            color="#16a34a"
            path="/finanzas"
          />
        )}

        {/* SOLO ADMIN */}
        {role === 'admin' && (
          <>
            <ActionCard
              title="Usuarios"
              desc="Roles y accesos"
              icon={Users}
              color="#dc2626"
              path="/usuarios"
            />
            <ActionCard
              title="Dashboard Bitácora"
              desc="Métricas generales"
              icon={BarChart2}
              color="#7c3aed"
              path="/bitacora-dashboard"
            />
          </>
        )}
      </div>
    </div>
  )
}