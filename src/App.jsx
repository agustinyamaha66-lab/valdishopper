// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

// OJO: ajusta la ruta según tu estructura real:
// Si tu carpeta es: src/components/layouts/Sidebar.jsx y Topbar.jsx
import Sidebar from "./components/layouts/sidebar.jsx";
import Topbar from "./components/layouts/topbar.jsx";

import Login from "./pages/Login";
import Home from "./pages/Home";

import Transporte from "./components/Transporte";
import Ruteo from "./components/Ruteo";
import ReportesFinancieros from "./components/ReportesFinancieros";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, role, loading } = useAuth();

  if (loading) return <div style={{ padding: 16 }}>Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !role) return <Navigate to="/" replace />;
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/" replace />;

  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <div style={{ padding: 16 }}>Cargando...</div>;
  if (user) return <Navigate to="/" replace />;

  return children;
};

// Layout "inline": arma Sidebar + Topbar + contenido
const AppLayout = ({ children }) => (
  <div className="flex min-h-screen">
    <Sidebar />
    <div className="flex flex-col flex-1">
      <Topbar />
      <main className="flex-1 p-6 bg-gray-50">{children}</main>
    </div>
  </div>
);

export default function App() {
  return (
    <Router>
      <Routes>
        {/* LOGIN (sin layout) */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        {/* APP (con layout) */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Home />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/transporte"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Transporte />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/ruteo"
          element={
            <ProtectedRoute allowedRoles={["admin", "cco"]}>
              <AppLayout>
                <Ruteo />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reportes-financieros"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AppLayout>
                <ReportesFinancieros />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
