import { createContext, useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [debeCambiarPass, setDebeCambiarPass] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true;

    // Función auxiliar para obtener el perfil de forma segura
    const fetchPerfil = async (userId) => {
      try {
        const { data, error } = await supabase
          .from('perfiles')
          .select('rol, debe_cambiar_pass')
          .eq('id', userId)
          .single()

        if (error) throw error
        return data
      } catch (error) {
        console.warn("No se pudo cargar perfil, asignando defecto:", error.message)
        return null
      }
    }

    const inicializarSesion = async () => {
      try {
        // 1. Obtenemos la sesión actual de Supabase
        const { data: { session }, error } = await supabase.auth.getSession()

        if (session && mounted) {
          setUser(session.user)

          // 2. Buscamos el rol INMEDIATAMENTE antes de quitar el loading
          const perfil = await fetchPerfil(session.user.id)

          if (perfil) {
            setRole(perfil.rol)
            setDebeCambiarPass(perfil.debe_cambiar_pass)
          } else {
            // FALLBACK: Si hay usuario pero falló la DB, le damos rol básico para que no explote
            setRole('colaborador')
          }
        }
      } catch (error) {
        console.error("Error crítico verificando sesión:", error)
      } finally {
        // 3. SOLO AHORA, que ya tenemos user y rol, quitamos la carga
        if (mounted) setLoading(false)
      }
    }

    // Ejecutamos la lógica inicial
    inicializarSesion()

    // Escuchamos cambios (Login, Logout, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // Nota: INITIAL_SESSION ya lo manejamos arriba manualmente para mayor control
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null)
        if (session?.user) {
            const perfil = await fetchPerfil(session.user.id)
            setRole(perfil?.rol || 'colaborador')
            setDebeCambiarPass(perfil?.debe_cambiar_pass || false)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setRole(null)
        setDebeCambiarPass(false)
      }
    })

    // --- SEGURO ANTI-BLOQUEO (Modificado) ---
    // Solo fuerza el fin de carga si pasaron 6 segundos y SEGUIMOS cargando
    const safetyTimer = setTimeout(() => {
        if (loading && mounted) {
            console.warn("⚠️ Timeout de seguridad: Forzando apertura de app.");
            setLoading(false);
        }
    }, 6000);

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    }
  }, [])

  const signOut = async () => {
    // Optimistic Update: Limpiamos visualmente primero
    setUser(null)
    setRole(null)
    setDebeCambiarPass(false)
    try {
        await supabase.auth.signOut()
    } catch (error) {
        console.error("Error al cerrar sesión:", error)
    }
  }

  const confirmarCambioPass = () => {
      setDebeCambiarPass(false)
  }

  return (
    <AuthContext.Provider value={{ user, role, debeCambiarPass, loading, signOut, confirmarCambioPass }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)