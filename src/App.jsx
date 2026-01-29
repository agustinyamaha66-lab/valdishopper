import { useState, useEffect } from 'react'
import { useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'
import Login from './components/Login'
import Home from './components/Home'

// Layout
import Sidebar from './components/layout/sidebar'
import Topbar from './components/layout/topbar'

// --- MÓDULOS ---
import Ruteo from "./components/Ruteo"
import GestionCostos from './components/GestionCostos'
import ReportesFinancieros from './components/ReportesFinancieros'
import OperacionBitacora from "./components/OperacionBitacora"
import DashboardBitacora from "./components/DashboardBitacora"
import Transporte from './components/Transporte'
import Devoluciones from './components/Devoluciones'
import AdminUsuarios from './components/AdminUsuarios'

// --- COMPONENTE INTERNO PARA CAMBIAR PASSWORD ---
function PantallaCambioPassword({ onPasswordChanged }) {
    const [pass, setPass] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if(pass.length < 6) return alert("Mínimo 6 caracteres")
        setLoading(true)

        try {
            // 1. Cambiamos la contraseña en Supabase Auth
            const { error } = await supabase.auth.updateUser({ password: pass })
            if (error) throw error

            // 2. Marcamos en la DB que YA la cambió
            const { data: { user } } = await supabase.auth.getUser()
            await supabase.from('perfiles').update({ debe_cambiar_pass: false }).eq('id', user.id)

            alert("¡Contraseña actualizada correctamente!")
            onPasswordChanged() // Avisamos a App que ya estamos listos
        } catch (error) {
            alert("Error: " + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#1e3c72]">
            <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full text-center">
                <div className="text-5xl mb-4">🔐</div>
                <h2 className="text-2xl font-black text-[#1e3c72] mb-2">SEGURIDAD REQUERIDA</h2>
                <p className="text-sm text-gray-500 mb-6">Es tu primer inicio de sesión (o un administrador lo solicitó). Por favor, crea una nueva contraseña segura.</p>
                <form onSubmit={handleSubmit}>
                    <input type="password" placeholder="Nueva Contraseña" className="w-full p-3 border-2 rounded-lg mb-4 font-bold" value={pass} onChange={e=>setPass(e.target.value)} required />
                    <button disabled={loading} className="w-full bg-[#d63384] text-white font-bold py-3 rounded-lg hover:bg-pink-600 transition-colors">
                        {loading ? 'ACTUALIZANDO...' : 'CONFIRMAR Y ENTRAR'}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default function App() {
  const auth = useAuth()
  const user = auth?.user
  const role = auth?.role
  const debeCambiarPass = auth?.debeCambiarPass
  const confirmarCambioPass = auth?.confirmarCambioPass
  const loading = auth?.loading
  const signOut = auth?.signOut

  const [vistaActual, setVistaActual] = useState(() => localStorage.getItem('vista_actual_app') || 'home')
  useEffect(() => { localStorage.setItem('vista_actual_app', vistaActual) }, [vistaActual])

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen')
    return saved !== null ? JSON.parse(saved) : true
  })
  useEffect(() => { localStorage.setItem('sidebarOpen', JSON.stringify(sidebarOpen)) }, [sidebarOpen])

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#1e3c72] text-white font-bold">CARGANDO SISTEMA...</div>
  if (!user) return <Login />

  // --- BLOQUEO DE SEGURIDAD ---
  if (debeCambiarPass) return <PantallaCambioPassword onPasswordChanged={confirmarCambioPass} />

  // --- CONFIGURACIÓN DE PERMISOS ---
  const permisos = {
    status: ['admin', 'cco'],
    bitacora_ops: ['admin', 'cco'],
    bitacora_dash: ['admin'],
    ruteo: ['admin', 'cco'],
    finanzas: ['admin', 'cco', 'jefe_finanzas'],
    kpis: ['admin', 'jefe_finanzas'],
    transporte: ['admin', 'cco'],
    devoluciones: ['admin', 'cco'],
    admin_users: ['admin']
  }

  const tienePermiso = (vista) => {
    if (vista === 'home') return true
    return permisos[vista]?.includes(role)
  }

  const vistaRender = tienePermiso(vistaActual) ? vistaActual : 'home'

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-gray-100 font-sans flex relative">
      <Sidebar cambiarVista={setVistaActual} vistaActual={vistaRender} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} role={role} />

      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        {/* --- AQUÍ ESTÁ EL CAMBIO --- */}
        <Topbar
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            userEmail={user.email}
            role={role}  // <--- ¡AHORA SÍ ESTÁ AGREGADO!
            signOut={signOut}
            irInicio={() => setVistaActual('home')}
        />

        <main className="p-8 pt-24 w-full">
          {vistaRender === 'home' && <Home role={role} cambiarVista={setVistaActual} />}
          {vistaRender === 'status' && <div className="animate-fade-in"><StatusCatex /></div>}
          {vistaRender === 'bitacora_ops' && <div className="animate-fade-in"><OperacionBitacora /></div>}
          {vistaRender === 'bitacora_dash' && <div className="animate-fade-in"><DashboardBitacora /></div>}
          {vistaRender === 'ruteo' && <div className="animate-fade-in h-[85vh] w-full -mt-6 border-4 border-white shadow-lg rounded-xl overflow-hidden"><Ruteo /></div>}
          {vistaRender === 'transporte' && <div className="animate-fade-in"><Transporte /></div>}
          {vistaRender === 'devoluciones' && <div className="animate-fade-in"><Devoluciones /></div>}
          {vistaRender === 'finanzas' && <div className="animate-fade-in"><GestionCostos /></div>}
          {vistaRender === 'kpis' && <div className="animate-fade-in"><ReportesFinancieros /></div>}
          {vistaRender === 'admin_users' && <div className="animate-fade-in"><AdminUsuarios /></div>}
        </main>
      </div>
    </div>
  )
}