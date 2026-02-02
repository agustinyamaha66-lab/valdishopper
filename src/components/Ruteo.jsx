import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Circle, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import * as XLSX from 'xlsx'
import 'leaflet/dist/leaflet.css'
import {
  UploadCloud,
  Map as MapIcon,
  Truck,
  Settings,
  Navigation,
  FileSpreadsheet,
  Trash2,
  MousePointer2,
  Layers,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronDown,
  RefreshCw,
  MoreVertical,
  LogOut
} from 'lucide-react'

// --- 1. CONFIGURACIÓN Y UTILIDADES ---
const COORD_LOC = {
  "58": { lat: -33.0076, lng: -71.5448 }, "94": { lat: -39.8285, lng: -73.2305 },
  "98": { lat: -36.8282, lng: -73.0614 }, "99": { lat: -41.4646, lng: -72.9642 },
  "120": { lat: -38.7396, lng: -72.6371 }, "121": { lat: -53.1366, lng: -70.9142 },
  "606": { lat: -36.9952, lng: -73.1619 }, "608": { lat: -36.6111, lng: -72.1023 },
  "618": { lat: -40.5843, lng: -73.1098 }, "657": { lat: -42.4728, lng: -73.7645 },
  "697": { lat: -34.5822, lng: -70.9904 }, "983": { lat: -32.7877, lng: -71.2140 }
}

const COLORES_RUTAS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']
const COLOR_LAT = "#64748b" // Slate-500

// Iconos Leaflet
const storeIcon = new L.DivIcon({
  className: '',
  html: `<div style="background-color:#1e3c72; width:36px; height:36px; border-radius:50%; border:3px solid white; box-shadow:0 4px 6px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:white; font-size:18px;">🏢</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18]
})

const createNumberIcon = (num, color, selected, dimmed) => {
  return new L.DivIcon({
    className: '',
    html: `<div style="background-color:${color}; width:28px; height:28px; border-radius:50%; border:${selected ? '3px solid #1e3c72' : '2px solid white'}; box-shadow:0 2px 4px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-family:sans-serif; font-size:12px; transform: ${selected ? 'scale(1.25)' : 'scale(1)'}; opacity: ${dimmed ? 0.3 : 1}; transition: all 0.2s;">${num}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  })
}

const formatDuration = (minutes) => {
  if (!minutes && minutes !== 0) return '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}

// --- 2. COMPONENTES VISUALES ---

const ToastNotification = ({ notification, onClose }) => {
    if (!notification.visible) return null;
    const config = {
        success: { bg: 'bg-emerald-50', border: 'border-emerald-500', text: 'text-emerald-800', icon: CheckCircle2 },
        error: { bg: 'bg-rose-50', border: 'border-rose-500', text: 'text-rose-800', icon: AlertTriangle },
        warning: { bg: 'bg-amber-50', border: 'border-amber-500', text: 'text-amber-800', icon: AlertTriangle },
        info: { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-800', icon: Navigation }
    };
    const style = config[notification.type] || config.info;
    const Icon = style.icon;

    return (
        <div className={`fixed top-24 right-6 z-[9999] flex items-center gap-3 px-5 py-4 rounded-xl shadow-xl border-l-4 transition-all duration-300 transform translate-y-0 opacity-100 ${style.bg} ${style.border} ${style.text} min-w-[320px] animate-in slide-in-from-right`}>
            <Icon size={24} />
            <div className="flex-1">
                <p className="font-bold text-xs uppercase tracking-wider opacity-80">{notification.type}</p>
                <p className="font-medium text-sm leading-tight">{notification.message}</p>
            </div>
            <button onClick={onClose} className="opacity-50 hover:opacity-100"><X size={18}/></button>
        </div>
    );
};

const ConfirmModal = ({ isOpen, onCancel, onConfirm, title, message }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-slate-900/60 z-[9999] flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm border border-slate-200">
                <div className="flex justify-center mb-4 text-rose-500"><AlertTriangle size={48} /></div>
                <h3 className="text-xl font-bold text-slate-800 text-center mb-2">{title}</h3>
                <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">{message}</p>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-sm transition-colors">Cancelar</button>
                    <button onClick={onConfirm} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-sm shadow-md transition-colors">Confirmar</button>
                </div>
            </div>
        </div>
    )
}

function MapFocusHandler({ rutasDestacadas, rutasReales, pedidos }) {
  const map = useMap()
  useEffect(() => {
    if (!map) return;
    let bounds = L.latLngBounds([])
    let hasPoints = false
    if (rutasDestacadas.size > 0) {
       rutasDestacadas.forEach(r => { if(rutasReales[r]?.positions?.length) { bounds.extend(rutasReales[r].positions); hasPoints = true } })
    } else if (Object.keys(rutasReales).length > 0) {
        Object.values(rutasReales).forEach(r => { if (r.positions?.length) { bounds.extend(r.positions); hasPoints = true; } });
    } else if (pedidos.length > 0) {
        pedidos.forEach(p => { bounds.extend([p.lat, p.lng]); hasPoints = true; });
    }
    if(hasPoints && bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], animate: true, maxZoom: 15 })
  }, [rutasDestacadas, rutasReales, pedidos, map])
  return null
}

