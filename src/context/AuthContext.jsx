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
        // Solo avisamos en consola, no rompemos nada
        console.warn("Aviso: No se pudo cargar el perfil inmediatamente.", error.message)
        return null
      }
    }

    const inicializarSesion = async () => {
      try {
        // 1. Verificamos si hay sesión activa en Supabase
        const { data: { session }, error } = await supabase.auth.getSession()

        if (session && mounted) {
          setUser(session.user)

          // 2. Buscamos el rol en la base de datos
          const perfil = await fetchPerfil(session.user.id)

          if (perfil) {
            setRole(perfil.rol)
            setDebeCambiarPass(perfil.debe_cambiar_pass)
          } else {
            // --- CORRECCIÓN CRÍTICA AQUÍ ---
            // Si falla la carga del perfil (por lentitud o red),
            // YA NO cerramos la sesión. Solo avisamos.
            console.warn("Sesión activa, pero el rol tardó en cargar. Manteniendo usuario.")
            // No hacemos signOut(), dejamos al usuario dentro.
            setRole(null)
          }
        }
      } catch (error) {
        console.error("Error general de sesión:", error)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    inicializarSesion()

    // Escuchamos cambios (Login, Logout, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
            setUser(session.user)
            const perfil = await fetchPerfil(session.user.id)

            // Asignamos rol si existe, si no, null (pero sin echar al usuario)
            setRole(perfil?.rol || null)
            setDebeCambiarPass(perfil?.debe_cambiar_pass || false)
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
            console.warn("⚠️ Tiempo de carga excedido. Abriendo aplicación.");
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
    // Limpieza visual inmediata
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