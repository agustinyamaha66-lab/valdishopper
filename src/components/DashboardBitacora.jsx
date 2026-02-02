import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { getWeek, parseISO, isValid } from 'date-fns'
import { es } from 'date-fns/locale'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement)

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

const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

// --- DATOS DE PRUEBA (MODO OFFLINE) ---
const MOCK_DATA = [
    { id: 1, fecha: new Date().toISOString().split('T')[0], local: '120 Temuco', servicio: 'LAT', sg: '994100', motivo: 'ALTO TRAFICO', kpi: 'ALERTA OTEA', observacion: 'Congestión alta en centro' },
    { id: 2, fecha: new Date().toISOString().split('T')[0], local: '58 Viña', servicio: 'HD', sg: '994101', motivo: 'CIERRE DE LOCAL', kpi: 'CONTINGENCIA', observacion: 'Manifestaciones fuera del local' },
    { id: 3, fecha: new Date().toISOString().split('T')[0], local: '120 Temuco', servicio: 'LAT', sg: '994102', motivo: 'PEDIDO DUPLICADO', kpi: 'REPORTADO', observacion: 'Error sistémico' },
    { id: 4, fecha: new Date().toISOString().split('T')[0], local: '99 Puerto Montt', servicio: 'CM', sg: '994105', motivo: 'SIN MORADORES', kpi: 'REPORTADO', observacion: 'Cliente no contesta' },
];

const determinarKPI = (motivo) => {
  const criticos = ["CIERRE DE LOCAL", "SIN APOYO LOCAL BAJA DOTACION WM", "CORTE DE LUZ LOCAL", "PROTESTA FUERA DEL LOCAL", "ACCIDENTE EN RUTA"];
  const advertencia = ["ALTO TRAFICO", "PROBLEMAS EN AMIDA", "COMPLICACIONES EN SALA", "PEDIDOS ENCOLADOS"];
  if (criticos.includes(motivo)) return "CONTINGENCIA";
  if (advertencia.includes(motivo)) return "ALERTA OTEA";
  return "REPORTADO";
}

// --- NOTIFICACIÓN TOAST ---
const ToastNotification = ({ notification, onClose }) => {
    if (!notification.visible) return null;
    const colors = { success: 'bg-green-100 border-green-500 text-green-800', error: 'bg-red-100 border-red-500 text-red-800', warning: 'bg-yellow-100 border-yellow-500 text-yellow-800' };
    return (
        <div className={`fixed top-24 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded shadow-xl border-l-4 ${colors[notification.type] || colors.success} min-w-[300px] animate-fade-in-up`}>
            <span className="text-xl">{notification.type === 'success' ? '✅' : notification.type === 'warning' ? '⚠️' : '⛔'}</span>
            <div className="flex-1"><p className="font-bold text-xs uppercase">{notification.type === 'success' ? 'CORRECTO' : notification.type === 'warning' ? 'ATENCIÓN' : 'ERROR'}</p><p className="text-sm">{notification.message}</p></div>
            <button onClick={onClose} className="text-gray-500 font-bold">×</button>
        </div>
    );
};

