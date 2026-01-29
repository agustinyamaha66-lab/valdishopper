import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

const ToastNotification = ({ notification, onClose }) => {
    if (!notification.visible) return null;
    const colors = { success: 'bg-green-100 border-green-500 text-green-800', error: 'bg-red-100 border-red-500 text-red-800' };
    return (
        <div className={`fixed top-24 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded shadow-xl border-l-4 ${colors[notification.type]} min-w-[300px] animate-fade-in-up`}>
            <span className="text-xl">{notification.type === 'success' ? '✅' : '⚠️'}</span>
            <div className="flex-1"><p className="font-bold text-xs uppercase">{notification.type === 'success' ? 'LISTO' : 'ATENCIÓN'}</p><p className="text-sm">{notification.message}</p></div>
            <button onClick={onClose} className="text-gray-500 font-bold">×</button>
        </div>
    );
};

export default function Transporte() {
  const [viajes, setViajes] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [notification, setNotification] = useState({ visible: false, message: '', type: 'success' })
  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0])

  // --- FILTROS ---
  const [filtroHora, setFiltroHora] = useState('')
  const [filtroDestino, setFiltroDestino] = useState('')

  const showToast = (message, type = 'success') => {
      setNotification({ visible: true, message, type });
      setTimeout(() => setNotification(prev => ({ ...prev, visible: false })), 4000);
  }

  // --- 1. CARGA DE DATOS Y TIEMPO REAL ---
  useEffect(() => {
    fetchViajes();
    const channel = supabase
      .channel('tabla-transporte')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asignaciones_transporte' }, (payload) => {
          fetchViajes(); // Recargar lista al haber cambios o insertos (2da vuelta)
          if (payload.eventType === 'UPDATE') {
              showToast(`Actualización: Patente ${payload.new.patente}`, 'success');
          }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); }
  }, [fechaFiltro]);

  const fetchViajes = async () => {
    setRefreshing(true);
    const { data } = await supabase
      .from('asignaciones_transporte')
      .select('*')
      .eq('fecha', fechaFiltro)
      // ORDENAMIENTO CLAVE: Hora -> Patente -> Vuelta
      .order('hora_citacion', { ascending: true })
      .order('patente', { ascending: true })
      .order('numero_vuelta', { ascending: true });

    if (data) setViajes(data);
    setTimeout(() => setRefreshing(false), 500);
  }

  const enviarMensaje = async (id, patente) => {
      const mensaje = prompt(`Escribe mensaje para ${patente}:`);
      if (mensaje) {
          await supabase.from('asignaciones_transporte').update({ mensaje_admin: mensaje }).eq('id', id);
          showToast("Mensaje enviado", "success");
      }
  }

  // --- 2. CARGA DE EXCEL (CON CORRECCIÓN DE DATOS) ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);

        if (!data.length) return showToast("Excel vacío", "error");
        setLoading(true);

        const filas = data.map(row => {
            const getVal = (keys) => { for (let k of keys) { if (row[k] !== undefined) return row[k]; } return null; };

            // Limpieza de Hora
            let rawHora = getVal(['CITACION', 'Citacion', 'Hora']);
            let horaFinal = '00:00';
            if (rawHora) {
                if (typeof rawHora === 'number') {
                    const totalSeconds = Math.floor(rawHora * 86400);
                    const hours = Math.floor(totalSeconds / 3600);
                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                    horaFinal = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                } else {
                    const texto = rawHora.toString().trim();
                    horaFinal = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(texto) ? texto : '00:00';
                }
            }

            // Limpieza de Vuelta (Asegurar que sea número)
            let rawVuelta = getVal(['VUELTA', 'Vuelta']) || 1;
            let vueltaNum = parseInt(rawVuelta) || 1;

            return {
                fecha: fechaFiltro,
                patente: (getVal(['PATENTE', 'Patente']) || 'S/P').toString().trim().toUpperCase(),
                nodo: (getVal(['NODO', 'Nodo']) || 'General').toString(),
                local_destino: (getVal(['LOCAL', 'Local', 'CIUDAD', 'Ciudad']) || 'Sin Asignar').toString(),
                hora_citacion: horaFinal,
                numero_vuelta: vueltaNum
            };
        });

        const { error } = await supabase.from('asignaciones_transporte').insert(filas);
        if (error) showToast(error.message, "error");
        else { showToast(`${filas.length} rutas cargadas`, "success"); fetchViajes(); }
        setLoading(false);
        e.target.value = null;
    };
    reader.readAsBinaryString(file);
  }

  // --- LÓGICA DE FILTROS Y SELECTOR "CUBO" ---
  const horasDisponibles = useMemo(() => {
      const horas = viajes.map(v => v.hora_citacion).filter(h => h);
      return [...new Set(horas)].sort();
  }, [viajes]);

  const viajesFiltrados = viajes.filter(v => {
      const matchHora = !filtroHora || (v.hora_citacion && v.hora_citacion === filtroHora);
      const matchDestino = !filtroDestino ||
                           (v.local_destino && v.local_destino.toLowerCase().includes(filtroDestino.toLowerCase())) ||
                           (v.nodo && v.nodo.toString().toLowerCase().includes(filtroDestino.toLowerCase()));
      return matchHora && matchDestino;
  });

  const getStatus = (v) => {
      if (v.hora_fin_reparto) return { label: 'EN RUTA', color: 'bg-green-600 text-white' };
      if (v.hora_salida) return { label: 'ABIERTO', color: 'bg-blue-600 text-white' };
      if (v.hora_llegada) return { label: 'EN SALA', color: 'bg-yellow-400 text-black' };
      return { label: 'ESPERANDO', color: 'bg-gray-200 text-gray-500' };
  }

  return (
    <div className="bg-gray-100 min-h-screen p-6 font-sans">
      <ToastNotification notification={notification} onClose={() => setNotification({...notification, visible: false})} />

      <div className="bg-[#1e3c72] text-white p-4 rounded-t-xl flex flex-col md:flex-row justify-between items-center shadow-lg border-b-4 border-[#d63384] mb-6 gap-4">
        <h1 className="text-2xl font-black tracking-tighter">TORRE DE CONTROL 🚚</h1>

        <div className="flex flex-wrap gap-3 items-center">
             {/* SELECTOR DE HORA (CUBO) */}
             <select
                value={filtroHora}
                onChange={(e) => setFiltroHora(e.target.value)}
                className="text-black text-xs font-bold p-2 rounded cursor-pointer border-2 border-transparent focus:border-[#d63384] outline-none shadow-md bg-white"
             >
                 <option value="">🕒 TODAS LAS HORAS</option>
                 {horasDisponibles.map(h => (
                     <option key={h} value={h}>{h} hrs</option>
                 ))}
             </select>

             <input
                type="text"
                placeholder="Buscar Destino / Nodo..."
                value={filtroDestino}
                onChange={(e) => setFiltroDestino(e.target.value)}
                className="text-black text-xs font-bold p-2 rounded w-40 shadow-md border-none outline-none focus:ring-2 focus:ring-[#d63384]"
             />

             <input
                type="date"
                value={fechaFiltro}
                onChange={(e) => setFechaFiltro(e.target.value)}
                className="text-black font-bold p-2 rounded cursor-pointer shadow-md"
             />
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6 flex justify-between items-center border-l-4 border-[#1e3c72]">
          <div><h3 className="font-bold text-[#1e3c72]">PLANIFICACIÓN DE VIAJES</h3><p className="text-xs text-gray-500">Carga aquí el Excel con las rutas.</p></div>
          <label className={`cursor-pointer bg-[#d63384] hover:bg-pink-600 text-white font-bold py-2 px-6 rounded text-xs shadow transition-transform active:scale-95 ${loading && 'opacity-50'}`}>
              {loading ? 'CARGANDO...' : '📤 CARGAR EXCEL'}
              <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
          </label>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden border-t-4 border-[#1e3c72]">
          <div className="p-3 bg-gray-50 flex justify-between items-center border-b">
              <div className="flex items-center gap-2">
                  <h6 className="font-black text-[#1e3c72]">VISTA OPERATIVA</h6>
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{viajesFiltrados.length} Rutas</span>
              </div>
              <button onClick={fetchViajes} className={`text-blue-600 font-bold text-xl hover:scale-110 transition-transform ${refreshing ? 'animate-spin' : ''}`}>↻</button>
          </div>
          <table className="w-full text-sm text-left">
              <thead className="bg-[#1e3c72] text-white uppercase font-bold text-xs">
                  <tr>
                      <th className="p-3">Patente</th>
                      <th className="p-3">Citación</th>
                      <th className="p-3">Destino / Nodo</th>
                      <th className="p-3 text-center">Vuelta</th>
                      <th className="p-3 text-center bg-yellow-50/10">Llegada (Sala)</th>
                      <th className="p-3 text-center bg-blue-50/10">Apertura</th>
                      <th className="p-3 text-center bg-green-50/10">Inicio Ruta</th>
                      <th className="p-3 text-center">Estado</th>
                      <th className="p-3 text-center">Acción</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                  {viajesFiltrados.length === 0 ? (
                      <tr><td colSpan="9" className="p-8 text-center text-gray-400 font-bold">No hay datos coincidentes.</td></tr>
                  ) : (
                      viajesFiltrados.map((viaje) => {
                          const st = getStatus(viaje);
                          return (
                          <tr key={viaje.id} className="hover:bg-blue-50 transition-colors">
                              <td className="p-3 font-black text-[#1e3c72]">{viaje.patente}</td>
                              <td className="p-3 font-mono font-bold text-gray-700 bg-gray-50">{viaje.hora_citacion}</td>
                              <td className="p-3">
                                  <div className="font-bold text-gray-800">{viaje.local_destino}</div>
                                  <div className="text-[10px] text-gray-500">{viaje.nodo}</div>
                              </td>
                              <td className="p-3 text-center font-bold"><span className="bg-gray-200 px-2 py-1 rounded text-xs">#{viaje.numero_vuelta}</span></td>

                              {/* LLEGADA CON GPS CORREGIDO */}
                              <td className="p-3 text-center font-mono text-gray-600">
                                  {viaje.hora_llegada ? (
                                      <div>
                                          {new Date(viaje.hora_llegada).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                          {viaje.gps_llegada_lat && (
                                              <a
                                                href={`http://maps.google.com/maps?q=${viaje.gps_llegada_lat},${viaje.gps_llegada_lon}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="block text-[9px] text-blue-600 font-bold hover:underline mt-1 bg-blue-50 rounded px-1"
                                              >
                                                  📍 VER MAPA
                                              </a>
                                          )}
                                      </div>
                                  ) : '-'}
                              </td>

                              <td className="p-3 text-center font-mono text-blue-600">{viaje.hora_salida ? new Date(viaje.hora_salida).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-'}</td>
                              <td className="p-3 text-center font-mono text-green-600">{viaje.hora_fin_reparto ? new Date(viaje.hora_fin_reparto).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-'}</td>

                              <td className="p-3 text-center"><div className={`px-2 py-1 rounded text-[10px] font-black inline-block ${st.color}`}>{st.label}</div></td>
                              <td className="p-3 text-center"><button onClick={() => enviarMensaje(viaje.id, viaje.patente)} className="bg-orange-100 text-orange-600 hover:bg-orange-200 px-2 py-1 rounded text-xs font-bold border border-orange-200 transition-colors">📩 AVISAR</button></td>
                          </tr>
                      )})
                  )}
              </tbody>
          </table>
      </div>
    </div>
  )
}