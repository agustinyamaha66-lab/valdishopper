import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
// IMPORTAR EL HOOK useAuth
import { useAuth } from '../context/AuthContext';
import valdishopperImg from '../assets/Valdishopper-inicio.png' // Tu imagen

export default function Login() {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mostrarPassword, setMostrarPassword] = useState(false)

  // OBTENER LA FUNCIÓN DEL CONTEXTO
  const { loginAsGuest } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    const emailCompleto = `${usuario}@valdishopper.com`
    const { error } = await supabase.auth.signInWithPassword({
      email: emailCompleto,
      password
    })
    if (error) {
      alert("Error de acceso: " + error.message)
      setLoading(false)
    }
  }

  // MANEJAR EL CLICK DE INVITADO
  const handleGuestLogin = () => {
      loginAsGuest();
      // El router se encargará de redirigir a /invitado
  }

  return (
    <div className="min-h-screen w-full flex">
      {/* ... (COLUMNA IZQUIERDA Y FONDOS IGUAL QUE ANTES) ... */}
      <div className="hidden md:block md:w-1/2 relative overflow-hidden">
        <img src={valdishopperImg} alt="Fondo" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f254a]/50 to-transparent"></div>
      </div>

      <div className="w-full md:w-1/2 flex items-center justify-center relative overflow-hidden bg-[#0f254a]">
        <div className="absolute inset-0 bg-cover bg-center z-0 filter blur-xl scale-110 opacity-50" style={{ backgroundImage: `url(${valdishopperImg})` }}></div>
        <div className="absolute inset-0 bg-[#0f254a]/60 z-10 bg-blend-multiply"></div>

        <div className="bg-white/95 backdrop-blur-sm p-8 rounded-2xl shadow-2xl w-full max-w-md border-t-8 border-[#d63384] animate-fade-in-up relative z-20 mx-4 ls:mx-auto">

          <div className="text-center mb-8">
            <h1 className="text-4xl font-black text-[#1e3c72] tracking-tighter">CCO</h1>
            <p className="text-xs font-bold text-[#d63384] tracking-[0.3em] uppercase mt-1">Control Operacional</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {/* ... (INPUTS DE USUARIO Y PASSWORD IGUAL QUE ANTES) ... */}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Usuario </label>
              <div className="flex items-center border-2 border-gray-200 rounded-lg overflow-hidden focus-within:border-[#d63384] transition-colors">
                <input type="text" required className="w-full p-3 font-bold text-[#1e3c72] outline-none placeholder-gray-300" placeholder="nombre.apellido" value={usuario} onChange={(e) => setUsuario(e.target.value.trim())} />
                <div className="bg-gray-100 px-4 py-3 border-l border-gray-200"><span className="text-sm font-bold text-gray-500">@valdishopper.com</span></div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Contraseña</label>
              <div className="relative">
                <input type={mostrarPassword ? "text" : "password"} required className="w-full p-3 border-2 border-gray-200 rounded-lg font-bold text-[#1e3c72] focus:border-[#d63384] outline-none transition-colors pr-10" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setMostrarPassword(!mostrarPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-[#d63384] transition-colors focus:outline-none" tabIndex="-1">
                  {mostrarPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  )}
                </button>
              </div>
            </div>

            <button disabled={loading} className="w-full bg-[#1e3c72] hover:bg-[#0f254a] text-white font-black py-4 rounded-lg shadow-lg transition-transform active:scale-95 disabled:opacity-50 flex justify-center items-center">
              {loading ? <span className="animate-pulse">VERIFICANDO...</span> : 'INICIAR SESIÓN'}
            </button>
          </form>

          {/* --- BOTÓN DE INVITADO --- */}
          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
             <button
                type="button"
                onClick={handleGuestLogin}
                className="text-sm font-semibold text-gray-500 hover:text-[#d63384] transition-colors"
             >
                Continuar como Invitado &rarr;
             </button>
          </div>

          <div className="mt-4 text-center text-xs text-gray-400">
            ¿Problemas de acceso? Contacta a Soporte TI.
          </div>
        </div>
      </div>
    </div>
  )
}