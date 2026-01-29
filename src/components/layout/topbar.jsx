import { useState, useEffect } from 'react'

export default function Topbar({ sidebarOpen, setSidebarOpen, userEmail, role, signOut, irInicio }) {
  const [hora, setHora] = useState(new Date().toLocaleTimeString('es-CL', {hour: '2-digit', minute:'2-digit'}))
  const [fecha, setFecha] = useState(new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }))

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      setHora(now.toLocaleTimeString('es-CL', {hour: '2-digit', minute:'2-digit'}))
      setFecha(now.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <header
      className={`fixed top-0 right-0 h-16 bg-[#1e3c72] text-white shadow-lg z-40 flex items-center justify-between px-4 transition-all duration-300 border-b border-blue-900 ${
        sidebarOpen ? 'left-64' : 'left-0'
      }`}
    >
      {/* SECCIÓN IZQUIERDA */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors focus:outline-none"
        >
          {sidebarOpen ? (
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
          ) : (
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          )}
        </button>

        {/* TÍTULO CON REDIRECCIÓN AL HOME */}
        <div className="flex items-center gap-3">
          <button
            onClick={irInicio}
            className="text-left focus:outline-none hover:opacity-80 transition-opacity group"
            title="Ir al Inicio"
          >
            <div className="leading-tight">
              <h2 className="text-lg font-black tracking-tight uppercase group-hover:text-pink-200 transition-colors">Panel CCO</h2>
              <p className="text-[10px] text-[#d63384] font-bold uppercase tracking-widest group-hover:text-white transition-colors">Valdishopper</p>
            </div>
          </button>
        </div>
      </div>

      {/* SECCIÓN DERECHA */}
      <div className="flex items-center gap-6">
        <div className="hidden md:flex flex-col items-end border-r border-white/20 pr-6">
          <span className="text-xl font-mono font-bold tracking-widest leading-none">{hora}</span>
          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider mt-1">{fecha}</span>
        </div>

        <div className="flex items-center gap-3 pl-2">
          <div className="text-right hidden sm:block leading-tight">
            <p className="text-sm font-bold text-white">{userEmail || 'Cargando...'}</p>

            <div className="flex items-center justify-end gap-2 mt-0.5">
               <div className="flex items-center gap-1">
                 <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                 <p className="text-[9px] text-green-400 font-bold uppercase tracking-wide">ONLINE</p>
               </div>

               {/* AQUÍ ESTABA EL PROBLEMA: YA NO DICE INVITADO */}
               <span className="text-[9px] bg-white/10 px-1.5 rounded text-white font-bold uppercase tracking-wide border border-white/10 min-w-[20px] text-center">
                  {role ? role.replace('_', ' ') : '...'}
               </span>

               <span className="text-gray-500 text-[10px]">|</span>

               <button onClick={signOut} className="text-[10px] text-red-300 hover:text-white font-bold uppercase hover:underline cursor-pointer transition-colors">
                 SALIR
               </button>
            </div>
          </div>

          <div className="h-10 w-10 bg-gradient-to-br from-[#d63384] to-purple-600 rounded-full flex items-center justify-center border-2 border-white/20 shadow-lg font-bold text-sm tracking-tighter">
            {userEmail ? userEmail.substring(0,2).toUpperCase() : 'U'}
          </div>
        </div>
      </div>
    </header>
  )
}