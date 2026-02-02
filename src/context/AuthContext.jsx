import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Busca perfil/rol en la tabla perfiles
  const fetchPerfil = async (userId) => {
    try {
      console.log("🔍 [AuthContext] Buscando perfil en DB para usuario:", userId);

      const { data, error } = await supabase
        .from("perfiles")
        .select("rol")
        .eq("id", userId)
        .single();

      if (error) {
        // Si es "no rows", supabase suele tirar error también en single()
        console.error("❌ [AuthContext] Error al buscar perfil:", error.message);
        return null;
      }

      if (!data) {
        console.warn("⚠️ [AuthContext] No se encontró perfil para el usuario.");
        return null;
      }

      console.log("✅ [AuthContext] Perfil encontrado:", data);
      return data;
    } catch (e) {
      console.error("❌ [AuthContext] Excepción en fetchPerfil:", e);
      return null;
    }
  };

  const cerrarSesionYLimpiar = async (motivo = "") => {
    if (motivo) console.warn("🚪 [AuthContext] Cerrando sesión:", motivo);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("❌ [AuthContext] Error al hacer signOut:", e);
    } finally {
      setUser(null);
      setRole(null);
      setLoading(false);
    }
  };

  // Carga sesión inicial al montar
  const inicializarSesion = async () => {
    try {
      console.log("🔄 [AuthContext] inicializarSesion() ejecutándose...");

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error("❌ [AuthContext] Error getSession:", error.message);
        setLoading(false);
        return;
      }

      const session = data?.session;

      if (!session?.user) {
        console.log("ℹ️ [AuthContext] No hay sesión activa.");
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      // Hay usuario, buscamos perfil
      const perfil = await fetchPerfil(session.user.id);

      if (!perfil) {
        // ✅ Evita "zombies": auth ok, pero sin perfil
        await cerrarSesionYLimpiar("Sesión válida pero sin perfil (zombie) en inicializarSesion()");
        return;
      }

      setUser(session.user);
      setRole(perfil.rol);
      setLoading(false);
    } catch (e) {
      console.error("❌ [AuthContext] Excepción en inicializarSesion:", e);
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("🟢 [AuthContext] Provider montado. Iniciando efectos...");
    inicializarSesion();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("🔔 [AuthContext] Evento de Auth disparado:", event);

        // Si se cerró sesión
        if (event === "SIGNED_OUT" || !session?.user) {
          console.log("👋 [AuthContext] Sesión cerrada o sin usuario.");
          setUser(null);
          setRole(null);
          setLoading(false);
          return;
        }

        // SIGNED_IN / TOKEN_REFRESHED: refrescamos perfil
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          console.log("🔄 [AuthContext] Recargando perfil tras evento...");

          const perfil = await fetchPerfil(session.user.id);

          if (!perfil) {
            // ✅ Evita "zombies": auth ok, pero sin perfil
            await cerrarSesionYLimpiar("Sesión válida pero sin perfil tras evento de Auth (zombie)");
            return;
          }

          setUser(session.user);
          setRole(perfil.rol);
          setLoading(false);
        }
      }
    );

    return () => {
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  const value = {
    user,
    role,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
