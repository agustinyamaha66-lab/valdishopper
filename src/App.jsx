import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

// Ajusta este import según tu proyecto:
// Opción A (común): "./components/Layout/Layout"
// Opción B: "./components/Layout"
import Layout from "./components/Layout/Layout";

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

export default function App() {
  return (
    <Router>
      <Routes>
        {/* LOGIN sin layout */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        {/* TODA la app protegida con Layout (sidebar/topbar) */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Home />} />
          <Route path="/transporte" element={<Transporte />} />
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
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
