import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import Login from "./pages/Login";
import Home from "./pages/Home";

import Transporte from "./components/Transporte";
import Ruteo from "./components/Ruteo";
import ReportesFinancieros from "./components/ReportesFinancieros";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, role, loading } = useAuth();

  if (loading) return <div style={{ padding: 16 }}>Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;

  // Si la ruta exige roles y todavía no hay rol => bloquear
  if (allowedRoles && !role) return <Navigate to="/" replace />;

  // Si el rol no está permitido => bloquear
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/" replace />;

  return children;
};

// Para páginas públicas como /login: si ya hay sesión, redirigir al home
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <div style={{ padding: 16 }}>Cargando...</div>;
  if (user) return <Navigate to="/" replace />;

  return children;
};

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Públicas */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        {/* Home protegido: si no hay sesión => /login */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />

        {/* Protegidas por login */}
        <Route
          path="/transporte"
          element={
            <ProtectedRoute>
              <Transporte />
            </ProtectedRoute>
          }
        />

        {/* Protegidas por rol */}
        <Route
          path="/ruteo"
          element={
            <ProtectedRoute allowedRoles={["admin", "cco"]}>
              <Ruteo />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reportes-financieros"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <ReportesFinancieros />
            </ProtectedRoute>
          }
        />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
