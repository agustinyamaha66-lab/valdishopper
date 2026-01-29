import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// --- DATOS MAESTROS ---
const localesPorServicio = {
  LAT: ["120 Temuco", "121 Punta Arenas", "143 Talca", "144 Parral", "146 San Javier", "182 Buin", "276 Lampa", "41 Huechuraba", "42 Curicó", "518 Valparaíso", "54 La Florida 54", "608 Chillán", "611 La Florida 611", "618 Osorno", "627 San Vicente"],
  HD: ["120 Temuco", "121 Punta Arenas", "58 Viña", "606 Coronel", "608 Chillán", "618 Osorno", "657 Castro", "697 San Fernando", "94 Valdivia", "98 Concepción", "99 Puerto Montt"],
  SBA: ["171 San Bernardo", "528 Curicó", "569 Talca", "570 Cauquenes", "583 Constitución", "587 Tome"],
  CM: ["159 Macul", "19 Puerto Montt", "513 Talca", "68 Osorno", "903 San Pedro de la Paz", "990 Maipú"]
}

const motivosPorGrupo = {
  "Sistemas": ["PEDIDO DUPLICADO", "PROBLEMAS EN AMIDA", "PROBLEMAS EN BEETRACK"],
  "Sala y Operacion": ["SIN APOYO LOCAL BAJA DOTACION WM", "LOCAL SOLICITA CIERRE DE VENTANA", "CIERRE DE LOCAL", "PROTESTA FUERA DEL LOCAL", "EVENTO CERCANO AL LOCAL", "BOLSAS SIN STOCK", "CARROS SIN STOCK", "COMPLICACIONES EN SALA", "CORTE DE LUZ LOCAL", "DEMORA REVISIÓN AP", "PEDIDOS ENCOLADOS", "FUGA PRESTADORES", "LLEGADA TARDE PRESTADORES", "DESABASTECIMIENTO BODEGA", "BAJA DEMANDA PEDIDOS"],
  "Ruta y entrega": ["ACCIDENTE EN RUTA", "ALTO TRAFICO", "CANCELADO/RECHAZADO", "DIRECCIÓN ERRÓNEA", "ESCALERA/ASCENSOR MALO", "FERRY", "MAL GEORREFERENCIADO", "OTRA TRANSPORTADORA", "SIN ESTACIONAMIENTOS", "SIN MORADORES"],
  "Otros": ["OTROS", "APOYO POLIGONO OTRO LOCAL", "APOYO PEDIDOS OTRO LOCAL"]
}

const determinarKPI = (motivo) => {
  const criticos = ["CIERRE DE LOCAL", "SIN APOYO LOCAL BAJA DOTACION WM", "CORTE DE LUZ LOCAL", "PROTESTA FUERA DEL LOCAL", "ACCIDENTE EN RUTA"];
  const advertencia = ["ALTO TRAFICO", "PROBLEMAS EN AMIDA", "COMPLICACIONES EN SALA", "PEDIDOS ENCOLADOS"];
  if (criticos.includes(motivo)) return "CONTINGENCIA";
  if (advertencia.includes(motivo)) return "ALERTA OTEA";
  return "REPORTADO";
}

// --- COMPONENTE DE NOTIFICACIÓN (TOAST) ---
const ToastNotification = ({ notification, onClose }) => {
    if (!notification.visible) return null;

    const colors = {
        success: 'bg-green-100 border-green-500 text-green-800',
        error: 'bg-red-100 border-red-500 text-red-800',
        warning: 'bg-yellow-100 border-yellow-500 text-yellow-800',
    };

    const labels = {
        success: 'CORRECTO',
        error: 'ERROR',
        warning: 'ATENCIÓN'
    };

    const icons = { success: '✅', error: '⛔', warning: '⚠️' };

    return (
        <div className={`fixed top-24 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded shadow-xl border-l-4 transition-all duration-300 transform translate-y-0 opacity-100 ${colors[notification.type] || colors.success} min-w-[300px] animate-fade-in-up`}>
            <span className="text-xl">{icons[notification.type]}</span>
            <div className="flex-1">
                <p className="font-bold text-xs uppercase tracking-wider">{labels[notification.type]}</p>
                <p className="font-medium text-sm">{notification.message}</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-black font-bold">×</button>
        </div>
    );
};