function CircleSelector({ active, onCircleComplete }) {
    const [center, setCenter] = useState(null)
    const [radius, setRadius] = useState(0)
    const [isDragging, setIsDragging] = useState(false)
    const map = useMap()

    useMapEvents({
        mousedown(e) {
            if (!active) return;
            map.dragging.disable();
            setCenter(e.latlng);
            setRadius(0);
            setIsDragging(true);
        },
        mousemove(e) {
            if (!active || !isDragging || !center) return;
            const currentDist = map.distance(center, e.latlng);
            setRadius(currentDist);
        },
        mouseup() {
            if (!active || !isDragging) return;
            setIsDragging(false);
            map.dragging.enable();
            if (center && radius > 0) {
                onCircleComplete(center, radius);
                setCenter(null);
                setRadius(0);
            }
        }
    })
    if (center && radius > 0) return <Circle center={center} radius={radius} pathOptions={{ color: '#d63384', fillColor: '#d63384', fillOpacity: 0.2, weight: 2, dashArray: '6, 6' }} />
    return null;
}

function BlockSelector({ config, setConfig, mapaConteos }) {
    const [abierto, setAbierto] = useState(false)
    const bloquesDisponibles = config.local && mapaConteos[config.local] ? Object.keys(mapaConteos[config.local]).sort() : []
    const ref = useRef(null)

    useEffect(() => {
        function handleClickOutside(event) { if (ref.current && !ref.current.contains(event.target)) setAbierto(false) }
        document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ref]);

    const toggleBloque = (bloque) => {
        let nuevos = [...config.horasSeleccionadas]
        if (nuevos.includes(bloque)) nuevos = nuevos.filter(b => b !== bloque)
        else nuevos.push(bloque)
        setConfig({ ...config, horasSeleccionadas: nuevos })
    }

    const toggleTodos = () => {
        if (config.horasSeleccionadas.length === bloquesDisponibles.length) setConfig({ ...config, horasSeleccionadas: [] })
        else setConfig({ ...config, horasSeleccionadas: bloquesDisponibles })
    }

    return (
        <div className="relative mb-3" ref={ref}>
            <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wide">Bloques Horarios</label>
            <button onClick={() => setAbierto(!abierto)} className="w-full bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-lg p-2.5 text-xs font-medium text-left flex justify-between items-center text-slate-200 transition-colors shadow-sm">
                <span className="truncate">{config.horasSeleccionadas.length > 0 ? `${config.horasSeleccionadas.length} Bloques Seleccionados` : 'Seleccionar Bloques...'}</span>
                <ChevronDown size={14} className={`transition-transform ${abierto ? 'rotate-180' : ''}`} />
            </button>

            {abierto && (
                <div className="absolute top-full left-0 right-0 bg-white text-slate-700 shadow-2xl rounded-xl z-50 mt-2 border border-slate-200 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                    {bloquesDisponibles.length > 0 ? (
                        <div className="p-1">
                            <div onClick={toggleTodos} className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded-lg cursor-pointer border-b border-slate-100 mb-1 sticky top-0 bg-white z-10">
                                <input type="checkbox" checked={config.horasSeleccionadas.length === bloquesDisponibles.length && bloquesDisponibles.length > 0} readOnly className="rounded text-[#d63384] focus:ring-[#d63384]" />
                                <span className="text-xs font-black text-[#1e3c72] uppercase">Seleccionar Todos</span>
                            </div>
                            {bloquesDisponibles.map(bloque => (
                                <div key={bloque} onClick={() => toggleBloque(bloque)} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                                    <input type="checkbox" checked={config.horasSeleccionadas.includes(bloque)} readOnly className="rounded text-blue-600 focus:ring-blue-500" />
                                    <span className="text-xs font-medium text-slate-600">{bloque} <span className="text-slate-400 text-[10px] ml-1">({mapaConteos[config.local][bloque]} ped)</span></span>
                                </div>
                            ))}
                        </div>
                    ) : <div className="p-4 text-xs text-slate-400 text-center italic">Selecciona un local primero</div>}
                </div>
            )}
        </div>
    )
}

function InvalidateSize() {
  const map = useMap();
  useEffect(() => { setTimeout(() => { map.invalidateSize(); }, 250); }, [map]);
  return null;
}

