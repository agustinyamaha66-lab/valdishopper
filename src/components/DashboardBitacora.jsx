import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { getWeek, parseISO, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  LayoutDashboard,
  CalendarDays,
  Search,
  Download,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  TrendingUp,
  Filter,
  ChevronLeft,
  ChevronRight,
  Edit,
  X,
  Save,
  BarChart3,
  PieChart,
  Calendar,
  Eye,
  Activity
} from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement)

// --- 1. COMPONENTE PAGE HEADER (NUEVO) ---
function PageHeader({
  eyebrow = "",
  title = "",
  subtitle = "",
  icon: Icon = null,
  iconClassName = "text-[#d63384]",
  gradient = "from-[#0b1f44]/95 via-[#163a6b]/90 to-[#0b1f44]/95",
  right = null,
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/20 shadow-xl mb-6">
      <div className={`absolute inset-0 bg-gradient-to-r ${gradient}`} />

      {/* Decoración de fondo */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-10 left-10 h-28 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 right-10 h-28 w-64 rounded-full bg-cyan-300/10 blur-2xl" />
      </div>

      <div className="relative z-10 px-6 py-6 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
        <div>
          {!!eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/70">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1 text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            {Icon && <Icon size={30} className={iconClassName} />}
            {title}
          </h1>
          {!!subtitle && (
            <p className="text-blue-100/80 text-sm mt-2 font-medium max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {/* Renderiza controles a la derecha (Tabs) */}
        {right ? <div className="w-full xl:w-auto">{right}</div> : null}
      </div>
    </div>
  );
}

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

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const MOCK_DATA = [
    { id: 1, fecha: new Date().toISOString().split('T')[0], local: '120 Temuco', servicio: 'LAT', sg: '994100', motivo: 'ALTO TRAFICO', kpi: 'ALERTA OTEA', observacion: 'Congestión alta en centro' },
    { id: 2, fecha: new Date().toISOString().split('T')[0], local: '58 Viña', servicio: 'HD', sg: '994101', motivo: 'CIERRE DE LOCAL', kpi: 'CONTINGENCIA', observacion: 'Manifestaciones fuera del local' },
];

const determinarKPI = (motivo) => {
  const criticos = ["CIERRE DE LOCAL", "SIN APOYO LOCAL BAJA DOTACION WM", "CORTE DE LUZ LOCAL", "PROTESTA FUERA DEL LOCAL", "ACCIDENTE EN RUTA"];
  const advertencia = ["ALTO TRAFICO", "PROBLEMAS EN AMIDA", "COMPLICACIONES EN SALA", "PEDIDOS ENCOLADOS"];
  if (criticos.includes(motivo)) return "CONTINGENCIA";
  if (advertencia.includes(motivo)) return "ALERTA OTEA";
  return "REPORTADO";
}

// --- BADGE KPI ---
const KpiBadge = ({ tipo }) => {
    const config = {
        'CONTINGENCIA': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: AlertOctagon },
        'ALERTA OTEA': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: AlertTriangle },
        'REPORTADO': { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', icon: CheckCircle2 },
    }
    const style = config[tipo] || config['REPORTADO'];
    const Icon = style.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${style.bg} ${style.text} ${style.border} uppercase tracking-wide`}>
            <Icon size={12} strokeWidth={2.5} /> {tipo}
        </span>
    )
}

const ToastNotification = ({ notification, onClose }) => {
    if (!notification.visible) return null;
    const colors = { success: 'bg-emerald-50 border-emerald-500 text-emerald-800', error: 'bg-rose-50 border-rose-500 text-rose-800', warning: 'bg-amber-50 border-amber-500 text-amber-800' };
    const icons = { success: CheckCircle2, error: AlertOctagon, warning: AlertTriangle };
    const Icon = icons[notification.type];
    return (
        <div className={`fixed top-24 right-6 z-[9999] flex items-center gap-3 px-5 py-4 rounded-xl shadow-xl border-l-4 transition-all duration-300 transform translate-y-0 opacity-100 ${colors[notification.type]} min-w-[320px] animate-in slide-in-from-right`}>
            <Icon size={24} />
            <div className="flex-1"><p className="font-bold text-xs uppercase tracking-wider opacity-80">{notification.type}</p><p className="font-medium text-sm leading-tight">{notification.message}</p></div>
            <button onClick={onClose} className="opacity-50 hover:opacity-100"><X size={18}/></button>
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
        setIncidencias(data && data.length > 0 ? data : [])
    } catch (err) {
        console.error("Error conexión Supabase:", err)
        showToast("Modo Offline activo (Demo Data)", "warning")
        setIncidencias(MOCK_DATA)
    } finally {
        setLoading(false);
    }
  }

  const datosFiltrados = useMemo(() => {
    if (!incidencias.length) return []
    return incidencias.filter(item => {
      if (!item.fecha) return false;
      try {
          const fechaItem = parseISO(item.fecha)
          if (!isValid(fechaItem)) return false;
          if (filterSg.trim() !== '') return item.sg && item.sg.toString().toUpperCase().includes(filterSg.toUpperCase());

          if (dashTab === 'DIARIA' || dashTab === 'REGISTROS') return item.fecha === filterDate
          else if (dashTab === 'SEMANAL') return getWeek(fechaItem, { locale: es }) === parseInt(filterWeek) && fechaItem.getFullYear() === new Date().getFullYear()
          else if (dashTab === 'MENSUAL') return fechaItem.getMonth() === parseInt(filterMonth) && fechaItem.getFullYear() === new Date().getFullYear()
          else return true;
      } catch (error) { return false; }
    })
  }, [incidencias, dashTab, filterDate, filterWeek, filterMonth, filterSg])

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

  // Charts
  const chartPareto = useMemo(() => {
    const counts = {}
    datosFiltrados.forEach(d => { counts[d.motivo] = (counts[d.motivo] || 0) + 1 })
    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 5)
    return {
      labels: sorted.map(x => x[0].length > 20 ? x[0].substring(0, 20) + '...' : x[0]),
      datasets: [{ label: 'Eventos', data: sorted.map(x => x[1]), backgroundColor: '#1e3c72', borderRadius: 4, barThickness: 24 }]
    }
  }, [datosFiltrados])

  const chartMonthlyLine = useMemo(() => {
    if (dashTab !== 'MENSUAL') return null;
    const days = new Date(new Date().getFullYear(), filterMonth + 1, 0).getDate();
    const labels = Array.from({length: days}, (_, i) => i + 1);
    const data = labels.map(day => datosFiltrados.filter(d => parseISO(d.fecha).getDate() === day).length);
    return { labels, datasets: [{ label: 'Incidencias', data, borderColor: '#1e3c72', backgroundColor: 'rgba(30,60,114,0.1)', fill: true, tension: 0.3, pointRadius: 2 }] }
  }, [datosFiltrados, dashTab, filterMonth])

  const chartServiceBar = useMemo(() => {
    if (dashTab !== 'MENSUAL') return null;
    const counts = { LAT: 0, HD: 0, SBA: 0, CM: 0 };
    datosFiltrados.forEach(d => { if (counts[d.servicio] !== undefined) counts[d.servicio]++; });
    return {
      labels: Object.keys(counts),
      datasets: [{ label: 'Total', data: Object.values(counts), backgroundColor: ['#1e3c72', '#d63384', '#f59e0b', '#10b981'], borderRadius: 4, barThickness: 30 }]
    }
  }, [datosFiltrados, dashTab])

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

  const handleEditClick = (record) => { setEditForm({ ...record, sg: record.sg || '', observacion: record.observacion || '' }); setEditingId(record.id); setEditModalOpen(true); }
  const handleEditChange = (e) => { const { name, value } = e.target; if (name==='servicio') setEditForm({...editForm, servicio:value, local:''}); else if(name==='grupo') setEditForm({...editForm, grupo:value, motivo:''}); else setEditForm({...editForm, [name]:value}); }
  const handleUpdate = async (e) => { e.preventDefault(); if(!editForm.local || !editForm.grupo || !editForm.motivo) return showToast("Faltan datos obligatorios", "error"); try { const { error } = await supabase.from('incidencias').update({ fecha: editForm.fecha, servicio: editForm.servicio, local: editForm.local, sg: editForm.sg, grupo: editForm.grupo, motivo: editForm.motivo, observacion: editForm.observacion, kpi: determinarKPI(editForm.motivo) }).eq('id', editingId); if (error) throw error; showToast("Registro actualizado correctamente", "success"); setEditModalOpen(false); fetchIncidencias(); } catch (err) { showToast("Error: " + err.message, "error"); } }
  const descargarReporteRango = async () => { setLoading(true); try { const { data, error } = await supabase.from('incidencias').select('*').gte('fecha', rangoDescarga.inicio).lte('fecha', rangoDescarga.fin).order('fecha', { ascending: true }); if (error || !data || data.length === 0) { showToast("No se encontraron datos", "warning"); } else { const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Reporte_CCO"); XLSX.writeFile(wb, `Reporte_CCO_${rangoDescarga.inicio}.xlsx`); showToast("Excel descargado", "success"); } } catch(err) { showToast("Error en descarga", "error"); } finally { setLoading(false); } }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-10 font-sans animate-fade-in">
      <ToastNotification notification={notification} onClose={() => setNotification({...notification, visible: false})} />

      {/* ==============================================================
          NUEVO PAGE HEADER INTEGRADO (Reemplaza al anterior header)
          ============================================================== */}
      <PageHeader
        eyebrow=""
        title="DASHBOARD DE BITÁCORA"
        subtitle="Monitor de operaciones, incidencias y cumplimiento de servicio."
        icon={LayoutDashboard}
        // Pasamos el selector de vistas a la parte derecha
        right={
            <div className="bg-white p-1 rounded-xl shadow-lg border border-slate-200 inline-flex self-start">
                {['DIARIA', 'SEMANAL', 'MENSUAL', 'REGISTROS'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setDashTab(tab)}
                        className={`px-5 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                            dashTab === tab 
                            ? 'bg-[#1e3c72] text-white shadow-md' 
                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>
        }
      />

      {/* BARRA DE HERRAMIENTAS UNIFICADA (Filtros y Export) */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-8 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
              <div className="relative group w-full sm:w-auto">
                  <label className="text-[9px] font-bold text-slate-400 uppercase absolute -top-2 left-2 bg-white px-1">Buscar SG</label>
                  <div className="relative">
                      <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                      <input type="text" placeholder="Ej: 994123" value={filterSg} onChange={(e) => setFilterSg(e.target.value)} className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm font-mono font-bold text-[#1e3c72] outline-none focus:ring-2 focus:ring-[#1e3c72] w-full sm:w-48 transition-all" />
                  </div>
              </div>

              {(dashTab === 'DIARIA' || dashTab === 'REGISTROS') && (
                  <div className="relative group w-full sm:w-auto">
                      <label className="text-[9px] font-bold text-slate-400 uppercase absolute -top-2 left-2 bg-white px-1">Fecha Análisis</label>
                      <div className="relative">
                          <CalendarDays className="absolute left-3 top-2.5 text-slate-400" size={16} />
                          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#1e3c72] w-full sm:w-auto transition-all cursor-pointer" />
                      </div>
                  </div>
              )}
              {dashTab === 'SEMANAL' && (
                  <div className="relative group w-full sm:w-auto">
                      <label className="text-[9px] font-bold text-slate-400 uppercase absolute -top-2 left-2 bg-white px-1">Semana</label>
                      <div className="relative">
                          <Calendar className="absolute left-3 top-2.5 text-slate-400" size={16} />
                          <select value={filterWeek} onChange={(e) => setFilterWeek(e.target.value)} className="pl-10 pr-8 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#1e3c72] w-full appearance-none cursor-pointer">
                              {Array.from({length: 52}, (_, i) => i + 1).map(w => (<option key={w} value={w}>Semana {w} {w === currentWeekNum ? '(Actual)' : ''}</option>))}
                          </select>
                      </div>
                  </div>
              )}
              {dashTab === 'MENSUAL' && (
                  <div className="relative group w-full sm:w-auto">
                      <label className="text-[9px] font-bold text-slate-400 uppercase absolute -top-2 left-2 bg-white px-1">Mes</label>
                      <div className="relative">
                          <BarChart3 className="absolute left-3 top-2.5 text-slate-400" size={16} />
                          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="pl-10 pr-8 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#1e3c72] w-full appearance-none cursor-pointer">
                              {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                          </select>
                      </div>
                  </div>
              )}
          </div>

          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 w-full xl:w-auto bg-slate-50 p-2 rounded-lg border border-slate-200">
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase px-1">Rango Export:</span>
                <input type="date" value={rangoDescarga.inicio} onChange={(e) => setRangoDescarga({ ...rangoDescarga, inicio: e.target.value })} className="text-xs font-medium border border-slate-200 rounded px-2 py-1.5 focus:border-[#1e3c72] outline-none" />
                <span className="text-slate-300">-</span>
                <input type="date" value={rangoDescarga.fin} onChange={(e) => setRangoDescarga({ ...rangoDescarga, fin: e.target.value })} className="text-xs font-medium border border-slate-200 rounded px-2 py-1.5 focus:border-[#1e3c72] outline-none" />
             </div>
             <button onClick={descargarReporteRango} disabled={loading} className="w-full sm:w-auto bg-[#d63384] hover:bg-pink-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50">
                {loading ? '...' : <><Download size={14} /> Exportar</>}
             </button>
          </div>
      </div>

      {/* --- VISTA: DASHBOARD (KPIS) --- */}
      {dashTab !== 'REGISTROS' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             {/* TARJETA KPI PRINCIPAL */}
             <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center gap-2">
                    <Activity size={16} className="text-[#1e3c72]" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Indicadores Clave de Desempeño</span>
                </div>
                <div className="flex flex-col sm:flex-row flex-1 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                   {/* KPI 1 */}
                   <div
                        onClick={() => handleKpiClick('ALL')}
                        className={`flex-1 p-6 flex items-center justify-between group transition-colors ${isKpiInteractive ? 'cursor-pointer hover:bg-slate-50' : ''} ${activeKpi==='ALL' && isKpiInteractive ? 'bg-blue-50/50' : ''}`}
                   >
                       <div>
                           <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Eventos</p>
                           <h3 className="text-3xl font-black text-[#1e3c72] group-hover:scale-105 transition-transform">{kpis.total}</h3>
                       </div>
                       <div className="p-3 bg-blue-100 text-blue-700 rounded-xl"><BarChart3 size={24} /></div>
                   </div>
                   {/* KPI 2 */}
                   <div
                        onClick={() => handleKpiClick('OTEA')}
                        className={`flex-1 p-6 flex items-center justify-between group transition-colors ${isKpiInteractive ? 'cursor-pointer hover:bg-amber-50/50' : ''} ${activeKpi==='OTEA' && isKpiInteractive ? 'bg-amber-50' : ''}`}
                   >
                       <div>
                           <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Alerta OTEA</p>
                           <h3 className="text-3xl font-black text-amber-500 group-hover:scale-105 transition-transform">{kpis.otea}</h3>
                       </div>
                       <div className="p-3 bg-amber-100 text-amber-600 rounded-xl"><AlertTriangle size={24} /></div>
                   </div>
                   {/* KPI 3 */}
                   <div
                        onClick={() => handleKpiClick('LOGISTICA')}
                        className={`flex-1 p-6 flex items-center justify-between group transition-colors ${isKpiInteractive ? 'cursor-pointer hover:bg-slate-50' : ''} ${activeKpi==='LOGISTICA' && isKpiInteractive ? 'bg-slate-100' : ''}`}
                   >
                       <div>
                           <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Logística</p>
                           <h3 className="text-3xl font-black text-slate-600 group-hover:scale-105 transition-transform">{kpis.logistica}</h3>
                       </div>
                       <div className="p-3 bg-slate-100 text-slate-500 rounded-xl"><CheckCircle2 size={24} /></div>
                   </div>
                </div>
             </div>

             {/* TARJETA CRÍTICA */}
             <div
                onClick={() => handleKpiClick('CONTINGENCIA')}
                className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col cursor-pointer hover:shadow-md transition-all group ${activeKpi==='CONTINGENCIA' && isKpiInteractive ? 'ring-2 ring-red-400' : ''}`}
             >
                <div className="bg-red-50 px-5 py-3 border-b border-red-100 flex items-center gap-2">
                    <AlertOctagon size={16} className="text-red-600" />
                    <span className="text-xs font-bold text-red-700 uppercase tracking-widest">Estado Crítico</span>
                </div>
                <div className="p-6 flex flex-col justify-center h-full">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-4xl font-black text-red-600 group-hover:scale-110 transition-transform">{kpis.contingencias}</h3>
                            <p className="text-xs font-bold text-red-400 mt-1">Locales Afectados</p>
                        </div>
                        <div className="p-3 bg-red-100 text-red-600 rounded-full animate-pulse"><AlertTriangle size={28} /></div>
                    </div>
                </div>
             </div>
          </div>
      )}

      {/* --- VISTA: REGISTROS (TABLA) --- */}
      {dashTab === 'REGISTROS' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in mt-6">
              <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          <tr><th className="px-6 py-4 w-24 text-center">Acción</th><th className="px-6 py-4">Fecha</th><th className="px-6 py-4">Local</th><th className="px-6 py-4">SG</th><th className="px-6 py-4">Motivo</th><th className="px-6 py-4">KPI</th><th className="px-6 py-4">Observación</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {registrosPaginados.length === 0 ? (<tr><td colSpan="7" className="p-10 text-center text-slate-400">No se encontraron registros.</td></tr>) : (
                              registrosPaginados.map(item => (
                                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-6 py-3 text-center"><button onClick={() => handleEditClick(item)} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-[#1e3c72] hover:border-[#1e3c72] transition-colors"><Edit size={14}/></button></td>
                                      <td className="px-6 py-3 font-mono text-slate-500">{item.fecha}</td>
                                      <td className="px-6 py-3 font-bold text-[#1e3c72]">{item.local}</td>
                                      <td className="px-6 py-3 font-mono font-medium text-slate-700">{item.sg || '-'}</td>
                                      <td className="px-6 py-3 text-slate-700">{item.motivo}</td>
                                      <td className="px-6 py-3"><KpiBadge tipo={item.kpi} /></td>
                                      <td className="px-6 py-3 text-slate-400 italic text-xs max-w-xs truncate">{item.observacion}</td>
                                  </tr>
                              ))
                          )}
                      </tbody>
                  </table>
              </div>
              {totalPaginasRegistros > 1 && (
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400">Página {paginaActual} de {totalPaginasRegistros}</span>
                      <div className="flex gap-2">
                          <button disabled={paginaActual===1} onClick={()=>setPaginaActual(p=>p-1)} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-50"><ChevronLeft size={16}/></button>
                          <button disabled={paginaActual===totalPaginasRegistros} onClick={()=>setPaginaActual(p=>p+1)} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-50"><ChevronRight size={16}/></button>
                      </div>
                  </div>
              )}
          </div>
      )}

      {/* --- VISTA: DIARIA (GRID LOCALES) --- */}
      {dashTab === 'DIARIA' && (
        <div className="space-y-4 mt-6">
          <div className="flex justify-between items-end px-1">
              <h3 className="text-[#1e3c72] font-bold text-sm uppercase tracking-wide flex items-center gap-2"><Activity size={16}/> Monitoreo en Tiempo Real</h3>
              <span className="text-[10px] text-slate-400 font-medium bg-white px-2 py-1 rounded border border-slate-200">Pag {paginaActual}</span>
          </div>
          {localesParaMostrar.length === 0 ? (
              <div className="bg-white p-10 rounded-xl border border-dashed border-slate-300 text-center text-slate-400">
                  <CheckCircle2 size={40} className="mx-auto mb-2 text-emerald-200" />
                  <p className="font-medium">Sin incidencias registradas para este filtro.</p>
              </div>
          ) : (
              localesParaMostrar.slice((paginaActual - 1) * ITEMS_POR_PAGINA, ((paginaActual - 1) * ITEMS_POR_PAGINA) + ITEMS_POR_PAGINA).map((loc, idx) => (
                  <div key={idx} className={`bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between transition-all hover:shadow-md ${loc.critico > 0 ? 'border-l-4 border-l-red-500' : loc.warn > 0 ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-slate-300'}`}>
                    <div className="flex-1">
                        <h4 className="font-black text-slate-800 text-base mb-1">{loc.nombre}</h4>
                        <div className="flex flex-wrap items-center gap-3">
                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${loc.critico > 0 ? 'bg-red-50 text-red-700 border-red-200' : loc.warn > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                {loc.critico > 0 ? 'CONTINGENCIA' : loc.warn > 0 ? 'RIESGO OTEA' : 'OPERATIVO'}
                            </span>
                            <p className="text-xs text-slate-500 font-medium truncate max-w-md flex items-center gap-1">
                                Último: <span className="font-bold text-slate-700">{loc.ultimoMotivo}</span>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <span className="block text-2xl font-black text-slate-700 leading-none">{loc.total}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Eventos</span>
                        </div>
                        <button onClick={() => abrirModalDetalle(loc)} className="bg-slate-50 hover:bg-[#1e3c72] text-[#1e3c72] hover:text-white border border-slate-200 hover:border-[#1e3c72] p-2 rounded-lg transition-all">
                            <Eye size={18} />
                        </button>
                    </div>
                  </div>
              ))
          )}
          {Math.ceil(localesParaMostrar.length / ITEMS_POR_PAGINA) > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                  <button disabled={paginaActual===1} onClick={()=>setPaginaActual(p=>p-1)} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-[#1e3c72] disabled:opacity-50 transition-colors"><ChevronLeft size={20}/></button>
                  <button disabled={paginaActual===Math.ceil(localesParaMostrar.length / ITEMS_POR_PAGINA)} onClick={()=>setPaginaActual(p=>p+1)} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-[#1e3c72] disabled:opacity-50 transition-colors"><ChevronRight size={20}/></button>
              </div>
          )}
        </div>
      )}

      {/* --- VISTAS: SEMANAL Y MENSUAL (CHARTS) --- */}
      {dashTab === 'SEMANAL' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
                    <BarChart3 className="text-[#1e3c72]" size={18} />
                    <h5 className="font-bold text-slate-700 text-sm uppercase">Top 5 Motivos (Pareto)</h5>
                </div>
                <div className="h-64"><Bar data={chartPareto} options={{ indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { stepSize: 1, precision: 0 } } } }} /></div>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
                    <PieChart className="text-[#1e3c72]" size={18} />
                    <h5 className="font-bold text-slate-700 text-sm uppercase">Distribución de Impacto</h5>
                </div>
                <div className="flex-1 flex justify-center items-center">
                    <div className="w-64 h-64"><Doughnut data={{ labels: ['Contingencia', 'OTEA', 'Normal'], datasets: [{ data: [kpis.contingencias, kpis.otea, kpis.logistica], backgroundColor: ['#ef4444', '#f59e0b', '#e2e8f0'], borderWidth: 0 }] }} options={{ maintainAspectRatio: false }} /></div>
                </div>
            </div>
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200"><h6 className="font-bold text-slate-700 text-xs uppercase flex items-center gap-2"><TrendingUp size={14}/> Ranking Semanal de Salas</h6></div>
                <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-white text-slate-400 text-xs uppercase font-bold border-b border-slate-100"><tr><th className="px-6 py-3">#</th><th className="px-6 py-3">Local</th><th className="px-6 py-3 text-center">Total Eventos</th><th className="px-6 py-3 text-center">Detalle</th></tr></thead><tbody>{estadoLocales.slice(0, 10).map((loc, idx) => (<tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50"><td className="px-6 py-3 font-bold text-slate-300">{idx+1}</td><td className="px-6 py-3 font-bold text-[#1e3c72]">{loc.nombre}</td><td className="px-6 py-3 text-center font-black text-slate-700">{loc.total}</td><td className="px-6 py-3 text-center"><button onClick={() => abrirModalDetalle(loc)} className="text-blue-600 hover:text-blue-800 font-bold text-xs hover:underline">Ver ficha</button></td></tr>))}</tbody></table></div>
            </div>
        </div>
      )}

      {dashTab === 'MENSUAL' && (
        <div className="space-y-6 mt-6">
            {chartMonthlyLine && (
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-4"><TrendingUp className="text-[#1e3c72]" size={18} /><h5 className="font-bold text-slate-700 text-sm uppercase">Evolución Diaria del Mes</h5></div>
                    <div className="h-64"><Line data={chartMonthlyLine} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } }} /></div>
                </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-4"><BarChart3 className="text-[#1e3c72]" size={18} /><h5 className="font-bold text-slate-700 text-sm uppercase">Comparativa por Servicio</h5></div>
                    {chartServiceBar && <div className="h-64"><Bar data={chartServiceBar} options={{ indexAxis: 'x', maintainAspectRatio: false, plugins: { legend: { display: false } } }} /></div>}
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="bg-slate-50 px-5 py-3 border-b border-slate-200"><h6 className="font-bold text-slate-700 text-xs uppercase flex items-center gap-2"><AlertOctagon size={14} className="text-red-500"/> Locales Crónicos (Top 10)</h6></div>
                    <div className="flex-1 overflow-auto"><table className="w-full text-sm text-left"><thead className="bg-white text-slate-400 text-xs uppercase font-bold border-b border-slate-100"><tr><th className="px-6 py-3">Local</th><th className="px-6 py-3 text-center text-red-500">Contingencias</th><th className="px-6 py-3 text-center">Total</th></tr></thead><tbody>{estadoLocales.slice(0, 10).map((loc, idx) => (<tr key={idx} className="border-b border-slate-50 hover:bg-slate-50"><td className="px-6 py-3 font-bold text-[#1e3c72]">{loc.nombre}</td><td className="px-6 py-3 text-center font-bold text-red-600 bg-red-50">{loc.critico}</td><td className="px-6 py-3 text-center font-bold text-slate-700">{loc.total}</td></tr>))}</tbody></table></div>
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL DETALLE --- */}
      {modalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
                  <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
                      <div>
                          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Search size={18}/> Detalle de Incidencias</h3>
                          <p className="text-xs text-[#1e3c72] font-bold uppercase tracking-wide mt-0.5">{modalData.titulo}</p>
                      </div>
                      <button onClick={() => setModalOpen(false)} className="bg-white p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 transition-colors"><X size={20}/></button>
                  </div>
                  <div className="overflow-y-auto p-0">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-white text-slate-400 text-xs uppercase font-bold border-b border-slate-100 sticky top-0 shadow-sm"><tr><th className="px-6 py-3">Fecha</th><th className="px-6 py-3">SG</th><th className="px-6 py-3">Motivo</th><th className="px-6 py-3">KPI</th><th className="px-6 py-3">Observación</th></tr></thead>
                          <tbody className="divide-y divide-slate-50">
                              {modalData.lista.map((inc, i) => (
                                  <tr key={i} className="hover:bg-slate-50">
                                      <td className="px-6 py-3 font-mono text-slate-500 text-xs">{inc.fecha}</td>
                                      <td className="px-6 py-3 font-mono font-bold text-[#1e3c72] text-xs">{inc.sg || '-'}</td>
                                      <td className="px-6 py-3 font-medium text-slate-700">{inc.motivo}</td>
                                      <td className="px-6 py-3"><KpiBadge tipo={inc.kpi} /></td>
                                      <td className="px-6 py-3 text-slate-500 italic text-xs">{inc.observacion}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* --- MODAL EDICIÓN --- */}
      {editModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2"><Edit size={18} className="text-[#d63384]" /> Editar Registro</h3>
                      <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-slate-800"><X size={20}/></button>
                  </div>
                  <div className="p-6">
                      <form onSubmit={handleUpdate} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                              <div><label className="text-xs font-bold text-slate-500 block mb-1">FECHA</label><input type="date" name="fecha" value={editForm.fecha || ''} onChange={handleEditChange} className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1e3c72] outline-none" /></div>
                              <div><label className="text-xs font-bold text-slate-500 block mb-1">SG</label><input type="number" name="sg" value={editForm.sg || ''} onChange={handleEditChange} className="w-full border border-slate-300 rounded-lg p-2 text-sm font-mono focus:ring-2 focus:ring-[#1e3c72] outline-none" /></div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div><label className="text-xs font-bold text-slate-500 block mb-1">SERVICIO</label><select name="servicio" value={editForm.servicio || ''} onChange={handleEditChange} className="w-full border border-slate-300 rounded-lg p-2 text-sm"><option value="LAT">LAT</option><option value="HD">HD</option><option value="SBA">SBA</option><option value="CM">CM</option></select></div>
                              <div><label className="text-xs font-bold text-slate-500 block mb-1">LOCAL</label><select name="local" value={editForm.local || ''} onChange={handleEditChange} className="w-full border border-slate-300 rounded-lg p-2 text-sm"><option value="">Seleccione...</option>{localesPorServicio[editForm.servicio]?.map((l, i) => <option key={i} value={l}>{l}</option>)}</select></div>
                          </div>
                          <div>
                              <label className="text-xs font-bold text-slate-500 block mb-1">CLASIFICACIÓN</label>
                              <div className="space-y-2">
                                  <select name="grupo" value={editForm.grupo || ''} onChange={handleEditChange} className="w-full border border-slate-300 rounded-lg p-2 text-sm font-bold text-slate-700"><option value="">Grupo...</option>{Object.keys(motivosPorGrupo).map(g => <option key={g} value={g}>{g}</option>)}</select>
                                  <select name="motivo" value={editForm.motivo || ''} onChange={handleEditChange} className="w-full border border-slate-300 rounded-lg p-2 text-sm font-bold text-[#1e3c72]" disabled={!editForm.grupo}><option value="">Motivo...</option>{motivosPorGrupo[editForm.grupo]?.map((m, i) => <option key={i} value={m}>{m}</option>)}</select>
                              </div>
                          </div>
                          <div><label className="text-xs font-bold text-slate-500 block mb-1">OBSERVACIÓN</label><textarea name="observacion" rows="3" value={editForm.observacion || ''} onChange={handleEditChange} className="w-full border border-slate-300 rounded-lg p-2 text-sm resize-none uppercase focus:ring-2 focus:ring-[#1e3c72] outline-none"></textarea></div>
                          <div className="flex gap-3 pt-2">
                              <button type="button" onClick={() => setEditModalOpen(false)} className="flex-1 py-2.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg text-xs hover:bg-slate-50">CANCELAR</button>
                              <button type="submit" className="flex-1 py-2.5 bg-[#1e3c72] text-white font-bold rounded-lg text-xs hover:bg-[#152a50] shadow-md flex justify-center items-center gap-2"><Save size={14}/> GUARDAR CAMBIOS</button>
                          </div>
                      </form>
                  </div>
              </div>
          </div>
      )}
    </div>
  )
}