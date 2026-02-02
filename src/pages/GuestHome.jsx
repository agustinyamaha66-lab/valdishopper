import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import bannerImg from "../assets/Valdishopper-inicio.png"; // Usamos la misma imagen
import { LogIn, Lock, Sparkles, ShieldAlert } from "lucide-react";

export default function GuestHome() {
  const navigate = useNavigate();
  // Asumiremos que signOut limpia el estado de invitado también
  const { signOut } = useAuth();

  const handleLogout = () => {
    signOut(); // Esto debería devolvernos al Login
    // Si signOut no redirige automáticamente, forzamos:
    // navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* --- HEADER SIMPLE --- */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                <Lock size={16} />
            </div>
            <span className="font-bold text-slate-700 tracking-tight">Modo Invitado</span>
        </div>
        <button
            onClick={handleLogout}
            className="text-sm font-semibold text-[#1e3c72] hover:underline flex items-center gap-1"
        >
            <LogIn size={16} /> Iniciar Sesión Corporativa
        </button>
      </header>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">

        {/* Fondo decorativo sutil */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
             <div className="absolute top-10 left-10 w-64 h-64 bg-blue-100 rounded-full blur-3xl mix-blend-multiply"></div>
             <div className="absolute bottom-10 right-10 w-64 h-64 bg-pink-100 rounded-full blur-3xl mix-blend-multiply"></div>
        </div>

        <div className="max-w-4xl w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden relative z-10 flex flex-col md:flex-row">

            {/* Columna Izquierda: Imagen */}
            <div className="md:w-1/2 relative min-h-[300px]">
                <img
                    src={bannerImg}
                    alt="Valdishopper Guest"
                    className="absolute inset-0 w-full h-full object-cover grayscale opacity-90"
                />
                <div className="absolute inset-0 bg-[#1e3c72]/80 mix-blend-multiply"></div>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-8 text-center">
                    <Sparkles size={48} className="mb-4 text-blue-200 opacity-80" />
                    <h2 className="text-2xl font-black tracking-tight">Próximamente</h2>
                    <p className="text-blue-100 mt-2 text-sm">
                        Estamos desarrollando nuevas experiencias para nuestros invitados y clientes externos.
                    </p>
                </div>
            </div>

            {/* Columna Derecha: Mensaje */}
            <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 text-xs font-bold uppercase w-fit mb-6">
                    <ShieldAlert size={14} /> Acceso Limitado
                </div>

                <h1 className="text-3xl font-bold text-slate-800 mb-4">
                    Bienvenido a Valdishopper
                </h1>

                <p className="text-slate-500 leading-relaxed mb-8">
                    Actualmente estás navegando en <strong>Modo Invitado</strong>. Este perfil no tiene acceso a los módulos operativos por razones de seguridad y privacidad de datos.
                </p>

                <div className="space-y-4">
                    <p className="text-sm font-semibold text-slate-700">¿Qué puedes hacer?</p>
                    <ul className="text-sm text-slate-500 space-y-2">
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                            Visualizar información pública (pronto).
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                            Contactar a soporte si eres cliente.
                        </li>
                    </ul>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-100">
                    <button
                        onClick={handleLogout}
                        className="w-full py-3 bg-[#1e3c72] hover:bg-[#0f254a] text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-900/10"
                    >
                        Volver al Login
                    </button>
                </div>
            </div>
        </div>

        <p className="mt-8 text-xs text-slate-400 font-medium">
            © 2026 Valdishopper SpA • Acceso Invitado v1.0
        </p>
      </div>
    </div>
  );
}