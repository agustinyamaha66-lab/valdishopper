import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip,Filler, Legend, ArcElement
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
ChartJS.register
ChartJS.register(CategoryScale, LinearScale, BarElement, Title,Filler, Tooltip, Legend, ArcElement)

// --- DATOS MAESTROS Y UTILIDADES ---
const localesPorServicio = {
  LAT: ["120 Temuco", "121 Punta Arenas", "143 Talca", "144 Parral", "146 San Javier", "182 Buin", "276 Lampa", "41 Huechuraba", "42 Curicó", "518 Valparaíso", "54 La Florida 54", "608 Chillán", "611 La Florida 611", "618 Osorno", "627 San Vicente"],
  HD: ["120 Temuco", "121 Punta Arenas", "58 Viña", "606 Coronel", "608 Chillán", "618 Osorno", "657 Castro", "697 San Fernando", "94 Valdivia", "98 Concepción", "99 Puerto Montt"],
  SBA: ["171 San Bernardo", "528 Curicó", "569 Talca", "570 Cauquenes", "583 Constitución", "587 Tome"],
  CM: ["159 Macul", "19 Puerto Montt", "513 Talca", "68 Osorno", "903 San Pedro de la Paz", "990 Maipú"],
  "MODELO MIXTO": ["95 La Reina", "45 Maipú", "58 Viña", "99 Puerto Montt", "98 Concepción"],
  "ESTIVALES": ["120 Temuco", "121 Punta Arenas", "58 Viña", "606 Coronel", "608 Chillán", "618 Osorno", "657 Castro", "697 San Fernando", "94 Valdivia", "98 Concepción", "99 Puerto Montt"],
  CATEX: ["33 Kennedy", "71 La Florida", "75 Maipú", "76 La Reina", "78 Puente Alto", "81 Peñalolén", "88 Tobalaba", "92 La Dehesa"]
}

const formatCLP = (value) => {
  if (!value) return '';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value);
}

const formatearRut = (rut) => {
  const actual = rut.replace(/^0+/, "").replace(/[^0-9kK]+/g, "").toUpperCase();
  if (actual === '') return '';
  const cuerpo = actual.slice(0, -1);
  const dv = actual.slice(-1);
  return (cuerpo.length > 0 ? new Intl.NumberFormat("es-CL").format(cuerpo) + "-" : "") + dv;
}

const validarRutChileno = (rut) => {
  if (!/^[0-9]+-[0-9kK]{1}$/.test(rut)) return false;
  const split = rut.split('-');
  let num = split[0].replace(/\./g, "");
  let dv = split[1].toUpperCase();
  let M = 0, S = 1;
  for (; num; num = Math.floor(num / 10)) S = (S + num % 10 * (9 - M++ % 6)) % 11;
  const dvEsperado = S ? S - 1 : 'K';
  return dvEsperado == dv;
}

const limpiarString = (str) => {
  return str ? str.toString().toUpperCase().replace(/[^0-9K]/g, '') : '';
}

