import PageHeader from "../ui/PageHeader";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import {
    Package,
    Search,
    RefreshCw,
    Image as ImageIcon,
    X,
    Download,
    AlertCircle,
    CheckCircle2,
    Clock,
    ChevronLeft,
    ChevronRight,
    Images,
    Calendar,
    Filter,
} from "lucide-react";

function safeParseJSONList(v) {
    if (Array.isArray(v)) return v.map((x) => String(x));
    if (v && typeof v === "object") return [JSON.stringify(v)];

    try {
        const s = String(v ?? "").trim();
        if (!s) return [];
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map((x) => String(x));
        return [];
    } catch {
        return String(v ?? "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
    }
}

function safeDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

export default function Devoluciones() {
    const [registros, setRegistros] = useState([]);
    const [busqueda, setBusqueda] = useState("");
    const [loading, setLoading] = useState(false);

    // Estados para filtros
    const [filtroStatus, setFiltroStatus] = useState("todos"); // 'todos', 'pendiente', 'confirmada'

    // Inicializar fechas con el día de hoy
    const hoy = new Date().toISOString().split('T')[0];
    const [fechaInicio, setFechaInicio] = useState(hoy);
    const [fechaFin, setFechaFin] = useState(hoy);
    const [mostrarFiltroFechas, setMostrarFiltroFechas] = useState(false);

    // Estados para paginación
    const [paginaActual, setPaginaActual] = useState(1);
    const registrosPorPagina = 10;

    const [galeriaModal, setGaleriaModal] = useState(null);
    const [imagenActual, setImagenActual] = useState(0);
    const [sgModal, setSgModal] = useState(null);

    useEffect(() => {
        let canal = null;

        const setup = async () => {
            await fetchData();

            canal = supabase
                .channel("devoluciones-live")
                .on(
                    "postgres_changes",
                    { event: "*", schema: "public", table: "devoluciones_bodega" },
                    () => fetchData()
                )
                .subscribe();
        };

        setup();

        return () => {
            if (canal) supabase.removeChannel(canal);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("devoluciones_bodega")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) console.error("❌ Error al cargar:", error);
        else setRegistros(data || []);

        setTimeout(() => setLoading(false), 300);
    };

    const registrosFiltrados = useMemo(() => {
        let resultado = registros;

        // Filtro por búsqueda de texto
        const q = busqueda.toLowerCase().trim();
        if (q) {
            resultado = resultado.filter((item) => {
                const patente = String(item.patente ?? "").toLowerCase();
                const ruta = String(item.id_manifiesto ?? "").toLowerCase();
                const key = String(item.key ?? "").toLowerCase();
                const status = String(item.status ?? "").toLowerCase();
                return (
                    patente.includes(q) ||
                    ruta.includes(q) ||
                    key.includes(q) ||
                    status.includes(q)
                );
            });
        }

        // Filtro por status
        if (filtroStatus !== "todos") {
            resultado = resultado.filter((item) =>
                filtroStatus === "confirmada"
                    ? item.status === "confirmada"
                    : item.status !== "confirmada"
            );
        }

        // Filtro por rango de fechas
        if (fechaInicio || fechaFin) {
            resultado = resultado.filter((item) => {
                const fecha = safeDate(item.created_at);
                if (!fecha) return false;

                const fechaSoloFecha = new Date(
                    fecha.getFullYear(),
                    fecha.getMonth(),
                    fecha.getDate()
                );

                if (fechaInicio && fechaFin) {
                    const inicio = new Date(fechaInicio);
                    const fin = new Date(fechaFin);
                    return fechaSoloFecha >= inicio && fechaSoloFecha <= fin;
                } else if (fechaInicio) {
                    const inicio = new Date(fechaInicio);
                    return fechaSoloFecha >= inicio;
                } else if (fechaFin) {
                    const fin = new Date(fechaFin);
                    return fechaSoloFecha <= fin;
                }

                return true;
            });
        }

        return resultado;
    }, [registros, busqueda, filtroStatus, fechaInicio, fechaFin]);

    // Cálculos de estadísticas
    const totalRegistros = registrosFiltrados.length;
    const pendientes = useMemo(
        () => registrosFiltrados.filter((r) => r.status !== "confirmada").length,
        [registrosFiltrados]
    );
    const confirmadas = useMemo(
        () => registrosFiltrados.filter((r) => r.status === "confirmada").length,
        [registrosFiltrados]
    );

    // Paginación
    const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina);
    const registrosPaginados = useMemo(() => {
        const inicio = (paginaActual - 1) * registrosPorPagina;
        const fin = inicio + registrosPorPagina;
        return registrosFiltrados.slice(inicio, fin);
    }, [registrosFiltrados, paginaActual]);

    // Reset página cuando cambian filtros
    useEffect(() => {
        setPaginaActual(1);
    }, [busqueda, filtroStatus, fechaInicio, fechaFin]);

    const cambiarPagina = (nuevaPagina) => {
        if (nuevaPagina >= 1 && nuevaPagina <= totalPaginas) {
            setPaginaActual(nuevaPagina);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    const limpiarFiltros = () => {
        setBusqueda("");
        setFiltroStatus("todos");
        const hoy = new Date().toISOString().split('T')[0];
        setFechaInicio(hoy);
        setFechaFin(hoy);
        setPaginaActual(1);
    };

    const abrirGaleria = (item) => {
        const fotos = [];

        if (item.foto_url) fotos.push(item.foto_url);

        const adicionales = safeParseJSONList(item.fotos_adicionales);
        fotos.push(...adicionales);

        if (fotos.length > 0) {
            setGaleriaModal({
                fotos,
                patente: item.patente,
                ruta: item.id_manifiesto,
            });
            setImagenActual(0);
        }
    };

    const siguienteImagen = () => {
        if (galeriaModal && imagenActual < galeriaModal.fotos.length - 1) {
            setImagenActual((v) => v + 1);
        }
    };

    const anteriorImagen = () => {
        if (imagenActual > 0) {
            setImagenActual((v) => v - 1);
        }
    };

    const cerrarGaleria = () => {
        setGaleriaModal(null);
        setImagenActual(0);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 p-6 md:p-8 font-sans animate-fade-in relative">
            <PageHeader
                title="Centro de Devoluciones"
                subtitle="Gestión de devoluciones por ruta • Cada registro representa un identificador de ruta completo"
                icon={Package}
            />

            {/* Stats Cards - Ahora son botones funcionales */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <button
                    onClick={() => setFiltroStatus("todos")}
                    className={`bg-white p-5 rounded-2xl shadow-sm border-2 transition-all text-left ${
                        filtroStatus === "todos"
                            ? "border-blue-500 shadow-lg scale-[1.02]"
                            : "border-slate-200 hover:shadow-md hover:border-blue-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Total Registros
                            </p>
                            <p className="text-3xl font-black text-slate-900">
                                {totalRegistros}
                            </p>
                        </div>
                        <div
                            className={`p-3 rounded-xl ${
                                filtroStatus === "todos"
                                    ? "bg-blue-600"
                                    : "bg-blue-100"
                            }`}
                        >
                            <Package
                                className={
                                    filtroStatus === "todos"
                                        ? "text-white"
                                        : "text-blue-600"
                                }
                                size={24}
                            />
                        </div>
                    </div>
                    {filtroStatus === "todos" && (
                        <div className="mt-2 text-xs font-bold text-blue-600">
                            ✓ Filtro activo
                        </div>
                    )}
                </button>

                <button
                    onClick={() => setFiltroStatus("pendiente")}
                    className={`bg-white p-5 rounded-2xl shadow-sm border-2 transition-all text-left ${
                        filtroStatus === "pendiente"
                            ? "border-amber-500 shadow-lg scale-[1.02]"
                            : "border-amber-200 hover:shadow-md hover:border-amber-400"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
                                Pendientes
                            </p>
                            <p className="text-3xl font-black text-amber-700">
                                {pendientes}
                            </p>
                        </div>
                        <div
                            className={`p-3 rounded-xl ${
                                filtroStatus === "pendiente"
                                    ? "bg-amber-600"
                                    : "bg-amber-100"
                            }`}
                        >
                            <Clock
                                className={
                                    filtroStatus === "pendiente"
                                        ? "text-white"
                                        : "text-amber-600"
                                }
                                size={24}
                            />
                        </div>
                    </div>
                    {filtroStatus === "pendiente" && (
                        <div className="mt-2 text-xs font-bold text-amber-600">
                            ✓ Filtro activo
                        </div>
                    )}
                </button>

                <button
                    onClick={() => setFiltroStatus("confirmada")}
                    className={`bg-white p-5 rounded-2xl shadow-sm border-2 transition-all text-left ${
                        filtroStatus === "confirmada"
                            ? "border-emerald-500 shadow-lg scale-[1.02]"
                            : "border-emerald-200 hover:shadow-md hover:border-emerald-400"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">
                                Confirmadas
                            </p>
                            <p className="text-3xl font-black text-emerald-700">
                                {confirmadas}
                            </p>
                        </div>
                        <div
                            className={`p-3 rounded-xl ${
                                filtroStatus === "confirmada"
                                    ? "bg-emerald-600"
                                    : "bg-emerald-100"
                            }`}
                        >
                            <CheckCircle2
                                className={
                                    filtroStatus === "confirmada"
                                        ? "text-white"
                                        : "text-emerald-600"
                                }
                                size={24}
                            />
                        </div>
                    </div>
                    {filtroStatus === "confirmada" && (
                        <div className="mt-2 text-xs font-bold text-emerald-600">
                            ✓ Filtro activo
                        </div>
                    )}
                </button>
            </div>

            {/* Barra de búsqueda y filtros */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6">
                {/* Indicador de día actual */}
                <div className="mb-4 flex items-center justify-between pb-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-2 rounded-lg">
                            <Calendar className="text-white" size={18} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Mostrando registros del
                            </p>
                            <p className="text-lg font-black text-slate-900">
                                {new Date().toLocaleDateString("es-CL", {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setMostrarFiltroFechas(!mostrarFiltroFechas)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-bold text-sm"
                    >
                        <Calendar size={16} />
                        Ver otras fechas
                    </button>
                </div>

                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Búsqueda */}
                    <div className="relative flex-1">
                        <Search
                            className="absolute left-4 top-3.5 text-slate-400"
                            size={18}
                        />
                        <input
                            type="text"
                            placeholder="Buscar por patente, ruta, key o status..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        />
                    </div>

                    {/* Limpiar filtros */}
                    {(busqueda || filtroStatus !== "todos") && (
                        <button
                            onClick={limpiarFiltros}
                            className="flex items-center gap-2 px-5 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-bold text-sm"
                        >
                            <X size={16} />
                            Limpiar
                        </button>
                    )}

                    {/* Actualizar */}
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all font-bold text-sm shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        {loading ? "Sincronizando..." : "Actualizar"}
                    </button>
                </div>

                {/* Panel de filtro de fechas */}
                {mostrarFiltroFechas && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Calendar size={16} className="text-purple-600" />
                                <span className="text-sm font-bold text-slate-700">
                                    Seleccionar rango de fechas personalizado
                                </span>
                            </div>
                            <button
                                onClick={() => {
                                    const hoy = new Date().toISOString().split('T')[0];
                                    setFechaInicio(hoy);
                                    setFechaFin(hoy);
                                    setMostrarFiltroFechas(false);
                                }}
                                className="text-xs font-bold text-blue-600 hover:text-blue-700 underline"
                            >
                                Volver a hoy
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-2">
                                    Fecha Inicio
                                </label>
                                <input
                                    type="date"
                                    value={fechaInicio}
                                    onChange={(e) => setFechaInicio(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-2">
                                    Fecha Fin
                                </label>
                                <input
                                    type="date"
                                    value={fechaFin}
                                    onChange={(e) => setFechaFin(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Indicador de filtros activos */}
            {(filtroStatus !== "todos" || busqueda) && (
                <div className="mb-4 flex items-center gap-2 text-sm">
                    <Filter size={16} className="text-blue-600" />
                    <span className="font-semibold text-slate-700">
                        Filtros activos:
                    </span>
                    {filtroStatus !== "todos" && (
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                            {filtroStatus === "confirmada" ? "Confirmadas" : "Pendientes"}
                        </span>
                    )}
                    {busqueda && (
                        <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-bold">
                            Búsqueda: "{busqueda}"
                        </span>
                    )}
                </div>
            )}

            {/* Main Table */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-200">
                            <tr>
                                <th className="px-6 py-5 text-xs font-black text-slate-600 uppercase tracking-wider">
                                    Fecha y Hora
                                </th>
                                <th className="px-6 py-5 text-xs font-black text-slate-600 uppercase tracking-wider">
                                    Patente
                                </th>
                                <th className="px-6 py-5 text-xs font-black text-slate-600 uppercase tracking-wider">
                                    ID Ruta
                                </th>
                                <th className="px-6 py-5 text-xs font-black text-slate-600 uppercase tracking-wider">
                                    Estado
                                </th>
                                <th className="px-6 py-5 text-xs font-black text-slate-600 uppercase tracking-wider text-center">
                                    Evidencia
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                            {registrosPaginados.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-16 text-center">
                                        <div className="flex flex-col items-center gap-3 text-slate-400">
                                            <div className="bg-slate-100 p-4 rounded-full">
                                                <AlertCircle size={40} className="opacity-50" />
                                            </div>
                                            <p className="font-bold text-lg">
                                                No se encontraron registros
                                            </p>
                                            <p className="text-sm">
                                                {busqueda || filtroStatus !== "todos"
                                                    ? "Intenta ajustar los filtros de búsqueda"
                                                    : "No hay registros para el día de hoy"}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                registrosPaginados.map((item) => {
                                    const dt = safeDate(item.created_at);
                                    const isConfirmada = item.status === "confirmada";

                                    const fotosAdicionales = safeParseJSONList(
                                        item.fotos_adicionales
                                    );
                                    const totalFotos =
                                        (item.foto_url ? 1 : 0) + fotosAdicionales.length;

                                    return (
                                        <tr
                                            key={item.id}
                                            className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent transition-all group"
                                        >
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-mono text-xs text-slate-500 font-semibold">
                                                        {dt ? dt.toLocaleDateString("es-CL") : "-"}
                                                    </span>
                                                    <span className="font-mono text-xs text-slate-400">
                                                        {dt
                                                            ? dt.toLocaleTimeString("es-CL", {
                                                                  hour: "2-digit",
                                                                  minute: "2-digit",
                                                              })
                                                            : "--:--"}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="px-6 py-5">
                                                <span className="inline-flex items-center font-black text-blue-700 bg-gradient-to-r from-blue-50 to-blue-100 px-3 py-2 rounded-xl border-2 border-blue-200 text-sm tracking-wider shadow-sm">
                                                    {item.patente}
                                                </span>
                                            </td>

                                            <td className="px-6 py-5">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const sgList = safeParseJSONList(item.sg);
                                                        const ordenList = safeParseJSONList(
                                                            item.numero_orden
                                                        );
                                                        const subEstados = safeParseJSONList(
                                                            item.sub_estado
                                                        );

                                                        setSgModal({
                                                            ruta: item.id_manifiesto,
                                                            patente: item.patente,
                                                            sgList,
                                                            ordenList,
                                                            subEstados,
                                                        });
                                                    }}
                                                    className="font-mono font-bold text-slate-700 hover:text-blue-600 hover:underline decoration-2 underline-offset-4 transition-all"
                                                    title="Ver detalles de SG asociados"
                                                >
                                                    {item.id_manifiesto}
                                                </button>
                                            </td>

                                            <td className="px-6 py-5">
                                                <span
                                                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wide border-2 shadow-sm ${
                                                        isConfirmada
                                                            ? "bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-300"
                                                            : "bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 border-amber-300"
                                                    }`}
                                                >
                                                    {isConfirmada ? (
                                                        <CheckCircle2 size={14} />
                                                    ) : (
                                                        <Clock size={14} />
                                                    )}
                                                    {item.status || "pendiente"}
                                                </span>
                                            </td>

                                            <td className="px-6 py-5 text-center">
                                                {totalFotos > 0 ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => abrirGaleria(item)}
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-100 to-slate-200 hover:from-blue-600 hover:to-blue-700 text-slate-700 hover:text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow-md"
                                                    >
                                                        {totalFotos > 1 ? (
                                                            <>
                                                                <Images size={14} />
                                                                Ver {totalFotos} Fotos
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ImageIcon size={14} />
                                                                Ver Foto
                                                            </>
                                                        )}
                                                    </button>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 text-slate-300 text-xs italic px-3 py-2 bg-slate-50 rounded-lg">
                                                        <X size={12} />
                                                        Sin evidencia
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer con paginación */}
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-t-2 border-slate-200">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <span className="text-xs font-bold text-slate-600">
                            Mostrando{" "}
                            <span className="text-blue-600">
                                {totalRegistros === 0
                                    ? 0
                                    : (paginaActual - 1) * registrosPorPagina + 1}
                            </span>
                            {" - "}
                            <span className="text-blue-600">
                                {Math.min(
                                    paginaActual * registrosPorPagina,
                                    totalRegistros
                                )}
                            </span>{" "}
                            de{" "}
                            <span className="text-blue-600">{totalRegistros}</span>{" "}
                            registro{totalRegistros !== 1 ? "s" : ""}
                        </span>

                        {/* Controles de paginación */}
                        {totalPaginas > 1 && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => cambiarPagina(1)}
                                    disabled={paginaActual === 1}
                                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    Primera
                                </button>

                                <button
                                    onClick={() => cambiarPagina(paginaActual - 1)}
                                    disabled={paginaActual === 1}
                                    className="p-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronLeft size={16} />
                                </button>

                                <div className="flex items-center gap-1">
                                    {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                                        .filter((num) => {
                                            // Mostrar: primera, última, actual, y 2 a cada lado de la actual
                                            return (
                                                num === 1 ||
                                                num === totalPaginas ||
                                                Math.abs(num - paginaActual) <= 2
                                            );
                                        })
                                        .map((num, idx, arr) => {
                                            // Agregar separador si hay salto
                                            const mostrarSeparador =
                                                idx > 0 && num - arr[idx - 1] > 1;

                                            return (
                                                <div key={num} className="flex items-center gap-1">
                                                    {mostrarSeparador && (
                                                        <span className="px-2 text-slate-400">
                                                            ...
                                                        </span>
                                                    )}
                                                    <button
                                                        onClick={() => cambiarPagina(num)}
                                                        className={`min-w-[36px] px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                                            num === paginaActual
                                                                ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md"
                                                                : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
                                                        }`}
                                                    >
                                                        {num}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                </div>

                                <button
                                    onClick={() => cambiarPagina(paginaActual + 1)}
                                    disabled={paginaActual === totalPaginas}
                                    className="p-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronRight size={16} />
                                </button>

                                <button
                                    onClick={() => cambiarPagina(totalPaginas)}
                                    disabled={paginaActual === totalPaginas}
                                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    Última
                                </button>
                            </div>
                        )}

                        <span className="text-xs text-slate-500 font-semibold">
                            CCO
                        </span>
                    </div>
                </div>
            </div>

            {/* MODAL GALERÍA DE FOTOS */}
            {galeriaModal && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
                    onClick={cerrarGaleria}
                >
                    <div
                        className="relative w-full max-w-7xl h-full max-h-screen flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-white/10 backdrop-blur-md rounded-t-2xl px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="bg-blue-600 p-2 rounded-lg">
                                    <Images className="text-white" size={20} />
                                </div>
                                <div>
                                    <p className="text-white font-black text-lg">
                                        {galeriaModal.ruta} • {galeriaModal.patente}
                                    </p>
                                    <p className="text-blue-200 text-sm font-semibold">
                                        Foto {imagenActual + 1} de {galeriaModal.fotos.length}
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={cerrarGaleria}
                                className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-xl transition-all"
                                title="Cerrar"
                            >
                                <X size={24} strokeWidth={2.5} />
                            </button>
                        </div>

                        {/* Imagen */}
                        <div className="flex-1 flex items-center justify-center relative bg-black/50 rounded-b-2xl overflow-hidden">
                            <img
                                src={galeriaModal.fotos[imagenActual]}
                                className="max-h-full max-w-full object-contain"
                                alt={`Evidencia ${imagenActual + 1}`}
                            />

                            {/* Navegación */}
                            {galeriaModal.fotos.length > 1 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={anteriorImagen}
                                        disabled={imagenActual === 0}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white p-4 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Anterior"
                                    >
                                        <ChevronLeft size={28} strokeWidth={3} />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={siguienteImagen}
                                        disabled={
                                            imagenActual === galeriaModal.fotos.length - 1
                                        }
                                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white p-4 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Siguiente"
                                    >
                                        <ChevronRight size={28} strokeWidth={3} />
                                    </button>
                                </>
                            )}

                            {/* DESCARGA (FIJO) */}
                            <a
                                href={galeriaModal.fotos[imagenActual]}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white p-3 rounded-xl transition-all shadow-lg"
                                title="Descargar imagen actual"
                            >
                                <Download size={20} />
                            </a>
                        </div>

                        {/* Miniaturas */}
                        {galeriaModal.fotos.length > 1 && (
                            <div className="mt-4 bg-white/10 backdrop-blur-md rounded-2xl p-4">
                                <div className="flex gap-3 overflow-x-auto pb-2">
                                    {galeriaModal.fotos.map((foto, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setImagenActual(idx)}
                                            className={`flex-shrink-0 relative ${
                                                idx === imagenActual
                                                    ? "ring-4 ring-blue-500"
                                                    : "ring-2 ring-white/30 hover:ring-white/50"
                                            } rounded-xl overflow-hidden transition-all`}
                                        >
                                            <img
                                                src={foto}
                                                className="w-24 h-24 object-cover"
                                                alt={`Miniatura ${idx + 1}`}
                                            />
                                            {idx === imagenActual && (
                                                <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                                    <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-black text-sm">
                                                        {idx + 1}
                                                    </div>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL SG */}
            {Boolean(sgModal) && (
                <div
                    className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setSgModal(null)}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl border-2 border-slate-200 overflow-hidden transform transition-all"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {!sgModal ? null : (
                            <>
                                <div className="px-8 py-6 bg-gradient-to-r from-blue-600 to-blue-700 border-b border-blue-800 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-blue-100 font-black uppercase tracking-widest mb-1">
                                            Detalle de Ruta
                                        </p>
                                        <h3 className="text-2xl font-black text-white flex items-baseline gap-3">
                                            {sgModal?.ruta || "-"}
                                            <span className="text-blue-200 font-mono text-base font-semibold">
                                                {sgModal?.patente || "-"}
                                            </span>
                                        </h3>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSgModal(null)}
                                        className="text-blue-100 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all"
                                        title="Cerrar"
                                    >
                                        <X size={24} strokeWidth={2.5} />
                                    </button>
                                </div>

                                <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-2">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-sm font-black text-slate-900">
                                                SG Asociados
                                            </p>
                                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-black">
                                                {sgModal?.sgList?.length || 0} items
                                            </span>
                                        </div>

                                        <div className="max-h-[400px] overflow-auto border-2 border-slate-200 rounded-2xl p-5 bg-gradient-to-br from-slate-50 to-white shadow-inner">
                                            {sgModal?.sgList?.length ? (
                                                <ul className="space-y-2">
                                                    {sgModal.sgList.map((sg, idx) => (
                                                        <li
                                                            key={idx}
                                                            className="font-mono text-sm text-slate-800 bg-white px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
                                                        >
                                                            <span className="text-slate-400 mr-2">
                                                                •
                                                            </span>
                                                            {sg}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <div className="text-center py-8">
                                                    <AlertCircle
                                                        className="mx-auto text-slate-300 mb-2"
                                                        size={32}
                                                    />
                                                    <p className="text-slate-500 text-sm font-semibold">
                                                        Sin SG asociados en el registro
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-5">
                                        <div className="border-2 border-slate-200 rounded-2xl p-4 bg-gradient-to-br from-slate-50 to-white shadow-sm">
                                            <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                                                Sub Estados
                                            </p>
                                            <div className="space-y-1.5 text-sm text-slate-800">
                                                {(sgModal?.subEstados?.length
                                                    ? sgModal.subEstados
                                                    : ["-"]
                                                ).map((x, i) => (
                                                    <div
                                                        key={i}
                                                        className="flex items-start gap-2"
                                                    >
                                                        <span className="text-slate-400 mt-0.5">
                                                            •
                                                        </span>
                                                        <span className="font-medium">{x}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="border-2 border-slate-200 rounded-2xl p-4 bg-gradient-to-br from-slate-50 to-white shadow-sm">
                                            <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                                                Nº Orden
                                            </p>
                                            <div className="max-h-[160px] overflow-auto space-y-1 text-sm">
                                                {(sgModal?.ordenList?.length
                                                    ? sgModal.ordenList
                                                    : ["-"]
                                                )
                                                    .slice(0, 50)
                                                    .map((x, i) => (
                                                        <div
                                                            key={i}
                                                            className="font-mono text-xs text-slate-700 flex items-start gap-2"
                                                        >
                                                            <span className="text-slate-400">
                                                                •
                                                            </span>
                                                            <span>{x}</span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="px-8 py-5 bg-gradient-to-r from-slate-50 to-slate-100 border-t-2 border-slate-200 flex items-center gap-2 text-xs text-slate-600">
                                    <div className="bg-blue-100 p-1.5 rounded">
                                        <AlertCircle size={14} className="text-blue-600" />
                                    </div>
                                    <span className="font-semibold">
                                        Este listado es informativo • Al confirmar la ruta
                                        se procesa el paquete completo
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}