export default function DashboardBitacora() {
  const [incidencias, setIncidencias] = useState([])
  const [dashTab, setDashTab] = useState('DIARIA')
  const [loading, setLoading] = useState(false)
  const [notification, setNotification] = useState({ visible: false, message: '', type: 'success' })

  // Filtros
  const currentWeekNum = getWeek(new Date(), { locale: es })
  const currentMonthNum = new Date().getMonth()
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [filterWeek, setFilterWeek] = useState(currentWeekNum)
  const [filterMonth, setFilterMonth] = useState(currentMonthNum)
  const [filterSg, setFilterSg] = useState('')

  const [rangoDescarga, setRangoDescarga] = useState({
    inicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    fin: new Date().toISOString().split('T')[0]
  })

  // UI States
  const [activeKpi, setActiveKpi] = useState('ALL')
  const [paginaActual, setPaginaActual] = useState(1)
  const ITEMS_POR_PAGINA = 8
  const [modalOpen, setModalOpen] = useState(false)
  const [modalData, setModalData] = useState({ titulo: '', lista: [] })
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  useEffect(() => { fetchIncidencias() }, [])
  useEffect(() => { setPaginaActual(1); setActiveKpi('ALL'); }, [dashTab, filterDate, filterWeek, filterMonth, filterSg])

  const showToast = (message, type = 'success') => {
      setNotification({ visible: true, message, type });
      setTimeout(() => setNotification(prev => ({ ...prev, visible: false })), 4000);
  }

  const fetchIncidencias = async () => {
    setLoading(true);
    try {
        const { data, error } = await supabase.from('incidencias').select('*').order('created_at', { ascending: false }).limit(2000)

        if (error) throw error;

        if (data && data.length > 0) {
            setIncidencias(data)
        } else {
            setIncidencias([])
        }
    } catch (err) {
        console.error("Error conexión Supabase:", err)
        showToast("Supabase no responde. Cargando modo DEMO.", "warning")
        setIncidencias(MOCK_DATA)
    } finally {
        setLoading(false);
    }
  }

  // --- 🔥 AQUÍ ESTÁ EL CAMBIO CLAVE: BÚSQUEDA HISTÓRICA 🔥 ---
  const datosFiltrados = useMemo(() => {
    if (!incidencias.length) return []

    return incidencias.filter(item => {
      if (!item.fecha) return false;

      try {
          const fechaItem = parseISO(item.fecha)
          if (!isValid(fechaItem)) return false;

          // 1. PRIORIDAD TOTAL: Si hay algo en "Buscar SG", ignoramos las fechas.
          if (filterSg.trim() !== '') {
              return item.sg && item.sg.toString().toUpperCase().includes(filterSg.toUpperCase());
          }

          // 2. Si NO hay búsqueda por SG, aplicamos los filtros de fecha normales
          let matchFecha = false;
          if (dashTab === 'DIARIA' || dashTab === 'REGISTROS') {
              matchFecha = item.fecha === filterDate
          } else if (dashTab === 'SEMANAL') {
              matchFecha = getWeek(fechaItem, { locale: es }) === parseInt(filterWeek) && fechaItem.getFullYear() === new Date().getFullYear()
          } else if (dashTab === 'MENSUAL') {
              matchFecha = fechaItem.getMonth() === parseInt(filterMonth) && fechaItem.getFullYear() === new Date().getFullYear()
          } else {
              matchFecha = true;
          }

          return matchFecha;

      } catch (error) {
          console.warn("Dato corrupto ignorado:", item);
          return false;
      }
    })
  }, [incidencias, dashTab, filterDate, filterWeek, filterMonth, filterSg])

  // --- KPI CALCULATIONS ---
  const kpis = useMemo(() => {
    const total = datosFiltrados.length
    const contingencias = datosFiltrados.filter(i => i.kpi === 'CONTINGENCIA').length
    const otea = datosFiltrados.filter(i => i.kpi === 'ALERTA OTEA').length
    const logistica = datosFiltrados.filter(i => i.kpi === 'REPORTADO').length
    return { total, contingencias, otea, logistica }
  }, [datosFiltrados])

  const estadoLocales = useMemo(() => {
    const grupos = {}
    datosFiltrados.forEach(inc => {
      const key = `${inc.servicio} - ${inc.local}`
      if (!grupos[key]) grupos[key] = { nombre: key, total: 0, critico: 0, warn: 0, logi: 0, ultimoMotivo: '', listaDetalle: [] }
      grupos[key].total += 1
      grupos[key].ultimoMotivo = inc.motivo
      grupos[key].listaDetalle.push(inc)
      if (inc.kpi === 'CONTINGENCIA') grupos[key].critico += 1
      else if (inc.kpi === 'ALERTA OTEA') grupos[key].warn += 1
      else grupos[key].logi += 1
    })
    return Object.values(grupos).sort((a, b) => b.critico - a.critico || b.warn - a.warn || b.total - a.total)
  }, [datosFiltrados])

  const localesParaMostrar = useMemo(() => {
    if (dashTab !== 'DIARIA') return estadoLocales;
    if (activeKpi === 'ALL') return estadoLocales;
    if (activeKpi === 'CONTINGENCIA') return estadoLocales.filter(l => l.critico > 0);
    if (activeKpi === 'OTEA') return estadoLocales.filter(l => l.warn > 0);
    if (activeKpi === 'LOGISTICA') return estadoLocales.filter(l => l.logi > 0);
    return estadoLocales;
  }, [estadoLocales, activeKpi, dashTab])

  const registrosPaginados = useMemo(() => {
      if (dashTab !== 'REGISTROS') return []
      const inicio = (paginaActual - 1) * ITEMS_POR_PAGINA
      return datosFiltrados.slice(inicio, inicio + ITEMS_POR_PAGINA)
  }, [datosFiltrados, paginaActual, dashTab])

  const totalPaginasRegistros = Math.ceil(datosFiltrados.length / ITEMS_POR_PAGINA)

  // --- CHARTS ---
  const chartPareto = useMemo(() => {
    const counts = {}
    datosFiltrados.forEach(d => { counts[d.motivo] = (counts[d.motivo] || 0) + 1 })
    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 5)
    return {
      labels: sorted.map(x => x[0].length > 20 ? x[0].substring(0, 20) + '...' : x[0]),
      datasets: [{ label: 'Eventos', data: sorted.map(x => x[1]), backgroundColor: '#1e3c72', borderRadius: 4, barThickness: 40 }]
    }
  }, [datosFiltrados])

  const paretoOptions = { indexAxis: 'y', maintainAspectRatio: false, scales: { x: { ticks: { stepSize: 1, precision: 0 } } }, plugins: { legend: { display: false } } }

  const chartMonthlyLine = useMemo(() => {
    if (dashTab !== 'MENSUAL') return null;
    const days = new Date(new Date().getFullYear(), filterMonth + 1, 0).getDate();
    const labels = Array.from({length: days}, (_, i) => i + 1);
    const data = labels.map(day => datosFiltrados.filter(d => parseISO(d.fecha).getDate() === day).length);
    return { labels, datasets: [{ label: 'Incidencias', data, borderColor: '#1e3c72', backgroundColor: 'rgba(30,60,114,0.1)', fill: true, tension: 0.3, pointRadius: 3 }] }
  }, [datosFiltrados, dashTab, filterMonth])

  const chartServiceBar = useMemo(() => {
    if (dashTab !== 'MENSUAL') return null;
    const counts = { LAT: 0, HD: 0, SBA: 0, CM: 0 };
    datosFiltrados.forEach(d => { if (counts[d.servicio] !== undefined) counts[d.servicio]++; });
    return {
      labels: Object.keys(counts),
      datasets: [{ label: 'Total', data: Object.values(counts), backgroundColor: ['#1e3c72', '#d63384', '#f59e0b', '#10b981'], borderRadius: 4, barThickness: 40 }]
    }
  }, [datosFiltrados, dashTab])

  // --- ACTIONS ---
  const isKpiInteractive = dashTab === 'DIARIA';
  const handleKpiClick = (type) => { if(isKpiInteractive){ setActiveKpi(type); setPaginaActual(1); } }

  const abrirModalDetalle = (localData) => {
    let lista = localData.listaDetalle;
    if(isKpiInteractive && activeKpi !== 'ALL'){
        if(activeKpi==='CONTINGENCIA') lista = lista.filter(i=>i.kpi==='CONTINGENCIA');
        if(activeKpi==='OTEA') lista = lista.filter(i=>i.kpi==='ALERTA OTEA');
        if(activeKpi==='LOGISTICA') lista = lista.filter(i=>i.kpi==='REPORTADO');
    }
    setModalData({ titulo: localData.nombre, lista }); setModalOpen(true);
  }

  // --- EDICIÓN ---
  const handleEditClick = (record) => {
      setEditForm({ ...record, sg: record.sg || '', observacion: record.observacion || '' });
      setEditingId(record.id);
      setEditModalOpen(true);
  }

  const handleEditChange = (e) => {
      const { name, value } = e.target;
      if (name==='servicio') setEditForm({...editForm, servicio:value, local:''});
      else if(name==='grupo') setEditForm({...editForm, grupo:value, motivo:''});
      else setEditForm({...editForm, [name]:value});
  }

  const handleUpdate = async (e) => {
      e.preventDefault();
      if(!editForm.local || !editForm.grupo || !editForm.motivo) return showToast("Faltan datos obligatorios", "error");

      try {
          const { error } = await supabase.from('incidencias').update({
              fecha: editForm.fecha,
              servicio: editForm.servicio,
              local: editForm.local,
              sg: editForm.sg,
              grupo: editForm.grupo,
              motivo: editForm.motivo,
              observacion: editForm.observacion,
              kpi: determinarKPI(editForm.motivo)
          }).eq('id', editingId);

          if (error) throw error;

          showToast("Registro actualizado correctamente", "success");
          setEditModalOpen(false);
          fetchIncidencias();
      } catch (err) {
          showToast("Error (Posiblemente Supabase offline): " + err.message, "error");
      }
  }

  const descargarReporteRango = async () => {
    setLoading(true);
    try {
        const { data, error } = await supabase.from('incidencias').select('*').gte('fecha', rangoDescarga.inicio).lte('fecha', rangoDescarga.fin).order('fecha', { ascending: true });
        if (error || !data || data.length === 0) {
            showToast("No se encontraron datos para descargar", "warning");
        } else {
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Reporte_CCO");
            XLSX.writeFile(wb, `Reporte_CCO_${rangoDescarga.inicio}_${rangoDescarga.fin}.xlsx`);
            showToast("Excel descargado correctamente", "success");
        }
    } catch(err) {
        showToast("Error en descarga", "error");
    } finally {
        setLoading(false);
    }
  }

  return (
    <div className="bg-gray-100 min-h-screen p-6 font-sans relative">
      <ToastNotification notification={notification} onClose={() => setNotification({...notification, visible: false})} />

      <div className="bg-gradient-to-r from-black via-[#0f254a] to-[#1e3c72] text-white p-4 rounded-t-xl flex justify-between items-center shadow-lg border-b-4 border-[#d63384] mb-6">
        <div><h1 className="text-2xl font-black tracking-tighter">DASHBOARD INCIDENCIAS </h1><p className="text-xs text-[#d63384] font-bold tracking-widest uppercase">Análisis y Tendencias</p></div>
      </div>

      <div className="animate-fade-in space-y-6">
          {/* BARRA DESCARGA */}
          <div className="bg-[#1e3c72] p-3 rounded-lg shadow-lg flex flex-wrap gap-4 items-center justify-between text-white">
             <div className="flex items-center gap-2"><span className="text-xl"></span><span className="text-xs font-bold uppercase tracking-wider">Centro de Descargas</span></div>
             <div className="flex items-center gap-2">
                <div className="flex flex-col"><span className="text-[9px] font-bold text-gray-300">DESDE</span><input type="date" value={rangoDescarga.inicio} onChange={(e) => setRangoDescarga({...rangoDescarga, inicio: e.target.value})} className="text-xs text-black rounded px-2 py-1 font-bold" /></div>
                <div className="flex flex-col"><span className="text-[9px] font-bold text-gray-300">HASTA</span><input type="date" value={rangoDescarga.fin} onChange={(e) => setRangoDescarga({...rangoDescarga, fin: e.target.value})} className="text-xs text-black rounded px-2 py-1 font-bold" /></div>
                <button onClick={descargarReporteRango} disabled={loading} className="bg-[#d63384] hover:bg-pink-600 text-white font-bold py-2 px-4 rounded text-xs ml-2 shadow-md transition-transform active:scale-95 disabled:opacity-50">{loading ? '...' : 'DESCARGAR EXCEL'}</button>
             </div>
          </div>

          {/* FILTROS */}
          <div className="bg-white p-4 rounded shadow-sm border-l-4 border-[#1e3c72] flex flex-wrap gap-4 items-center">
            <div className="flex bg-gray-100 rounded p-1 mr-4">
              {['DIARIA', 'SEMANAL', 'MENSUAL', 'REGISTROS'].map(tab => (
                <button key={tab} onClick={() => setDashTab(tab)} className={`px-4 py-1 text-xs font-bold rounded transition ${dashTab===tab ? 'bg-[#1e3c72] text-white shadow' : 'text-gray-500 hover:text-gray-800'}`}>{tab}</button>
              ))}
            </div>
            <div className="flex flex-1 gap-4 overflow-x-auto pb-1 items-center">
              <div className="flex items-center gap-2 border px-3 py-2 rounded bg-white min-w-[200px] ring-1 ring-gray-200 focus-within:ring-blue-400">
                <div className="text-lg">🔍</div>
                <div className="flex flex-col w-full"><span className="text-[9px] font-bold text-gray-400 uppercase">BUSCAR SG</span><input type="text" placeholder="..." value={filterSg} onChange={(e) => setFilterSg(e.target.value)} className="text-sm font-black text-[#1e3c72] outline-none bg-transparent w-full" /></div>
              </div>

              {(dashTab === 'DIARIA' || dashTab === 'REGISTROS') && (
                  <div className="flex items-center gap-2 border px-3 py-2 rounded bg-white min-w-[150px] ring-2 ring-blue-100"><span className="text-xl">📅</span><div className="flex flex-col"><span className="text-[9px] font-bold text-gray-400 uppercase">FECHA</span><input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="text-sm font-black text-[#1e3c72] outline-none bg-transparent" /></div></div>
              )}
              {dashTab === 'SEMANAL' && (<div className="flex items-center gap-2 border px-3 py-2 rounded bg-white min-w-[200px] ring-2 ring-blue-100"><span className="text-xl">📆</span><div className="flex flex-col w-full"><span className="text-[9px] font-bold text-gray-400 uppercase">SEMANA</span><select value={filterWeek} onChange={(e) => setFilterWeek(e.target.value)} className="text-sm font-black text-blue-600 outline-none bg-transparent w-full">{Array.from({length: 52}, (_, i) => i + 1).map(w => (<option key={w} value={w}>SEMANA {w} {w === currentWeekNum ? '(ACTUAL)' : ''}</option>))}</select></div></div>)}
              {(dashTab === 'MENSUAL') && (<div className="flex items-center gap-2 border px-3 py-2 rounded bg-white min-w-[180px] ring-2 ring-blue-100"><span className="text-xl">📊</span><div className="flex flex-col w-full"><span className="text-[9px] font-bold text-gray-400 uppercase">MES</span><select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="text-sm font-black text-[#1e3c72] outline-none bg-transparent w-full">{MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}</select></div></div>)}
            </div>
          </div>

          {/* VISTA: KPI CARDS */}
          {dashTab !== 'REGISTROS' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
                 <div className="lg:col-span-3 bg-white rounded shadow-md overflow-hidden flex flex-col">
                    <div className="bg-[#0f254a] text-white px-4 py-2 text-xs font-bold uppercase tracking-widest flex items-center gap-2"><span>⏲</span> INDICADORES DEL PERÍODO</div>
                    <div className="flex flex-1 divide-x divide-gray-200">
                       <div onClick={() => handleKpiClick('ALL')} className={`flex-1 p-4 text-center transition ${isKpiInteractive?'cursor-pointer hover:bg-blue-50':''} ${activeKpi==='ALL'&&isKpiInteractive?'bg-blue-50 border-b-4 border-[#0f254a]':''}`}><div className="text-3xl font-black text-[#0f254a]">{kpis.total}</div><div className="text-[10px] font-bold text-gray-400 mt-1">TOTAL INCIDENCIAS</div></div>
                       <div onClick={() => handleKpiClick('OTEA')} className={`flex-1 p-4 text-center transition ${isKpiInteractive?'cursor-pointer hover:bg-yellow-50':''} ${activeKpi==='OTEA'&&isKpiInteractive?'bg-yellow-50 border-b-4 border-yellow-400':''}`}><div className="text-3xl font-black text-yellow-500">{kpis.otea}</div><div className="text-[10px] font-bold text-gray-400 mt-1">RIESGO OTEA</div></div>
                       <div onClick={() => handleKpiClick('LOGISTICA')} className={`flex-1 p-4 text-center transition ${isKpiInteractive?'cursor-pointer hover:bg-gray-50':''} ${activeKpi==='LOGISTICA'&&isKpiInteractive?'bg-gray-100 border-b-4 border-gray-500':''}`}><div className="text-3xl font-black text-gray-600">{kpis.logistica}</div><div className="text-[10px] font-bold text-gray-400 mt-1">LOGÍSTICA / VENTA</div></div>
                    </div>
                 </div>
                 <div className="lg:col-span-1 bg-white rounded shadow-md overflow-hidden flex flex-col">
                    <div className="bg-[#d63384] text-white px-4 py-2 text-xs font-bold uppercase tracking-widest flex items-center gap-2"><span>⚠</span> ALERTA CRÍTICA</div>
                    <div onClick={() => handleKpiClick('CONTINGENCIA')} className={`flex-1 p-4 text-center transition ${isKpiInteractive?'cursor-pointer hover:bg-pink-50':''} ${activeKpi==='CONTINGENCIA'&&isKpiInteractive?'bg-pink-50 border-b-4 border-[#d63384]':''}`}><div className="text-3xl font-black text-[#d63384]">{estadoLocales.filter(l=>l.critico>0).length}</div><div className="text-[10px] font-bold text-[#d63384] mt-1">LOCALES CRÍTICOS</div></div>
                 </div>
              </div>
          )}

          {/* VISTA: REGISTROS (TABLA) */}
          {dashTab === 'REGISTROS' && (
              <div className="bg-white rounded shadow-lg overflow-hidden border-t-4 border-[#1e3c72] animate-fade-in">
                  <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                      <h6 className="font-black text-[#1e3c72] text-sm uppercase">📋 GESTIÓN DE REGISTROS</h6>
                      <span className="text-xs font-bold text-gray-400">{datosFiltrados.length} Registros encontrados</span>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                          <thead className="bg-[#1e3c72] text-white uppercase font-bold">
                              <tr><th className="px-4 py-3">ACCIÓN</th><th className="px-4 py-3">FECHA</th><th className="px-4 py-3">LOCAL</th><th className="px-4 py-3">SG</th><th className="px-4 py-3">MOTIVO</th><th className="px-4 py-3">KPI</th><th className="px-4 py-3">OBSERVACIÓN</th></tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {registrosPaginados.length === 0 ? (<tr><td colSpan="7" className="p-8 text-center text-gray-400 font-bold">No se encontraron registros.</td></tr>) : (
                                  registrosPaginados.map(item => (
                                      <tr key={item.id} className="hover:bg-blue-50 transition-colors">
                                          <td className="px-4 py-2"><button onClick={() => handleEditClick(item)} className="bg-orange-100 text-orange-600 hover:bg-orange-500 hover:text-white px-2 py-1 rounded font-bold border border-orange-200 transition-all shadow-sm">✏ EDITAR</button></td>
                                          <td className="px-4 py-2 font-mono text-gray-500">{item.fecha}</td>
                                          <td className="px-4 py-2 font-bold text-[#1e3c72]">{item.local}</td>
                                          <td className="px-4 py-2 font-mono font-bold">{item.sg || '-'}</td>
                                          <td className="px-4 py-2">{item.motivo}</td>
                                          <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded font-bold text-[10px] ${item.kpi==='CONTINGENCIA'?'bg-red-100 text-red-600':item.kpi==='ALERTA OTEA'?'bg-yellow-100 text-yellow-700':'bg-gray-100 text-gray-500'}`}>{item.kpi}</span></td>
                                          <td className="px-4 py-2 text-gray-500 italic truncate max-w-xs">{item.observacion}</td>
                                      </tr>
                                  ))
                              )}
                          </tbody>
                      </table>
                  </div>
                  {totalPaginasRegistros > 1 && (
                      <div className="p-3 bg-gray-50 flex justify-center gap-2 border-t">
                          <button disabled={paginaActual===1} onClick={()=>setPaginaActual(p=>p-1)} className="px-3 py-1 bg-white border rounded text-xs font-bold disabled:opacity-50 hover:bg-gray-100">◀ ANTERIOR</button>
                          <span className="px-3 py-1 text-xs font-bold text-gray-500 flex items-center">Página {paginaActual} de {totalPaginasRegistros}</span>
                          <button disabled={paginaActual===totalPaginasRegistros} onClick={()=>setPaginaActual(p=>p+1)} className="px-3 py-1 bg-white border rounded text-xs font-bold disabled:opacity-50 hover:bg-gray-100">SIGUIENTE ▶</button>
                      </div>
                  )}
              </div>
          )}

          {/* VISTA: DIARIA */}
          {dashTab === 'DIARIA' && (
            <div className="space-y-3">
              <div className="flex justify-between items-end"><h3 className="text-[#1e3c72] font-bold text-sm uppercase">Monitoreo ({filterDate})</h3><span className="text-[10px] text-gray-400 italic">Pag {paginaActual}</span></div>
              {localesParaMostrar.slice((paginaActual - 1) * ITEMS_POR_PAGINA, ((paginaActual - 1) * ITEMS_POR_PAGINA) + ITEMS_POR_PAGINA).map((loc, idx) => (
                  <div key={idx} className={`bg-white p-3 rounded shadow-sm flex items-center justify-between border-l-4 ${loc.critico > 0 ? 'border-red-500 bg-red-50' : loc.warn > 0 ? 'border-yellow-400' : 'border-gray-300'}`}>
                    <div className="flex-1"><h4 className="font-black text-[#1e3c72] text-lg">{loc.nombre}</h4><div className="flex items-center gap-3 mt-1"><span className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${loc.critico > 0 ? 'bg-red-600 text-white' : loc.warn > 0 ? 'bg-yellow-400 text-black' : 'bg-gray-200 text-gray-600'}`}>{loc.critico > 0 ? 'CONTINGENCIA' : loc.warn > 0 ? 'RIESGO OTEA' : 'OPERATIVO'}</span><p className="text-xs text-gray-600 font-bold uppercase truncate max-w-md">{loc.ultimoMotivo} <span className="text-gray-400 font-normal">({loc.total} eventos)</span></p></div></div>
                    <div><button onClick={() => abrirModalDetalle(loc)} className="border border-gray-300 bg-white hover:bg-gray-100 text-[#1e3c72] text-xs font-bold py-2 px-4 rounded-full shadow-sm">VER 👁️</button></div>
                  </div>
              ))}
              {Math.ceil(localesParaMostrar.length / ITEMS_POR_PAGINA) > 1 && <div className="flex justify-center gap-2 mt-4"><button disabled={paginaActual===1} onClick={()=>setPaginaActual(p=>p-1)} className="px-3 py-1 bg-white border rounded text-xs font-bold disabled:opacity-50">◀</button><button disabled={paginaActual===Math.ceil(localesParaMostrar.length / ITEMS_POR_PAGINA)} onClick={()=>setPaginaActual(p=>p+1)} className="px-3 py-1 bg-white border rounded text-xs font-bold disabled:opacity-50">▶</button></div>}
            </div>
          )}

          {/* VISTAS SEMANAL Y MENSUAL */}
          {dashTab === 'SEMANAL' && (
            <div className="row">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-white p-4 rounded shadow h-80"><h5 className="font-bold text-[#1e3c72] text-xs mb-4">TOP 5 MOTIVOS (PARETO)</h5><Bar data={chartPareto} options={paretoOptions} /></div>
                  <div className="bg-white p-4 rounded shadow h-80 flex flex-col items-center justify-center"><h5 className="font-bold text-[#1e3c72] text-xs mb-4">ORIGEN DEL PROBLEMA</h5><div className="w-full h-full max-w-xs"><Doughnut data={{ labels: ['Contingencia', 'OTEA', 'Normal'], datasets: [{ data: [kpis.contingencias, kpis.otea, kpis.logistica], backgroundColor: ['#ef4444', '#eab308', '#e5e7eb'] }] }} options={{ maintainAspectRatio: false }} /></div></div>
               </div>
               <div className="bg-white rounded shadow h-full flex flex-col"><div className="p-3 border-b bg-gray-50"><h6 className="text-[#1e3c72] font-bold text-xs uppercase">🏆 RANKING SEMANAL DE SALAS</h6></div><div className="flex-1 overflow-auto p-0 max-h-80"><table className="w-full text-sm text-left"><thead className="bg-gray-100 text-gray-500 text-xs uppercase sticky top-0"><tr><th className="p-3">#</th><th className="p-3">Local</th><th className="p-3 text-center">Total</th><th className="p-3 text-center">Acción</th></tr></thead><tbody>{estadoLocales.slice(0, 10).map((loc, idx) => (<tr key={idx} className="border-b hover:bg-gray-50"><td className="p-3 font-bold text-gray-400">{idx+1}</td><td className="p-3"><div className="font-bold text-[#1e3c72]">{loc.nombre}</div></td><td className="p-3 text-center font-black">{loc.total}</td><td className="p-3 text-center"><button onClick={() => abrirModalDetalle(loc)} className="bg-[#1e3c72] text-white p-2 rounded text-xs font-bold">VER 👁️</button></td></tr>))}</tbody></table></div></div>
            </div>
          )}

          {dashTab === 'MENSUAL' && (
            <div className="space-y-6">
                {chartMonthlyLine && (<div className="bg-white p-4 rounded shadow h-80"><h5 className="font-bold text-[#1e3c72] text-xs mb-4 uppercase">Evolución Diaria</h5><div className="h-full pb-6"><Line data={chartMonthlyLine} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }} /></div></div>)}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-4 rounded shadow h-full min-h-[320px]"><h5 className="font-bold text-[#1e3c72] text-xs mb-4 uppercase">Comparativa por Servicio</h5>{chartServiceBar && (<div className="h-64"><Bar data={chartServiceBar} options={{ indexAxis: 'x', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }} /></div>)}</div>
                    <div className="bg-white rounded shadow h-full flex flex-col min-h-[320px]"><div className="p-3 border-b bg-gray-50 flex justify-between"><h6 className="text-[#1e3c72] font-bold text-xs uppercase"> Locales Crónicos </h6></div><div className="flex-1 overflow-auto p-0 max-h-72"><table className="w-full text-sm text-left"><thead className="bg-gray-100 text-gray-500 text-xs uppercase sticky top-0"><tr><th className="p-3">#</th><th className="p-3">Local</th><th className="p-3 text-center">Total</th><th className="p-3 text-center">Acción</th></tr></thead><tbody>{estadoLocales.slice(0, 10).map((loc, idx) => (<tr key={idx} className="border-b hover:bg-gray-50"><td className="p-3 font-bold text-gray-400">{idx+1}</td><td className="p-3"><div className="font-bold text-[#1e3c72]">{loc.nombre}</div><div className="text-[10px] text-red-500 font-bold">{loc.critico} Contingencias</div></td><td className="p-3 text-center font-black text-lg">{loc.total}</td><td className="p-3 text-center"><button onClick={() => abrirModalDetalle(loc)} className="bg-[#1e3c72] text-white p-2 rounded hover:bg-blue-900 text-xs font-bold">VER 👁️</button></td></tr>))}</tbody></table></div></div>
                </div>
            </div>
          )}
      </div>

      {/* MODAL DETALLES */}
      {modalOpen && (<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"><div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl overflow-hidden"><div className="bg-[#0f254a] text-white p-4 flex justify-between items-center border-b-4 border-[#d63384]"><h3 className="font-bold">DETALLE: <span className="text-[#d63384]">{modalData.titulo}</span></h3><button onClick={() => setModalOpen(false)} className="text-white text-2xl">&times;</button></div><div className="max-h-[60vh] overflow-y-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-100 text-xs uppercase font-bold sticky top-0"><tr><th className="p-3">Fecha/Hora</th><th className="p-3">SG</th><th className="p-3">Motivo</th><th className="p-3">KPI</th><th className="p-3">Observación</th></tr></thead><tbody className="divide-y">{modalData.lista.map((inc, i) => (<tr key={i}><td className="p-3 font-mono text-gray-500">{inc.fecha}</td><td className="p-3 font-mono font-bold text-blue-600">{inc.sg || '-'}</td><td className="p-3 font-bold text-[#1e3c72]">{inc.motivo}</td><td className="p-3"><span className={`text-[10px] font-bold px-2 py-1 rounded ${inc.kpi==='CONTINGENCIA'?'bg-red-100 text-red-700':inc.kpi==='ALERTA OTEA'?'bg-yellow-100 text-yellow-800':'bg-gray-100'}`}>{inc.kpi}</span></td><td className="p-3 text-xs italic">{inc.observacion}</td></tr>))}</tbody></table></div><div className="bg-gray-50 p-3 text-right"><button onClick={() => setModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded font-bold text-xs">CERRAR</button></div></div></div>)}

      {/* MODAL EDICIÓN */}
      {editModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg border-t-8 border-orange-500 animate-fade-in-up">
                  <div className="p-4 border-b flex justify-between items-center bg-orange-50">
                      <h3 className="font-black text-orange-800 text-lg">✏ EDITAR REGISTRO</h3>
                      <button onClick={() => setEditModalOpen(false)} className="text-gray-400 hover:text-black font-bold text-xl">&times;</button>
                  </div>
                  <div className="p-6">
                      <form onSubmit={handleUpdate} className="space-y-4">
                          <div className="flex gap-4">
                              <div className="w-1/2"><label className="text-[10px] font-bold text-gray-500 block mb-1">FECHA</label><input type="date" name="fecha" value={editForm.fecha || ''} onChange={handleEditChange} className="w-full border p-2 rounded font-bold" /></div>
                              <div className="w-1/2"><label className="text-[10px] font-bold text-gray-500 block mb-1">SG</label><input type="number" name="sg" value={editForm.sg || ''} onChange={handleEditChange} className="w-full border p-2 rounded font-mono font-bold text-blue-600" /></div>
                          </div>
                          <div className="flex gap-4">
                              <div className="w-1/3"><label className="text-[10px] font-bold text-gray-500 block mb-1">SERVICIO</label><select name="servicio" value={editForm.servicio || ''} onChange={handleEditChange} className="w-full border p-2 rounded text-sm"><option value="LAT">LAT</option><option value="HD">HD</option><option value="SBA">SBA</option><option value="CM">CM</option></select></div>
                              <div className="w-2/3"><label className="text-[10px] font-bold text-gray-500 block mb-1">LOCAL</label><select name="local" value={editForm.local || ''} onChange={handleEditChange} className="w-full border p-2 rounded text-sm"><option value="">Seleccione...</option>{localesPorServicio[editForm.servicio]?.map((l, i) => <option key={i} value={l}>{l}</option>)}</select></div>
                          </div>
                          <div>
                              <label className="text-[10px] font-bold text-gray-500 block mb-1">MOTIVO</label>
                              <select name="grupo" value={editForm.grupo || ''} onChange={handleEditChange} className="w-full border p-2 rounded mb-2 text-sm font-bold text-gray-700"><option value="">Grupo...</option>{Object.keys(motivosPorGrupo).map(g => <option key={g} value={g}>{g}</option>)}</select>
                              <select name="motivo" value={editForm.motivo || ''} onChange={handleEditChange} className="w-full border p-2 rounded text-sm font-bold text-[#1e3c72]" disabled={!editForm.grupo}><option value="">Motivo...</option>{motivosPorGrupo[editForm.grupo]?.map((m, i) => <option key={i} value={m}>{m}</option>)}</select>
                          </div>
                          <div><label className="text-[10px] font-bold text-gray-500 block mb-1">OBSERVACIÓN</label><textarea name="observacion" rows="3" value={editForm.observacion || ''} onChange={handleEditChange} className="w-full border p-2 rounded resize-none uppercase text-sm"></textarea></div>

                          <div className="flex gap-3 pt-2">
                              <button type="button" onClick={() => setEditModalOpen(false)} className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded text-xs">CANCELAR</button>
                              <button type="submit" className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded text-xs shadow-lg">GUARDAR CAMBIOS</button>
                          </div>
                      </form>
                  </div>
              </div>
          </div>
      )}
    </div>
  )
}