export default function ReportesFinancieros() {
  const [registros, setRegistros] = useState([])
  const [filtroServicio, setFiltroServicio] = useState('TODOS')
  const [busquedaPatente, setBusquedaPatente] = useState('')
  const [loadingDescarga, setLoadingDescarga] = useState(false)

  // Estado para Rango de Fechas
  const [rangoDescarga, setRangoDescarga] = useState({
    inicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    fin: new Date().toISOString().split('T')[0]
  })

  // --- ESTADOS PARA EDICIÓN (MODAL) ---
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    modalidad: 'PAGO', fecha: '', servicio: '', local: '', patente: '',
    tipoDocumento: 'PATENTE', tipo: '', montoPrestador: '', porcentaje: '50%',
    incluirCobro: false, montoCliente: '', detalleCliente: '', comentario: ''
  })

  useEffect(() => { fetchRegistros() }, [])

  const fetchRegistros = async () => {
    // Traemos los últimos 1000 registros para visualización rápida
    const { data } = await supabase.from('costos_extra').select('*').order('created_at', { ascending: false }).limit(1000)
    if (data) setRegistros(data)
  }

  // --- DESCARGAR POR RANGO ---
  const descargarExcelPorRango = async () => {
    setLoadingDescarga(true);

    let query = supabase
      .from('costos_extra')
      .select('*')
      .gte('fecha_evento', rangoDescarga.inicio)
      .lte('fecha_evento', rangoDescarga.fin)
      .order('fecha_evento', { ascending: true });

    if (filtroServicio !== 'TODOS') {
      query = query.eq('servicio', filtroServicio);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      alert("No se encontraron registros en ese rango de fechas.");
      setLoadingDescarga(false);
      return;
    }

    const datosParaExcel = data.map(r => ({
      "ID": r.id,
      "Fecha Evento": r.fecha_evento,
      "Servicio": r.servicio,
      "Local": r.local,
      "Identificador": r.patente,
      "Concepto": r.tipo_concepto,
      "Monto Prestador": r.monto_prestador,
      "Cobro Cliente": r.monto_cliente,
      "Detalle": r.detalle_cliente,
      "Comentario": r.comentario
    }));

    const ws = XLSX.utils.json_to_sheet(datosParaExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte_Rango");
    const nombreArchivo = `Finanzas_${filtroServicio}_${rangoDescarga.inicio}_${rangoDescarga.fin}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);

    setLoadingDescarga(false);
  }

  // --- FILTRADO VISUAL ---
  const registrosFiltrados = useMemo(() => {
    return registros.filter(r => {
      const coincideServicio = filtroServicio === 'TODOS' || r.servicio === filtroServicio;
      const busquedaLimpia = limpiarString(busquedaPatente);
      const patenteLimpia = limpiarString(r.patente);
      const coincidePatente = busquedaPatente === '' || patenteLimpia.includes(busquedaLimpia);
      return coincideServicio && coincidePatente;
    });
  }, [registros, filtroServicio, busquedaPatente]);

  // --- GRÁFICOS ---
  const datosGraficos = useMemo(() => {
    const gastoServicio = {}
    registrosFiltrados.forEach(r => {
      const valorStr = r.monto_prestador.toString();
      if (!valorStr.includes('%')) {
          const monto = parseInt(valorStr) || 0;
          if (!isNaN(monto)) gastoServicio[r.servicio] = (gastoServicio[r.servicio] || 0) + monto
      }
    })

    const conteoConcepto = {}
    registrosFiltrados.forEach(r => {
      if(r.tipo_concepto !== 'SOLO COBRO') conteoConcepto[r.tipo_concepto] = (conteoConcepto[r.tipo_concepto] || 0) + 1
    })

    return {
      barData: {
        labels: Object.keys(gastoServicio),
        datasets: [{ label: 'Gasto Real ($)', data: Object.values(gastoServicio), backgroundColor: '#1e3c72', borderRadius: 4 }]
      },
      doughnutData: {
        labels: Object.keys(conteoConcepto),
        datasets: [{ data: Object.values(conteoConcepto), backgroundColor: ['#d63384', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'] }]
      }
    }
  }, [registrosFiltrados])

  // --- LÓGICA DE EDICIÓN ---
  const handleEditClick = (reg) => {
    const esPorcentaje = reg.monto_prestador.toString().includes('%');
    const pareceRut = reg.patente.includes('-') || reg.patente.includes('.');

    setFormData({
      modalidad: reg.modalidad,
      fecha: reg.fecha_evento,
      servicio: reg.servicio,
      local: reg.local,
      patente: reg.patente === '-' ? '' : reg.patente,
      tipoDocumento: pareceRut ? 'RUT' : 'PATENTE',
      tipo: reg.tipo_concepto === 'SOLO COBRO' ? 'AMBULANCIA' : reg.tipo_concepto,
      montoPrestador: esPorcentaje ? '' : reg.monto_prestador,
      porcentaje: esPorcentaje ? reg.monto_prestador : '50%',
      incluirCobro: reg.tiene_cobro,
      montoCliente: reg.monto_cliente || '',
      detalleCliente: reg.detalle_cliente === '-' ? '' : reg.detalle_cliente,
      comentario: reg.comentario
    });
    setEditingId(reg.id);
    setShowModal(true);
  }

  const handleModalChange = (e) => {
    const { name, value, type, checked } = e.target
    if (name === 'servicio') setFormData({ ...formData, servicio: value, local: '' })
    else {
      const valorFinal = (name === 'local' || type === 'checkbox') ? value : value.toUpperCase();
      setFormData({ ...formData, [name]: type === 'checkbox' ? checked : valorFinal })
    }
  }

  const handleMontoChange = (e) => {
    const { name, value } = e.target;
    const soloNumeros = value.replace(/\D/g, '');
    if (soloNumeros.length > 7) return;
    setFormData({ ...formData, [name]: soloNumeros });
  }

  const handleIdentificadorChange = (e) => {
    let val = e.target.value;
    if (formData.tipoDocumento === 'RUT') val = val.replace(/[^0-9kK\-\.]/g, '');
    else { if (val.length > 6) return; val = val.toUpperCase(); }
    setFormData({ ...formData, patente: val });
  }

  const handleRutBlur = () => {
    if (formData.tipoDocumento === 'RUT' && formData.patente) {
      setFormData(prev => ({...prev, patente: formatearRut(prev.patente)}))
    }
  }

  const esFalsoFleteHD = () => (formData.servicio === 'HD' || formData.servicio === 'ESTIVALES') && formData.tipo === 'FALSO FLETE';

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!formData.local) return alert("Selecciona una Sala/Local");
    if (formData.modalidad === 'PAGO' && !formData.tipo) return alert("Debes seleccionar un CONCEPTO");

    if (formData.modalidad === 'PAGO') {
        if (formData.tipoDocumento === 'PATENTE') {
            const regexPatente = /^([A-Z]{4}\d{2}|[A-Z]{2}\d{4})$/;
            if (!regexPatente.test(formData.patente)) return alert("⛔ ERROR EN PATENTE:\nFormatos: ABCD12 o AB1234");
        } else {
            const rutLimpio = formData.patente.replace(/\./g, '').toUpperCase();
            if (!validarRutChileno(rutLimpio)) return alert("⛔ ERROR EN RUT");
            setFormData(prev => ({...prev, patente: formatearRut(rutLimpio)}));
        }
        if (!esFalsoFleteHD() && (!formData.montoPrestador || parseInt(formData.montoPrestador) <= 0)) return alert("⛔ FALTA EL MONTO");
    }

    let montoFinalPrestador = formData.montoPrestador
    if (esFalsoFleteHD() && formData.modalidad === 'PAGO') montoFinalPrestador = formData.porcentaje

    const payload = {
      fecha_evento: formData.fecha,
      servicio: formData.servicio,
      local: formData.local,
      modalidad: formData.modalidad,
      patente: formData.modalidad === 'PAGO' ? formData.patente : '-',
      tipo_concepto: formData.modalidad === 'PAGO' ? formData.tipo : 'SOLO COBRO',
      monto_prestador: formData.modalidad === 'PAGO' ? montoFinalPrestador : '0',
      tiene_cobro: formData.incluirCobro || formData.modalidad === 'COBRO',
      monto_cliente: (formData.incluirCobro || formData.modalidad === 'COBRO') ? (formData.montoCliente || 0) : 0,
      detalle_cliente: (formData.incluirCobro || formData.modalidad === 'COBRO') ? formData.detalleCliente : '-',
      comentario: formData.comentario,
      usuario_registro: 'Usuario Activo'
    }

    const { error } = await supabase.from('costos_extra').update(payload).eq('id', editingId);

    if (error) alert("Error al actualizar: " + error.message);
    else {
      alert("Registro Actualizado Correctamente ✅");
      fetchRegistros();
      setShowModal(false);
    }
  }

  return (
    <div className="bg-gray-100 min-h-screen p-6 font-sans animate-fade-in relative">
        <div className="bg-gradient-to-r from-black via-[#1e3c72] to-[#1e3c72] text-white p-4 rounded-xl flex justify-between items-center shadow-lg border-b-4 border-[#d63384] mb-6">
            <div><h1 className="text-2xl font-black tracking-tight">REPORTES FINANCIEROS</h1><p className="text-xs text-[#d63384] font-bold tracking-widest uppercase">Análisis y KPIs</p></div>
        </div>

        {/* --- CENTRO DE DESCARGAS --- */}
        <div className="bg-[#1e3c72] p-3 rounded-lg shadow-lg flex flex-wrap gap-4 items-center justify-between text-white mb-6">
             <div className="flex items-center gap-2">
                <span className="text-xl">📥</span>
                <span className="text-xs font-bold uppercase tracking-wider">Centro de Descargas</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="flex flex-col"><span className="text-[9px] font-bold text-gray-300">DESDE</span><input type="date" value={rangoDescarga.inicio} onChange={(e) => setRangoDescarga({...rangoDescarga, inicio: e.target.value})} className="text-xs text-black rounded px-2 py-1 font-bold" /></div>
                <div className="flex flex-col"><span className="text-[9px] font-bold text-gray-300">HASTA</span><input type="date" value={rangoDescarga.fin} onChange={(e) => setRangoDescarga({...rangoDescarga, fin: e.target.value})} className="text-xs text-black rounded px-2 py-1 font-bold" /></div>
                <button onClick={descargarExcelPorRango} disabled={loadingDescarga} className="bg-[#d63384] hover:bg-pink-600 text-white font-bold py-2 px-4 rounded text-xs ml-2 shadow-md transition-transform active:scale-95 disabled:opacity-50">
                   {loadingDescarga ? 'GENERANDO...' : 'DESCARGAR EXCEL'}
                </button>
             </div>
        </div>

        {/* --- FILTROS VISUALES --- */}
        <div className="bg-white p-4 rounded shadow mb-6 flex flex-wrap gap-4 justify-between items-center border-t-4 border-[#d63384]">
            <div className="flex flex-wrap items-center gap-4">
               <div><label className="text-[10px] font-bold text-gray-400 block mb-1">FILTRAR SERVICIO (Gráficos)</label><select value={filtroServicio} onChange={(e) => setFiltroServicio(e.target.value)} className="border p-2 rounded font-bold text-sm"><option value="TODOS">TODOS</option>{Object.keys(localesPorServicio).map(svc => (<option key={svc} value={svc}>{svc}</option>))}</select></div>
               <div><label className="text-[10px] font-bold text-gray-400 block mb-1">BUSCAR ID (Pat/RUT)</label><div className="relative"><span className="absolute left-2 top-1.5 text-gray-400">🔍</span><input type="text" placeholder="..." value={busquedaPatente} onChange={(e) => setBusquedaPatente(e.target.value)} className="border pl-8 p-1.5 rounded font-mono uppercase text-sm w-32 focus:w-48 transition-all" /></div></div>
            </div>
            <div className="text-xs text-gray-400 font-bold italic">Mostrando últimos 1000 registros en pantalla</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
             <div className="bg-white p-4 rounded shadow"><h6 className="font-bold text-[#1e3c72] text-xs uppercase mb-4">Gasto Total por Servicio (Sin %)</h6><div className="h-60"><Bar data={datosGraficos.barData} options={{ indexAxis: 'y', maintainAspectRatio: false }} /></div></div>
             <div className="bg-white p-4 rounded shadow"><h6 className="font-bold text-[#1e3c72] text-xs uppercase mb-4">Distribución por Concepto</h6><div className="h-60 flex justify-center"><Doughnut data={datosGraficos.doughnutData} options={{ maintainAspectRatio: false }} /></div></div>
        </div>

        <div className="bg-white rounded shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#1e3c72] text-white uppercase"><tr><th className="px-4 py-3 text-center">ACCIÓN</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Servicio</th><th className="px-4 py-3">Local</th><th className="px-4 py-3">ID (Pat/RUT)</th><th className="px-4 py-3">Concepto</th><th className="px-4 py-3">Monto Prest.</th><th className="px-4 py-3">Monto Cli.</th><th className="px-4 py-3">Comentario</th></tr></thead>
                <tbody>
                  {registrosFiltrados.map(reg => (
                    <tr key={reg.id} className="border-b hover:bg-gray-100 odd:bg-white even:bg-gray-50 transition-colors">
                      <td className="px-4 py-2 text-center">
                        <button onClick={() => handleEditClick(reg)} className="bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white px-3 py-1 rounded-full font-bold text-[10px] transition-colors shadow-sm">✏️ EDITAR</button>
                      </td>
                      <td className="px-4 py-2">{reg.fecha_evento}</td>
                      <td className="px-4 py-2 font-bold">{reg.servicio}</td>
                      <td className="px-4 py-2">{reg.local}</td>
                      <td className="px-4 py-2 font-mono text-blue-600 font-bold">{reg.patente}</td>
                      <td className="px-4 py-2">{reg.tipo_concepto}</td>
                      <td className="px-4 py-2 font-bold">{!isNaN(reg.monto_prestador) && !reg.monto_prestador.toString().includes('%') ? formatCLP(reg.monto_prestador) : reg.monto_prestador}</td>
                      <td className="px-4 py-2 text-red-600">{formatCLP(reg.monto_cliente)}</td>
                      <td className="px-4 py-2 truncate max-w-[200px] italic text-gray-500">{reg.comentario}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </div>

        {/* --- MODAL DE EDICIÓN --- */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden border-t-8 border-orange-500">
              <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-[#1e3c72] text-lg">✏️ EDITAR REGISTRO</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-red-500 text-2xl font-bold">&times;</button>
              </div>
              <div className="p-6 max-h-[80vh] overflow-y-auto">
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div className="flex gap-4">
                     <div className="w-1/2"><label className="text-xs font-bold text-gray-500">FECHA</label><input type="date" name="fecha" value={formData.fecha} onChange={handleModalChange} className="w-full border p-2 rounded" /></div>
                     <div className="w-1/2"><label className="text-xs font-bold text-gray-500">SERVICIO</label><select name="servicio" value={formData.servicio} onChange={handleModalChange} className="w-full border p-2 rounded"><option value="">SEL...</option>{Object.keys(localesPorServicio).map(svc => (<option key={svc} value={svc}>{svc}</option>))}</select></div>
                  </div>
                  <div><label className="text-xs font-bold text-gray-500">LOCAL</label><select name="local" value={formData.local} onChange={handleModalChange} className="w-full border p-2 rounded"><option value="">Seleccione...</option>{localesPorServicio[formData.servicio]?.map((l, i) => (<option key={i} value={l}>{l}</option>))}</select></div>

                  {formData.modalidad === 'PAGO' && (
                    <div className="bg-blue-50 p-4 rounded border border-blue-100">
                      <div className="flex gap-4 mb-3">
                        <div className="w-1/2">
                           <div className="flex justify-between items-center mb-1">
                             <label className="text-xs font-bold text-gray-500">IDENTIFICADOR</label>
                             <div className="flex bg-gray-200 rounded p-0.5"><button type="button" onClick={() => setFormData(prev => ({...prev, tipoDocumento: 'PATENTE', patente: ''}))} className={`px-2 py-0.5 text-[9px] font-bold rounded ${formData.tipoDocumento === 'PATENTE' ? 'bg-white text-blue-800 shadow' : 'text-gray-500'}`}>PAT</button><button type="button" onClick={() => setFormData(prev => ({...prev, tipoDocumento: 'RUT', patente: ''}))} className={`px-2 py-0.5 text-[9px] font-bold rounded ${formData.tipoDocumento === 'RUT' ? 'bg-white text-green-600 shadow' : 'text-gray-500'}`}>RUT</button></div>
                           </div>
                           <input type="text" name="patente" value={formData.patente} onChange={handleIdentificadorChange} onBlur={handleRutBlur} placeholder={formData.tipoDocumento==='PATENTE'?"ABCD12":"12.345.678-K"} className="w-full border p-2 rounded font-mono uppercase font-bold text-center" maxLength={formData.tipoDocumento==='PATENTE'?6:12}/>
                        </div>
                        <div className="w-1/2">
                           <label className="text-xs font-bold text-gray-500">CONCEPTO</label>
                           <select name="tipo" value={formData.tipo} onChange={handleModalChange} className="w-full border p-2 rounded text-sm font-bold text-[#1e3c72]"><option value="">Seleccione...</option><option value="AMBULANCIA">AMBULANCIA</option><option value="DOBLE RUTA">DOBLE RUTA</option><option value="FALSO FLETE">FALSO FLETE</option><option value="INCENTIVO">INCENTIVO</option><option value="OTRO">OTRO</option></select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500">MONTO A PAGAR</label>
                        {esFalsoFleteHD() ? (
                          <select name="porcentaje" value={formData.porcentaje} onChange={handleModalChange} className="w-full border p-2 rounded font-bold text-[#1e3c72]"><option value="50%">50%</option><option value="70%">70%</option><option value="100%">100%</option></select>
                        ) : (
                          <input type="text" name="montoPrestador" value={formatCLP(formData.montoPrestador)} onChange={handleMontoChange} placeholder="$ 0" className="w-full border p-2 rounded font-bold text-right text-[#1e3c72]" />
                        )}
                      </div>
                    </div>
                  )}

                  <div className="bg-gray-100 p-3 rounded">
                     <div className="flex gap-4">
                       <div className="w-1/3"><label className="text-xs font-bold text-gray-500">COBRO CLIENTE</label><input type="text" name="montoCliente" value={formatCLP(formData.montoCliente)} onChange={handleMontoChange} className="w-full border p-2 rounded font-bold text-red-600" placeholder="$ 0" /></div>
                       <div className="w-2/3"><label className="text-xs font-bold text-gray-500">DETALLE COBRO</label><input type="text" name="detalleCliente" value={formData.detalleCliente} onChange={handleModalChange} className="w-full border p-2 rounded text-sm" /></div>
                     </div>
                  </div>

                  <div><label className="text-xs font-bold text-gray-500">COMENTARIO</label><textarea name="comentario" value={formData.comentario} onChange={handleModalChange} rows="2" className="w-full border p-2 rounded uppercase"></textarea></div>

                  <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded">CANCELAR</button>
                    <button type="submit" className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded shadow-lg">GUARDAR CAMBIOS 💾</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}