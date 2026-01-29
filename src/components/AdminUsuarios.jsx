import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function AdminUsuarios() {
  const { user } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    fetchUsuarios()
    const sub = supabase.channel('public:perfiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'perfiles' }, () => fetchUsuarios())
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [])

  const fetchUsuarios = async () => {
    setLoading(true)
    const { data } = await supabase.from('perfiles').select('*').order('id', { ascending: false })
    if (data) setUsuarios(data)
    setLoading(false)
  }

  const cambiarRol = async (idUsuario, nuevoRol) => {
    const backup = [...usuarios]
    setUsuarios(prev => prev.map(u => u.id === idUsuario ? { ...u, rol: nuevoRol } : u))
    const { error } = await supabase.from('perfiles').update({ rol: nuevoRol }).eq('id', idUsuario)
    if (error) { alert("Error: " + error.message); setUsuarios(backup); }
  }

  const usuariosFiltrados = usuarios.filter(u => u.email?.toLowerCase().includes(busqueda.toLowerCase()))

  const rolesDisponibles = [
    { value: 'colaborador', label: '👷 Colaborador', color: 'bg-gray-100 text-gray-600' },
    { value: 'cco', label: '📡 CCO', color: 'bg-blue-100 text-blue-700' },
    { value: 'jefe_finanzas', label: '💰 Jefe Finanzas', color: 'bg-green-100 text-green-700' },
    { value: 'admin', label: '👑 Administrador', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="bg-[#1e3c72] text-white p-6 rounded-t-xl shadow-lg border-b-4 border-[#d63384] flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tighter">GESTIÓN DE USUARIOS 👥</h1>
          <p className="text-xs opacity-80">Administra accesos y roles del sistema</p>
        </div>
        <button onClick={fetchUsuarios} className="bg-white/10 hover:bg-white/20 p-2 rounded-lg text-xl">↻</button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex gap-4 items-center">
        <span className="text-gray-400">🔍</span>
        <input type="text" placeholder="Buscar por correo..." className="w-full py-2 border-b focus:border-[#d63384] outline-none" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <div className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">TOTAL: {usuariosFiltrados.length}</div>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-600 font-black uppercase text-xs">
            <tr><th className="p-4">Usuario</th><th className="p-4">Rol</th><th className="p-4">Estado Clave</th></tr>
          </thead>
          <tbody>
            {usuariosFiltrados.map(u => {
              const esMiUsuario = user?.id === u.id;
              return (
                <tr key={u.id} className="hover:bg-blue-50/50 border-t border-gray-100">
                  <td className="p-4 font-bold text-[#1e3c72]">{u.email} {esMiUsuario && <span className="text-[9px] bg-[#d63384] text-white px-1 rounded">YO</span>}</td>
                  <td className="p-4">
                    <select value={u.rol || 'colaborador'} onChange={(e) => cambiarRol(u.id, e.target.value)} disabled={esMiUsuario} className="font-bold text-xs py-1 px-2 rounded border focus:ring-2 focus:ring-[#d63384] outline-none">
                      {rolesDisponibles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </td>
                  <td className="p-4 text-xs font-bold">
                      {u.debe_cambiar_pass ? <span className="text-orange-500">⚠️ Debe Cambiar</span> : <span className="text-green-500">✅ Activo</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

    </div>
  )
}