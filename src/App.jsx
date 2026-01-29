import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Toaster } from 'sonner'

// Layout
import Sidebar from './components/layout/sidebar'
import Topbar from './components/layout/topbar'

// Páginas
import Login from './pages/Login'
import Home from './pages/Home'

// TUS COMPONENTES REALES (Ya no inventamos nada)
import Transporte from './components/Transporte.jsx'
import Ruteo from './components/Ruteo.jsx'
import Devoluciones from './components/Devoluciones.jsx'
import OperacionBitacora from './components/OperacionBitacora.jsx'
import DashboardBitacora from './components/DashboardBitacora.jsx'
import GestionCostos from './components/GestionCostos.jsx'
import ReportesFinancieros from './components/ReportesFinancieros.jsx'
import AdminUsuarios from './components/AdminUsuarios.jsx'

// Ruta Protegida
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, role, loading } = useAuth()

  // Spinner mientras carga (Evita que el F5 te bote)
  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-100 gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-bold animate-pulse">Cargando Sistema...</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" />

  if (allowedRoles && role && !allowedRoles.includes(role)) {
     return <Navigate to="/" />
  }

  return children
}

function AppContent() {
  const { user, role, signOut, loading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  if (loading) return null

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
      {/* SIDEBAR */}
      <Sidebar
        role={role}
        isOpen={sidebarOpen}
        toggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* CONTENIDO */}
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

            {/* --- TUS RUTAS REALES --- */}
            <Route path="/transporte" element={<ProtectedRoute allowedRoles={['admin', 'cco', 'logistica', 'colaborador']}><Transporte /></ProtectedRoute>} />
            <Route path="/ruteo" element={<ProtectedRoute allowedRoles={['admin', 'cco']}><Ruteo /></ProtectedRoute>} />
            <Route path="/devoluciones" element={<ProtectedRoute allowedRoles={['admin', 'cco', 'bodega']}><Devoluciones /></ProtectedRoute>} />

            {/* Bitácora */}
            <Route path="/bitacora-operacion" element={<ProtectedRoute allowedRoles={['admin', 'cco']}><OperacionBitacora /></ProtectedRoute>} />
            <Route path="/bitacora-dashboard" element={<ProtectedRoute allowedRoles={['admin']}><DashboardBitacora /></ProtectedRoute>} />

            {/* Finanzas */}
            <Route path="/finanzas" element={<ProtectedRoute allowedRoles={['admin', 'jefe_finanzas', 'analista_finanzas']}><GestionCostos /></ProtectedRoute>} />
            <Route path="/reportes" element={<ProtectedRoute allowedRoles={['admin', 'jefe_finanzas']}><ReportesFinancieros /></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/usuarios" element={<ProtectedRoute allowedRoles={['admin']}><AdminUsuarios /></ProtectedRoute>} />

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