// --- 4. RUTEADOR PRINCIPAL ---
export default function Ruteo() {
  const [rawData, setRawData] = useState(() => JSON.parse(localStorage.getItem('ruteo_rawData')) || [])
  const [localesDisponibles, setLocalesDisponibles] = useState(() => JSON.parse(localStorage.getItem('ruteo_locales')) || [])
  const [mapaConteos, setMapaConteos] = useState(() => JSON.parse(localStorage.getItem('ruteo_conteos')) || {})
  const [config, setConfig] = useState(() => JSON.parse(localStorage.getItem('ruteo_config')) || { local: '', horasSeleccionadas: [], moviles: 3 })
  const [pedidos, setPedidos] = useState(() => JSON.parse(localStorage.getItem('ruteo_pedidos')) || [])
  const [rutasReales, setRutasReales] = useState(() => JSON.parse(localStorage.getItem('ruteo_rutasReales')) || {})
  const [mapCenter, setMapCenter] = useState(() => JSON.parse(localStorage.getItem('ruteo_mapCenter')) || [-33.45, -70.66])

  // UI
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [mostrarLineas, setMostrarLineas] = useState(true)
  const [calculandoRuta, setCalculandoRuta] = useState(false)
  const [rutasDestacadas, setRutasDestacadas] = useState(new Set())
  const [isCircleMode, setIsCircleMode] = useState(false)

  // Modals
  const [showModalRuta, setShowModalRuta] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [notification, setNotification] = useState({ visible: false, message: '', type: 'info' })

  const showToast = (message, type = 'info') => {
      setNotification({ visible: true, message, type });
      setTimeout(() => setNotification(prev => ({ ...prev, visible: false })), 4000);
  }

  // Persistencia
  useEffect(() => localStorage.setItem('ruteo_rawData', JSON.stringify(rawData)), [rawData])
  useEffect(() => localStorage.setItem('ruteo_locales', JSON.stringify(localesDisponibles)), [localesDisponibles])
  useEffect(() => localStorage.setItem('ruteo_conteos', JSON.stringify(mapaConteos)), [mapaConteos])
  useEffect(() => localStorage.setItem('ruteo_config', JSON.stringify(config)), [config])
  useEffect(() => localStorage.setItem('ruteo_pedidos', JSON.stringify(pedidos)), [pedidos])
  useEffect(() => localStorage.setItem('ruteo_rutasReales', JSON.stringify(rutasReales)), [rutasReales])
  useEffect(() => localStorage.setItem('ruteo_mapCenter', JSON.stringify(mapCenter)), [mapCenter])

  // --- LOGICA INTERNA (Sin cambios funcionales) ---
  const dispersarPuntos = (lista) => { const grupos = {}; lista.forEach(p => { const key = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`; if(!grupos[key]) grupos[key] = []; grupos[key].push(p); }); let listaDispersa = []; Object.values(grupos).forEach(grupo => { if (grupo.length === 1) { listaDispersa.push(grupo[0]); } else { const angleStep = (2 * Math.PI) / grupo.length; const radius = 0.0003; grupo.forEach((p, i) => { listaDispersa.push({ ...p, lat: p.lat + radius * Math.cos(i * angleStep), lng: p.lng + radius * Math.sin(i * angleStep) }); }); } }); return listaDispersa; }
  const calcularDistancia = (p1, p2) => Math.sqrt(Math.pow(p1.lat - p2.lat, 2) + Math.pow(p1.lng - p2.lng, 2));
  const optimizarRutaInterna = (puntos, origen) => { if (puntos.length === 0) return []; let pendientes = [...puntos]; let ordenados = []; let actual = origen; while (pendientes.length > 0) { let bestIdx = -1; let minDst = Infinity; for (let i = 0; i < pendientes.length; i++) { const d = calcularDistancia(actual, pendientes[i]); if (d < minDst) { minDst = d; bestIdx = i; } } const next = pendientes[bestIdx]; ordenados.push(next); actual = next; pendientes.splice(bestIdx, 1); } return ordenados; }
  const trazarRutasEstricto = async (listaPedidosOrdenada) => { if(!config.local) return; const suc = COORD_LOC[config.local]; if(!suc) return; setCalculandoRuta(true); const rutasUnicas = [...new Set(listaPedidosOrdenada.map(p => p.ruta))]; const infoRutas = { ...rutasReales }; for(const r of rutasUnicas) { const puntosRuta = listaPedidosOrdenada.filter(p => p.ruta === r).sort((a,b) => a.secuencia - b.secuencia); if(puntosRuta.length === 0) continue; const coordsURL = [`${suc.lng},${suc.lat}`]; puntosRuta.forEach(p => coordsURL.push(`${p.lng},${p.lat}`)); try { const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsURL.join(';')}?overview=full&geometries=geojson`); const json = await res.json(); if(json.code === 'Ok' && json.routes.length > 0) { const routeData = json.routes[0]; infoRutas[r] = { positions: routeData.geometry.coordinates.map(c => [c[1], c[0]]), km: (routeData.distance / 1000).toFixed(1), min: Math.round(routeData.duration / 60) }; } } catch (error) { console.error(error); } await new Promise(resolve => setTimeout(resolve, 250)); } setRutasReales(infoRutas); setPedidos(listaPedidosOrdenada); setCalculandoRuta(false); }
  const handleCircleComplete = (center, radiusMeters) => { const nuevosSeleccionados = new Set(); pedidos.forEach(p => { if (L.latLng(p.lat, p.lng).distanceTo(center) <= radiusMeters) nuevosSeleccionados.add(p.id); }); if (nuevosSeleccionados.size > 0) { setSelectedIds(nuevosSeleccionados); setIsCircleMode(false); setShowModalRuta(true); showToast(`¡${nuevosSeleccionados.size} pedidos seleccionados!`, 'success'); } else { showToast("Ningún pedido encontrado dentro del círculo.", "warning"); setIsCircleMode(false); } }
  const asignarRutaDesdeModal = async (rutaDestino) => { const rutaNum = rutaDestino === 'LAT' ? 'LAT' : parseInt(rutaDestino); const suc = COORD_LOC[config.local]; let nuevaLista = pedidos.map(p => selectedIds.has(p.id) ? { ...p, ruta: rutaNum } : p); let listaFinal = []; const rutasTodas = [...new Set(nuevaLista.map(p=>p.ruta))].sort(); rutasTodas.forEach(r => { const pts = nuevaLista.filter(p => p.ruta === r); if (r === rutaNum && r !== 'LAT') { const opt = optimizarRutaInterna(pts, suc); opt.forEach((p, i) => { p.secuencia = i + 1; listaFinal.push(p); }); } else { pts.sort((a,b) => a.secuencia - b.secuencia).forEach((p, i) => { p.secuencia = i + 1; listaFinal.push(p); }); } }); setPedidos(listaFinal); setSelectedIds(new Set()); setShowModalRuta(false); showToast("Pedidos movidos y ruta re-optimizada.", "success"); await trazarRutasEstricto(listaFinal); }
  const autoAsignarRutas = async () => { if(!config.local || config.horasSeleccionadas.length === 0) return showToast("Faltan datos: Selecciona Local y Bloques", "error"); const suc = COORD_LOC[config.local]; if(!suc) return showToast("Local sin coordenadas configuradas.", "error"); setMapCenter([suc.lat, suc.lng]); let lista = rawData.filter(row => { const rLoc = row["LOCAL"]?row["LOCAL"].toString().replace('L','').replace('.0','').trim():""; let rHora=(typeof row["TIEMPO MIN ENTREGA"]==='string')?(row["TIEMPO MIN ENTREGA"].includes(" ")?row["TIEMPO MIN ENTREGA"].split(" ")[1].substring(0,5):row["TIEMPO MIN ENTREGA"].substring(0,5)):"00:00"; return rLoc===config.local && config.horasSeleccionadas.includes(rHora); }).map((r, i) => { let eCom = r["COMUNA"]||r["COMUNA CLIENTE"]; const rawDir = r["DIRECCION CLIENTE"]?.toString()||""; if (!eCom && rawDir.includes(',')) { const parts = rawDir.split(','); if (parts.length > 1) eCom = parts[parts.length - 1].trim(); } return { id: i, cliente: r["NOMBRE CLIENTE"], direccion: rawDir.split(',')[0].trim(), comuna: eCom||"", lat: parseFloat(r["LATITUD DIRECCION"]?.replace(',','.')), lng: parseFloat(r["LONGITUD DIRECCION"]?.replace(',','.')), bultos: r["DETALLE BULTOS"]?parseInt(r["DETALLE BULTOS"].toString().match(/Totales\s*(\d+)/i)?.[1]||0):0, sg: r["ORDEN"], ruta: 1, secuencia: 0, score: 0 } }).filter(p => !isNaN(p.lat)); lista = dispersarPuntos(lista); lista.forEach(p => { p.angulo = Math.atan2(p.lat - suc.lat, p.lng - suc.lng); const dist = Math.sqrt(Math.pow(p.lat - suc.lat, 2) + Math.pow(p.lng - suc.lng, 2)); p.score = p.bultos + (dist * 111 * 2); }); lista.sort((a, b) => a.angulo - b.angulo); let esfTotal = lista.reduce((s, p) => s + p.score, 0); let esfCam = esfTotal / config.moviles; let c = 1, crg = 0; lista.forEach(p => { if(crg + p.score > esfCam && c < config.moviles) { if(Math.abs((crg + p.score) - esfCam) > Math.abs(crg - esfCam) && crg > 0) { c++; crg = 0; } } p.ruta = c; crg += p.score; }); let lFin = []; const rIds = [...new Set(lista.map(p => p.ruta))]; rIds.forEach(r => { const pts = lista.filter(p => p.ruta === r); const opt = optimizarRutaInterna(pts, suc); opt.forEach((p, idx) => { p.secuencia = idx + 1; lFin.push(p); }); }); setPedidos(lFin); showToast(`Rutas calculadas para ${lFin.length} pedidos.`, "success"); await trazarRutasEstricto(lFin); }
  const procesarExcel = (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (evt) => { const wb = XLSX.read(evt.target.result, { type: 'binary' }); const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]); const cleanData = []; const conteos = {}; data.forEach(row => { const newRow = {}; Object.keys(row).forEach(k => newRow[k.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()] = row[k]); let hora = (typeof newRow["TIEMPO MIN ENTREGA"] === 'string') ? (newRow["TIEMPO MIN ENTREGA"].includes(" ") ? newRow["TIEMPO MIN ENTREGA"].split(" ")[1].substring(0,5) : newRow["TIEMPO MIN ENTREGA"].substring(0,5)) : "00:00"; if (!hora.endsWith(':15')) return; cleanData.push(newRow); let local = newRow["LOCAL"] ? newRow["LOCAL"].toString().replace('.0','').trim() : ""; const k = local.startsWith('L') ? local.replace('L','') : local; if(local) { if(!conteos[k]) conteos[k]={}; conteos[k][hora] = (conteos[k][hora] || 0) + 1; } }); setRawData(cleanData); setMapaConteos(conteos); setLocalesDisponibles(Object.keys(conteos).sort()); showToast(`Archivo cargado: ${cleanData.length} pedidos detectados (:15)`, "success"); }; reader.readAsBinaryString(file); }
  const descargarExcel = () => { if (pedidos.length === 0) return showToast("No hay datos para exportar.", "warning"); const totales = {}; pedidos.forEach(p => { if(!totales[p.ruta]) totales[p.ruta]=0; totales[p.ruta]+=p.bultos; }); const listaOrdenada = [...pedidos].sort((a,b) => { if(a.ruta === b.ruta) return a.secuencia - b.secuencia; if(a.ruta === 'LAT') return 1; if(b.ruta === 'LAT') return -1; return a.ruta - b.ruta; }); const data = listaOrdenada.map((p, i, arr) => { const isFirst = i === 0 || arr[i-1].ruta !== p.ruta; return { "Orden": p.secuencia, "SG": p.sg, "Cliente": p.cliente, "Dirección": p.direccion, "Comuna": p.comuna, "Ruta": p.ruta === "LAT" ? "LATERAL" : `RUTA ${p.ruta}`, "Total Bultos": isFirst ? totales[p.ruta] : "" } }); const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Hoja de Ruta"); XLSX.writeFile(wb, `Ruta_L${config.local}.xlsx`); showToast("Excel exportado exitosamente.", "success"); }
  const handleResetRequest = () => { setShowResetConfirm(true); }
  const confirmReset = () => { localStorage.removeItem('ruteo_rawData'); localStorage.removeItem('ruteo_locales'); localStorage.removeItem('ruteo_conteos'); localStorage.removeItem('ruteo_config'); localStorage.removeItem('ruteo_pedidos'); localStorage.removeItem('ruteo_rutasReales'); localStorage.removeItem('ruteo_mapCenter'); setRawData([]); setLocalesDisponibles([]); setMapaConteos({}); setConfig({ local: '', horasSeleccionadas: [], moviles: 3 }); setPedidos([]); setRutasReales({}); setMapCenter([-33.45, -70.66]); setSelectedIds(new Set()); setRutasDestacadas(new Set()); setShowResetConfirm(false); showToast("Datos limpiados. Listo para nueva carga.", "success"); }
  const cambiarRutaManual = async (id, nuevaRuta) => { const rutaNum = nuevaRuta === 'LAT' ? 'LAT' : parseInt(nuevaRuta); const suc = COORD_LOC[config.local]; let nuevaLista = pedidos.map(p => p.id === id ? { ...p, ruta: rutaNum } : p); let listaFinal = []; const rutasTodas = [...new Set(nuevaLista.map(p=>p.ruta))].sort(); rutasTodas.forEach(r => { const pts = nuevaLista.filter(p => p.ruta === r); if (r === rutaNum && r !== 'LAT') { const opt = optimizarRutaInterna(pts, suc); opt.forEach((p, i) => { p.secuencia = i + 1; listaFinal.push(p); }); } else { pts.sort((a,b) => a.secuencia - b.secuencia).forEach((p, i) => { p.secuencia = i + 1; listaFinal.push(p); }); } }); setPedidos(listaFinal); await trazarRutasEstricto(listaFinal); }
  const cambiarSecuenciaManual = async (id, nuevaSecuenciaStr) => { const nuevaSecuencia = parseInt(nuevaSecuenciaStr); const pedido = pedidos.find(p => p.id === id); if(!pedido) return; const ruta = pedido.ruta; if(pedido.secuencia === nuevaSecuencia) return; let puntosRuta = pedidos.filter(p => p.ruta === ruta).sort((a,b) => a.secuencia - b.secuencia); const movedPoint = puntosRuta.find(p => p.id === id); const otrosPuntos = puntosRuta.filter(p => p.id !== id); const insertIndex = nuevaSecuencia - 1; const previos = otrosPuntos.slice(0, insertIndex); const porReordenar = otrosPuntos.slice(insertIndex); const colaOptimizada = optimizarRutaInterna(porReordenar, movedPoint); const nuevaRutaFinal = [...previos, movedPoint, ...colaOptimizada]; nuevaRutaFinal.forEach((p, i) => p.secuencia = i + 1); let listaGlobal = pedidos.filter(p => p.ruta !== ruta); listaGlobal = [...listaGlobal, ...nuevaRutaFinal]; listaGlobal.sort((a,b) => { if (a.ruta !== b.ruta) return a.ruta - b.ruta; return a.secuencia - b.secuencia; }); setPedidos(listaGlobal); showToast("Ruta re-secuenciada y optimizada.", "info"); await trazarRutasEstricto(listaGlobal); }
  const toggleRutaDestacada = (r) => { const newSet = new Set(rutasDestacadas); if (newSet.has(r)) newSet.delete(r); else newSet.add(r); setRutasDestacadas(newSet); }
  const moverPedidosMasivo = async () => { if (selectedIds.size === 0) return showToast("Primero selecciona puntos en el mapa.", "warning"); const target = document.getElementById('rutaDestino').value; const rutaNum = target === 'LAT' ? 'LAT' : parseInt(target); const suc = COORD_LOC[config.local]; let nuevaLista = pedidos.map(p => selectedIds.has(p.id) ? { ...p, ruta: rutaNum } : p); let listaFinal = []; const rutasTodas = [...new Set(nuevaLista.map(p=>p.ruta))].sort(); rutasTodas.forEach(r => { const pts = nuevaLista.filter(p => p.ruta === r); if (r === rutaNum && r !== 'LAT') { const opt = optimizarRutaInterna(pts, suc); opt.forEach((p, i) => { p.secuencia = i + 1; listaFinal.push(p); }); } else { pts.sort((a,b) => a.secuencia - b.secuencia).forEach((p, i) => { p.secuencia = i + 1; listaFinal.push(p); }); } }); setPedidos(listaFinal); setSelectedIds(new Set()); showToast("Pedidos movidos exitosamente.", "success"); await trazarRutasEstricto(listaFinal); }

  return (
   <div className="flex w-full h-[calc(100vh-64px)] min-h-[600px] bg-slate-50 font-sans overflow-hidden relative">

      <ToastNotification notification={notification} onClose={() => setNotification({...notification, visible: false})} />
      <ConfirmModal isOpen={showResetConfirm} title="¿Reiniciar Estación?" message="Se eliminarán todos los datos cargados y la configuración actual. Esta acción no se puede deshacer." onCancel={() => setShowResetConfirm(false)} onConfirm={confirmReset} />

      {/* --- PANEL DE CONTROL (LEFT) --- */}
      <div className="w-80 bg-[#0f254a] text-slate-100 flex flex-col shadow-2xl z-20 h-full border-r border-slate-700/50">

        {/* Header Panel */}
        <div className="p-5 border-b border-slate-700/50 bg-[#0b1b36] flex justify-between items-center shrink-0">
            <div>
                <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                    <MapIcon size={20} className="text-[#d63384]" /> RUTEADOR
                </h1>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-0.5">Gestión Logística</p>
            </div>
            {rawData.length > 0 && (
                <button onClick={handleResetRequest} className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors" title="Limpiar todo">
                    <Trash2 size={16} />
                </button>
            )}
        </div>

        {/* Body Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">

            {/* 1. SECCIÓN IMPORTACIÓN */}
            {rawData.length === 0 ? (
                <div className="animate-fade-in">
                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-600 rounded-xl cursor-pointer hover:bg-slate-800/50 hover:border-[#d63384] transition-all group">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <UploadCloud className="w-10 h-10 mb-3 text-slate-400 group-hover:text-[#d63384] transition-colors" />
                            <p className="mb-2 text-sm text-slate-300 font-semibold">Cargar Planilla Excel</p>
                            <p className="text-xs text-slate-500">Arrastra o haz clic aquí</p>
                        </div>
                        <input type="file" accept=".xlsx,.xls" onChange={procesarExcel} className="hidden" />
                    </label>
                </div>
            ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-center gap-3 animate-fade-in">
                    <div className="bg-emerald-500 p-2 rounded-lg text-white"><FileSpreadsheet size={18} /></div>
                    <div>
                        <p className="text-xs font-bold text-emerald-400 uppercase">Datos Cargados</p>
                        <p className="text-xs text-slate-300">{rawData.length} pedidos detectados</p>
                    </div>
                </div>
            )}

            {/* 2. SECCIÓN CONFIGURACIÓN */}
            {rawData.length > 0 && (
                <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        <Settings size={12} /> Configuración
                    </div>

                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 space-y-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase">Local Origen</label>
                            <div className="relative">
                                <select
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs font-bold text-white focus:border-[#d63384] outline-none appearance-none"
                                    value={config.local}
                                    onChange={e => { setConfig({...config, local: e.target.value, horasSeleccionadas: []}); const c = COORD_LOC[e.target.value]; if(c) setMapCenter([c.lat, c.lng]); }}
                                >
                                    <option value="">Seleccione Local...</option>
                                    {localesDisponibles.map(l => <option key={l} value={l}>Local {l}</option>)}
                                </select>
                                <ChevronDown className="absolute right-3 top-3 text-slate-500 pointer-events-none" size={14} />
                            </div>
                        </div>

                        <BlockSelector config={config} setConfig={setConfig} mapaConteos={mapaConteos} />

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase">Flota Disponible</label>
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type="number"
                                        min="1"
                                        value={config.moviles}
                                        onChange={e => { const val=parseInt(e.target.value); setConfig({...config, moviles: (isNaN(val)||val<1)?1:val}) }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 pl-9 text-white font-bold text-sm focus:border-[#d63384] outline-none"
                                    />
                                    <Truck className="absolute left-3 top-2.5 text-slate-500" size={16} />
                                </div>
                                <button
                                    onClick={autoAsignarRutas}
                                    disabled={calculandoRuta}
                                    className="bg-[#d63384] hover:bg-pink-600 text-white font-bold py-2.5 px-4 rounded-lg text-xs shadow-lg disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2"
                                >
                                    {calculandoRuta ? <RefreshCw size={14} className="animate-spin" /> : <Navigation size={14} />}
                                    CALCULAR
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. SECCIÓN HERRAMIENTAS */}
            {pedidos.length > 0 && (
                <div className="space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                        <span className="flex items-center gap-2"><Layers size={12} /> Acciones</span>
                        <span onClick={() => trazarRutasEstricto(pedidos)} className="cursor-pointer text-blue-400 hover:text-white flex items-center gap-1"><RefreshCw size={10}/> Recalcular</span>
                    </div>

                    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 space-y-3">
                        <div className="flex gap-2">
                            <select id="rutaDestino" className="bg-slate-900 text-xs border border-slate-700 rounded-lg flex-1 h-9 px-2 font-bold text-white outline-none focus:border-blue-500">
                                <option value="LAT">Mover a LAT</option>
                                {[...Array(config.moviles)].map((_, i) => <option key={i+1} value={i+1}>Mover a RUTA {i+1}</option>)}
                            </select>
                            <button onClick={moverPedidosMasivo} className="bg-blue-600 hover:bg-blue-500 text-white px-3 rounded-lg text-xs font-bold h-9 shadow-md transition-colors whitespace-nowrap">
                                MOVER ({selectedIds.size})
                            </button>
                        </div>

                        <button
                            onClick={() => { setIsCircleMode(!isCircleMode); }}
                            className={`w-full font-bold py-2.5 rounded-lg text-xs shadow-sm border transition-all flex items-center justify-center gap-2 ${isCircleMode ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 hover:bg-rose-500/30' : 'bg-slate-700 text-slate-200 border-slate-600 hover:bg-slate-600 hover:text-white'}`}
                        >
                            {isCircleMode ? <X size={14} /> : <MousePointer2 size={14} />}
                            {isCircleMode ? 'CANCELAR SELECCIÓN' : 'SELECCIÓN CIRCULAR'}
                        </button>

                        <div
                            onClick={() => setMostrarLineas(!mostrarLineas)}
                            className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors select-none"
                        >
                            <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${mostrarLineas ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500 bg-transparent'}`}>
                                {mostrarLineas && <CheckCircle2 size={12} className="text-white" />}
                            </div>
                            <span className="text-xs font-medium text-slate-300">Mostrar trazado de calles</span>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Footer Panel */}
        <div className="p-4 bg-[#0b1b36] border-t border-slate-700/50 flex-shrink-0">
            <button
                onClick={descargarExcel}
                disabled={pedidos.length===0}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-xs shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
            >
                <FileSpreadsheet size={16} /> EXPORTAR HOJA DE RUTA
            </button>
        </div>
      </div>

      {/* --- MAPA (RIGHT) --- */}
      <div className="flex-1 relative h-full bg-slate-200 z-0">
        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false} className="z-0">
            <InvalidateSize />
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
            <MapFocusHandler rutasDestacadas={rutasDestacadas} rutasReales={rutasReales} pedidos={pedidos} />
            <CircleSelector active={isCircleMode} onCircleComplete={handleCircleComplete} />

            {/* Polylines */}
            {mostrarLineas && Object.keys(rutasReales).map(k => {
                const rId = parseInt(k); const r = rutasReales[k];
                const isSelected = rutasDestacadas.has(rId);
                const isAnythingSelected = rutasDestacadas.size > 0;
                const isVisible = !isAnythingSelected || isSelected;
                const opacity = isVisible ? (isSelected ? 1 : 0.6) : 0.1;
                const weight = isSelected ? 6 : 4;
                const color = k==='LAT' ? COLOR_LAT : COLORES_RUTAS[(rId-1)%COLORES_RUTAS.length];
                return <Polyline key={k} positions={r.positions} color={color} weight={weight} opacity={opacity} />
            })}

            {/* Marcador Tienda */}
            {config.local && COORD_LOC[config.local] && (
                <Marker position={[COORD_LOC[config.local].lat, COORD_LOC[config.local].lng]} icon={storeIcon}>
                    <Popup className="font-sans text-xs font-bold">📍 Centro de Distribución</Popup>
                </Marker>
            )}

            {/* Marcadores Pedidos */}
            {pedidos.map(p => {
                const color = p.ruta === 'LAT' ? COLOR_LAT : COLORES_RUTAS[(p.ruta-1)%COLORES_RUTAS.length];
                const isSel = selectedIds.has(p.id);
                const isAnythingSelected = rutasDestacadas.size > 0;
                const isVisible = !isAnythingSelected || rutasDestacadas.has(p.ruta);
                return (
                <Marker
                    key={p.id}
                    position={[p.lat, p.lng]}
                    icon={createNumberIcon(p.secuencia, color, isSel, !isVisible)}
                    eventHandlers={{ click: () => { const s = new Set(selectedIds); if(s.has(p.id)) s.delete(p.id); else s.add(p.id); setSelectedIds(s); } }}
                >
                    <Popup>
                        <div className="p-1 min-w-[180px] font-sans">
                            <div className="flex justify-between items-start border-b border-slate-100 pb-1 mb-2">
                                <strong className="text-xs font-bold text-slate-800 uppercase">{p.cliente}</strong>
                                <span className="text-[10px] font-mono text-slate-400">#{p.id}</span>
                            </div>
                            <div className="mb-3 space-y-0.5">
                                <p className="text-xs text-slate-600 leading-tight">{p.direccion}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{p.comuna}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                                    <label className="block text-[9px] font-bold text-slate-400 mb-0.5">RUTA</label>
                                    <select className="w-full bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-700 outline-none" value={p.ruta} onChange={(e) => cambiarRutaManual(p.id, e.target.value)}>
                                        <option value="LAT">LAT</option>
                                        {[...Array(config.moviles)].map((_,i)=><option key={i+1} value={i+1}>R{i+1}</option>)}
                                    </select>
                                </div>
                                <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                                    <label className="block text-[9px] font-bold text-slate-400 mb-0.5">ORDEN</label>
                                    <select className="w-full bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-700 outline-none" value={p.secuencia} onChange={(e) => cambiarSecuenciaManual(p.id, e.target.value)}>
                                        {[...Array(pedidos.filter(x => x.ruta === p.ruta).length)].map((_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="bg-blue-50 text-blue-700 px-2 py-1.5 rounded text-center font-bold text-xs border border-blue-100">
                                📦 {p.bultos} Bultos
                            </div>
                        </div>
                    </Popup>
                </Marker>
                )
            })}
        </MapContainer>

        {/* --- TARJETAS DE RUTA FLOTANTES (BOTTOM) --- */}
        <div className="absolute bottom-6 left-6 right-6 flex gap-4 overflow-x-auto z-[1000] pb-4 px-2 snap-x scrollbar-hide">
           {pedidos.length > 0 && [...Array(config.moviles)].map((_, i) => {
               const r = i+1; const pts = pedidos.filter(p => p.ruta === r); if(pts.length===0) return null;
               const info = rutasReales[r]; const isActive = rutasDestacadas.has(r);
               const color = COLORES_RUTAS[i % COLORES_RUTAS.length];
               return (
                 <div
                    key={r}
                    onClick={() => toggleRutaDestacada(r)}
                    className={`
                        flex flex-col min-w-[140px] bg-white/90 backdrop-blur-md rounded-xl p-3 shadow-lg cursor-pointer 
                        transition-all duration-200 border-b-4 snap-center select-none group
                        ${isActive ? 'ring-2 ring-offset-2 ring-slate-400 translate-y-[-4px] shadow-xl' : 'hover:translate-y-[-2px] hover:shadow-xl'}
                    `}
                    style={{ borderColor: color }}
                 >
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-black text-slate-700 uppercase tracking-wider">RUTA {r}</span>
                        {info ? (
                            <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">REAL</span>
                        ) : (
                            <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">EST</span>
                        )}
                    </div>

                    <div className="flex items-baseline gap-1 mb-1">
                        <span className="text-2xl font-black text-slate-800 leading-none">{info?.km || '-'}</span>
                        <span className="text-[10px] font-bold text-slate-400">km</span>
                    </div>

                    <div className="flex justify-between items-center text-xs font-medium text-slate-500 mb-2">
                        <span>{info ? formatDuration(info.min) : '-'}</span>
                    </div>

                    <div className={`flex justify-between items-center text-[10px] font-bold p-1.5 rounded-lg transition-colors ${isActive ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600'}`}>
                        <span className="flex items-center gap-1"><MapIcon size={10}/> {pts.length}</span>
                        <span className="flex items-center gap-1"><Truck size={10}/> {pts.reduce((s,x)=>s+x.bultos,0)}</span>
                    </div>
                 </div>
               )
           })}
        </div>
      </div>

      {/* --- MODAL FLOTANTE (MOVER PEDIDOS) --- */}
      {showModalRuta && (
          <div className="fixed inset-0 bg-slate-900/60 z-[9999] flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden">

                  {/* Modal Header */}
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div>
                          <h3 className="text-xl font-black text-[#1e3c72] flex items-center gap-2">
                              <MousePointer2 className="text-[#d63384]" /> Mover {selectedIds.size} Pedidos
                          </h3>
                          <p className="text-sm text-slate-500 mt-1">Selecciona la ruta de destino para los puntos seleccionados.</p>
                      </div>
                      <button onClick={() => setShowModalRuta(false)} className="bg-white p-2 rounded-full text-slate-400 hover:text-rose-500 shadow-sm border border-slate-200 transition-colors"><X size={20}/></button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-8 overflow-y-auto bg-slate-50/50">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                          {[...Array(config.moviles)].map((_, i) => (
                              <button
                                key={i+1}
                                onClick={() => asignarRutaDesdeModal(i+1)}
                                className="flex flex-col items-center justify-center py-6 bg-white border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 rounded-xl transition-all shadow-sm group"
                              >
                                  <span className="text-2xl font-black text-slate-300 group-hover:text-blue-500 mb-1">R{i+1}</span>
                                  <span className="text-xs font-bold text-slate-500 group-hover:text-blue-700 uppercase">Asignar</span>
                              </button>
                          ))}
                          <button
                            onClick={() => asignarRutaDesdeModal('LAT')}
                            className="flex flex-col items-center justify-center py-6 bg-slate-100 border-2 border-slate-200 hover:border-slate-400 hover:bg-slate-200 rounded-xl transition-all shadow-sm group col-span-2 sm:col-span-1"
                          >
                              <span className="text-xl font-black text-slate-400 group-hover:text-slate-600 mb-1">LAT</span>
                              <span className="text-xs font-bold text-slate-500 group-hover:text-slate-700 uppercase">A Lateral</span>
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  )
}