import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  Package,
  Search,
  RefreshCw,
  Edit3,
  Image as ImageIcon,
  X,
  Save,
  Download,
  AlertCircle
} from 'lucide-react'

export default function Devoluciones() {
  const [registros, setRegistros] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(false)

  // --- ESTADOS PARA MODALES ---
  const [zoomImagen, setZoomImagen] = useState(null)
  const [editando, setEditando] = useState(null)

  useEffect(() => {
    let canal = null;
    console.log("🟢 [Devoluciones] Componente montado.");

    const setup = async () => {
        await fetchData();

        // Suscripción en vivo
        canal = supabase
            .channel('devoluciones-live')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'devoluciones_bodega' },
                (payload) => {
                    console.log("🔔 Cambio detectado:", payload);
                    fetchData();
                }
            )
            .subscribe();
    };

    setup();

    return () => {
        if (canal) supabase.removeChannel(canal);
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
        .from('devoluciones_bodega')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) console.error("❌ Error al cargar:", error);
    else if (data) setRegistros(data);

    setTimeout(() => setLoading(false), 500);
  }

  // --- GUARDAR EDICIÓN ---
  const guardarEdicion = async (e) => {
      e.preventDefault();
      if (!editando) return;

      const { error } = await supabase
          .from('devoluciones_bodega')
          .update({
              patente: editando.patente.toUpperCase(),
              id_manifiesto: editando.id_manifiesto
          })
          .eq('id', editando.id);

      if (!error) {
          setEditando(null);
          fetchData();
      } else {
          alert("Error al actualizar: " + error.message);
      }
  }

  // --- FILTRADO ---
  const registrosFiltrados = registros.filter(item =>
    item.patente.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.id_manifiesto.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 font-sans animate-fade-in relative">

      {/* HEADER ENTERPRISE (FONDO AZUL) */}
      <div className="relative overflow-hidden rounded-2xl border border-white/20 shadow-xl mb-8">
        {/* Fondo degradado corporativo */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b1f44]/95 via-[#163a6b]/90 to-[#0b1f44]/95" />

        {/* Contenido del Header */}
        <div className="relative z-10 px-6 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/70">
              Bodega • Logística Inversa
            </p>
            <h1 className="mt-1 text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Package size={30} className="text-[#d63384]" />
              Centro de Devoluciones
            </h1>
            <p className="text-blue-100/80 text-sm mt-2 font-medium max-w-2xl leading-relaxed">
                Control de devoluciones, gestión de evidencias fotográficas y trazabilidad de retornos en tiempo real.
            </p>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">

         {/* Buscador */}
         <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input
                type="text"
                placeholder="Buscar por Patente o ID Manifiesto..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-[#1e3c72] outline-none transition-all"
            />
         </div>

         {/* Botón Actualizar */}
         <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:text-[#1e3c72] transition-colors font-bold text-sm shadow-sm disabled:opacity-50"
         >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Sincronizando...' : 'Actualizar Tabla'}
         </button>
      </div>

      {/* TABLA DE DATOS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold tracking-wider">
                      <tr>
                          <th className="px-6 py-4 sticky top-0 bg-slate-50 z-10">Fecha Registro</th>
                          <th className="px-6 py-4 sticky top-0 bg-slate-50 z-10">Patente Vehículo</th>
                          <th className="px-6 py-4 sticky top-0 bg-slate-50 z-10">ID Manifiesto</th>
                          <th className="px-6 py-4 sticky top-0 bg-slate-50 z-10 text-center">Evidencia</th>
                          <th className="px-6 py-4 sticky top-0 bg-slate-50 z-10 text-center">Acciones</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                      {registrosFiltrados.length === 0 ? (
                          <tr><td colSpan="5" className="p-12 text-center">
                              <div className="flex flex-col items-center gap-2 text-slate-400">
                                  <AlertCircle size={32} className="opacity-50"/>
                                  <p className="font-medium">No se encontraron registros de devoluciones.</p>
                              </div>
                          </td></tr>
                      ) : (
                          registrosFiltrados.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                                  <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                                      {new Date(item.created_at).toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' })}
                                  </td>
                                  <td className="px-6 py-4">
                                      <span className="font-bold text-[#1e3c72] bg-blue-50 px-2 py-1 rounded border border-blue-100 text-xs tracking-wide">
                                          {item.patente}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 font-bold text-slate-700 font-mono tracking-tight">
                                      {item.id_manifiesto}
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                      {item.foto_url ? (
                                          <button
                                            onClick={() => setZoomImagen(item.foto_url)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-[#1e3c72] text-slate-600 hover:text-white rounded-full text-xs font-bold transition-all group-hover:shadow-sm"
                                          >
                                              <ImageIcon size={14} /> Ver Foto
                                          </button>
                                      ) : (
                                          <span className="text-slate-300 text-xs italic flex items-center justify-center gap-1">
                                              <X size={12} /> Sin evidencia
                                          </span>
                                      )}
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                      <button
                                        onClick={() => setEditando(item)}
                                        className="text-slate-400 hover:text-[#1e3c72] p-2 rounded-full hover:bg-slate-100 transition-colors"
                                        title="Editar Registro"
                                      >
                                          <Edit3 size={16} />
                                      </button>
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>

          {/* Footer Tabla */}
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 font-medium">
              <span>Mostrando {registrosFiltrados.length} registros</span>
              <span>Sistema CATEX • Bodega</span>
          </div>
      </div>

      {/* --- MODAL EDITAR --- */}
      {editando && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="bg-[#1e3c72] p-1.5 rounded text-white"><Edit3 size={16}/></div>
                        <h3 className="font-bold text-slate-800">Editar Registro</h3>
                    </div>
                    <button onClick={() => setEditando(null)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={20}/></button>
                </div>

                <form onSubmit={guardarEdicion} className="p-6 space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Patente Vehículo</label>
                        <input
                            type="text"
                            value={editando.patente}
                            onChange={(e) => setEditando({...editando, patente: e.target.value})}
                            className="w-full border border-slate-200 rounded-lg p-2.5 font-bold text-[#1e3c72] uppercase focus:ring-2 focus:ring-[#1e3c72] outline-none transition-all text-center tracking-widest"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">ID Manifiesto</label>
                        <input
                            type="text"
                            value={editando.id_manifiesto}
                            onChange={(e) => setEditando({...editando, id_manifiesto: e.target.value})}
                            className="w-full border border-slate-200 rounded-lg p-2.5 font-mono text-slate-700 focus:ring-2 focus:ring-[#1e3c72] outline-none transition-all"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setEditando(null)} className="flex-1 bg-white border border-slate-300 text-slate-700 py-2.5 rounded-lg font-bold hover:bg-slate-50 transition-colors text-sm">Cancelar</button>
                        <button type="submit" className="flex-1 bg-[#1e3c72] text-white py-2.5 rounded-lg font-bold hover:bg-[#152a50] shadow-sm transition-colors text-sm flex items-center justify-center gap-2">
                            <Save size={16} /> Guardar
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* --- MODAL ZOOM FOTO --- */}
      {zoomImagen && (
          <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setZoomImagen(null)}>
              <div className="relative max-w-5xl w-full max-h-screen flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>

                  <img
                    src={zoomImagen}
                    className="max-h-[80vh] max-w-full rounded-lg shadow-2xl border border-white/10 object-contain bg-black"
                    alt="Evidencia Ampliada"
                  />

                  <div className="absolute top-4 right-4 flex gap-3">
                      <a
                        href={zoomImagen}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="bg-white/10 backdrop-blur hover:bg-white/20 text-white p-3 rounded-full transition-all"
                        title="Descargar Original"
                      >
                          <Download size={20} />
                      </a>
                      <button
                        onClick={() => setZoomImagen(null)}
                        className="bg-white text-black p-3 rounded-full hover:scale-110 transition-transform shadow-lg"
                        title="Cerrar"
                      >
                          <X size={20} strokeWidth={3} />
                      </button>
                  </div>

                  <div className="mt-4 bg-black/50 backdrop-blur px-4 py-2 rounded-full text-white text-xs font-mono border border-white/10">
                      VISTA DE EVIDENCIA
                  </div>
              </div>
          </div>
      )}
    </div>
  )
}