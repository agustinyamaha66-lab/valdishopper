import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import Login from "./pages/Login";
import Home from "./pages/Home";

// Tus pantallas (ajusta rutas si las tienes en components/Layout u otro lado)
import Transporte from "./components/Transporte";
import Ruteo from "./components/Ruteo";
import ReportesFinancieros from "./components/ReportesFinancieros";
// ...importa aquí las demás pantallas que tengas

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, role, loading } = useAuth();

  if (loading) return <div style={{ padding: 16 }}>Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;

  // ✅ Si la ruta exige roles y todavía no hay rol (o no existe), NO deja pasar
  if (allowedRoles && !role) return <Navigate to="/" replace />;

  // ✅ Si el rol no está permitido, bloquea
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/" replace />;

  return children;
};

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Públicas */}
        <Route path="/login" element={<Login />} />

        {/* Home: puede ser pública o protegida según tu diseño.
            Si la quieres protegida, envuélvela con ProtectedRoute */}
        <Route path="/" element={<Home />} />

        {/* Protegidas por login (cualquier usuario logueado) */}
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
