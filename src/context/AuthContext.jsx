import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);
  const watchdogRef = useRef(null);

  // ... (MANTENER TODO EL CÓDIGO DE startLoading, stopLoading, fetchPerfil IGUAL) ...
  const startLoading = (ms = 8000) => {
    if (!mountedRef.current) return;
    setLoading(true);
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = setTimeout(() => {
      console.warn("⏳ [AuthContext] Watchdog: liberando loading.");
      if (mountedRef.current) setLoading(false);
    }, ms);
  };

  const stopLoading = () => {
    if (!mountedRef.current) return;
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    setLoading(false);
  };

  const fetchPerfil = async (userId) => {
    // ... (MANTENER TU LÓGICA DE FETCHPERFIL IGUAL) ...
    // Copia y pega tu función fetchPerfil aquí tal cual la tienes
    try {
      const { data, error } = await supabase.from("perfiles").select("rol").eq("id", userId).single();
      if (error || !data) return null;
      return data;
    } catch (e) { return null; }
  };

  // ... (MANTENER cerrarSesionYLimpiar IGUAL) ...
  const cerrarSesionYLimpiar = async () => {
      await supabase.auth.signOut();
      if (mountedRef.current) { setUser(null); setRole(null); stopLoading(); }
  };

  // ... (MANTENER aplicarSesion IGUAL) ...
  const aplicarSesion = async (session) => {
    if (!session?.user) {
      if (!mountedRef.current) return;
      setUser(null); setRole(null); stopLoading();
      return;
    }
    startLoading();
    // Si el usuario es "guest", no buscamos en DB
    if (session.user.id === 'guest-id') {
         setUser(session.user);
         setRole('invitado');
         stopLoading();
         return;
    }
    const perfil = await fetchPerfil(session.user.id);
    if (!perfil) { await cerrarSesionYLimpiar(); return; }
    if (!mountedRef.current) return;
    setUser(session.user); setRole(perfil.rol); stopLoading();
  };

  // ... (MANTENER useEffect IGUAL) ...
  useEffect(() => {
    mountedRef.current = true;
    const inicializarSesion = async () => {
      startLoading();
      const { data } = await supabase.auth.getSession();
      await aplicarSesion(data?.session ?? null);
    };
    void inicializarSesion();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (!mountedRef.current) return;
        if (event === "SIGNED_OUT" || !session?.user) {
            setUser(null); setRole(null); stopLoading();
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
            aplicarSesion(session);
        }
    });
    return () => { mountedRef.current = false; data?.subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    // Limpieza inmediata
    setUser(null); setRole(null); setLoading(false);
    await supabase.auth.signOut();
  };

  // --- AGREGAR ESTA NUEVA FUNCIÓN ---
  const loginAsGuest = () => {
    setLoading(true);
    // Simulamos un objeto de usuario
    const guestUser = {
        id: 'guest-id',
        email: 'invitado@valdishopper.com',
        aud: 'authenticated'
    };
    setUser(guestUser);
    setRole('invitado'); // Rol especial
    setLoading(false);
  };

  return (
    // Agregamos loginAsGuest al value del provider
    <AuthContext.Provider value={{ user, role, loading, signOut, loginAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() debe usarse dentro de <AuthProvider>.");
  return ctx;
};