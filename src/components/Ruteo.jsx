import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Circle, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import * as XLSX from 'xlsx'
import 'leaflet/dist/leaflet.css'

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
const COLOR_LAT = "#6b7280"

// Iconos
const storeIcon = new L.DivIcon({
  className: '',
  html: `<div style="background-color:#d63384; width:30px; height:30px; border-radius:50%; border:3px solid white; box-shadow:0 2px 5px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:white; font-size:16px;">🏪</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
})

const createNumberIcon = (num, color, selected, dimmed) => {
  return new L.DivIcon({
    className: '',
    html: `<div style="background-color:${color}; width:24px; height:24px; border-radius:50%; border:${selected ? '3px solid #000' : '2px solid white'}; box-shadow:0 2px 4px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:11px; transform: ${selected ? 'scale(1.2)' : 'scale(1)'}; opacity: ${dimmed ? 0.2 : 1}; transition: all 0.2s;">${num}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  })
}

const formatDuration = (minutes) => {
  if (!minutes && minutes !== 0) return '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}

// --- 2. COMPONENTES VISUALES INTERNOS ---

// A. NOTIFICACIÓN TOAST
const ToastNotification = ({ notification, onClose }) => {
    if (!notification.visible) return null;

    const colors = {
        success: 'bg-green-100 border-green-500 text-green-800',
        error: 'bg-red-100 border-red-500 text-red-800',
        warning: 'bg-yellow-100 border-yellow-500 text-yellow-800',
        info: 'bg-blue-100 border-blue-500 text-blue-800'
    };

    const icons = { success: '✅', error: '⛔', warning: '⚠️', info: 'ℹ️' };

    return (
        <div className={`fixed top-20 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded shadow-xl border-l-4 transition-all duration-300 transform translate-y-0 opacity-100 ${colors[notification.type] || colors.info} min-w-[300px]`}>
            <span className="text-xl">{icons[notification.type]}</span>
            <div className="flex-1">
                <p className="font-bold text-xs uppercase tracking-wider">{notification.type}</p>
                <p className="font-medium text-sm">{notification.message}</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-black font-bold">×</button>
        </div>
    );
};

// B. MODAL DE CONFIRMACIÓN
const ConfirmModal = ({ isOpen, onCancel, onConfirm, title, message }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 z-[4000] flex items-center justify-center backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-sm border-t-8 border-red-500">
                <h3 className="text-xl font-black text-[#1e3c72] mb-2">{title}</h3>
                <p className="text-sm text-gray-600 mb-6">{message}</p>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded text-xs">CANCELAR</button>
                    <button onClick={onConfirm} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-xs shadow-lg">CONFIRMAR</button>
                </div>
            </div>
        </div>
    )
}
// C. MAP FOCUS MEJORADO (AUTO-ZOOM)
function MapFocusHandler({ rutasDestacadas, rutasReales, pedidos }) {
  const map = useMap()

  useEffect(() => {
    if (!map) return;

    let bounds = L.latLngBounds([])
    let hasPoints = false

    // CASO 1: Hay rutas destacadas manualmente
    if (rutasDestacadas.size > 0) {
       rutasDestacadas.forEach(r => {
           if(rutasReales[r]?.positions?.length) {
               bounds.extend(rutasReales[r].positions)
               hasPoints = true
           }
       })
    }
    // CASO 2: No hay destacadas, pero SÍ hay rutas calculadas (Zoom General)
    else if (Object.keys(rutasReales).length > 0) {
        Object.values(rutasReales).forEach(r => {
            if (r.positions?.length) {
                bounds.extend(r.positions);
                hasPoints = true;
            }
        });
    }
    // CASO 3: No hay rutas, pero hay pedidos (Zoom a los puntos)
    else if (pedidos.length > 0) {
        pedidos.forEach(p => {
            bounds.extend([p.lat, p.lng]);
            hasPoints = true;
        });
    }

    // APLICAR ZOOM
    if(hasPoints && bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], animate: true, maxZoom: 15 })
    }

  }, [rutasDestacadas, rutasReales, pedidos, map]) // Escucha cambios en Pedidos y Rutas

  return null
}
// D. CIRCLE SELECTOR
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

    if (center && radius > 0) {
        return <Circle center={center} radius={radius} pathOptions={{ color: '#d63384', fillColor: '#d63384', fillOpacity: 0.3, weight: 2, dashArray: '5, 5' }} />
    }
    return null;
}

