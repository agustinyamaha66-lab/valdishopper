import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Circle, useMapEvents, Polygon } from 'react-leaflet'
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
    LogOut,
    Pencil,
    Maximize2,
    Eye,
    EyeOff,
    ZoomIn,
    Package
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
const COLOR_LAT = "#64748b"

const ALERT_LABELS = {
    success: "Listo",
    error: "Error",
    warning: "Advertencia",
    info: "Información",
}

// Iconos Leaflet mejorados
const storeIcon = new L.DivIcon({
    className: '',
    html: `<div style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); width:42px; height:42px; border-radius:50%; border:4px solid white; box-shadow:0 6px 12px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; color:white; font-size:20px; animation: pulse 2s ease-in-out infinite;">🏢</div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21]
})

const createNumberIcon = (num, color, selected, dimmed) => {
    return new L.DivIcon({
        className: '',
        html: `<div style="
      background: ${selected ? `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)` : color}; 
      width:${selected ? '32px' : '28px'}; 
      height:${selected ? '32px' : '28px'}; 
      border-radius:50%; 
      border:${selected ? '3px solid #1e3c72' : '2px solid white'}; 
      box-shadow:0 ${selected ? '4px 8px' : '2px 4px'} rgba(0,0,0,${selected ? '0.5' : '0.3'}); 
      display:flex; 
      align-items:center; 
      justify-content:center; 
      color:white; 
      font-weight:bold; 
      font-family:sans-serif; 
      font-size:${selected ? '13px' : '11px'}; 
      opacity: ${dimmed ? 0.25 : 1}; 
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
    ">${num}</div>`,
        iconSize: [selected ? 32 : 28, selected ? 32 : 28],
        iconAnchor: [selected ? 16 : 14, selected ? 16 : 14]
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
                <p className="font-bold text-xs uppercase tracking-wider opacity-80">
                    {ALERT_LABELS[notification.type] || "Aviso"}
                </p>
                <p className="font-medium text-sm leading-tight">{notification.message}</p>
            </div>
            <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity">
                <X size={18}/>
            </button>
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

// ✨ NUEVO: Componente de Lazo Manual
function LassoSelector({ active, onLassoComplete }) {
    const [lassoPath, setLassoPath] = useState([])
    const [isDrawing, setIsDrawing] = useState(false)
    const map = useMap()

    useMapEvents({
        mousedown(e) {
            if (!active) return;
            map.dragging.disable();
            setLassoPath([e.latlng]);
            setIsDrawing(true);
        },
        mousemove(e) {
            if (!active || !isDrawing) return;
            setLassoPath(prev => [...prev, e.latlng]);
        },
        mouseup() {
            if (!active || !isDrawing) return;
            setIsDrawing(false);
            map.dragging.enable();

            if (lassoPath.length > 2) {
                onLassoComplete(lassoPath);
            }
            setLassoPath([]);
        }
    })

    if (lassoPath.length > 0) {
        return (
            <>
                <Polyline
                    positions={lassoPath}
                    pathOptions={{
                        color: '#d63384',
                        weight: 3,
                        dashArray: '10, 5',
                        opacity: 0.8
                    }}
                />
                {lassoPath.length > 2 && (
                    <Polygon
                        positions={lassoPath}
                        pathOptions={{
                            color: '#d63384',
                            fillColor: '#d63384',
                            fillOpacity: 0.15,
                            weight: 2
                        }}
                    />
                )}
            </>
        )
    }
    return null;
}

function BlockSelector({ config, setConfig, mapaConteos }) {
    const [abierto, setAbierto] = useState(false)
    const bloquesDisponibles = config.local && mapaConteos[config.local] ? Object.keys(mapaConteos[config.local]).sort() : []
    const ref = useRef(null)

    useEffect(() => {
        function handleClickOutside(event) { if (ref.current && !ref.current.contains(event.target)) setAbierto(false) }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
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
            <button
                onClick={() => setAbierto(!abierto)}
                className="w-full bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-lg p-2.5 text-xs font-medium text-left flex justify-between items-center text-slate-200 transition-all shadow-sm hover:shadow-md"
            >
                <span className="truncate">
                    {config.horasSeleccionadas.length > 0
                        ? `${config.horasSeleccionadas.length} Bloques Seleccionados`
                        : 'Seleccionar Bloques...'
                    }
                </span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`} />
            </button>

            {abierto && (
                <div className="absolute top-full left-0 right-0 bg-white text-slate-700 shadow-2xl rounded-xl z-50 mt-2 border border-slate-200 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                    {bloquesDisponibles.length > 0 ? (
                        <div className="p-1">
                            <div
                                onClick={toggleTodos}
                                className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded-lg cursor-pointer border-b border-slate-100 mb-1 sticky top-0 bg-white z-10 transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    checked={config.horasSeleccionadas.length === bloquesDisponibles.length && bloquesDisponibles.length > 0}
                                    readOnly
                                    className="rounded text-[#d63384] focus:ring-[#d63384]"
                                />
                                <span className="text-xs font-black text-[#1e3c72] uppercase">Seleccionar Todos</span>
                            </div>
                            {bloquesDisponibles.map(bloque => (
                                <div
                                    key={bloque}
                                    onClick={() => toggleBloque(bloque)}
                                    className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                                >
                                    <input
                                        type="checkbox"
                                        checked={config.horasSeleccionadas.includes(bloque)}
                                        readOnly
                                        className="rounded text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-xs font-medium text-slate-600">
                                        {bloque}
                                        <span className="text-slate-400 text-[10px] ml-1">
                                            ({mapaConteos[config.local][bloque]} ped)
                                        </span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 text-xs text-slate-400 text-center italic">
                            Selecciona un local primero
                        </div>
                    )}
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
    const [isLassoMode, setIsLassoMode] = useState(false) // ✨ Cambiado de Circle a Lasso

    // Modals
    const [showModalRuta, setShowModalRuta] = useState(false)
    const [showResetConfirm, setShowResetConfirm] = useState(false)
    const [notification, setNotification] = useState({ visible: false, message: '', type: 'info' })

    // Refs
    const mapCaptureRef = useRef(null) // contenedor del mapa para pantallazos

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
    const dispersarPuntos = (lista) => {
        const grupos = {};
        lista.forEach(p => {
            // Más precisión para evitar agrupar puntos que están realmente separados
            const key = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
            if(!grupos[key]) grupos[key] = [];
            grupos[key].push(p);
        });
        let listaDispersa = [];
        Object.values(grupos).forEach(grupo => {
            if (grupo.length === 1) {
                listaDispersa.push(grupo[0]);
            } else {
                const angleStep = (2 * Math.PI) / grupo.length;
                // Desplazamiento leve para evitar superposición visual (sin deformar demasiado)
                const radius = 0.00025;
                grupo.forEach((p, i) => {
                    listaDispersa.push({
                        ...p,
                        lat: p.lat + radius * Math.cos(i * angleStep),
                        lng: p.lng + radius * Math.sin(i * angleStep)
                    });
                });
            }
        });
        return listaDispersa;
    }

    const calcularDistancia = (p1, p2) => Math.sqrt(Math.pow(p1.lat - p2.lat, 2) + Math.pow(p1.lng - p2.lng, 2));

    // Parseo robusto de bultos/paquetes desde planillas con distintos formatos
    const parseBultos = (val) => {
        if (val === null || val === undefined) return 0;
        if (typeof val === 'number' && Number.isFinite(val)) return Math.max(0, Math.round(val));
        const s = val.toString();
        // Caso típico: "Totales 12" / "TOTAL 12"
        const m1 = s.match(/total(?:es)?\s*[:\-]?\s*(\d+)/i);
        if (m1) return parseInt(m1[1], 10);
        // Si viene como lista de ítems con números, tomar el último número como fallback
        const nums = s.match(/\d+/g);
        if (nums && nums.length) return parseInt(nums[nums.length - 1], 10);
        return 0;
    }

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
                if (d < minDst) {
                    minDst = d;
                    bestIdx = i;
                }
            }
            const next = pendientes[bestIdx];
            ordenados.push(next);
            actual = next;
            pendientes.splice(bestIdx, 1);
        }
        return ordenados;
    }

    const trazarRutasEstricto = async (listaPedidosOrdenada) => {
        if(!config.local) return;
        const suc = COORD_LOC[config.local];
        if(!suc) return;
        setCalculandoRuta(true);
        const rutasUnicas = [...new Set(listaPedidosOrdenada.map(p => p.ruta))];
        const infoRutas = { ...rutasReales };
        for(const r of rutasUnicas) {
            const puntosRuta = listaPedidosOrdenada.filter(p => p.ruta === r).sort((a,b) => a.secuencia - b.secuencia);
            if(puntosRuta.length === 0) continue;
            const coordsURL = [`${suc.lng},${suc.lat}`];
            puntosRuta.forEach(p => coordsURL.push(`${p.lng},${p.lat}`));
            try {
                // steps=true y annotations=true ayudan a trazado/tiempos más consistentes
                const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsURL.join(';')}?overview=full&geometries=geojson&steps=true&annotations=true`);
                const json = await res.json();
                if(json.code === 'Ok' && json.routes.length > 0) {
                    const routeData = json.routes[0];
                    infoRutas[r] = {
                        positions: routeData.geometry.coordinates.map(c => [c[1], c[0]]),
                        km: (routeData.distance / 1000).toFixed(1),
                        min: Math.round(routeData.duration / 60)
                    };
                }
            } catch (error) {
                console.error(error);
            }
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        setRutasReales(infoRutas);
        setPedidos(listaPedidosOrdenada);
        setCalculandoRuta(false);
    }

    // ✨ NUEVO: Función para procesar el lazo manual
    const handleLassoComplete = (lassoPath) => {
        const nuevosSeleccionados = new Set();
        const polygon = L.polygon(lassoPath);

        pedidos.forEach(p => {
            const point = L.latLng(p.lat, p.lng);
            // Verificar si el punto está dentro del polígono del lazo
            if (polygon.getBounds().contains(point)) {
                // Verificación más precisa usando ray casting
                if (isPointInPolygon(point, lassoPath)) {
                    nuevosSeleccionados.add(p.id);
                }
            }
        });

        if (nuevosSeleccionados.size > 0) {
            setSelectedIds(nuevosSeleccionados);
            setIsLassoMode(false);
            setShowModalRuta(true);
            showToast(`¡${nuevosSeleccionados.size} pedidos seleccionados!`, 'success');
        } else {
            showToast("Ningún pedido encontrado dentro del área.", "warning");
            setIsLassoMode(false);
        }
    }

    // Algoritmo para verificar si un punto está dentro de un polígono (ray casting)
    const isPointInPolygon = (point, polygon) => {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].lat, yi = polygon[i].lng;
            const xj = polygon[j].lat, yj = polygon[j].lng;
            const intersect = ((yi > point.lng) !== (yj > point.lng)) &&
                (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    const asignarRutaDesdeModal = async (rutaDestino) => {
        const rutaNum = rutaDestino === 'LAT' ? 'LAT' : parseInt(rutaDestino);
        const suc = COORD_LOC[config.local];
        let nuevaLista = pedidos.map(p => selectedIds.has(p.id) ? { ...p, ruta: rutaNum } : p);
        let listaFinal = [];
        const rutasTodas = [...new Set(nuevaLista.map(p=>p.ruta))].sort();
        rutasTodas.forEach(r => {
            const pts = nuevaLista.filter(p => p.ruta === r);
            if (r === rutaNum && r !== 'LAT') {
                const opt = optimizarRutaInterna(pts, suc);
                opt.forEach((p, i) => {
                    p.secuencia = i + 1;
                    listaFinal.push(p);
                });
            } else {
                pts.sort((a,b) => a.secuencia - b.secuencia).forEach((p, i) => {
                    p.secuencia = i + 1;
                    listaFinal.push(p);
                });
            }
        });
        setPedidos(listaFinal);
        setSelectedIds(new Set());
        setShowModalRuta(false);
        showToast("Pedidos movidos y ruta re-optimizada.", "success");
        await trazarRutasEstricto(listaFinal);
    }

    const autoAsignarRutas = async () => {
        if(!config.local || config.horasSeleccionadas.length === 0)
            return showToast("Faltan datos: Selecciona Local y Bloques", "error");

        const suc = COORD_LOC[config.local];
        if(!suc) return showToast("Local sin coordenadas configuradas.", "error");

        setMapCenter([suc.lat, suc.lng]);

        let lista = rawData.filter(row => {
            const rLoc = row["LOCAL"]?row["LOCAL"].toString().replace('L','').replace('.0','').trim():"";
            let rHora=(typeof row["TIEMPO MIN ENTREGA"]==='string')?(row["TIEMPO MIN ENTREGA"].includes(" ")?row["TIEMPO MIN ENTREGA"].split(" ")[1].substring(0,5):row["TIEMPO MIN ENTREGA"].substring(0,5)):"00:00";
            return rLoc===config.local && config.horasSeleccionadas.includes(rHora);
        }).map((r, i) => {
            let eCom = r["COMUNA"]||r["COMUNA CLIENTE"];
            const rawDir = r["DIRECCION CLIENTE"]?.toString()||"";
            if (!eCom && rawDir.includes(',')) {
                const parts = rawDir.split(',');
                if (parts.length > 1) eCom = parts[parts.length - 1].trim();
            }
            return {
                id: i,
                cliente: r["NOMBRE CLIENTE"],
                direccion: rawDir.split(',')[0].trim(),
                comuna: eCom||"",
                lat: parseFloat(r["LATITUD DIRECCION"]?.replace(',','.')),
                lng: parseFloat(r["LONGITUD DIRECCION"]?.replace(',','.')),
                bultos: parseBultos(r["DETALLE BULTOS"]),
                sg: r["ORDEN"],
                ruta: 1,
                secuencia: 0,
                score: 0
            }
        }).filter(p => !isNaN(p.lat));

        lista = dispersarPuntos(lista);
        lista.forEach(p => {
            p.angulo = Math.atan2(p.lat - suc.lat, p.lng - suc.lng);
            const dist = Math.sqrt(Math.pow(p.lat - suc.lat, 2) + Math.pow(p.lng - suc.lng, 2));
            p.score = p.bultos + (dist * 111 * 2);
        });

        lista.sort((a, b) => a.angulo - b.angulo);
        let esfTotal = lista.reduce((s, p) => s + p.score, 0);
        let esfCam = esfTotal / config.moviles;
        let c = 1, crg = 0;

        lista.forEach(p => {
            if(crg + p.score > esfCam && c < config.moviles) {
                if(Math.abs((crg + p.score) - esfCam) > Math.abs(crg - esfCam) && crg > 0) {
                    c++;
                    crg = 0;
                }
            }
            p.ruta = c;
            crg += p.score;
        });

        let lFin = [];
        const rIds = [...new Set(lista.map(p => p.ruta))];
        rIds.forEach(r => {
            const pts = lista.filter(p => p.ruta === r);
            const opt = optimizarRutaInterna(pts, suc);
            opt.forEach((p, idx) => {
                p.secuencia = idx + 1;
                lFin.push(p);
            });
        });

        setPedidos(lFin);
        showToast(`Rutas calculadas para ${lFin.length} pedidos.`, "success");
        await trazarRutasEstricto(lFin);
    }

    const procesarExcel = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const wb = XLSX.read(evt.target.result, { type: 'binary' });
            const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            const cleanData = [];
            const conteos = {};
            data.forEach(row => {
                const newRow = {};
                Object.keys(row).forEach(k => newRow[k.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()] = row[k]);
                let hora = (typeof newRow["TIEMPO MIN ENTREGA"] === 'string') ? (newRow["TIEMPO MIN ENTREGA"].includes(" ") ? newRow["TIEMPO MIN ENTREGA"].split(" ")[1].substring(0,5) : newRow["TIEMPO MIN ENTREGA"].substring(0,5)) : "00:00";
                if (!hora.endsWith(':15')) return;
                cleanData.push(newRow);
                let local = newRow["LOCAL"] ? newRow["LOCAL"].toString().replace('.0','').trim() : "";
                const k = local.startsWith('L') ? local.replace('L','') : local;
                if(local) {
                    if(!conteos[k]) conteos[k]={};
                    conteos[k][hora] = (conteos[k][hora] || 0) + 1;
                }
            });
            setRawData(cleanData);
            setMapaConteos(conteos);
            setLocalesDisponibles(Object.keys(conteos).sort());
            showToast(`Archivo cargado: ${cleanData.length} pedidos detectados (:15)`, "success");
        };
        reader.readAsBinaryString(file);
    }

    const descargarExcel = async () => {
        if (pedidos.length === 0) return showToast("No hay datos para exportar.", "warning");
        const totales = {};
        pedidos.forEach(p => {
            if(!totales[p.ruta]) totales[p.ruta]=0;
            totales[p.ruta]+=p.bultos;
        });
        const listaOrdenada = [...pedidos].sort((a,b) => {
            if(a.ruta === b.ruta) return a.secuencia - b.secuencia;
            if(a.ruta === 'LAT') return 1;
            if(b.ruta === 'LAT') return -1;
            return a.ruta - b.ruta;
        });
        const data = listaOrdenada.map((p, i, arr) => {
            const isFirst = i === 0 || arr[i-1].ruta !== p.ruta;
            return {
                "Orden": p.secuencia,
                "SG": p.sg,
                "Cliente": p.cliente,
                "Dirección": p.direccion,
                "Comuna": p.comuna,
                "Ruta": p.ruta === "LAT" ? "LATERAL" : `RUTA ${p.ruta}`,
                "Total Bultos": isFirst ? totales[p.ruta] : ""
            }
        });
        // Intentar exportación con estilos (colores) si está instalado xlsx-js-style.
        // Si no, hace fallback al XLSX normal.
        let XLSXW = XLSX;
        let canStyle = false;
        try {
            const mod = await import('xlsx-js-style');
            XLSXW = mod.default || mod;
            canStyle = true;
        } catch (_) {
            canStyle = false;
        }

        const ws = XLSXW.utils.json_to_sheet(data);

        // Ancho de columnas (mejora visual)
        ws['!cols'] = [
            { wch: 8 },   // Orden
            { wch: 16 },  // SG
            { wch: 28 },  // Cliente
            { wch: 34 },  // Dirección
            { wch: 18 },  // Comuna
            { wch: 12 },  // Ruta
            { wch: 14 },  // Total Bultos
        ];

        // Freeze header + autofilter
        ws['!freeze'] = { xSplit: 0, ySplit: 1 };
        const range = XLSXW.utils.decode_range(ws['!ref']);
        ws['!autofilter'] = { ref: XLSXW.utils.encode_range(range) };

        if (canStyle) {
            // Estilo header
            const headerStyle = {
                font: { bold: true, color: { rgb: 'FFFFFF' } },
                fill: { patternType: 'solid', fgColor: { rgb: '1E3C72' } },
                alignment: { vertical: 'center', horizontal: 'center' },
                border: {
                    top: { style: 'thin', color: { rgb: 'CBD5E1' } },
                    bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
                    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
                    right: { style: 'thin', color: { rgb: 'CBD5E1' } },
                },
            };
            const zebraA = { fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } } };
            const zebraB = { fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } } };

            const headers = Object.keys(data[0] || {});
            // Header row is 1
            headers.forEach((_, idx) => {
                const addr = XLSXW.utils.encode_cell({ r: 0, c: idx });
                if (ws[addr]) ws[addr].s = headerStyle;
            });

            // Zebra rows + bordes suaves
            for (let r = 1; r <= range.e.r; r++) {
                for (let c = 0; c <= range.e.c; c++) {
                    const addr = XLSXW.utils.encode_cell({ r, c });
                    if (!ws[addr]) continue;
                    ws[addr].s = {
                        ...(r % 2 === 0 ? zebraA : zebraB),
                        alignment: { vertical: 'center', horizontal: c === 0 ? 'center' : 'left', wrapText: true },
                        border: {
                            top: { style: 'thin', color: { rgb: 'E2E8F0' } },
                            bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
                            left: { style: 'thin', color: { rgb: 'E2E8F0' } },
                            right: { style: 'thin', color: { rgb: 'E2E8F0' } },
                        },
                    };
                }
            }
        }

        const wb = XLSXW.utils.book_new();
        XLSXW.utils.book_append_sheet(wb, ws, "Hoja de Ruta");
        XLSXW.writeFile(wb, `Ruta_L${config.local}.xlsx`);
        if (!canStyle) showToast("Excel exportado (sin estilos). Para colores: npm i xlsx-js-style", "info");
        else showToast("Excel exportado con formato y colores.", "success");
    }

    // Descargar pantallazos (mapa) de cada ruta en un PDF
    const descargarPantallazosRutas = async () => {
        if (pedidos.length === 0) return showToast("No hay rutas para descargar.", "warning");
        if (!mapCaptureRef.current) return showToast("No se encontró el contenedor del mapa.", "error");

        let html2canvas;
        let jsPDF;
        try {
            const h2c = await import('html2canvas');
            html2canvas = h2c.default || h2c;
            const jspdfMod = await import('jspdf');
            jsPDF = jspdfMod.jsPDF || jspdfMod.default;
        } catch (_) {
            showToast("Faltan dependencias. Instala: npm i html2canvas jspdf", "error");
            return;
        }

        // Rutas disponibles (solo con puntos)
        const rutas = [];
        for (let i = 1; i <= config.moviles; i++) {
            if (pedidos.some(p => p.ruta === i)) rutas.push(i);
        }
        if (pedidos.some(p => p.ruta === 'LAT')) rutas.push('LAT');
        if (rutas.length === 0) return showToast("No hay pedidos asignados a rutas.", "warning");

        const prev = new Set(rutasDestacadas);
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

        // Helper: pequeño wait para que Leaflet termine de renderizar tiles/polylines
        const wait = (ms) => new Promise(r => setTimeout(r, ms));

        try {
            for (let idx = 0; idx < rutas.length; idx++) {
                const rk = rutas[idx];
                setRutasDestacadas(new Set([rk]));
                await wait(700);

                const canvas = await html2canvas(mapCaptureRef.current, {
                    useCORS: true,
                    backgroundColor: '#e2e8f0',
                    scale: 2,
                });
                const imgData = canvas.toDataURL('image/png');

                if (idx > 0) pdf.addPage();
                const pageW = pdf.internal.pageSize.getWidth();
                const pageH = pdf.internal.pageSize.getHeight();

                // Mantener proporción
                const imgW = canvas.width;
                const imgH = canvas.height;
                const ratio = Math.min(pageW / imgW, pageH / imgH);
                const w = imgW * ratio;
                const h = imgH * ratio;
                const x = (pageW - w) / 2;
                const y = (pageH - h) / 2;

                pdf.addImage(imgData, 'PNG', x, y, w, h);
                pdf.setFontSize(12);
                pdf.text(`Ruta: ${rk === 'LAT' ? 'LAT (APOYO)' : `RUTA ${rk}`}`, 28, 28);
            }

            pdf.save(`Pantallazos_Rutas_L${config.local || 'SIN_LOCAL'}.pdf`);
            showToast("PDF generado con pantallazos de rutas.", "success");
        } catch (err) {
            console.error(err);
            showToast("No se pudo generar el PDF de pantallazos.", "error");
        } finally {
            setRutasDestacadas(prev);
        }
    }

    const handleResetRequest = () => {
        setShowResetConfirm(true);
    }

    const confirmReset = () => {
        localStorage.removeItem('ruteo_rawData');
        localStorage.removeItem('ruteo_locales');
        localStorage.removeItem('ruteo_conteos');
        localStorage.removeItem('ruteo_config');
        localStorage.removeItem('ruteo_pedidos');
        localStorage.removeItem('ruteo_rutasReales');
        localStorage.removeItem('ruteo_mapCenter');
        setRawData([]);
        setLocalesDisponibles([]);
        setMapaConteos({});
        setConfig({ local: '', horasSeleccionadas: [], moviles: 3 });
        setPedidos([]);
        setRutasReales({});
        setMapCenter([-33.45, -70.66]);
        setSelectedIds(new Set());
        setRutasDestacadas(new Set());
        setShowResetConfirm(false);
        showToast("Datos limpiados. Listo para nueva carga.", "success");
    }

    const cambiarRutaManual = async (id, nuevaRuta) => {
        const rutaNum = nuevaRuta === 'LAT' ? 'LAT' : parseInt(nuevaRuta);
        const suc = COORD_LOC[config.local];
        let nuevaLista = pedidos.map(p => p.id === id ? { ...p, ruta: rutaNum } : p);
        let listaFinal = [];
        const rutasTodas = [...new Set(nuevaLista.map(p=>p.ruta))].sort();
        rutasTodas.forEach(r => {
            const pts = nuevaLista.filter(p => p.ruta === r);
            if (r === rutaNum && r !== 'LAT') {
                const opt = optimizarRutaInterna(pts, suc);
                opt.forEach((p, i) => {
                    p.secuencia = i + 1;
                    listaFinal.push(p);
                });
            } else {
                pts.sort((a,b) => a.secuencia - b.secuencia).forEach((p, i) => {
                    p.secuencia = i + 1;
                    listaFinal.push(p);
                });
            }
        });
        setPedidos(listaFinal);
        await trazarRutasEstricto(listaFinal);
    }

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
        listaGlobal.sort((a,b) => {
            if (a.ruta !== b.ruta) return a.ruta - b.ruta;
            return a.secuencia - b.secuencia;
        });
        setPedidos(listaGlobal);
        showToast("Ruta re-secuenciada y optimizada.", "info");
        await trazarRutasEstricto(listaGlobal);
    }

    const toggleRutaDestacada = (r) => {
        const newSet = new Set(rutasDestacadas);
        if (newSet.has(r)) newSet.delete(r);
        else newSet.add(r);
        setRutasDestacadas(newSet);
    }

    const moverPedidosMasivo = async () => {
        if (selectedIds.size === 0) return showToast("Primero selecciona puntos en el mapa.", "warning");
        const target = document.getElementById('rutaDestino').value;
        const rutaNum = target === 'LAT' ? 'LAT' : parseInt(target);
        const suc = COORD_LOC[config.local];
        let nuevaLista = pedidos.map(p => selectedIds.has(p.id) ? { ...p, ruta: rutaNum } : p);
        let listaFinal = [];
        const rutasTodas = [...new Set(nuevaLista.map(p=>p.ruta))].sort();
        rutasTodas.forEach(r => {
            const pts = nuevaLista.filter(p => p.ruta === r);
            if (r === rutaNum && r !== 'LAT') {
                const opt = optimizarRutaInterna(pts, suc);
                opt.forEach((p, i) => {
                    p.secuencia = i + 1;
                    listaFinal.push(p);
                });
            } else {
                pts.sort((a,b) => a.secuencia - b.secuencia).forEach((p, i) => {
                    p.secuencia = i + 1;
                    listaFinal.push(p);
                });
            }
        });
        setPedidos(listaFinal);
        setSelectedIds(new Set());
        showToast("Pedidos movidos exitosamente.", "success");
        await trazarRutasEstricto(listaFinal);
    }

    const deselecionarTodos = () => {
        setSelectedIds(new Set());
        showToast("Selección limpiada.", "info");
    }

    return (
        <div className="flex w-full h-[calc(100vh-64px)] min-h-[600px] bg-gradient-to-br from-slate-50 to-slate-100 font-sans overflow-hidden relative">

            <ToastNotification
                notification={notification}
                onClose={() => setNotification({...notification, visible: false})}
            />

            <ConfirmModal
                isOpen={showResetConfirm}
                title="¿Reiniciar Estación?"
                message="Se eliminarán todos los datos cargados y la configuración actual. Esta acción no se puede deshacer."
                onCancel={() => setShowResetConfirm(false)}
                onConfirm={confirmReset}
            />

            {/* --- PANEL DE CONTROL (LEFT) --- */}
            <div className="w-80 bg-gradient-to-b from-[#0f254a] to-[#1a3a5f] text-slate-100 flex flex-col shadow-2xl z-20 h-full border-r border-slate-700/50">

                {/* Header Panel */}
                <div className="p-5 border-b border-slate-700/50 bg-[#0b1b36]/80 backdrop-blur-sm flex justify-between items-center shrink-0">
                    <div>
                        <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                            <div className="p-1.5 bg-[#d63384] rounded-lg">
                                <MapIcon size={18} className="text-white" />
                            </div>
                            RUTEADOR PRO
                        </h1>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-1">
                            Gestión Logística Inteligente
                        </p>
                    </div>
                    {rawData.length > 0 && (
                        <button
                            onClick={handleResetRequest}
                            className="text-slate-400 hover:text-red-400 p-2 rounded-lg hover:bg-slate-800/50 transition-all active:scale-95"
                            title="Limpiar todo"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>

                {/* Body Scrollable */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">

                    {/* 1. SECCIÓN IMPORTACIÓN */}
                    {rawData.length === 0 ? (
                        <div className="animate-fade-in">
                            <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-slate-600 rounded-xl cursor-pointer hover:bg-slate-800/50 hover:border-[#d63384] transition-all group relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-[#d63384]/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="flex flex-col items-center justify-center pt-5 pb-6 relative z-10">
                                    <UploadCloud className="w-12 h-12 mb-3 text-slate-400 group-hover:text-[#d63384] transition-all group-hover:scale-110" />
                                    <p className="mb-2 text-sm text-slate-300 font-bold">Cargar Planilla Excel</p>
                                    <p className="text-xs text-slate-500">Arrastra o haz clic aquí</p>
                                    <p className="text-[10px] text-slate-600 mt-2">Formatos: .xlsx, .xls</p>
                                </div>
                                <input type="file" accept=".xlsx,.xls" onChange={procesarExcel} className="hidden" />
                            </label>
                        </div>
                    ) : (
                        <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 border border-emerald-500/30 p-4 rounded-xl flex items-center gap-3 animate-fade-in shadow-lg">
                            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-2.5 rounded-lg text-white shadow-md">
                                <FileSpreadsheet size={20} />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Datos Cargados</p>
                                <p className="text-sm text-slate-200 font-semibold">{rawData.length} pedidos</p>
                            </div>
                        </div>
                    )}

                    {/* 2. SECCIÓN CONFIGURACIÓN */}
                    {rawData.length > 0 && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                <Settings size={14} className="text-[#d63384]" />
                                Configuración
                            </div>

                            <div className="bg-slate-800/50 backdrop-blur-sm p-4 rounded-xl border border-slate-700/50 space-y-4 shadow-lg">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 block mb-2 uppercase tracking-wide">
                                        Local Origen
                                    </label>
                                    <div className="relative">
                                        <select
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm font-bold text-white focus:border-[#d63384] focus:ring-2 focus:ring-[#d63384]/20 outline-none appearance-none transition-all"
                                            value={config.local}
                                            onChange={e => {
                                                setConfig({...config, local: e.target.value, horasSeleccionadas: []});
                                                const c = COORD_LOC[e.target.value];
                                                if(c) setMapCenter([c.lat, c.lng]);
                                            }}
                                        >
                                            <option value="">Seleccione Local...</option>
                                            {localesDisponibles.map(l => <option key={l} value={l}>Local {l}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-3.5 text-slate-500 pointer-events-none" size={16} />
                                    </div>
                                </div>

                                <BlockSelector config={config} setConfig={setConfig} mapaConteos={mapaConteos} />

                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 block mb-2 uppercase tracking-wide">
                                        Flota Disponible
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                type="number"
                                                min="1"
                                                value={config.moviles}
                                                onChange={e => {
                                                    const val=parseInt(e.target.value);
                                                    setConfig({...config, moviles: (isNaN(val)||val<1)?1:val})
                                                }}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 pl-10 text-white font-bold text-sm focus:border-[#d63384] focus:ring-2 focus:ring-[#d63384]/20 outline-none transition-all"
                                            />
                                            <Truck className="absolute left-3 top-3 text-slate-500" size={18} />
                                        </div>
                                        <button
                                            onClick={autoAsignarRutas}
                                            disabled={calculandoRuta}
                                            className="bg-gradient-to-r from-[#d63384] to-pink-600 hover:from-pink-600 hover:to-[#d63384] text-white font-bold py-3 px-5 rounded-lg text-xs shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center gap-2"
                                        >
                                            {calculandoRuta ? (
                                                <>
                                                    <RefreshCw size={14} className="animate-spin" />
                                                    <span>Procesando...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Navigation size={14} />
                                                    <span>CALCULAR</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. SECCIÓN HERRAMIENTAS */}
                    {pedidos.length > 0 && (
                        <div className="space-y-3 animate-fade-in">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                        <span className="flex items-center gap-2">
                            <Layers size={14} className="text-[#d63384]" />
                            Herramientas
                        </span>
                                <button
                                    onClick={() => trazarRutasEstricto(pedidos)}
                                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors bg-slate-800/50 px-2 py-1 rounded-lg"
                                >
                                    <RefreshCw size={12}/>
                                    <span className="text-[10px]">Recalcular</span>
                                </button>
                            </div>

                            <div className="bg-slate-800/50 backdrop-blur-sm p-4 rounded-xl border border-slate-700/50 space-y-3 shadow-lg">

                                {/* Selector de Ruta Destino */}
                                <div className="flex gap-2">
                                    <select
                                        id="rutaDestino"
                                        className="bg-slate-900 text-sm border border-slate-700 rounded-lg flex-1 h-10 px-3 font-bold text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                    >
                                        <option value="LAT">Mover a LAT</option>
                                        {[...Array(config.moviles)].map((_, i) => (
                                            <option key={i+1} value={i+1}>Mover a RUTA {i+1}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={moverPedidosMasivo}
                                        className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white px-4 rounded-lg text-xs font-bold h-10 shadow-md transition-all active:scale-95 whitespace-nowrap flex items-center gap-2"
                                    >
                                        <Truck size={14} />
                                        MOVER ({selectedIds.size})
                                    </button>
                                </div>

                                {/* ✨ Botón Lazo Manual */}
                                <button
                                    onClick={() => {
                                        setIsLassoMode(!isLassoMode);
                                        if (isLassoMode) {
                                            setSelectedIds(new Set());
                                        }
                                    }}
                                    className={`w-full font-bold py-3 rounded-lg text-sm shadow-md border transition-all flex items-center justify-center gap-2 ${
                                        isLassoMode
                                            ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white border-rose-400 hover:from-rose-600 hover:to-rose-500'
                                            : 'bg-gradient-to-r from-slate-700 to-slate-600 text-slate-200 border-slate-600 hover:from-slate-600 hover:to-slate-700'
                                    } active:scale-95`}
                                >
                                    {isLassoMode ? (
                                        <>
                                            <X size={16} />
                                            CANCELAR SELECCIÓN
                                        </>
                                    ) : (
                                        <>
                                            <Pencil size={16} />
                                            DIBUJAR SELECCIÓN
                                        </>
                                    )}
                                </button>

                                {/* Botón para limpiar selección */}
                                {selectedIds.size > 0 && !isLassoMode && (
                                    <button
                                        onClick={deselecionarTodos}
                                        className="w-full font-bold py-2.5 rounded-lg text-xs shadow-sm border border-slate-600 bg-slate-700/50 text-slate-300 hover:bg-slate-600 hover:text-white transition-all flex items-center justify-center gap-2 active:scale-95"
                                    >
                                        <X size={14} />
                                        LIMPIAR SELECCIÓN ({selectedIds.size})
                                    </button>
                                )}

                                {/* Toggle de líneas */}
                                <div
                                    onClick={() => setMostrarLineas(!mostrarLineas)}
                                    className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-all select-none group"
                                >
                                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all ${
                                        mostrarLineas
                                            ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-500'
                                            : 'border-slate-500 bg-transparent group-hover:border-slate-400'
                                    }`}>
                                        {mostrarLineas && <CheckCircle2 size={14} className="text-white" />}
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-sm font-semibold text-slate-200 block">Trazado de calles</span>
                                        <span className="text-[10px] text-slate-400">Visualizar rutas en el mapa</span>
                                    </div>
                                    {mostrarLineas ? <Eye size={16} className="text-emerald-400" /> : <EyeOff size={16} className="text-slate-500" />}
                                </div>

                                {/* Información de modo lazo */}
                                {isLassoMode && (
                                    <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 p-3 rounded-lg animate-pulse">
                                        <p className="text-xs text-purple-300 font-semibold flex items-center gap-2">
                                            <Pencil size={14} />
                                            Dibuja un área en el mapa para seleccionar pedidos
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Panel */}
                <div className="p-4 bg-[#0b1b36]/80 backdrop-blur-sm border-t border-slate-700/50 flex-shrink-0 space-y-2">
                    <button
                        onClick={descargarExcel}
                        disabled={pedidos.length===0}
                        className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:active:scale-100"
                    >
                        <FileSpreadsheet size={18} />
                        EXPORTAR HOJA DE RUTA
                    </button>

                    <button
                        onClick={descargarPantallazosRutas}
                        disabled={pedidos.length===0}
                        className="w-full bg-gradient-to-r from-[#d63384] to-pink-500 hover:from-pink-500 hover:to-[#d63384] disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:active:scale-100"
                        title="Genera un PDF con pantallazos del mapa por cada ruta"
                    >
                        <Maximize2 size={18} />
                        DESCARGAR RUTAS (PANTALLAZO)
                    </button>

                    {pedidos.length > 0 && (
                        <div className="text-center text-[10px] text-slate-400 font-medium">
                            {pedidos.length} pedidos • {Object.keys(rutasReales).length} rutas
                        </div>
                    )}
                </div>
            </div>

            {/* --- MAPA (RIGHT) --- */}
            <div ref={mapCaptureRef} className="flex-1 relative h-full bg-slate-200 z-0">
                <MapContainer
                    center={mapCenter}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                    className="z-0"
                >
                    <InvalidateSize />
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OSM'
                    />
                    <MapFocusHandler
                        rutasDestacadas={rutasDestacadas}
                        rutasReales={rutasReales}
                        pedidos={pedidos}
                    />

                    {/* ✨ Componente de Lazo Manual */}
                    <LassoSelector
                        active={isLassoMode}
                        onLassoComplete={handleLassoComplete}
                    />

                    {/* Polylines */}
                    {mostrarLineas && Object.keys(rutasReales).map(k => {
                        const routeKey = k === 'LAT' ? 'LAT' : parseInt(k);
                        const rIdNum = typeof routeKey === 'number' ? routeKey : null;
                        const r = rutasReales[k];
                        const isSelected = rutasDestacadas.has(routeKey);
                        const isAnythingSelected = rutasDestacadas.size > 0;
                        const isVisible = !isAnythingSelected || isSelected;
                        const opacity = isVisible ? (isSelected ? 1 : 0.6) : 0.1;
                        const weight = isSelected ? 7 : 5;
                        const color = k==='LAT' ? COLOR_LAT : COLORES_RUTAS[((rIdNum||1)-1)%COLORES_RUTAS.length];

                        return (
                            <Polyline
                                key={k}
                                positions={r.positions}
                                color={color}
                                weight={weight}
                                opacity={opacity}
                                // Menos simplificación para trazado más preciso
                                smoothFactor={0}
                            />
                        )
                    })}

                    {/* Marcador Tienda */}
                    {config.local && COORD_LOC[config.local] && (
                        <Marker
                            position={[COORD_LOC[config.local].lat, COORD_LOC[config.local].lng]}
                            icon={storeIcon}
                        >
                            <Popup className="font-sans text-xs font-bold">
                                <div className="p-2">
                                    <div className="text-center font-bold text-sm text-[#1e3c72] mb-1">
                                        📍 Centro de Distribución
                                    </div>
                                    <div className="text-xs text-slate-600">
                                        Local {config.local}
                                    </div>
                                </div>
                            </Popup>
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
                                eventHandlers={{
                                    click: () => {
                                        if (isLassoMode) return; // No permitir selección individual en modo lazo
                                        const s = new Set(selectedIds);
                                        if(s.has(p.id)) s.delete(p.id);
                                        else s.add(p.id);
                                        setSelectedIds(s);
                                    }
                                }}
                            >
                                <Popup>
                                    <div className="p-2 min-w-[200px] font-sans">
                                        <div className="flex justify-between items-start border-b border-slate-200 pb-2 mb-3">
                                            <strong className="text-sm font-bold text-slate-800 uppercase leading-tight">
                                                {p.cliente}
                                            </strong>
                                            <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                    #{p.id}
                                </span>
                                        </div>

                                        <div className="mb-3 space-y-1">
                                            <p className="text-xs text-slate-600 leading-tight flex items-start gap-1">
                                                <MapIcon size={12} className="text-slate-400 mt-0.5 flex-shrink-0" />
                                                <span>{p.direccion}</span>
                                            </p>
                                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                                                {p.comuna}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                                                <label className="block text-[9px] font-bold text-slate-400 mb-1 uppercase">
                                                    Ruta
                                                </label>
                                                <select
                                                    className="w-full bg-white border border-slate-300 rounded-md text-xs font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                    value={p.ruta}
                                                    onChange={(e) => cambiarRutaManual(p.id, e.target.value)}
                                                >
                                                    <option value="LAT">LAT</option>
                                                    {[...Array(config.moviles)].map((_,i)=>(
                                                        <option key={i+1} value={i+1}>R{i+1}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                                                <label className="block text-[9px] font-bold text-slate-400 mb-1 uppercase">
                                                    Orden
                                                </label>
                                                <select
                                                    className="w-full bg-white border border-slate-300 rounded-md text-xs font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                    value={p.secuencia}
                                                    onChange={(e) => cambiarSecuenciaManual(p.id, e.target.value)}
                                                >
                                                    {[...Array(pedidos.filter(x => x.ruta === p.ruta).length)].map((_,i)=>(
                                                        <option key={i+1} value={i+1}>{i+1}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 px-3 py-2 rounded-lg text-center font-bold text-sm border border-blue-200 shadow-sm">
                                            <Package size={14} className="inline mr-1" />
                                            {p.bultos} Bultos
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
                        const r = i+1;
                        const pts = pedidos.filter(p => p.ruta === r);
                        if(pts.length===0) return null;
                        const info = rutasReales[r];
                        const isActive = rutasDestacadas.has(r);
                        const color = COLORES_RUTAS[i % COLORES_RUTAS.length];

                        return (
                            <div
                                key={r}
                                onClick={() => toggleRutaDestacada(r)}
                                className={`
                        flex flex-col min-w-[160px] bg-white/95 backdrop-blur-lg rounded-2xl p-4 shadow-xl cursor-pointer 
                        transition-all duration-300 border-b-4 snap-center select-none group relative overflow-hidden
                        ${isActive
                                    ? 'ring-4 ring-slate-400/50 ring-offset-2 translate-y-[-6px] shadow-2xl scale-105'
                                    : 'hover:translate-y-[-3px] hover:shadow-2xl hover:scale-102'
                                }
                    `}
                                style={{ borderColor: color }}
                            >
                                {/* Efecto de brillo en hover */}
                                <div
                                    className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                    style={{ background: `linear-gradient(135deg, transparent 0%, ${color}20 100%)` }}
                                ></div>

                                <div className="relative z-10">
                                    <div className="flex justify-between items-center mb-3">
                            <span className="text-sm font-black text-slate-700 uppercase tracking-wider">
                                RUTA {r}
                            </span>
                                        {info ? (
                                            <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-bold shadow-sm">
                                    REAL
                                </span>
                                        ) : (
                                            <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-1 rounded-full font-bold">
                                    EST
                                </span>
                                        )}
                                    </div>

                                    <div className="flex items-baseline gap-1.5 mb-2">
                            <span className="text-3xl font-black text-slate-800 leading-none">
                                {info?.km || '-'}
                            </span>
                                        <span className="text-xs font-bold text-slate-400">km</span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm font-medium text-slate-500 mb-3">
                            <span className="flex items-center gap-1">
                                <Navigation size={12} />
                                {info ? formatDuration(info.min) : '-'}
                            </span>
                                    </div>

                                    <div
                                        className={`flex justify-between items-center text-xs font-bold p-2 rounded-lg transition-all ${
                                            isActive
                                                ? 'bg-slate-100 text-slate-700 shadow-sm'
                                                : 'bg-slate-50 text-slate-500 group-hover:bg-slate-100 group-hover:text-slate-600'
                                        }`}
                                    >
                            <span className="flex items-center gap-1.5">
                                <MapIcon size={12}/>
                                {pts.length}
                            </span>
                                        <span className="flex items-center gap-1.5">
                                <Package size={12}/>
                                            {pts.reduce((s,x)=>s+x.bultos,0)}
                            </span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}

                    {/* LAT (Móvil de apoyo) */}
                    {(() => {
                        const pts = pedidos.filter(p => p.ruta === 'LAT');
                        if (pts.length === 0) return null;
                        const info = rutasReales['LAT'];
                        const isActive = rutasDestacadas.has('LAT');
                        const color = COLOR_LAT;

                        return (
                            <div
                                key="LAT"
                                onClick={() => toggleRutaDestacada('LAT')}
                                className={`
                                    flex flex-col min-w-[180px] bg-white/95 backdrop-blur-lg rounded-2xl p-4 shadow-xl cursor-pointer
                                    transition-all duration-300 border-b-4 snap-center select-none group relative overflow-hidden
                                    ${isActive
                                    ? 'ring-4 ring-slate-400/50 ring-offset-2 translate-y-[-6px] shadow-2xl scale-105'
                                    : 'hover:translate-y-[-3px] hover:shadow-2xl hover:scale-102'
                                }
                                `}
                                style={{ borderColor: color }}
                            >
                                <div
                                    className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                    style={{ background: `linear-gradient(135deg, transparent 0%, ${color}20 100%)` }}
                                ></div>

                                <div className="relative z-10">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-sm font-black text-slate-700 uppercase tracking-wider">
                                            LAT (APOYO)
                                        </span>
                                        {info ? (
                                            <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-bold shadow-sm">
                                                REAL
                                            </span>
                                        ) : (
                                            <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-1 rounded-full font-bold">
                                                EST
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-baseline gap-1.5 mb-2">
                                        <span className="text-3xl font-black text-slate-800 leading-none">
                                            {info?.km || '-'}
                                        </span>
                                        <span className="text-xs font-bold text-slate-400">km</span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm font-medium text-slate-500 mb-3">
                                        <span className="flex items-center gap-1">
                                            <Navigation size={12} />
                                            {info ? formatDuration(info.min) : '-'}
                                        </span>
                                    </div>

                                    <div
                                        className={`flex justify-between items-center text-xs font-bold p-2 rounded-lg transition-all ${
                                            isActive
                                                ? 'bg-slate-100 text-slate-700 shadow-sm'
                                                : 'bg-slate-50 text-slate-500 group-hover:bg-slate-100 group-hover:text-slate-600'
                                        }`}
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <MapIcon size={12}/>
                                            {pts.length}
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <Package size={12}/>
                                            {pts.reduce((s,x)=>s+x.bultos,0)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Instrucciones de modo lazo */}
                {isLassoMode && (
                    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-[1000] bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-full shadow-2xl animate-bounce">
                        <p className="text-sm font-bold flex items-center gap-2">
                            <Pencil size={16} />
                            Haz clic y arrastra para dibujar un área de selección
                        </p>
                    </div>
                )}
            </div>

            {/* --- MODAL FLOTANTE (MOVER PEDIDOS) --- */}
            {showModalRuta && (
                <div className="fixed inset-0 bg-slate-900/70 z-[9999] flex items-center justify-center backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">

                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-slate-100">
                            <div>
                                <h3 className="text-2xl font-black text-[#1e3c72] flex items-center gap-3">
                                    <div className="p-2 bg-[#d63384] rounded-lg">
                                        <MousePointer2 className="text-white" size={20} />
                                    </div>
                                    Mover {selectedIds.size} Pedidos
                                </h3>
                                <p className="text-sm text-slate-500 mt-2">
                                    Selecciona la ruta de destino para los puntos seleccionados.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowModalRuta(false)}
                                className="bg-white p-2.5 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 shadow-md border border-slate-200 transition-all active:scale-95"
                            >
                                <X size={22}/>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 overflow-y-auto bg-gradient-to-br from-slate-50/50 to-white">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {[...Array(config.moviles)].map((_, i) => {
                                    const color = COLORES_RUTAS[i % COLORES_RUTAS.length];
                                    return (
                                        <button
                                            key={i+1}
                                            onClick={() => asignarRutaDesdeModal(i+1)}
                                            className="relative flex flex-col items-center justify-center py-8 bg-white border-2 border-slate-200 hover:border-current rounded-2xl transition-all shadow-md hover:shadow-xl group overflow-hidden"
                                            style={{
                                                '--hover-color': color,
                                                borderColor: 'var(--hover-color)'
                                            }}
                                        >
                                            <div
                                                className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity"
                                                style={{ backgroundColor: color }}
                                            ></div>
                                            <span
                                                className="text-3xl font-black text-slate-300 group-hover:text-current mb-2 transition-colors relative z-10"
                                                style={{ color: color }}
                                            >
                                        R{i+1}
                                      </span>
                                            <span className="text-xs font-bold text-slate-500 group-hover:text-slate-700 uppercase relative z-10">
                                        Asignar
                                      </span>
                                        </button>
                                    )
                                })}

                                <button
                                    onClick={() => asignarRutaDesdeModal('LAT')}
                                    className="relative flex flex-col items-center justify-center py-8 bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-slate-300 hover:border-slate-500 hover:from-slate-200 hover:to-slate-300 rounded-2xl transition-all shadow-md hover:shadow-xl group col-span-2 sm:col-span-1"
                                >
                              <span className="text-2xl font-black text-slate-500 group-hover:text-slate-700 mb-2 transition-colors">
                                LAT
                              </span>
                                    <span className="text-xs font-bold text-slate-600 group-hover:text-slate-800 uppercase">
                                Lateral
                              </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}