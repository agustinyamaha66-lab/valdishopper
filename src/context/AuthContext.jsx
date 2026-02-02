import { createContext, useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    console.log("🟢 [AuthContext] Provider montado. Iniciando efectos...")

    const fetchPerfil = async (userId) => {
      console.log("🔍 [AuthContext] Buscando perfil en DB para usuario:", userId)
      try {
        const { data, error } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', userId)
          .single()

        if (error) {
          console.error("❌ [AuthContext] Error al buscar perfil:", error.message)
          return null
        }
        if (!data) {
          console.warn("⚠️ [AuthContext] No se encontró perfil (data vacía).")
          return null
        }

        console.log("✅ [AuthContext] Perfil encontrado:", data)
        return data
      } catch (e) {
        console.error("💥 [AuthContext] Excepción en fetchPerfil:", e)
        return null
      }
    }

    const cerrarSesionYLimpiar = async (motivo = "") => {
      if (motivo) console.warn("🚪 [AuthContext] Cerrando sesión:", motivo)
      try {
        await supabase.auth.signOut()
      } catch (e) {
        console.error("❌ [AuthContext] Error al hacer signOut:", e)
      } finally {
        if (mounted) {
          setUser(null)
          setRole(null)
          setLoading(false)
        }
      }
    }

    const inicializarSesion = async () => {
      console.log("🔄 [AuthContext] inicializarSesion() ejecutándose...")
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) console.error("❌ [AuthContext] Error obteniendo sesión:", error)
        console.log("🎫 [AuthContext] Sesión actual en navegador:", session ? "EXISTE" : "NULL")

        if (session?.user && mounted) {
          const perfil = await fetchPerfil(session.user.id)

          if (perfil) {
            console.log("👍 [AuthContext] Usuario y Rol válidos. Actualizando estado...")
            setUser(session.user)
            setRole(perfil.rol)
          } else {
            console.warn("💀 [AuthContext] ZOMBIE: Auth ok pero sin perfil. Cerrando sesión...")
            await cerrarSesionYLimpiar("Sesión válida pero sin perfil (zombie) en inicializarSesion()")
            return
          }
        } else {
          console.log("ℹ️ [AuthContext] No hay sesión activa.")
          setUser(null)
          setRole(null)
        }
      } catch (error) {
        console.error("💥 [AuthContext] Error fatal en inicializarSesion:", error)
      } finally {
        if (mounted) {
          console.log("🛑 [AuthContext] Finalizando carga (setLoading false)")
          setLoading(false)
        }
      }
    }

    inicializarSesion()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔔 [AuthContext] Evento de Auth disparado: ${event}`)
      if (!mounted) return

      if (event === 'SIGNED_OUT' || !session?.user) {
        console.log("👋 [AuthContext] Sesión cerrada o sin usuario.")
        setUser(null)
        setRole(null)
        setLoading(false)
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        console.log("🔄 [AuthContext] Recargando perfil tras evento...")
        const perfil = await fetchPerfil(session.user.id)

        if (perfil) {
          setUser(session.user)
          setRole(perfil.rol)
          setLoading(false)
        } else {
          console.warn("💀 [AuthContext] ZOMBIE tras evento Auth: no hay perfil. Cerrando sesión...")
          await cerrarSesionYLimpiar("Sesión válida pero sin perfil tras evento Auth (zombie)")
        }
      }
    })

    return () => {
      console.log("🔌 [AuthContext] Desmontando provider.")
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    console.log("🚪 [AuthContext] Ejecutando signOut manual...")
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

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth() debe usarse dentro de <AuthProvider>.")
  }
  return ctx
}
