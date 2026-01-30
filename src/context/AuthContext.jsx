import { createContext, useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true;

    const fetchPerfil = async (userId) => {
      try {
        const { data, error } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', userId)
          .single()

        if (error || !data) return null;
        return data;
      } catch (e) {
        return null;
      }
    }

    const inicializarSesion = async () => {
      try {
        // 1. Verificamos si hay sesión guardada en el navegador
        const { data: { session } } = await supabase.auth.getSession()

        if (session && mounted) {
          // 2. Si hay sesión, intentamos buscar el perfil/rol
          const perfil = await fetchPerfil(session.user.id)

          if (perfil) {
            // A) TODO ESTÁ BIEN: Hay usuario y hay rol
            setUser(session.user)
            setRole(perfil.rol)
          } else {
            // B) ERROR ZOMBIE: Hay usuario pero NO hay rol (borraste la DB)
            console.warn("Usuario sin perfil detectado. Cerrando sesión automática.")
            await supabase.auth.signOut() // <--- ESTO ARREGLA LA PANTALLA BLANCA
            setUser(null)
            setRole(null)
          }
        }
      } catch (error) {
        console.error("Error de sesión:", error)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    inicializarSesion()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
         if (session?.user) {
            const perfil = await fetchPerfil(session.user.id)
            if (perfil) {
                setUser(session.user)
                setRole(perfil.rol)
            } else {
                // Protección extra por si acaso
                setUser(session.user)
                setRole(null)
            }
         }
      } else if (event === 'SIGNED_OUT') {
         setUser(null)
         setRole(null)
      }
    })

    return () => {
      mounted = false;
      subscription.unsubscribe();
    }
  }, [])

  const signOut = async () => {
    setUser(null)
    setRole(null)
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)