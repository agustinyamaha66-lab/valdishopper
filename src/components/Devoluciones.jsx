import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Devoluciones() {
  const [registros, setRegistros] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(false)

  // --- ESTADOS PARA MODALES ---
  const [zoomImagen, setZoomImagen] = useState(null)
  const [editando, setEditando] = useState(null) // Guarda el objeto que se está editando

  useEffect(() => {
    let canal = null;
    console.log("🟢 [Devoluciones] Componente montado. Iniciando carga...");

    const setup = async () => {
        await fetchData();

        // Suscripción en vivo
        canal = supabase
            .channel('devoluciones-live')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'devoluciones_bodega' },
                (payload) => {
                    console.log("🔔 [Devoluciones] Cambio detectado en tiempo real:", payload);
                    fetchData(); // Recargar datos frescos
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log("📡 [Devoluciones] Conectado a Realtime correctamente.");
                }
            });
    };

    setup();

    return () => {
        if (canal) {
            console.log("🔌 [Devoluciones] Cerrando canal Realtime...");
            supabase.removeChannel(canal);
        }
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    console.log("🔍 [Devoluciones] Buscando registros en base de datos...");

    const { data, error } = await supabase
        .from('devoluciones_bodega')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("❌ [Devoluciones] Error al cargar datos:", error);
    } else {
        console.log(`✅ [Devoluciones] ${data?.length || 0} registros cargados.`);
        if (data) setRegistros(data);
    }

    setTimeout(() => setLoading(false), 500);
  }

  // --- GUARDAR EDICIÓN ---
  const guardarEdicion = async (e) => {
      e.preventDefault();
      if (!editando) return;

      console.log("💾 [Devoluciones] Guardando cambios...", editando);

      const { error } = await supabase
          .from('devoluciones_bodega')
          .update({
              patente: editando.patente.toUpperCase(),
              id_manifiesto: editando.id_manifiesto
          })
          .eq('id', editando.id);

      if (!error) {
          console.log("✨ [Devoluciones] Edición exitosa.");
          setEditando(null); // Cerrar modal
          fetchData(); // Refrescar datos
      } else {
          console.error("❌ [Devoluciones] Error al actualizar:", error);
          alert("Error al actualizar: " + error.message);
      }
  }

  // --- FILTRADO ---
  const registrosFiltrados = registros.filter(item =>
    item.patente.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.id_manifiesto.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="bg-gray-100 min-h-screen p-8 font-sans">

      {/* HEADER Y HERRAMIENTAS */}
      <div className="bg-[#1e3c72] text-white p-6 rounded-t-xl shadow-lg border-b-4 border-[#d63384] flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2">📦 CENTRO DE DEVOLUCIONES</h1>
            <p className="text-xs opacity-80 font-mono">Registro histórico de evidencia</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
            {/* BUSCADOR */}
            <div className="relative group w-full md:w-64">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">🔍</div>
                <input
                    type="text"
                    placeholder="Buscar Patente o ID..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="w-full bg-[#14284d] text-white text-sm font-bold border border-blue-800 rounded-lg pl-10 p-2.5 focus:ring-2 focus:ring-[#d63384] outline-none transition-all placeholder-gray-400"
                />
            </div>

            {/* REFRESCAR */}
            <button
                onClick={() => { console.log("🔄 [Devoluciones] Botón actualizar presionado"); fetchData(); }}
                className={`bg-[#d63384] hover:bg-pink-600 text-white font-bold py-2.5 px-4 rounded-lg shadow-md transition-all active:scale-95 flex items-center gap-2 ${loading ? 'opacity-80 cursor-wait' : ''}`}
            >
                <span className={`text-lg leading-none ${loading ? 'animate-spin' : ''}`}>↻</span>
                <span className="hidden md:inline text-xs">ACTUALIZAR</span>
            </button>
        </div>
      </div>

      {/* TABLA DE DATOS */}
      <div className="bg-white rounded-b-xl shadow-md overflow-hidden border-x border-b border-gray-200">
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                      <tr>
                          <th className="px-6 py-4 font-black text-[#1e3c72]">Fecha / Hora</th>
                          <th className="px-6 py-4 font-black text-[#1e3c72]">Patente</th>
                          <th className="px-6 py-4 font-black text-[#1e3c72]">ID Manifiesto</th>
                          <th className="px-6 py-4 font-black text-[#1e3c72] text-center">Evidencia</th>
                          <th className="px-6 py-4 font-black text-[#1e3c72] text-center">Acciones</th>
                      </tr>
                  </thead>
                  <tbody>
                      {registrosFiltrados.length === 0 ? (
                          <tr><td colSpan="5" className="px-6 py-10 text-center text-gray-400 bg-gray-50 italic">
                              {busqueda ? 'No se encontraron resultados.' : 'No hay devoluciones registradas.'}
                          </td></tr>
                      ) : (
                          registrosFiltrados.map((item, index) => (
                              <tr key={item.id} className={`hover:bg-blue-50 transition-colors border-b border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                                  <td className="px-6 py-4 font-mono text-gray-600">
                                      {new Date(item.created_at).toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' })}
                                  </td>
                                  <td className="px-6 py-4">
                                      <span className="bg-blue-100 text-blue-800 text-xs font-black px-2.5 py-0.5 rounded border border-blue-200">{item.patente}</span>
                                  </td>
                                  <td className="px-6 py-4 font-bold text-gray-800">{item.id_manifiesto}</td>
                                  <td className="px-6 py-4 text-center">
                                      {item.foto_url ? (
                                          <button
                                            onClick={() => { console.log("📷 [Devoluciones] Abriendo foto:", item.foto_url); setZoomImagen(item.foto_url); }}
                                            className="text-blue-600 hover:text-[#d63384] font-bold text-xs flex items-center justify-center gap-1 mx-auto transition-colors"
                                          >
                                              <span className="text-lg">📷</span> VER FOTO
                                          </button>
                                      ) : <span className="text-gray-300 text-xs italic">Sin adjunto</span>}
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                      <button
                                        onClick={() => { console.log("✏️ [Devoluciones] Editando ID:", item.id); setEditando(item); }}
                                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-blue-600 p-2 rounded-full transition-colors shadow-sm border border-gray-200"
                                        title="Editar Registro"
                                      >
                                          ✏️
                                      </button>
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>

          {/* FOOTER */}
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500">
              <span>Mostrando <strong>{registrosFiltrados.length}</strong> registros</span>
              <span>Sistema CATEX v2.0</span>
          </div>
      </div>

      {/* --- MODAL EDITAR --- */}
      {editando && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                <div className="bg-[#1e3c72] p-4 flex justify-between items-center border-b border-blue-800">
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">✏️ EDITAR REGISTRO</h3>
                    <button onClick={() => setEditando(null)} className="text-white hover:text-pink-300 font-bold text-xl transition-colors">×</button>
                </div>

                <form onSubmit={guardarEdicion} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Patente</label>
                        <input
                            type="text"
                            value={editando.patente}
                            onChange={(e) => setEditando({...editando, patente: e.target.value})}
                            className="w-full border border-gray-300 rounded p-2.5 font-bold text-[#1e3c72] uppercase focus:ring-2 focus:ring-[#d63384] outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">ID Manifiesto</label>
                        <input
                            type="text"
                            value={editando.id_manifiesto}
                            onChange={(e) => setEditando({...editando, id_manifiesto: e.target.value})}
                            className="w-full border border-gray-300 rounded p-2.5 font-mono focus:ring-2 focus:ring-[#d63384] outline-none transition-all"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={() => setEditando(null)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-lg font-bold hover:bg-gray-200 transition-colors">CANCELAR</button>
                        <button type="submit" className="flex-1 bg-[#d63384] text-white py-3 rounded-lg font-bold hover:bg-pink-600 shadow-md transition-colors">GUARDAR CAMBIOS</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* --- MODAL ZOOM FOTO --- */}
      {zoomImagen && (
          <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={() => setZoomImagen(null)}>
              <div className="relative max-w-4xl max-h-full" onClick={(e) => e.stopPropagation()}>
                  <img src={zoomImagen} className="max-h-[85vh] max-w-full rounded-lg shadow-2xl border-2 border-white/20" alt="Evidencia" />

                  <div className="absolute -top-12 right-0 flex gap-2">
                      <a href={zoomImagen} target="_blank" rel="noreferrer" className="bg-white text-black px-4 py-2 rounded-full font-bold text-xs hover:bg-gray-200 transition-colors shadow-lg flex items-center gap-1">
                          ⬇ DESCARGAR
                      </a>
                      <button onClick={() => setZoomImagen(null)} className="bg-[#d63384] text-white w-8 h-8 rounded-full font-bold flex items-center justify-center hover:bg-pink-600 transition-colors shadow-lg">
                          ✕
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  )
}