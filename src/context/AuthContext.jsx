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

    // Función auxiliar para obtener el perfil
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
        console.error("Error al cargar perfil real:", error.message)
        return null
      }
    }

    const inicializarSesion = async () => {
      try {
        // 1. Verificamos sesión en Supabase
        const { data: { session }, error } = await supabase.auth.getSession()

        if (session && mounted) {
          setUser(session.user)

          // 2. Buscamos el rol REAL en la base de datos
          const perfil = await fetchPerfil(session.user.id)

          if (perfil) {
            // ÉXITO: Tenemos rol real
            setRole(perfil.rol)
            setDebeCambiarPass(perfil.debe_cambiar_pass)
          } else {
            // ERROR: Hay usuario pero NO hay perfil (o falló la DB).
            // NO asignamos 'colaborador'. Dejamos null y cerramos sesión por seguridad.
            console.warn("Usuario autenticado sin perfil. Forzando cierre.")
            setRole(null)
            await supabase.auth.signOut()
            setUser(null)
          }
        }
      } catch (error) {
        console.error("Error crítico de sesión:", error)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    inicializarSesion()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
            setUser(session.user)
            const perfil = await fetchPerfil(session.user.id)

            // Si hay perfil, asignamos rol. Si no, NULL (nada de colaborador)
            setRole(perfil?.rol || null)
            setDebeCambiarPass(perfil?.debe_cambiar_pass || false)
        } else {
            // Caso raro donde hay evento pero no user
            setUser(null)
            setRole(null)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setRole(null)
        setDebeCambiarPass(false)
      }
    })

    // --- SEGURO ANTI-BLOQUEO ---
    const safetyTimer = setTimeout(() => {
        if (loading && mounted) {
            console.warn("⚠️ Tiempo agotado. Finalizando carga.");
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