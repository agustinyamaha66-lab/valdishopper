import { createContext, useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [debeCambiarPass, setDebeCambiarPass] = useState(false) // Nuevo estado
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true;

    const recuperarSesion = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (session && mounted) {
          setUser(session.user)
          // Buscamos rol Y si debe cambiar pass
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

    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setRole(null)
    setDebeCambiarPass(false)
  }

  // Función para actualizar el estado local cuando el usuario cambie su pass
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