// E. BLOCK SELECTOR
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
        <div className="relative mb-2" ref={ref}>
            <label className="text-[10px] font-bold text-gray-400 block mb-1">BLOQUES (Selección Múltiple)</label>
            <button onClick={() => setAbierto(!abierto)} className="w-full bg-[#0f254a] border border-blue-800 rounded p-2 text-xs font-bold text-left flex justify-between items-center text-white transition-colors hover:border-blue-600">
                <span className="truncate">{config.horasSeleccionadas.length > 0 ? `${config.horasSeleccionadas.length} Bloques Seleccionados` : 'Seleccionar Bloques...'}</span>
                <span>{abierto ? '▲' : '▼'}</span>
            </button>

            {abierto && (
                <div className="absolute top-full left-0 right-0 bg-white text-gray-800 shadow-xl rounded z-50 mt-1 border border-gray-200 max-h-60 overflow-y-auto animate-fade-in-up">
                    {bloquesDisponibles.length > 0 ? (
                        <div className="p-2 space-y-1">
                            <div onClick={toggleTodos} className="flex items-center gap-2 p-1.5 hover:bg-gray-100 rounded cursor-pointer border-b border-gray-100 pb-2 mb-1 sticky top-0 bg-white z-10">
                                <input type="checkbox" checked={config.horasSeleccionadas.length === bloquesDisponibles.length && bloquesDisponibles.length > 0} readOnly className="rounded text-[#d63384] focus:ring-[#d63384]" />
                                <span className="text-xs font-black text-[#1e3c72]">MARCAR TODOS</span>
                            </div>
                            {bloquesDisponibles.map(bloque => (
                                <div key={bloque} onClick={() => toggleBloque(bloque)} className="flex items-center gap-2 p-1.5 hover:bg-blue-50 rounded cursor-pointer transition-colors">
                                    <input type="checkbox" checked={config.horasSeleccionadas.includes(bloque)} readOnly className="rounded text-blue-600 focus:ring-blue-500" />
                                    <span className="text-xs font-medium">{bloque} <span className="text-gray-400 text-[10px] ml-1">({mapaConteos[config.local][bloque]} ped)</span></span>
                                </div>
                            ))}
                        </div>
                    ) : <div className="p-3 text-xs text-gray-400 text-center">Primero seleccione un Local</div>}
                </div>
            )}
        </div>
    )
}


