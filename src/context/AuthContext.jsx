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

    // --- MEJORA: FUNCIÓN CON REINTENTOS (RETRY) ---
    // Si falla a la primera, lo intenta 3 veces más antes de rendirse.
    const fetchPerfil = async (userId, intentos = 3) => {
      for (let i = 0; i < intentos; i++) {
        try {
          const { data, error } = await supabase
            .from('perfiles')
            .select('rol, debe_cambiar_pass')
            .eq('id', userId)
            .single()

          // Si tenemos éxito, devolvemos el perfil
          if (!error && data) return data;

          // Si falla, esperamos un poco (500ms, 1000ms...) y reintentamos
          if (i < intentos - 1) {
             console.log(`Intento ${i + 1} fallido. Reintentando...`);
             await new Promise(res => setTimeout(res, 500 * (i + 1)));
          }
        } catch (error) {
          console.warn("Error de red al buscar perfil:", error)
        }
      }
      return null; // Si fallaron los 3 intentos, nos rendimos
    }

    const inicializarSesion = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (session && mounted) {
          setUser(session.user)

          // Usamos la función inteligente con reintentos
          const perfil = await fetchPerfil(session.user.id)

          if (perfil) {
            setRole(perfil.rol)
            setDebeCambiarPass(perfil.debe_cambiar_pass)
          } else {
            console.warn("El perfil tardó demasiado. Manteniendo sesión sin rol visual por ahora.")
            // IMPORTANTE: NO hacemos signOut. Te dejamos dentro.
            setRole(null)
          }
        }
      } catch (error) {
        console.error("Error crítico:", error)
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
            // Aquí también reintentamos si es necesario
            const perfil = await fetchPerfil(session.user.id)
            setRole(perfil?.rol || null)
            setDebeCambiarPass(perfil?.debe_cambiar_pass || false)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setRole(null)
        setDebeCambiarPass(false)
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
    setDebeCambiarPass(false)
    await supabase.auth.signOut()
  }

  const confirmarCambioPass = () => setDebeCambiarPass(false)

  return (
    <AuthContext.Provider value={{ user, role, debeCambiarPass, loading, signOut, confirmarCambioPass }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)