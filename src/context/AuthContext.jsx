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

    const recuperarSesion = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (session && mounted) {
          setUser(session.user)
          const { data: perfil } = await supabase
            .from('perfiles')
            .select('rol, debe_cambiar_pass')
            .eq('id', session.user.id)
            .single()

          if (perfil) {
            setRole(perfil.rol)
            setDebeCambiarPass(perfil.debe_cambiar_pass)
          }
        }
      } catch (error) {
        console.error("Error sesión:", error)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    recuperarSesion()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' && session) {
        setUser(session.user)
        const { data } = await supabase
            .from('perfiles')
            .select('rol, debe_cambiar_pass')
            .eq('id', session.user.id)
            .single()

        setRole(data?.rol || 'colaborador')
        setDebeCambiarPass(data?.debe_cambiar_pass || false)

      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setRole(null)
        setDebeCambiarPass(false)
      }
    })

    // --- [NUEVO] SEGURO ANTI-BLOQUEO ---
    // Si por alguna razón (internet lento, error de Vercel) sigue cargando a los 5 segundos,
    // forzamos que termine para que no se quede la pantalla azul eterna.
    const safetyTimer = setTimeout(() => {
        if (loading && mounted) {
            console.warn("⚠️ Tiempo de espera agotado. Forzando fin de carga.");
            setLoading(false);
        }
    }, 5000); // 5 segundos de espera máxima

    // --- [MODIFICADO] LIMPIEZA ---
    return () => {
      mounted = false;
      clearTimeout(safetyTimer); // <--- Importante limpiar el timer
      subscription.unsubscribe();
    }
  }, []) // <--- Array de dependencias vacío, esto está bien

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setRole(null)
    setDebeCambiarPass(false)
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