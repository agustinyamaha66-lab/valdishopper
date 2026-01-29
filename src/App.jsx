import { useState } from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Toaster } from 'sonner'

// Layout
import Sidebar from './components/layout/sidebar'
import Topbar from './components/layout/topbar'

// Páginas Reales
import Login from './pages/Login'
import Home from './pages/Home'
import Transporte from './components/Transporte.jsx'
import Usuarios from './components/AdminUsuarios.jsx'
import Finanzas from './components/GestionCostos.jsx'

// Páginas Temporales (Placeholders)
const Inventario = () => <div className="p-10 text-2xl font-bold text-gray-500">📦 Módulo de Inventario (Próximamente)</div>
const Solicitudes = () => <div className="p-10 text-2xl font-bold text-gray-500">📋 Módulo de Solicitudes (Próximamente)</div>
const Config = () => <div className="p-10 text-2xl font-bold text-gray-500">⚙️ Configuración (Próximamente)</div>

// Ruta Protegida
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-100 gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-bold animate-pulse">Cargando Sistema...</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" />

  // Si hay roles permitidos y el usuario no lo tiene, al home
  if (allowedRoles && role && !allowedRoles.includes(role)) {
     return <Navigate to="/" />
  }

  return children
}

function AppContent() {
  const { user, role, signOut, loading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  if (loading) return null // El spinner ya lo maneja ProtectedRoute o Login

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    )
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* SIDEBAR: Le pasamos el estado de apertura */}
      <Sidebar
        role={role}
        isOpen={sidebarOpen}
        toggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* CONTENIDO PRINCIPAL: Se mueve si el sidebar se abre */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'ml-0'}`}>
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
            <Route path="/" element={<Home role={role} />} />

            {/* RUTAS REALES */}
            <Route path="/transporte" element={<ProtectedRoute allowedRoles={['admin', 'cco', 'logistica', 'colaborador']}><Transporte /></ProtectedRoute>} />
            <Route path="/finanzas" element={<ProtectedRoute allowedRoles={['admin', 'jefe_finanzas']}><Finanzas /></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute allowedRoles={['admin']}><Usuarios /></ProtectedRoute>} />

            {/* RUTAS TEMPORALES */}
            <Route path="/inventario" element={<ProtectedRoute><Inventario /></ProtectedRoute>} />
            <Route path="/solicitudes" element={<ProtectedRoute><Solicitudes /></ProtectedRoute>} />
            <Route path="/config" element={<ProtectedRoute><Config /></ProtectedRoute>} />

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