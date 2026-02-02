import { createContext, useState, useEffect, useContext } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    console.log("🟢 [AuthContext] Provider montado. Iniciando efectos...");

    // Watchdog (UI) - se reinicia cuando se llama startLoading()
    let watchdogId = null;
    const startLoading = (ms = 8000) => {
      if (!mounted) return;
      setLoading(true);

      if (watchdogId) clearTimeout(watchdogId);
      watchdogId = setTimeout(() => {
        console.warn("⏳ [AuthContext] Watchdog: liberando loading para evitar pantalla pegada.");
        if (mounted) setLoading(false);
      }, ms);
    };

    const stopLoading = () => {
      if (!mounted) return;
      if (watchdogId) clearTimeout(watchdogId);
      watchdogId = null;
      setLoading(false);
    };

    const fetchPerfil = async (userId) => {
      console.log("🔍 [AuthContext] Buscando perfil en DB para usuario:", userId);

      // Timeout real para la consulta al perfil (no solo watchdog UI)
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout consultando perfil (8s)")), 8000)
      );

      try {
        const query = supabase
          .from("perfiles")
          .select("rol")
          .eq("id", userId)
          .single();

        const { data, error } = await Promise.race([query, timeout]);

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
        if (mounted) {
          setUser(null);
          setRole(null);
          stopLoading();
        }
      }
    };

    const aplicarSesion = async (session) => {
      // session null o sin user => limpiar
      if (!session?.user) {
        if (!mounted) return;
        setUser(null);
        setRole(null);
        stopLoading();
        return;
      }

      startLoading(); // ✅ importante: cada vez que recargues perfil, activa loading

      const perfil = await fetchPerfil(session.user.id);

      if (!perfil) {
        console.warn("💀 [AuthContext] ZOMBIE: auth ok pero sin perfil/permisos. Cerrando sesión...");
        await cerrarSesionYLimpiar("Sesión válida pero sin perfil o sin permisos (RLS).");
        return;
      }

      if (!mounted) return;
      setUser(session.user);
      setRole(perfil.rol);
      stopLoading();
    };

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
        if (mounted) stopLoading();
      }
    };

    inicializarSesion();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔔 [AuthContext] Evento Auth: ${event}`);
      if (!mounted) return;

      // SIGNED_OUT o sesión vacía
      if (event === "SIGNED_OUT" || !session?.user) {
        setUser(null);
        setRole(null);
        stopLoading();
        return;
      }

      // SIGNED_IN / TOKEN_REFRESHED => recargar perfil
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        await aplicarSesion(session);
      }
    });

    return () => {
      console.log("🔌 [AuthContext] Desmontando provider.");
      mounted = false;

      if (watchdogId) clearTimeout(watchdogId);

      // En supabase-js moderno, listener.subscription.unsubscribe()
      // En versiones antiguas, listener.unsubscribe()
      try {
        listener?.subscription?.unsubscribe?.();
      } catch (_) {}
      try {
        listener?.unsubscribe?.();
      } catch (_) {}
    };
  }, []);

  const signOut = async () => {
    console.log("🚪 [AuthContext] signOut manual...");
    // Limpieza inmediata UI
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
