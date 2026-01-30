import { createContext, useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true;
    console.log("🟢 [AuthContext] Provider montado. Iniciando efectos...");

    const fetchPerfil = async (userId) => {
      console.log("🔍 [AuthContext] Buscando perfil en DB para usuario:", userId);
      try {
        const { data, error } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', userId)
          .single()

        if (error) {
            console.error("❌ [AuthContext] Error al buscar perfil:", error.message);
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
    }

    const inicializarSesion = async () => {
      console.log("🔄 [AuthContext] inicializarSesion() ejecutándose...");
      try {
        // 1. Verificamos si hay sesión guardada en el navegador
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) console.error("❌ [AuthContext] Error obteniendo sesión:", error);
        console.log("🎫 [AuthContext] Sesión actual en navegador:", session ? "EXISTE" : "NULL");

        if (session && mounted) {
          // 2. Si hay sesión, intentamos buscar el perfil/rol
          const perfil = await fetchPerfil(session.user.id)

          if (perfil) {
            // A) TODO ESTÁ BIEN
            console.log("👍 [AuthContext] Usuario y Rol válidos. Actualizando estado...");
            setUser(session.user)
            setRole(perfil.rol)
          } else {
            // B) ERROR ZOMBIE
            console.warn("💀 [AuthContext] ZOMBIE DETECTADO: Hay usuario Auth pero no tiene perfil en DB.");
            console.log("🧹 [AuthContext] Cerrando sesión automáticamente para limpiar...");
            await supabase.auth.signOut()
            setUser(null)
            setRole(null)
          }
        } else {
            console.log("ℹ️ [AuthContext] No hay sesión activa.");
        }
      } catch (error) {
        console.error("💥 [AuthContext] Error fatal en inicializarSesion:", error)
      } finally {
        if (mounted) {
            console.log("🛑 [AuthContext] Finalizando carga (setLoading false)");
            setLoading(false)
        }
      }
    }

    inicializarSesion()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔔 [AuthContext] Evento de Auth disparado: ${event}`);
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
         if (session?.user) {
            console.log("🔄 [AuthContext] Recargando perfil tras evento...");
            const perfil = await fetchPerfil(session.user.id)
            if (perfil) {
                setUser(session.user)
                setRole(perfil.rol)
            } else {
                setUser(session.user)
                setRole(null)
            }
         }
      } else if (event === 'SIGNED_OUT') {
         console.log("👋 [AuthContext] Usuario cerró sesión.");
         setUser(null)
         setRole(null)
      }
    })

    return () => {
      console.log("🔌 [AuthContext] Desmontando provider.");
      mounted = false;
      subscription.unsubscribe();
    }
  }, [])

  const signOut = async () => {
    console.log("🚪 [AuthContext] Ejecutando signOut manual...");
    setUser(null)
    setRole(null)
    await supabase.auth.signOut()
  }

  // Log para ver qué se está enviando a la app en cada render
  // console.log("📦 [AuthContext] Render state ->", { loading, role, userEmail: user?.email });

  return (
    <AuthContext.Provider value={{ user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)