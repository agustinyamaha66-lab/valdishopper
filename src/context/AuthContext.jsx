import { createContext, useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true;

    // Función inteligente con reintentos para evitar errores de red
    const fetchPerfil = async (userId, intentos = 3) => {
      for (let i = 0; i < intentos; i++) {
        try {
          const { data, error } = await supabase
            .from('perfiles')
            .select('rol')
            .eq('id', userId)
            .single()

          if (!error && data) return data;

          // Esperar un poco antes de reintentar
          if (i < intentos - 1) await new Promise(res => setTimeout(res, 500));
        } catch (e) {
          console.warn(`Intento ${i+1} fallido:`, e)
        }
      }
      return null;
    }

    const inicializarSesion = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session && mounted) {
          setUser(session.user)
          // Buscamos el rol
          const perfil = await fetchPerfil(session.user.id)
          // Si encuentra rol lo pone, si no, lo deja null (pero NO te saca)
          if (perfil) setRole(perfil.rol)
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
            setUser(session.user)
            const perfil = await fetchPerfil(session.user.id)
            setRole(perfil?.rol || null)
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