export default function OperacionBitacora() {
  const [incidencias, setIncidencias] = useState([])
  const [loading, setLoading] = useState(false)

  // Estado para notificaciones
  const [notification, setNotification] = useState({ visible: false, message: '', type: 'success' })

  const showToast = (message, type = 'success') => {
      setNotification({ visible: true, message, type });
      setTimeout(() => setNotification(prev => ({ ...prev, visible: false })), 3000);
  }

  // Formulario
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    servicio: 'LAT',
    local: '',
    sg: '',
    grupo: '',
    motivo: '',
    observacion: ''
  })

  useEffect(() => { fetchIncidencias() }, [])

  const fetchIncidencias = async () => {
    const { data } = await supabase.from('incidencias').select('*').order('created_at', { ascending: false }).limit(50)
    if (data) setIncidencias(data)
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name==='servicio') setFormData({...formData, servicio:value, local:''});
    else if(name==='grupo') setFormData({...formData, grupo:value, motivo:''});
    else setFormData({...formData, [name]:value});
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Validar campos básicos
    if(!formData.local || !formData.grupo || !formData.motivo) {
        showToast("Faltan datos: Local o Motivo no seleccionados", "error");
        return;
    }

    // 2. Validar largo de observación (NUEVO)
    if (formData.observacion.length < 5) {
        showToast("La observación es muy corta (mínimo 5 letras)", "warning");
        return;
    }

    setLoading(true);
    const { error } = await supabase.from('incidencias').insert([{...formData, kpi: determinarKPI(formData.motivo)}]);

    if(error) {
        showToast("Error al guardar: " + error.message, "error");
    } else {
        showToast("Incidencia registrada exitosamente", "success");
        fetchIncidencias();
        setFormData({...formData, sg: '', grupo: '', motivo: '', observacion: ''}); // Reset parcial
    }
    setLoading(false);
  }

  return (
    <div className="bg-gray-100 min-h-screen p-6 font-sans relative">
        {/* Notificación Flotante */}
        <ToastNotification notification={notification} onClose={() => setNotification({...notification, visible: false})} />

        {/* HEADER */}
        <div className="bg-gradient-to-r from-black via-[#0f254a] to-[#1e3c72] text-white p-4 rounded-t-xl flex justify-between items-center shadow-lg border-b-4 border-[#d63384] mb-6">
            <div><h1 className="text-2xl font-black tracking-tighter">REGISTRO DE INCIDENCIAS</h1><p className="text-xs text-[#d63384] font-bold tracking-widest uppercase">Bitácora Operacional</p></div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 animate-fade-in">
          {/* Formulario */}
          <div className="w-full lg:w-4/12">
            <div className="bg-white rounded-lg shadow-sm border-t-4 border-[#d63384]">
                <div className="p-4 border-b"><h6 className="text-[#1e3c72] font-bold"> NUEVA INCIDENCIA</h6></div>
                <div className="p-5">
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div><label className="text-xs font-bold text-gray-500">FECHA</label><input type="date" name="fecha" value={formData.fecha} onChange={handleChange} className="w-full border p-2 rounded fw-bold" /></div>
                        <div className="flex gap-2">
                            <div className="w-1/3"><label className="text-xs font-bold text-gray-500">SERVICIO</label><select name="servicio" value={formData.servicio} onChange={handleChange} className="w-full border p-2 rounded font-bold text-[#1e3c72]"><option value="LAT">LAT</option><option value="HD">HD</option><option value="SBA">SBA</option><option value="CM">CM</option></select></div>
                            <div className="w-2/3"><label className="text-xs font-bold text-gray-500">LOCAL</label><select name="local" value={formData.local} onChange={handleChange} className="w-full border p-2 rounded"><option value="">Seleccione...</option>{localesPorServicio[formData.servicio]?.map((l, i) => <option key={i} value={l}>{l}</option>)}</select></div>
                        </div>

                        {/* CASILLA SG NUMÉRICA */}
                        <div>
                            <label className="text-xs font-bold text-gray-500">SG (OPCIONAL)</label>
                            <input
                                type="number"
                                name="sg"
                                value={formData.sg}
                                onChange={handleChange}
                                placeholder="Ej: 994123"
                                className="w-full border p-2 rounded font-mono uppercase font-bold text-[#1e3c72]"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500">MOTIVO</label>
                            <select name="grupo" value={formData.grupo} onChange={handleChange} className="w-full border p-2 rounded mb-2"><option value="">Grupo...</option>{Object.keys(motivosPorGrupo).map(g => <option key={g} value={g}>{g}</option>)}</select>
                            <select name="motivo" value={formData.motivo} onChange={handleChange} className="w-full border p-2 rounded" disabled={!formData.grupo}><option value="">Motivo...</option>{motivosPorGrupo[formData.grupo]?.map((m, i) => <option key={i} value={m}>{m}</option>)}</select>
                        </div>
                        <div><label className="text-xs font-bold text-gray-500">OBSERVACIÓN (Mín. 5 caract.)</label><textarea name="observacion" rows="2" value={formData.observacion} onChange={handleChange} className="w-full border p-2 rounded resize-none uppercase"></textarea></div>
                        <button disabled={loading} className="w-full bg-[#1e3c72] text-white font-bold py-2 rounded hover:bg-[#0f254a] transition-colors">{loading ? 'GUARDANDO...' : 'GUARDAR'}</button>
                    </form>
                </div>
            </div>
          </div>

          {/* Historial Rápido */}
          <div className="w-full lg:w-8/12">
            <div className="bg-white rounded-lg shadow-sm border-t-4 border-[#d63384] h-full flex flex-col">
                <div className="p-4 border-b flex justify-between items-center"><h6 className="text-[#1e3c72] font-bold"> ÚLTIMOS INGRESOS</h6><button onClick={fetchIncidencias} className="text-gray-400 hover:text-blue-600"></button></div>
                <div className="flex-1 overflow-auto p-0">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-xs uppercase sticky top-0"><tr><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Local</th><th className="px-4 py-2">SG</th><th className="px-4 py-2">Motivo</th><th className="px-4 py-2">KPI</th></tr></thead>
                        <tbody>{incidencias.map((item) => (<tr key={item.id} className="border-b hover:bg-gray-50"><td className="px-4 py-2 font-bold text-gray-600">{item.fecha}</td><td className="px-4 py-2 font-bold text-[#1e3c72]">{item.local}</td><td className="px-4 py-2 font-mono text-xs">{item.sg || '-'}</td><td className="px-4 py-2 text-xs">{item.motivo}</td><td className="px-4 py-2"><span className={`text-[10px] font-bold px-2 py-1 rounded ${item.kpi==='CONTINGENCIA'?'bg-red-100 text-red-700':item.kpi==='ALERTA OTEA'?'bg-yellow-100 text-yellow-800':'bg-gray-100 text-gray-500'}`}>{item.kpi}</span></td></tr>))}</tbody>
                    </table>
                </div>
            </div>
          </div>
        </div>
    </div>
  )
}