import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "./context/AuthContext";
import "leaflet/dist/leaflet.css";

import Sidebar from "./components/layout/sidebar.jsx";
import Topbar from "./components/layout/topbar.jsx";

import Login from "./pages/Login";
import Home from "./pages/Home";
import GuestHome from "./pages/GuestHome";

import Transporte from "./components/Transporte";
import Ruteo from "./components/Ruteo";
import Devoluciones from "./components/Devoluciones";
import OperacionBitacora from "./components/OperacionBitacora";
import GestionCostos from "./components/GestionCostos";
import ReportesFinancieros from "./components/ReportesFinancieros";
import AdminUsuarios from "./components/AdminUsuarios";
import DashboardBitacora from "./components/DashboardBitacora";
import CatastroPatente from "./components/CatastroPatente"; // ✅ NUEVO

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div style={{ padding: 16 }}>Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;

  // Invitado: se queda en /invitado
  if (role === "invitado" && location.pathname !== "/invitado") {
    return <Navigate to="/invitado" replace />;
  }
  if (role !== "invitado" && location.pathname === "/invitado") {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { user, role, loading } = useAuth();
  if (loading) return <div style={{ padding: 16 }}>Cargando...</div>;

  if (user) {
    if (role === "invitado") return <Navigate to="/invitado" replace />;
    return <Navigate to="/" replace />;
  }
  return children;
};

const AppLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="min-h-screen">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <Topbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className={`${sidebarOpen ? "md:pl-64" : ""} pt-16`}>
        <main className="p-6 bg-gray-50 min-h-[calc(100vh-64px)]">{children}</main>
      </div>
    </div>
  );
};

export default function App() {
  const FINANZAS_ROLES = ["admin", "jefe_finanzas", "analista_finanzas"];

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

        <Route
          path="/invitado"
          element={
            <ProtectedRoute>
              <GuestHome />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<ProtectedRoute><AppLayout><Home /></AppLayout></ProtectedRoute>} />

        <Route path="/transporte" element={<ProtectedRoute><AppLayout><Transporte /></AppLayout></ProtectedRoute>} />
        <Route path="/ruteo" element={<ProtectedRoute allowedRoles={["admin", "cco"]}><AppLayout><Ruteo /></AppLayout></ProtectedRoute>} />
        <Route path="/devoluciones" element={<ProtectedRoute><AppLayout><Devoluciones /></AppLayout></ProtectedRoute>} />
        <Route path="/bitacora-operacion" element={<ProtectedRoute><AppLayout><OperacionBitacora /></AppLayout></ProtectedRoute>} />
        <Route path="/finanzas" element={<ProtectedRoute allowedRoles={FINANZAS_ROLES}><AppLayout><GestionCostos /></AppLayout></ProtectedRoute>} />
        <Route path="/reportes-financieros" element={<ProtectedRoute allowedRoles={FINANZAS_ROLES}><AppLayout><ReportesFinancieros /></AppLayout></ProtectedRoute>} />
        <Route path="/usuarios" element={<ProtectedRoute allowedRoles={["admin"]}><AppLayout><AdminUsuarios /></AppLayout></ProtectedRoute>} />

        {/* ✅ NUEVO: SOLO ADMIN */}
        <Route
          path="/catastro-patentes"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AppLayout>
                <CatastroPatente />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route path="/bitacora-dashboard" element={<ProtectedRoute allowedRoles={["admin"]}><AppLayout><DashboardBitacora /></AppLayout></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
