import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Toaster } from 'sonner' // Si no tienes sonner, puedes comentar esta línea
import Sidebar from './components/layout/sidebar'
import Topbar from './components/layout/topbar'

// --- 1. PÁGINAS PRINCIPALES (Están en /pages) ---
import Login from './pages/Login'
import Home from './pages/Home'

// --- 2. COMPONENTES OPERATIVOS (Están en /components) ---
// Aquí conectamos tus archivos reales a las rutas
import Transporte from './components/Transporte.jsx'
import Usuarios from './components/AdminUsuarios.jsx' // Usamos AdminUsuarios para la ruta de Usuarios
import Finanzas from './components/GestionCostos.jsx' // Usamos GestionCostos para la ruta de Finanzas

// --- 3. PLACEHOLDERS (Para lo que aún no has creado) ---
// Estos evitan que Vercel te de error rojo por "archivo no encontrado"
const Inventario = () => <div className="p-10 text-2xl font-bold text-gray-500 animate-pulse">📦 Módulo de Inventario (Próximamente)</div>
const Solicitudes = () => <div className="p-10 text-2xl font-bold text-gray-500 animate-pulse">📋 Módulo de Solicitudes (Próximamente)</div>
const Config = () => <div className="p-10 text-2xl font-bold text-gray-500 animate-pulse">⚙️ Configuración del Sistema (Próximamente)</div>

// --- LÓGICA DE PROTECCIÓN DE RUTAS ---
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, role, loading } = useAuth()

  // 1. SI ESTÁ CARGANDO, MOSTRAMOS SPINNER (CRUCIAL PARA EL F5)
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100 flex-col gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-bold animate-pulse">Cargando Sistema...</p>
      </div>
    )
  }

  // 2. SI NO HAY USUARIO, AL LOGIN
  if (!user) return <Navigate to="/login" />

  // 3. SI EL ROL NO ESTÁ AUTORIZADO
  if (allowedRoles && role && !allowedRoles.includes(role)) {
     return <Navigate to="/" />
  }

  return children
}

function AppContent() {
  const { user, role, signOut, loading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Pantalla de carga global
  if (loading) {
     return (
      <div className="flex h-screen w-full items-center justify-center bg-[#1e3c72]">
        <div className="text-white text-center">
            <h1 className="text-3xl font-black tracking-tighter mb-4">VALDISHOPPER</h1>
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
     )
  }

  // Si no está logueado, Login
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    )
  }

  // Layout Principal
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* SIDEBAR */}
      <Sidebar
        role={role}
        sidebarOpen={sidebarOpen}
        toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* CONTENIDO DERECHO */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        <Topbar
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            userEmail={user.email}
            role={role}
            signOut={signOut}
            irInicio={() => window.location.href = '/'}
        />

        <main className="flex-1 overflow-y-auto p-6 mt-16">
          <Routes>
            <Route path="/" element={<Home role={role} cambiarVista={(v) => window.location.href = `/${v}`} />} />

            {/* --- RUTAS CONECTADAS A TUS ARCHIVOS REALES --- */}
            <Route path="/transporte" element={<ProtectedRoute allowedRoles={['admin', 'cco', 'logistica', 'colaborador']}><Transporte /></ProtectedRoute>} />
            <Route path="/finanzas" element={<ProtectedRoute allowedRoles={['admin', 'jefe_finanzas', 'analista_finanzas']}><Finanzas /></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute allowedRoles={['admin']}><Usuarios /></ProtectedRoute>} />

            {/* --- RUTAS TEMPORALES (PLACEHOLDERS) --- */}
            <Route path="/inventario" element={<ProtectedRoute allowedRoles={['admin', 'cco', 'bodega']}><Inventario /></ProtectedRoute>} />
            <Route path="/solicitudes" element={<ProtectedRoute allowedRoles={['admin', 'cco', 'jefe_finanzas', 'colaborador']}><Solicitudes /></ProtectedRoute>} />
            <Route path="/config" element={<ProtectedRoute allowedRoles={['admin']}><Config /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
        <Toaster position="top-right" richColors />
      </Router>
    </AuthProvider>
  )
}