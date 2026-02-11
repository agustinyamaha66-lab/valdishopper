import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  Search,
  RefreshCw,
  Shield,
  User,
  Power,
  Filter,
  CheckCircle2,
  Lock,
  Users // Agregué Users para el icono del header
} from 'lucide-react'

// --- 1. COMPONENTE PAGE HEADER (Integrado) ---
function PageHeader({
  eyebrow = "",
  title = "",
  subtitle = "",
  icon: Icon = null,
  iconClassName = "text-[#d63384]",
  gradient = "from-[#0b1f44]/95 via-[#163a6b]/90 to-[#0b1f44]/95",
  right = null,
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/20 shadow-xl mb-6">
      <div className={`absolute inset-0 bg-gradient-to-r ${gradient}`} />

      {/* Decoración de fondo */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-10 left-10 h-28 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 right-10 h-28 w-64 rounded-full bg-cyan-300/10 blur-2xl" />
      </div>

      <div className="relative z-10 px-6 py-6 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
        <div>
          {!!eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/70">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1 text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            {Icon && <Icon size={30} className={iconClassName} />}
            {title}
          </h1>
          {!!subtitle && (
            <p className="text-blue-100/80 text-sm mt-2 font-medium max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {/* Acciones a la derecha */}
        {right ? <div className="w-full xl:w-auto">{right}</div> : null}
      </div>
    </div>
  );
}

export default function AdminUsuarios() {
  const { user } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('todos')

  useEffect(() => {
    fetchUsuarios()
    const sub = supabase.channel('public:perfiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'perfiles' }, () => fetchUsuarios())
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [])

  const fetchUsuarios = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('perfiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setUsuarios(data)
    setLoading(false)
  }

  const cambiarRol = async (idUsuario, nuevoRol) => {
    // Doble verificación por seguridad (aunque la UI lo bloquee)
    const usuarioDestino = usuarios.find(u => u.id === idUsuario);
    if (usuarioDestino?.rol === 'admin' && usuarioDestino.id !== user.id) {
        alert("No puedes modificar el rol de otro Administrador.");
        return;
    }

    const backup = [...usuarios]
    setUsuarios(prev => prev.map(u => u.id === idUsuario ? { ...u, rol: nuevoRol } : u))

    const { error } = await supabase.from('perfiles').update({ rol: nuevoRol }).eq('id', idUsuario)
    if (error) {
      alert("Error al actualizar rol: " + error.message);
      setUsuarios(backup);
    }
  }

  const toggleEstado = async (usuario) => {
    if (usuario.id === user.id) return;

    // Verificación de seguridad
    if (usuario.rol === 'admin') {
        alert("No puedes desactivar a otro Administrador.");
        return;
    }

    const nuevoEstado = !usuario.activo
    const backup = [...usuarios]

    setUsuarios(prev => prev.map(u => u.id === usuario.id ? { ...u, activo: nuevoEstado } : u))

    const { error } = await supabase
      .from('perfiles')
      .update({ activo: nuevoEstado })
      .eq('id', usuario.id)

    if (error) {
      alert("Error al cambiar estado");
      setUsuarios(backup);
    }
  }

  const usuariosFiltrados = usuarios.filter(u => {
    const coincideBusqueda = u.email?.toLowerCase().includes(busqueda.toLowerCase())
    const coincideRol = filtroRol === 'todos' || u.rol === filtroRol
    return coincideBusqueda && coincideRol
  })

  const rolesConfig = {
    colaborador: { label: 'Colaborador', bg: 'bg-gray-100', text: 'text-gray-700', icon: User },
    cco: { label: 'CCO', bg: 'bg-blue-50', text: 'text-blue-700', icon: Shield },
    jefe_finanzas: { label: 'Finanzas', bg: 'bg-green-50', text: 'text-green-700', icon: CheckCircle2 },
    admin: { label: 'Admin', bg: 'bg-purple-50', text: 'text-purple-700', icon: Shield },
    invitado: { label: 'Invitado', bg: 'bg-orange-50', text: 'text-orange-700', icon: User },
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-12 font-sans">

      {/* ==============================================================
          NUEVO PAGE HEADER
          ============================================================== */}
      <PageHeader
        eyebrow=""
        title="GESTIÓN DE USUARIOS"
        subtitle="Control centralizado de accesos, roles y permisos de seguridad."
        icon={Users}
        right={
            <button
                onClick={fetchUsuarios}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl transition-all text-xs font-bold uppercase tracking-wide backdrop-blur-sm"
            >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                {loading ? 'Sincronizando...' : 'Actualizar Lista'}
            </button>
        }
      />

      {/* FILTROS */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
                type="text"
                placeholder="Buscar por correo..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:border-[#d63384] focus:ring-1 focus:ring-[#d63384] outline-none transition-all"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
            />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-md text-xs font-semibold text-gray-500 uppercase">
                <Filter size={12} /> Rol
            </div>
            <select
                value={filtroRol}
                onChange={(e) => setFiltroRol(e.target.value)}
                className="text-sm border-none bg-transparent font-medium text-gray-600 focus:ring-0 cursor-pointer outline-none"
            >
                <option value="todos">Todos</option>
                <option value="admin">Admin</option>
                <option value="colaborador">Colaborador</option>
                <option value="cco">CCO</option>
                <option value="jefe_finanzas">Finanzas</option>
            </select>
        </div>
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-semibold uppercase text-xs">
                <tr>
                    <th className="p-5 pl-6">Usuario</th>
                    <th className="p-5">Rol</th>
                    <th className="p-5">Estado</th>
                    <th className="p-5 text-right pr-6">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {usuariosFiltrados.length > 0 ? (
                    usuariosFiltrados.map(u => {
                    const esMiUsuario = user?.id === u.id;
                    // LÓGICA CLAVE: Detectar si es otro admin
                    const esOtroAdmin = u.rol === 'admin' && !esMiUsuario;
                    const puedeEditar = !esMiUsuario && !esOtroAdmin;

                    const config = rolesConfig[u.rol] || rolesConfig['colaborador'];
                    const IconoRol = config.icon;

                    return (
                        <tr key={u.id} className={`group hover:bg-slate-50 transition-colors ${!u.activo ? 'opacity-60 bg-gray-50' : ''}`}>

                            {/* USUARIO */}
                            <td className="p-5 pl-6">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${esMiUsuario ? 'bg-[#d63384] text-white' : 'bg-[#1e3c72]/10 text-[#1e3c72]'}`}>
                                        {u.email?.substring(0,2).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900 flex items-center gap-2">
                                            {u.email}
                                            {esOtroAdmin && <Lock size={12} className="text-gray-400" title="Protegido" />}
                                        </div>
                                        {esMiUsuario && <span className="text-[10px] font-bold text-[#d63384]">TU CUENTA</span>}
                                        {esOtroAdmin && <span className="text-[10px] font-bold text-gray-400 border border-gray-200 px-1 rounded ml-1">ADMINISTRADOR</span>}
                                    </div>
                                </div>
                            </td>

                            {/* ROL */}
                            <td className="p-5">
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border w-fit ${config.bg} ${config.text} border-transparent ${puedeEditar ? 'group-hover:border-gray-200' : 'opacity-80'}`}>
                                    <IconoRol size={14} />
                                    <select
                                        value={u.rol || 'colaborador'}
                                        onChange={(e) => cambiarRol(u.id, e.target.value)}
                                        disabled={!puedeEditar}
                                        className={`appearance-none bg-transparent border-none text-xs font-bold focus:ring-0 p-0 pr-2 ${puedeEditar ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                                    >
                                        {Object.keys(rolesConfig).map(key => (
                                            <option key={key} value={key}>{rolesConfig[key].label}</option>
                                        ))}
                                    </select>
                                </div>
                            </td>

                            {/* ESTADO CLAVE */}
                            <td className="p-5">
                                {u.debe_cambiar_pass ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100">
                                        <RefreshCw size={12} className="animate-spin-slow" /> Reset pendiente
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                                        <CheckCircle2 size={12} /> OK
                                    </span>
                                )}
                            </td>

                            {/* ACCIONES (POWER) */}
                            <td className="p-5 text-right pr-6">
                                <button
                                    onClick={() => toggleEstado(u)}
                                    disabled={!puedeEditar}
                                    title={esOtroAdmin ? "No puedes desactivar a otro admin" : (u.activo ? "Desactivar" : "Activar")}
                                    className={`
                                        p-2 rounded-lg transition-all border
                                        ${!puedeEditar ? 'opacity-30 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400' : ''}
                                        ${puedeEditar && u.activo ? 'text-green-600 border-green-200 hover:bg-green-50' : ''}
                                        ${puedeEditar && !u.activo ? 'text-gray-400 border-gray-200 hover:text-green-600 hover:border-green-300' : ''}
                                    `}
                                >
                                    {esOtroAdmin ? <Shield size={18} /> : <Power size={18} />}
                                </button>
                            </td>
                        </tr>
                    )
                    })
                ) : (
                    <tr>
                        <td colSpan="4" className="p-12 text-center text-gray-400">No hay usuarios.</td>
                    </tr>
                )}
            </tbody>
            </table>
        </div>
      </div>
    </div>
  )
}