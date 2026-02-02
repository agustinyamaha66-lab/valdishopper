import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);
  const watchdogRef = useRef(null);

  const startLoading = (ms = 8000) => {
    if (!mountedRef.current) return;
    setLoading(true);

    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = setTimeout(() => {
      console.warn("⏳ [AuthContext] Watchdog: liberando loading para evitar pantalla pegada.");
      if (mountedRef.current) setLoading(false);
    }, ms);
  };

  const stopLoading = () => {
    if (!mountedRef.current) return;
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    setLoading(false);
  };

  const fetchPerfil = async (userId) => {
    console.log("🔍 [AuthContext] Buscando perfil en DB para usuario:", userId);

    // timeout real para query
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Timeout consultando perfil (8s)")), 8000);
    });

    try {
      const queryPromise = supabase
        .from("perfiles")
        .select("rol")
        .eq("id", userId)
        .single();

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) {
        console.error("❌ [AuthContext] Error al buscar perfil:", error);
        return null;
      }

      if (!data) {
        console.warn("⚠️ [AuthContext] No se encontró perfil (data vacía).");
        return null;
      }

      console.log("✅ [AuthContext] Perfil encontrado:", data);
      return data;
    } catch (e) {
      console.error("💥 [AuthContext] Excepción en fetchPerfil:", e);
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
      if (mountedRef.current) {
        setUser(null);
        setRole(null);
        stopLoading();
      }
    }
  };

  const aplicarSesion = async (session) => {
    // sesión nula => limpiar
    if (!session?.user) {
      if (!mountedRef.current) return;
      setUser(null);
      setRole(null);
      stopLoading();
      return;
    }

    startLoading();

    const perfil = await fetchPerfil(session.user.id);

    if (!perfil) {
      console.warn("💀 [AuthContext] ZOMBIE: auth ok pero sin perfil/permisos. Cerrando sesión...");
      await cerrarSesionYLimpiar("Sesión válida pero sin perfil o sin permisos (RLS).");
      return;
    }

    if (!mountedRef.current) return;
    setUser(session.user);
    setRole(perfil.rol);
    stopLoading();
  };

  useEffect(() => {
    mountedRef.current = true;
    console.log("🟢 [AuthContext] Provider montado. Iniciando efectos...");

    const inicializarSesion = async () => {
      console.log("🔄 [AuthContext] inicializarSesion() ejecutándose...");
      startLoading();

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.error("❌ [AuthContext] Error obteniendo sesión:", error);

        const session = data?.session ?? null;
        console.log("🎫 [AuthContext] Sesión actual:", session ? "EXISTE" : "NULL");

        await aplicarSesion(session);
      } catch (e) {
        console.error("💥 [AuthContext] Error fatal en inicializarSesion:", e);
        stopLoading();
      }
    };

    // ✅ no “Promise ignored”
    void inicializarSesion();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`🔔 [AuthContext] Evento Auth: ${event}`);

      if (!mountedRef.current) return;

      // ✅ evitamos async directo aquí; usamos IIFE controlada
      if (event === "SIGNED_OUT" || !session?.user) {
        setUser(null);
        setRole(null);
        stopLoading();
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        void (async () => {
          await aplicarSesion(session);
        })();
      }
    });

    return () => {
      console.log("🔌 [AuthContext] Desmontando provider.");
      mountedRef.current = false;

      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }

      // ✅ Unsubscribe robusto sin bloques vacíos
      const sub = data?.subscription;
      if (sub && typeof sub.unsubscribe === "function") {
        sub.unsubscribe();
      } else if (data && typeof data.unsubscribe === "function") {
        data.unsubscribe();
      }
    };
  }, []);

  const signOut = async () => {
    console.log("🚪 [AuthContext] signOut manual...");

    // limpieza UI inmediata
    setUser(null);
    setRole(null);
    setLoading(false);

    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("❌ [AuthContext] Error en signOut manual:", e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() debe usarse dentro de <AuthProvider>.");
  return ctx;
};