function InvalidateSize() {
  const map = useMap();

  useEffect(() => {
    // le damos un pequeño tiempo a React para que aplique tamaños
    const t = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => clearTimeout(t);
  }, [map]);

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

  // Sistema de Notificaciones
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

  // --- LOGICA INTERNA ---
  const dispersarPuntos = (lista) => { const grupos = {}; lista.forEach(p => { const key = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`; if(!grupos[key]) grupos[key] = []; grupos[key].push(p); }); let listaDispersa = []; Object.values(grupos).forEach(grupo => { if (grupo.length === 1) { listaDispersa.push(grupo[0]); } else { const angleStep = (2 * Math.PI) / grupo.length; const radius = 0.0003; grupo.forEach((p, i) => { listaDispersa.push({ ...p, lat: p.lat + radius * Math.cos(i * angleStep), lng: p.lng + radius * Math.sin(i * angleStep) }); }); } }); return listaDispersa; }

  const calcularDistancia = (p1, p2) => Math.sqrt(Math.pow(p1.lat - p2.lat, 2) + Math.pow(p1.lng - p2.lng, 2));

  const optimizarRutaInterna = (puntos, origen) => {
      if (puntos.length === 0) return [];
      let pendientes = [...puntos];
      let ordenados = [];
      let actual = origen;
      while (pendientes.length > 0) {
          let bestIdx = -1;
          let minDst = Infinity;
          for (let i = 0; i < pendientes.length; i++) {
              const d = calcularDistancia(actual, pendientes[i]);
              if (d < minDst) { minDst = d; bestIdx = i; }
          }
          const next = pendientes[bestIdx];
          ordenados.push(next);
          actual = next;
          pendientes.splice(bestIdx, 1);
      }
      return ordenados;
  }

  const trazarRutasEstricto = async (listaPedidosOrdenada) => {
    if(!config.local) return; const suc = COORD_LOC[config.local]; if(!suc) return;
    setCalculandoRuta(true); const rutasUnicas = [...new Set(listaPedidosOrdenada.map(p => p.ruta))]; const infoRutas = { ...rutasReales };
    for(const r of rutasUnicas) {
        const puntosRuta = listaPedidosOrdenada.filter(p => p.ruta === r).sort((a,b) => a.secuencia - b.secuencia); if(puntosRuta.length === 0) continue;
        const coordsURL = [`${suc.lng},${suc.lat}`]; puntosRuta.forEach(p => coordsURL.push(`${p.lng},${p.lat}`));
        try { const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsURL.join(';')}?overview=full&geometries=geojson`); const json = await res.json();
            if(json.code === 'Ok' && json.routes.length > 0) { const routeData = json.routes[0]; infoRutas[r] = { positions: routeData.geometry.coordinates.map(c => [c[1], c[0]]), km: (routeData.distance / 1000).toFixed(1), min: Math.round(routeData.duration / 60) }; }
        } catch (error) { console.error(error); } await new Promise(resolve => setTimeout(resolve, 250));
    }
    setRutasReales(infoRutas); setPedidos(listaPedidosOrdenada); setCalculandoRuta(false);
  }

  const handleCircleComplete = (center, radiusMeters) => {
      const nuevosSeleccionados = new Set();
      pedidos.forEach(p => { if (L.latLng(p.lat, p.lng).distanceTo(center) <= radiusMeters) nuevosSeleccionados.add(p.id); });
      if (nuevosSeleccionados.size > 0) {
          setSelectedIds(nuevosSeleccionados);
          setIsCircleMode(false);
          setShowModalRuta(true);
          showToast(`¡${nuevosSeleccionados.size} pedidos seleccionados!`, 'success');
      }
      else {
          showToast("Ningún pedido encontrado dentro del círculo.", "warning");
          setIsCircleMode(false);
      }
  }

  const asignarRutaDesdeModal = async (rutaDestino) => {
      const rutaNum = rutaDestino === 'LAT' ? 'LAT' : parseInt(rutaDestino); const suc = COORD_LOC[config.local];
      let nuevaLista = pedidos.map(p => selectedIds.has(p.id) ? { ...p, ruta: rutaNum } : p);
      let listaFinal = []; const rutasTodas = [...new Set(nuevaLista.map(p=>p.ruta))].sort();
      rutasTodas.forEach(r => { const pts = nuevaLista.filter(p => p.ruta === r); if (r === rutaNum && r !== 'LAT') { const opt = optimizarRutaInterna(pts, suc); opt.forEach((p, i) => { p.secuencia = i + 1; listaFinal.push(p); }); } else { pts.sort((a,b) => a.secuencia - b.secuencia).forEach((p, i) => { p.secuencia = i + 1; listaFinal.push(p); }); } });
      setPedidos(listaFinal); setSelectedIds(new Set()); setShowModalRuta(false);
      showToast("Pedidos movidos y ruta re-optimizada.", "success");
      await trazarRutasEstricto(listaFinal);
  }

  const autoAsignarRutas = async () => {
      if(!config.local || config.horasSeleccionadas.length === 0) return showToast("Faltan datos: Selecciona Local y Bloques", "error");
      const suc = COORD_LOC[config.local]; if(!suc) return showToast("Local sin coordenadas configuradas.", "error");
      setMapCenter([suc.lat, suc.lng]);

      let lista = rawData.filter(row => { const rLoc = row["LOCAL"]?row["LOCAL"].toString().replace('L','').replace('.0','').trim():""; let rHora=(typeof row["TIEMPO MIN ENTREGA"]==='string')?(row["TIEMPO MIN ENTREGA"].includes(" ")?row["TIEMPO MIN ENTREGA"].split(" ")[1].substring(0,5):row["TIEMPO MIN ENTREGA"].substring(0,5)):"00:00"; return rLoc===config.local && config.horasSeleccionadas.includes(rHora); }).map((r, i) => { let eCom = r["COMUNA"]||r["COMUNA CLIENTE"]; const rawDir = r["DIRECCION CLIENTE"]?.toString()||""; if (!eCom && rawDir.includes(',')) { const parts = rawDir.split(','); if (parts.length > 1) eCom = parts[parts.length - 1].trim(); } return { id: i, cliente: r["NOMBRE CLIENTE"], direccion: rawDir.split(',')[0].trim(), comuna: eCom||"", lat: parseFloat(r["LATITUD DIRECCION"]?.replace(',','.')), lng: parseFloat(r["LONGITUD DIRECCION"]?.replace(',','.')), bultos: r["DETALLE BULTOS"]?parseInt(r["DETALLE BULTOS"].toString().match(/Totales\s*(\d+)/i)?.[1]||0):0, sg: r["ORDEN"], ruta: 1, secuencia: 0, score: 0 } }).filter(p => !isNaN(p.lat));
      lista = dispersarPuntos(lista); lista.forEach(p => { p.angulo = Math.atan2(p.lat - suc.lat, p.lng - suc.lng); const dist = Math.sqrt(Math.pow(p.lat - suc.lat, 2) + Math.pow(p.lng - suc.lng, 2)); p.score = p.bultos + (dist * 111 * 2); }); lista.sort((a, b) => a.angulo - b.angulo);
      let esfTotal = lista.reduce((s, p) => s + p.score, 0); let esfCam = esfTotal / config.moviles; let c = 1, crg = 0;
      lista.forEach(p => { if(crg + p.score > esfCam && c < config.moviles) { if(Math.abs((crg + p.score) - esfCam) > Math.abs(crg - esfCam) && crg > 0) { c++; crg = 0; } } p.ruta = c; crg += p.score; });
      let lFin = []; const rIds = [...new Set(lista.map(p => p.ruta))]; rIds.forEach(r => { const pts = lista.filter(p => p.ruta === r); const opt = optimizarRutaInterna(pts, suc); opt.forEach((p, idx) => { p.secuencia = idx + 1; lFin.push(p); }); });
      setPedidos(lFin);
      showToast(`Rutas calculadas para ${lFin.length} pedidos.`, "success");
      await trazarRutasEstricto(lFin);
  }

  const procesarExcel = (e) => {
    const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (evt) => { const wb = XLSX.read(evt.target.result, { type: 'binary' }); const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]); const cleanData = []; const conteos = {}; data.forEach(row => { const newRow = {}; Object.keys(row).forEach(k => newRow[k.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()] = row[k]); let hora = (typeof newRow["TIEMPO MIN ENTREGA"] === 'string') ? (newRow["TIEMPO MIN ENTREGA"].includes(" ") ? newRow["TIEMPO MIN ENTREGA"].split(" ")[1].substring(0,5) : newRow["TIEMPO MIN ENTREGA"].substring(0,5)) : "00:00"; if (!hora.endsWith(':15')) return; cleanData.push(newRow); let local = newRow["LOCAL"] ? newRow["LOCAL"].toString().replace('.0','').trim() : ""; const k = local.startsWith('L') ? local.replace('L','') : local; if(local) { if(!conteos[k]) conteos[k]={}; conteos[k][hora] = (conteos[k][hora] || 0) + 1; } }); setRawData(cleanData); setMapaConteos(conteos); setLocalesDisponibles(Object.keys(conteos).sort());
    showToast(`Archivo cargado: ${cleanData.length} pedidos detectados (:15)`, "success"); }; reader.readAsBinaryString(file);
  }

  const descargarExcel = () => { if (pedidos.length === 0) return showToast("No hay datos para exportar.", "warning"); const totales = {}; pedidos.forEach(p => { if(!totales[p.ruta]) totales[p.ruta]=0; totales[p.ruta]+=p.bultos; }); const listaOrdenada = [...pedidos].sort((a,b) => { if(a.ruta === b.ruta) return a.secuencia - b.secuencia; if(a.ruta === 'LAT') return 1; if(b.ruta === 'LAT') return -1; return a.ruta - b.ruta; }); const data = listaOrdenada.map((p, i, arr) => { const isFirst = i === 0 || arr[i-1].ruta !== p.ruta; return { "Orden": p.secuencia, "SG": p.sg, "Cliente": p.cliente, "Dirección": p.direccion, "Comuna": p.comuna, "Ruta": p.ruta === "LAT" ? "LATERAL" : `RUTA ${p.ruta}`, "Total Bultos": isFirst ? totales[p.ruta] : "" } }); const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Hoja de Ruta"); XLSX.writeFile(wb, `Ruta_L${config.local}.xlsx`); showToast("Excel exportado exitosamente.", "success"); }

  const moverPedidosMasivo = async () => { if (selectedIds.size === 0) return showToast("Primero selecciona puntos en el mapa.", "warning"); const target = document.getElementById('rutaDestino').value; const rutaNum = target === 'LAT' ? 'LAT' : parseInt(target); const suc = COORD_LOC[config.local]; let nuevaLista = pedidos.map(p => selectedIds.has(p.id) ? { ...p, ruta: rutaNum } : p); let listaFinal = []; const rutasTodas = [...new Set(nuevaLista.map(p=>p.ruta))].sort(); rutasTodas.forEach(r => { const pts = nuevaLista.filter(p => p.ruta === r); if (r === rutaNum && r !== 'LAT') { const opt = optimizarRutaInterna(pts, suc); opt.forEach((p, i) => { p.secuencia = i + 1; listaFinal.push(p); }); } else { pts.sort((a,b) => a.secuencia - b.secuencia).forEach((p, i) => { p.secuencia = i + 1; listaFinal.push(p); }); } }); setPedidos(listaFinal); setSelectedIds(new Set());
  showToast("Pedidos movidos exitosamente.", "success");
  await trazarRutasEstricto(listaFinal); }

  // --- ⭐ NUEVA LÓGICA DE LIMPIEZA SIN RECARGA ⭐ ---
  const handleResetRequest = () => { setShowResetConfirm(true); }

  const confirmReset = () => {
      // 1. Borrar solo las claves de ruteo del LocalStorage
      localStorage.removeItem('ruteo_rawData');
      localStorage.removeItem('ruteo_locales');
      localStorage.removeItem('ruteo_conteos');
      localStorage.removeItem('ruteo_config');
      localStorage.removeItem('ruteo_pedidos');
      localStorage.removeItem('ruteo_rutasReales');
      localStorage.removeItem('ruteo_mapCenter');

      // 2. Resetear todos los estados a su valor inicial
      setRawData([]);
      setLocalesDisponibles([]);
      setMapaConteos({});
      setConfig({ local: '', horasSeleccionadas: [], moviles: 3 });
      setPedidos([]);
      setRutasReales({});
      setMapCenter([-33.45, -70.66]);
      setSelectedIds(new Set());
      setRutasDestacadas(new Set());

      // 3. Cerrar el modal y mostrar aviso
      setShowResetConfirm(false);
      showToast("Datos limpiados. Listo para nueva carga.", "success");
  }

  const cambiarRutaManual = async (id, nuevaRuta) => { const rutaNum = nuevaRuta === 'LAT' ? 'LAT' : parseInt(nuevaRuta); const suc = COORD_LOC[config.local]; let nuevaLista = pedidos.map(p => p.id === id ? { ...p, ruta: rutaNum } : p); let listaFinal = []; const rutasTodas = [...new Set(nuevaLista.map(p=>p.ruta))].sort(); rutasTodas.forEach(r => { const pts = nuevaLista.filter(p => p.ruta === r); if (r === rutaNum && r !== 'LAT') { const opt = optimizarRutaInterna(pts, suc); opt.forEach((p, i) => { p.secuencia = i + 1; listaFinal.push(p); }); } else { pts.sort((a,b) => a.secuencia - b.secuencia).forEach((p, i) => { p.secuencia = i + 1; listaFinal.push(p); }); } }); setPedidos(listaFinal); await trazarRutasEstricto(listaFinal); }

  // --- FUNCIÓN DE CAMBIO INTELIGENTE EN CASCADA ---
  const cambiarSecuenciaManual = async (id, nuevaSecuenciaStr) => {
      const nuevaSecuencia = parseInt(nuevaSecuenciaStr);
      const pedido = pedidos.find(p => p.id === id);
      if(!pedido) return;
      const ruta = pedido.ruta;
      if(pedido.secuencia === nuevaSecuencia) return;

      let puntosRuta = pedidos.filter(p => p.ruta === ruta).sort((a,b) => a.secuencia - b.secuencia);
      const movedPoint = puntosRuta.find(p => p.id === id);
      const otrosPuntos = puntosRuta.filter(p => p.id !== id);

      const insertIndex = nuevaSecuencia - 1;
      const previos = otrosPuntos.slice(0, insertIndex);
      const porReordenar = otrosPuntos.slice(insertIndex);

      const colaOptimizada = optimizarRutaInterna(porReordenar, movedPoint);

      const nuevaRutaFinal = [...previos, movedPoint, ...colaOptimizada];
      nuevaRutaFinal.forEach((p, i) => p.secuencia = i + 1);

      let listaGlobal = pedidos.filter(p => p.ruta !== ruta);
      listaGlobal = [...listaGlobal, ...nuevaRutaFinal];
      listaGlobal.sort((a,b) => { if (a.ruta !== b.ruta) return a.ruta - b.ruta; return a.secuencia - b.secuencia; });
      setPedidos(listaGlobal);
      showToast("Ruta re-secuenciada y optimizada.", "info");
      await trazarRutasEstricto(listaGlobal);
  }

  const toggleRutaDestacada = (r) => { const newSet = new Set(rutasDestacadas); if (newSet.has(r)) newSet.delete(r); else newSet.add(r); setRutasDestacadas(newSet); }

  return (
   <div className="flex w-full h-[calc(100vh-64px)] min-h-[600px] bg-gray-100 font-sans overflow-hidden rounded-xl relative">

      <ToastNotification notification={notification} onClose={() => setNotification({...notification, visible: false})} />
      <ConfirmModal
        isOpen={showResetConfirm}
        title="¿BORRAR TODOS LOS DATOS?"
        message="Esta acción eliminará todos los pedidos cargados y la configuración actual. No se puede deshacer."
        onCancel={() => setShowResetConfirm(false)}
        onConfirm={confirmReset}
      />

      <div className="w-80 bg-[#1e3c72] text-white flex flex-col shadow-2xl z-20 h-full border-r border-white/10">
        <div className="p-4 border-b border-blue-800 bg-[#14284d] flex justify-between items-center flex-shrink-0">
            <h1 className="text-lg font-black tracking-tight"><span className="text-[#d63384]">CCO</span> ROUTER</h1>
            {rawData.length > 0 && <button onClick={handleResetRequest} className="text-[10px] bg-red-600 px-2 py-1 rounded font-bold hover:bg-red-500">LIMPIAR</button>}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
            {rawData.length === 0 ? (
                <div className="bg-white/5 p-6 rounded border-2 border-dashed border-white/20 text-center">
                    <label className="bg-[#d63384] hover:bg-pink-600 text-white py-2 px-4 rounded text-xs font-bold cursor-pointer block">CARGAR EXCEL 📂<input type="file" accept=".xlsx,.xls" onChange={procesarExcel} className="hidden" /></label>
                </div>
            ) : (
                <div className="space-y-5 animate-fade-in">
                    <div className="bg-white/5 p-3 rounded border border-white/10">
                        <div className="mb-2"><label className="text-[10px] font-bold text-gray-400">LOCAL</label><select className="w-full bg-[#0f254a] border border-blue-800 rounded p-1 text-xs font-bold" value={config.local} onChange={e => { setConfig({...config, local: e.target.value, horasSeleccionadas: []}); const c = COORD_LOC[e.target.value]; if(c) setMapCenter([c.lat, c.lng]); }}><option value="">...</option>{localesDisponibles.map(l => <option key={l} value={l}>Local {l}</option>)}</select></div>
                        <BlockSelector config={config} setConfig={setConfig} mapaConteos={mapaConteos} />
                        <div className="flex gap-2 items-end"><div className="w-1/3"><label className="text-[9px] text-gray-400 font-bold">MÓVILES</label><input type="number" min="1" value={config.moviles} onChange={e => { const val=parseInt(e.target.value); setConfig({...config, moviles: (isNaN(val)||val<1)?1:val}) }} className="w-full bg-[#0f254a] border border-blue-800 rounded p-1 text-center font-bold text-sm"/></div><div className="w-2/3"><button onClick={autoAsignarRutas} disabled={calculandoRuta} className="w-full bg-[#d63384] hover:bg-pink-600 text-white font-bold py-1.5 rounded text-xs shadow-lg disabled:opacity-50">{calculandoRuta ? 'CALCULANDO...' : 'CALCULAR ⚡'}</button></div></div>
                    </div>
                    {pedidos.length > 0 && (
                        <div className="bg-white/5 p-3 rounded border border-white/10 space-y-2">
                            <div className="text-[10px] font-bold text-gray-400 flex justify-between"><span>HERRAMIENTAS</span><span onClick={() => trazarRutasEstricto(pedidos)} className="cursor-pointer text-blue-400 hover:text-white">↻ Refrescar</span></div>
                            <div className="flex gap-2 items-center pb-2 border-b border-white/10"><select id="rutaDestino" className="bg-[#0f254a] text-[10px] border border-blue-800 rounded flex-1 h-7 px-1 font-bold"><option value="LAT">A LAT</option>{[...Array(config.moviles)].map((_, i) => <option key={i+1} value={i+1}>A RUTA {i+1}</option>)}</select><button onClick={moverPedidosMasivo} className="bg-blue-600 hover:bg-blue-500 px-3 rounded text-[10px] font-bold h-7 whitespace-nowrap">MOVER SEL ({selectedIds.size})</button></div>
                            <button onClick={() => { setIsCircleMode(!isCircleMode); }} className={`w-full font-bold py-2 rounded text-xs shadow border transition-colors ${isCircleMode ? 'bg-red-500 hover:bg-red-600 text-white border-red-400' : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400'}`}>{isCircleMode ? '❌ CANCELAR SELECCIÓN' : '⭕ SELECCIÓN CIRCULAR (Arrastrar)'}</button>
                            <div onClick={() => setMostrarLineas(!mostrarLineas)} className="flex items-center gap-2 text-[10px] font-bold text-gray-300 cursor-pointer pt-2 border-t border-white/10"><div className={`w-3 h-3 border rounded flex items-center justify-center ${mostrarLineas ? 'bg-green-500 border-green-500' : 'border-gray-500'}`}>{mostrarLineas && '✓'}</div> Ver Calles</div>
                        </div>
                    )}
                </div>
            )}
        </div>
        <div className="p-4 bg-[#14284d] border-t border-blue-800 flex-shrink-0"><button onClick={descargarExcel} disabled={pedidos.length===0} className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-2 rounded text-xs">📥 EXPORTAR EXCEL</button></div>
      </div>

      <div className="flex-1 relative h-full bg-gray-200">
        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <InvalidateSize />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
          <MapFocusHandler rutasDestacadas={rutasDestacadas} rutasReales={rutasReales} pedidos={pedidos} />
          <CircleSelector active={isCircleMode} onCircleComplete={handleCircleComplete} />
          {mostrarLineas && Object.keys(rutasReales).map(k => {
              const rId = parseInt(k); const r = rutasReales[k];
              const isSelected = rutasDestacadas.has(rId);
              const isAnythingSelected = rutasDestacadas.size > 0;
              const isVisible = !isAnythingSelected || isSelected;
              const opacity = isVisible ? (isSelected ? 1 : 0.8) : 0.1;
              const weight = isSelected ? 7 : 4;
              const color = k==='LAT' ? COLOR_LAT : COLORES_RUTAS[(rId-1)%COLORES_RUTAS.length];
              return <Polyline key={k} positions={r.positions} color={color} weight={weight} opacity={opacity} />
          })}
          {config.local && COORD_LOC[config.local] && <Marker position={[COORD_LOC[config.local].lat, COORD_LOC[config.local].lng]} icon={storeIcon}><Popup>Tienda</Popup></Marker>}
          {pedidos.map(p => {
             const color = p.ruta === 'LAT' ? COLOR_LAT : COLORES_RUTAS[(p.ruta-1)%COLORES_RUTAS.length];
             const isSel = selectedIds.has(p.id);
             const isAnythingSelected = rutasDestacadas.size > 0;
             const isVisible = !isAnythingSelected || rutasDestacadas.has(p.ruta);
             return (
               <Marker key={p.id} position={[p.lat, p.lng]} icon={createNumberIcon(p.secuencia, color, isSel, !isVisible)} eventHandlers={{ click: () => { const s = new Set(selectedIds); if(s.has(p.id)) s.delete(p.id); else s.add(p.id); setSelectedIds(s); } }}>
                 <Popup>
                   <div className="text-xs p-1 min-w-[150px]"><strong className="block text-sm uppercase mb-1 border-b pb-1">{p.cliente}</strong><div className="mb-2 text-gray-600"><p>{p.direccion}</p><p className="font-bold text-gray-500">{p.comuna}</p></div><div className="grid grid-cols-2 gap-2 mb-2"><div className="bg-gray-100 p-1 rounded"><label className="block text-[8px] font-bold text-gray-500">RUTA</label><select className="w-full bg-white border rounded text-[10px] font-bold" value={p.ruta} onChange={(e) => cambiarRutaManual(p.id, e.target.value)}><option value="LAT">LAT</option>{[...Array(config.moviles)].map((_,i)=><option key={i+1} value={i+1}>R{i+1}</option>)}</select></div><div className="bg-gray-100 p-1 rounded"><label className="block text-[8px] font-bold text-gray-500">ORDEN</label><select className="w-full bg-white border rounded text-[10px] font-bold" value={p.secuencia} onChange={(e) => cambiarSecuenciaManual(p.id, e.target.value)}>{[...Array(pedidos.filter(x => x.ruta === p.ruta).length)].map((_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></div></div><div className="bg-gray-200 px-2 py-1 rounded font-bold text-center">📦 {p.bultos} Bultos</div></div>
                 </Popup>
               </Marker>
             )
          })}
        </MapContainer>
        <div className="absolute bottom-6 left-6 right-6 flex gap-3 overflow-x-auto z-[1000] pb-2 px-2 snap-x">
           {pedidos.length > 0 && [...Array(config.moviles)].map((_, i) => {
               const r = i+1; const pts = pedidos.filter(p => p.ruta === r); if(pts.length===0) return null; const info = rutasReales[r]; const isActive = rutasDestacadas.has(r);
               return (
                 <div key={r} onClick={() => toggleRutaDestacada(r)} className={`flex flex-col min-w-[120px] bg-white/95 backdrop-blur rounded-lg p-3 shadow-xl cursor-pointer transition-all duration-200 border-l-[6px] snap-center select-none ${isActive ? 'ring-4 ring-offset-2 scale-105 z-10 translate-y-[-5px]' : 'hover:scale-105 opacity-90'}`} style={{ borderLeftColor: COLORES_RUTAS[i % COLORES_RUTAS.length], ringColor: COLORES_RUTAS[i % COLORES_RUTAS.length] }}>
                    <div className="flex justify-between items-center border-b pb-1 mb-1"><span className="text-xs font-black text-gray-800">RUTA {r}</span>{info ? <span className="text-[9px] bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-bold shadow-sm">REAL</span> : <span className="text-[9px] bg-gray-200 px-1 rounded">EST</span>}</div>
                    <div className="flex justify-between items-end mb-1"><span className="text-lg font-black text-gray-700 leading-none">{info?.km || '-'} <span className="text-[9px] text-gray-400 font-bold">km</span></span><span className="text-xs font-bold text-gray-500">{info ? formatDuration(info.min) : '-'}</span></div>
                    <div className={`flex justify-between items-center text-[9px] font-bold mt-1 p-1 rounded transition-colors ${isActive ? 'bg-blue-100 text-blue-800' : 'bg-gray-50 text-gray-500'}`}><span>📍 {pts.length} pts</span><span>📦 {pts.reduce((s,x)=>s+x.bultos,0)}</span></div>
                 </div>
               )
           })}
        </div>
      </div>

      {/* --- MODAL FLOTANTE CORREGIDO (RESPONSIVO Y CON SCROLL) --- */}
      {showModalRuta && (
          <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-sm p-4">
              <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl border-t-8 border-[#d63384] animate-fade-in-up flex flex-col max-h-[90vh]">

                  {/* HEADER (FIJO) */}
                  <div className="p-6 border-b flex-shrink-0">
                      <h3 className="text-xl font-black text-[#1e3c72] text-center">MOVER {selectedIds.size} PEDIDOS</h3>
                      <p className="text-sm text-gray-500 text-center">Selecciona la ruta destino para el grupo encerrado.</p>
                  </div>

                  {/* BODY (SCROLLABLE) */}
                  <div className="p-6 overflow-y-auto">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {[...Array(config.moviles)].map((_, i) => (
                              <button key={i+1} onClick={() => asignarRutaDesdeModal(i+1)} className="py-4 bg-blue-50 border-2 border-blue-100 hover:border-blue-500 hover:bg-blue-100 rounded-lg font-bold text-[#1e3c72] transition-all shadow-sm">
                                  RUTA {i+1}
                              </button>
                          ))}
                          <button onClick={() => asignarRutaDesdeModal('LAT')} className="py-4 bg-gray-100 border-2 border-gray-200 hover:border-gray-500 hover:bg-gray-200 rounded-lg font-bold text-gray-700 col-span-2 sm:col-span-1 transition-all shadow-sm">
                              A LAT
                          </button>
                      </div>
                  </div>

                  {/* FOOTER (FIJO) */}
                  <div className="p-4 border-t bg-gray-50 flex-shrink-0">
                      <button onClick={() => setShowModalRuta(false)} className="w-full text-xs text-red-500 font-bold hover:underline py-2">CANCELAR OPERACIÓN</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  )
}
