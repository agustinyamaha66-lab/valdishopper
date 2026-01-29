import { useState } from 'react'
// CAMBIO CLAVE: Usamos HashRouter en lugar de BrowserRouter
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Toaster } from 'sonner'

// Layout
import Sidebar from './components/layout/sidebar'
import Topbar from './components/layout/topbar'

// Páginas
import Login from './pages/Login'
import Home from './pages/Home'

// --- TUS COMPONENTES REALES (Conectados según tus archivos) ---
import Transporte from './components/Transporte.jsx'
import Ruteo from './components/Ruteo.jsx'
import Devoluciones from './components/Devoluciones.jsx'
import OperacionBitacora from './components/OperacionBitacora.jsx'
import DashboardBitacora from './components/DashboardBitacora.jsx'
import GestionCostos from './components/GestionCostos.jsx'
import ReportesFinancieros from './components/ReportesFinancieros.jsx'
import AdminUsuarios from './components/AdminUsuarios.jsx'

// Ruta Protegida (Maneja la espera y seguridad)
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, role, loading } = useAuth()

  // 1. PANTALLA DE CARGA (Para que el F5 no te expulse mientras piensa)
  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-100 gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-bold animate-pulse">Cargando Sistema...</p>
      </div>
    )
  }

  // 2. SI NO HAY USUARIO -> LOGIN
  if (!user) return <Navigate to="/login" />

  // 3. SI EL ROL NO ES CORRECTO -> HOME
  if (allowedRoles && role && !allowedRoles.includes(role)) {
     return <Navigate to="/" />
  }

  return children
}

// Contenido Principal de la App
function AppContent() {
  const { user, role, signOut, loading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Si está cargando, dejamos que ProtectedRoute o el loader de abajo manejen
  if (loading) return null

  // Si no está logueado, mostramos Login
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    )
  }

  // Estructura del Panel (Sidebar + Topbar + Contenido)
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">

      <Sidebar
        role={role}
        isOpen={sidebarOpen}
        toggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'ml-0'}`}>
        <Topbar
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            userEmail={user.email}
            role={role}
            signOut={signOut}
            irInicio={() => window.location.href = '#/'} // HashRouter usa #/
        />

        <main className="flex-1 overflow-y-auto p-6 mt-16">
          <Routes>
            <Route path="/" element={<Home role={role} />} />

            {/* --- RUTAS OPERATIVAS --- */}
            <Route path="/transporte" element={<ProtectedRoute allowedRoles={['admin', 'cco', 'logistica', 'colaborador']}><Transporte /></ProtectedRoute>} />
            <Route path="/ruteo" element={<ProtectedRoute allowedRoles={['admin', 'cco']}><Ruteo /></ProtectedRoute>} />
            <Route path="/devoluciones" element={<ProtectedRoute allowedRoles={['admin', 'cco', 'bodega']}><Devoluciones /></ProtectedRoute>} />

            {/* --- BITÁCORA --- */}
            <Route path="/bitacora-operacion" element={<ProtectedRoute allowedRoles={['admin', 'cco']}><OperacionBitacora /></ProtectedRoute>} />
            <Route path="/bitacora-dashboard" element={<ProtectedRoute allowedRoles={['admin']}><DashboardBitacora /></ProtectedRoute>} />

            {/* --- FINANZAS --- */}
            <Route path="/finanzas" element={<ProtectedRoute allowedRoles={['admin', 'jefe_finanzas', 'analista_finanzas']}><GestionCostos /></ProtectedRoute>} />
            <Route path="/reportes" element={<ProtectedRoute allowedRoles={['admin', 'jefe_finanzas']}><ReportesFinancieros /></ProtectedRoute>} />

            {/* --- ADMIN --- */}
            <Route path="/usuarios" element={<ProtectedRoute allowedRoles={['admin']}><AdminUsuarios /></ProtectedRoute>} />

            {/* Cualquier otra ruta lleva al inicio */}
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
      {/* CAMBIO FINAL: Router con Hash para evitar errores en Render */}
      <Router>
        <AppContent />
        <Toaster position="top-right" richColors />
      </Router>
    </AuthProvider>
  )
}