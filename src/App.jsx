import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Toaster } from 'sonner' // O tu librería de notificaciones
import Sidebar from './components/layout/sidebar'
import Topbar from './components/layout/topbar'
import Login from './pages/Login'
import Home from './pages/Home'
import Inventario from './pages/Inventario'
import Solicitudes from './pages/Solicitudes'
import Finanzas from './pages/Finanzas'
import Usuarios from './pages/Usuarios'
import Config from './pages/Config'
import Transporte from './pages/Transporte' // Tu nueva página

// Componente para proteger rutas
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

  // 3. SI EL ROL NO ESTÁ AUTORIZADO (O es null pero hay user), ESPERAMOS O REDIRIGIMOS
  // Nota: Si role es null pero hay user, a veces es mejor dejar pasar a Home para que no rebote
  if (allowedRoles && role && !allowedRoles.includes(role)) {
     return <Navigate to="/" />
  }

  return children
}

function AppContent() {
  const { user, role, signOut, loading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Pantalla de carga global (Doble seguridad)
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

  // Si no está logueado, mostramos SOLO el Login
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    )
  }

  // Estructura principal con Sidebar y Topbar
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
            irInicio={() => window.location.href = '/'} // O usar navigate
        />

        <main className="flex-1 overflow-y-auto p-6 mt-16">
          <Routes>
            <Route path="/" element={<Home role={role} cambiarVista={(v) => window.location.href = `/${v}`} />} />

            {/* RUTAS OPERATIVAS */}
            <Route path="/transporte" element={<ProtectedRoute allowedRoles={['admin', 'cco', 'logistica', 'colaborador']}><Transporte /></ProtectedRoute>} />
            <Route path="/inventario" element={<ProtectedRoute allowedRoles={['admin', 'cco', 'bodega']}><Inventario /></ProtectedRoute>} />
            <Route path="/solicitudes" element={<ProtectedRoute allowedRoles={['admin', 'cco', 'jefe_finanzas', 'colaborador']}><Solicitudes /></ProtectedRoute>} />

            {/* RUTAS ADMINISTRATIVAS */}
            <Route path="/finanzas" element={<ProtectedRoute allowedRoles={['admin', 'jefe_finanzas', 'analista_finanzas']}><Finanzas /></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute allowedRoles={['admin']}><Usuarios /></ProtectedRoute>} />
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