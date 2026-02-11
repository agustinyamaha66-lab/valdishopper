import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
    UploadCloud,
    X,
    Save,
    RefreshCw,
    FileSpreadsheet,
    Lock,
    Unlock,
    Calendar,
    CheckCircle2,
    AlertCircle,
    Clock,
    Shield,
    FileCheck,
    Filter,
    ChevronDown
} from "lucide-react";
import { supabase } from "../lib/supabase";

const TABLE = "devoluciones_bodega";

const norm = (v) => String(v ?? "").trim();
const lower = (v) => norm(v).toLowerCase();

function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function toJSONListString(values) {
    const uniq = Array.from(new Set(values.map((x) => norm(x)).filter(Boolean)));
    return JSON.stringify(uniq);
}

function parsePatenteFromIdentificador(identificador) {
    const s = norm(identificador).toUpperCase();
    if (!s.startsWith("CTVS")) return "";
    return s.slice(4).trim();
}

const TOAST_STYLES = {
    success: { bg: "bg-emerald-50", border: "border-emerald-500", text: "text-emerald-800", icon: CheckCircle2 },
    error: { bg: "bg-rose-50", border: "border-rose-500", text: "text-rose-800", icon: AlertCircle },
    warning: { bg: "bg-amber-50", border: "border-amber-500", text: "text-amber-800", icon: AlertCircle },
    info: { bg: "bg-blue-50", border: "border-blue-500", text: "text-blue-800", icon: AlertCircle },
};

function ToastNotification({ toast, onClose }) {
    if (!toast.visible) return null;
    const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
    const Icon = style.icon;

    return (
        <div className={`fixed top-24 right-6 z-[9999] flex items-center gap-3 px-5 py-4 rounded-xl shadow-xl border-l-4 transition-all duration-300 ${style.bg} ${style.border} ${style.text} min-w-[320px]`}>
            <Icon size={20} />
            <p className="text-sm font-semibold leading-tight flex-1">{toast.message}</p>
            <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity">
                <X size={18} />
            </button>
        </div>
    );
}

export default function DevolucionesImportExcel() {
    const [fileName, setFileName] = useState("");
    const [rawRows, setRawRows] = useState([]);
    const [busy, setBusy] = useState(false);

    const [dbBusy, setDbBusy] = useState(false);
    const [dbRows, setDbRows] = useState([]);

    // Estado para filtro de status
    const [filtroStatus, setFiltroStatus] = useState("todos"); // 'todos', 'pendientes', 'confirmadas', 'conFoto'

    // Estados para el calendario y bloqueo
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [importLocked, setImportLocked] = useState(false);
    const [hasImportedToday, setHasImportedToday] = useState(false);
    const [showCalendar, setShowCalendar] = useState(false);
    const [lastImportInfo, setLastImportInfo] = useState(null);
    const [showLockedInfo, setShowLockedInfo] = useState(false);
    const [toast, setToast] = useState({ visible: false, message: "", type: "info" });
    const toastTimerRef = useRef(null);

    const importDate = useMemo(() => {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }, []);

    const isToday = selectedDate === importDate;

    // Verificar si ya se importó hoy
    const checkTodayImport = async () => {
        try {
            const { data, error } = await supabase
                .from(TABLE)
                .select("id, created_at, source_filename, import_date")
                .eq("import_date", importDate)
                .order("created_at", { ascending: false })
                .limit(1);

            if (error) throw error;

            if (data && data.length > 0) {
                setHasImportedToday(true);
                setImportLocked(true);
                setLastImportInfo(data[0]);
            } else {
                setHasImportedToday(false);
                setImportLocked(false);
                setLastImportInfo(null);
            }
        } catch (e) {
            console.error("Error verificando import de hoy:", e);
        }
    };

    const onPickFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
        const rows = Array.isArray(json) ? json : [];
        setRawRows(rows);

        // Guardado automático después de cargar
        if (rows.length > 0) {
            setTimeout(() => {
                guardarAutomatico(rows, file.name);
            }, 500);
        }
    };

    const filtered = useMemo(() => {
        return rawRows
            .map((r) => ({
                identificador_ruta: norm(r["Identificador ruta"]),
                identificador: norm(r["Identificador"]),
                transportadora: norm(r["Transportadora"]),
                estado: norm(r["Estado"]),
                sub_estado: norm(r["Subestado"]),
                sg: norm(r["SG"]),
                numero_orden: norm(r["Número de orden"]),
            }))
            .filter((x) => {
                const idok = lower(x.identificador).startsWith("ctvs");
                const tok = lower(x.transportadora) === "valdishopper";
                const eok = lower(x.estado) === "no entregado";
                return idok && tok && eok && !!x.identificador_ruta;
            });
    }, [rawRows]);

    const grouped = useMemo(() => {
        const m = new Map();
        for (const row of filtered) {
            const k = row.identificador_ruta;
            if (!m.has(k)) {
                m.set(k, {
                    identificador_ruta: k,
                    identificador: row.identificador,
                    transportadora: row.transportadora,
                    estado: row.estado,
                    sub_estado_set: new Set(),
                    sg_list: [],
                    orden_list: [],
                    patente: parsePatenteFromIdentificador(row.identificador),
                });
            }
            const g = m.get(k);
            g.sub_estado_set.add(row.sub_estado);
            if (row.sg) g.sg_list.push(row.sg);
            if (row.numero_orden) g.orden_list.push(row.numero_orden);
            if (!g.patente) g.patente = parsePatenteFromIdentificador(row.identificador);
        }

        return Array.from(m.values()).map((g) => ({
            identificador_ruta: g.identificador_ruta,
            patente: g.patente || "SINPAT",
            identificador: g.identificador || null,
            transportadora: g.transportadora || null,
            estado: g.estado || null,
            sub_estado: JSON.stringify(Array.from(g.sub_estado_set).filter(Boolean)),
            sg: toJSONListString(g.sg_list),
            numero_orden: toJSONListString(g.orden_list),
        }));
    }, [filtered]);

    const fetchDbRows = async () => {
        setDbBusy(true);
        try {
            const { data, error } = await supabase
                .from(TABLE)
                .select("id, created_at, import_date, patente, id_manifiesto, key, status, foto_url, confirmed_at")
                .eq("import_date", selectedDate)
                .order("created_at", { ascending: false })
                .limit(500);

            if (error) throw error;
            setDbRows(data || []);
        } catch (e) {
            console.error(e);
            showToast(e?.message || "Error cargando datos", "error");
        } finally {
            setDbBusy(false);
        }
    };

    useEffect(() => {
        checkTodayImport();
        fetchDbRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDate]);

    useEffect(() => {
        if (!importLocked || !isToday) setShowLockedInfo(false);
    }, [importLocked, isToday]);

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        };
    }, []);

    const showToast = (message, type = "info") => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ visible: true, message, type });
        toastTimerRef.current = setTimeout(() => {
            setToast((prev) => ({ ...prev, visible: false }));
        }, 4000);
    };

    const clear = () => {
        setFileName("");
        setRawRows([]);
    };

    const guardarAutomatico = async (rows, filename) => {
        if (importLocked && hasImportedToday) {
            showToast("Ya se importo data hoy. Usa 'Desbloquear' para permitir nuevos imports.", "warning");
            clear();
            return;
        }

        setBusy(true);

        try {
            // Procesar las filas
            const processedFiltered = rows
                .map((r) => ({
                    identificador_ruta: norm(r["Identificador ruta"]),
                    identificador: norm(r["Identificador"]),
                    transportadora: norm(r["Transportadora"]),
                    estado: norm(r["Estado"]),
                    sub_estado: norm(r["Subestado"]),
                    sg: norm(r["SG"]),
                    numero_orden: norm(r["Número de orden"]),
                }))
                .filter((x) => {
                    const idok = lower(x.identificador).startsWith("ctvs");
                    const tok = lower(x.transportadora) === "valdishopper";
                    const eok = lower(x.estado) === "no entregado";
                    return idok && tok && eok && !!x.identificador_ruta;
                });

            const m = new Map();
            for (const row of processedFiltered) {
                const k = row.identificador_ruta;
                if (!m.has(k)) {
                    m.set(k, {
                        identificador_ruta: k,
                        identificador: row.identificador,
                        transportadora: row.transportadora,
                        estado: row.estado,
                        sub_estado_set: new Set(),
                        sg_list: [],
                        orden_list: [],
                        patente: parsePatenteFromIdentificador(row.identificador),
                    });
                }
                const g = m.get(k);
                g.sub_estado_set.add(row.sub_estado);
                if (row.sg) g.sg_list.push(row.sg);
                if (row.numero_orden) g.orden_list.push(row.numero_orden);
                if (!g.patente) g.patente = parsePatenteFromIdentificador(row.identificador);
            }

            const processedGrouped = Array.from(m.values()).map((g) => ({
                identificador_ruta: g.identificador_ruta,
                patente: g.patente || "SINPAT",
                identificador: g.identificador || null,
                transportadora: g.transportadora || null,
                estado: g.estado || null,
                sub_estado: JSON.stringify(Array.from(g.sub_estado_set).filter(Boolean)),
                sg: toJSONListString(g.sg_list),
                numero_orden: toJSONListString(g.orden_list),
            }));

            if (!processedGrouped.length) {
                showToast("No se encontraron rutas validas para importar", "warning");
                clear();
                return;
            }

            const keys = processedGrouped.map((g) => g.identificador_ruta);
            const existingMap = new Map();

            for (const c of chunk(keys, 500)) {
                const { data, error } = await supabase
                    .from(TABLE)
                    .select("key, status, foto_url, confirmed_at, confirmed_source, patente, id_manifiesto")
                    .in("key", c);

                if (error) throw error;
                (data || []).forEach((r) => existingMap.set(r.key, r));
            }

            const payload = processedGrouped.map((g) => {
                const existing = existingMap.get(g.identificador_ruta);

                const preservedStatus = existing?.status || "pendiente";
                const preservedFoto = existing?.foto_url || null;
                const preservedConfirmedAt = existing?.confirmed_at || null;
                const preservedConfirmedSource = existing?.confirmed_source || null;

                return {
                    key: g.identificador_ruta,
                    id_manifiesto: g.identificador_ruta,
                    patente: (existing?.patente || g.patente || "SINPAT").toUpperCase(),
                    import_date: importDate,
                    source_filename: filename || null,
                    identificador: g.identificador,
                    transportadora: g.transportadora,
                    estado: g.estado,
                    sub_estado: g.sub_estado,
                    sg: g.sg,
                    numero_orden: g.numero_orden,
                    status: preservedStatus,
                    foto_url: preservedFoto,
                    confirmed_at: preservedConfirmedAt,
                    confirmed_source: preservedConfirmedSource,
                };
            });

            for (const p of chunk(payload, 500)) {
                const { error } = await supabase
                    .from(TABLE)
                    .upsert(p, { onConflict: "key" });
                if (error) throw error;
            }

            await checkTodayImport();
            await fetchDbRows();

            showToast(`Import automatico exitoso: ${payload.length} rutas procesadas`, "success");
            clear();
        } catch (e) {
            console.error(e);
            showToast(e?.message || "Error importando", "error");
            clear();
        } finally {
            setBusy(false);
        }
    };

    const guardar = async () => {
        if (!grouped.length) return;
        await guardarAutomatico(rawRows, fileName);
    };

    const desbloquearImport = () => {
        if (window.confirm("¿Estás seguro de desbloquear el import? Esto permitirá subir nueva data del día de hoy.")) {
            setImportLocked(false);
        }
    };

    const estadisticas = useMemo(() => {
        const total = dbRows.length;
        const pendientes = dbRows.filter(r => r.status !== "confirmada").length;
        const confirmadas = dbRows.filter(r => r.status === "confirmada").length;
        const conFoto = dbRows.filter(r => r.foto_url).length;

        return { total, pendientes, confirmadas, conFoto };
    }, [dbRows]);

    // Filtrar registros según el botón seleccionado
    const registrosFiltrados = useMemo(() => {
        switch (filtroStatus) {
            case "pendientes":
                return dbRows.filter(r => r.status !== "confirmada");
            case "confirmadas":
                return dbRows.filter(r => r.status === "confirmada");
            case "conFoto":
                return dbRows.filter(r => r.foto_url);
            default:
                return dbRows;
        }
    }, [dbRows, filtroStatus]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 p-6 md:p-8 font-sans">
            <ToastNotification
                toast={toast}
                onClose={() => setToast((prev) => ({ ...prev, visible: false }))}
            />
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-3 rounded-xl shadow-lg">
                        <FileSpreadsheet className="text-white" size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900">
                            Importar Devoluciones
                        </h1>
                        <p className="text-sm text-slate-600 font-medium">
                            Sistema de carga automática por rutas · {TABLE}
                        </p>
                    </div>
                </div>
            </div>

            {/* Estadísticas Cards - Ahora funcionales */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                                Total Rutas
                            </p>
                            <p className="text-3xl font-black text-slate-900">
                                {estadisticas.total}
                            </p>
                        </div>
                        <div className={`p-3 rounded-xl ${
                            filtroStatus === "todos" ? "bg-blue-600" : "bg-blue-100"
                        }`}>
                            <FileSpreadsheet className={
                                filtroStatus === "todos" ? "text-white" : "text-blue-600"
                            } size={24} />
                        </div>
                    </div>
                    {filtroStatus === "todos" && (
                        <div className="mt-2 text-xs font-bold text-blue-600">
                            ✓ Filtro activo
                        </div>
                    )}
                </button>

                <button
                    onClick={() => setFiltroStatus("pendientes")}
                    className={`bg-white p-5 rounded-2xl shadow-sm border-2 transition-all text-left ${
                        filtroStatus === "pendientes"
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
                                {estadisticas.pendientes}
                            </p>
                        </div>
                        <div className={`p-3 rounded-xl ${
                            filtroStatus === "pendientes" ? "bg-amber-600" : "bg-amber-100"
                        }`}>
                            <Clock className={
                                filtroStatus === "pendientes" ? "text-white" : "text-amber-600"
                            } size={24} />
                        </div>
                    </div>
                    {filtroStatus === "pendientes" && (
                        <div className="mt-2 text-xs font-bold text-amber-600">
                            ✓ Filtro activo
                        </div>
                    )}
                </button>

                <button
                    onClick={() => setFiltroStatus("confirmadas")}
                    className={`bg-white p-5 rounded-2xl shadow-sm border-2 transition-all text-left ${
                        filtroStatus === "confirmadas"
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
                                {estadisticas.confirmadas}
                            </p>
                        </div>
                        <div className={`p-3 rounded-xl ${
                            filtroStatus === "confirmadas" ? "bg-emerald-600" : "bg-emerald-100"
                        }`}>
                            <CheckCircle2 className={
                                filtroStatus === "confirmadas" ? "text-white" : "text-emerald-600"
                            } size={24} />
                        </div>
                    </div>
                    {filtroStatus === "confirmadas" && (
                        <div className="mt-2 text-xs font-bold text-emerald-600">
                            ✓ Filtro activo
                        </div>
                    )}
                </button>

                <button
                    onClick={() => setFiltroStatus("conFoto")}
                    className={`bg-white p-5 rounded-2xl shadow-sm border-2 transition-all text-left ${
                        filtroStatus === "conFoto"
                            ? "border-purple-500 shadow-lg scale-[1.02]"
                            : "border-purple-200 hover:shadow-md hover:border-purple-400"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">
                                Con Evidencia
                            </p>
                            <p className="text-3xl font-black text-purple-700">
                                {estadisticas.conFoto}
                            </p>
                        </div>
                        <div className={`p-3 rounded-xl ${
                            filtroStatus === "conFoto" ? "bg-purple-600" : "bg-purple-100"
                        }`}>
                            <FileCheck className={
                                filtroStatus === "conFoto" ? "text-white" : "text-purple-600"
                            } size={24} />
                        </div>
                    </div>
                    {filtroStatus === "conFoto" && (
                        <div className="mt-2 text-xs font-bold text-purple-600">
                            ✓ Filtro activo
                        </div>
                    )}
                </button>
            </div>

            {/* Indicador de filtro activo */}
            {filtroStatus !== "todos" && (
                <div className="mb-6 flex items-center gap-3 bg-gradient-to-r from-blue-50 to-slate-50 border-2 border-blue-200 rounded-xl p-4">
                    <div className="bg-blue-600 p-2 rounded-lg">
                        <Filter className="text-white" size={18} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                            Filtro activo
                        </p>
                        <p className="text-sm font-black text-slate-900">
                            {filtroStatus === "pendientes" && "Mostrando solo rutas pendientes"}
                            {filtroStatus === "confirmadas" && "Mostrando solo rutas confirmadas"}
                            {filtroStatus === "conFoto" && "Mostrando solo rutas con evidencia fotográfica"}
                        </p>
                    </div>
                    <button
                        onClick={() => setFiltroStatus("todos")}
                        className="ml-auto flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 transition-all"
                    >
                        <X size={16} />
                        Limpiar filtro
                    </button>
                </div>
            )}

            {/* Panel de Importación */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-lg mb-6">
                {/* Indicador de fecha actual y calendario */}
                <div className="mb-6 pb-6 border-b-2 border-slate-200">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-3 rounded-xl">
                                <Calendar className="text-white" size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Viendo datos del
                                </p>
                                <p className="text-xl font-black text-slate-900">
                                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString("es-CL", {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </p>
                                {isToday && (
                                    <span className="inline-flex items-center gap-1 mt-1 text-xs font-bold text-emerald-600">
                                        <CheckCircle2 size={12} />
                                        Día actual
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowCalendar(!showCalendar)}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-bold text-sm"
                            >
                                <Calendar size={16} />
                                {showCalendar ? "Ocultar" : "Seleccionar fecha"}
                            </button>

                            {!isToday && (
                                <button
                                    onClick={() => setSelectedDate(importDate)}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold text-sm"
                                >
                                    Volver a hoy
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Selector de calendario */}
                    {showCalendar && (
                        <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Seleccionar fecha
                            </label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                max={importDate}
                                className="w-full md:w-auto px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                    )}
                </div>

                {/* Estado de bloqueo */}
                {hasImportedToday && isToday && (
                    <div className={`mb-6 p-4 rounded-xl border-2 flex items-start gap-3 ${
                        importLocked 
                            ? "bg-amber-50 border-amber-300" 
                            : "bg-emerald-50 border-emerald-300"
                    }`}>
                        <div className={`p-2 rounded-lg ${
                            importLocked ? "bg-amber-100" : "bg-emerald-100"
                        }`}>
                            {importLocked ? (
                                <Lock className="text-amber-600" size={20} />
                            ) : (
                                <Unlock className="text-emerald-600" size={20} />
                            )}
                        </div>
                        <div className="flex-1">
                            <p className={`font-black text-sm ${
                                importLocked ? "text-amber-900" : "text-emerald-900"
                            }`}>
                                {importLocked
                                    ? "🔒 Import bloqueado - Ya se importó data hoy"
                                    : "🔓 Import desbloqueado - Puedes importar nueva data"
                                }
                            </p>
                            {lastImportInfo && (
                                <p className="text-xs text-slate-600 mt-1">
                                    Último import: <span className="font-semibold">{lastImportInfo.source_filename || "Sin nombre"}</span>
                                    {" · "}
                                    {new Date(lastImportInfo.created_at).toLocaleString("es-CL")}
                                </p>
                            )}
                        </div>
                        {importLocked && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowLockedInfo((v) => !v)}
                                    className="flex items-center gap-2 px-4 py-2 bg-white border border-amber-300 text-amber-800 rounded-xl hover:bg-amber-50 transition-all font-bold text-sm"
                                >
                                    <ChevronDown
                                        size={16}
                                        className={`transition-transform ${showLockedInfo ? "rotate-180" : ""}`}
                                    />
                                    {showLockedInfo ? "Ocultar detalle" : "Ver detalle"}
                                </button>
                                <button
                                    onClick={desbloquearImport}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-all font-bold text-sm"
                                >
                                    <Unlock size={16} />
                                    Desbloquear
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Solo mostrar panel de carga si es hoy y no está bloqueado */}
                {isToday && !importLocked && (
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <Shield className="text-blue-600" size={20} />
                            <h2 className="text-lg font-black text-slate-900">
                                Cargar nuevo Excel
                            </h2>
                        </div>

                        <div className="bg-gradient-to-br from-blue-50 to-slate-50 p-5 rounded-xl border-2 border-blue-200">
                            <div className="flex items-center gap-4 flex-wrap">
                                <label className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-blue-600 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-black cursor-pointer transition-all shadow-md hover:shadow-lg ${
                                    busy ? "opacity-50 cursor-not-allowed" : ""
                                }`}>
                                    <UploadCloud size={20} />
                                    {busy ? "Procesando..." : "Cargar Excel"}
                                    <input
                                        type="file"
                                        accept=".xlsx,.xls"
                                        onChange={onPickFile}
                                        className="hidden"
                                        disabled={busy}
                                    />
                                </label>

                                {fileName && (
                                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200">
                                        <FileSpreadsheet size={16} className="text-emerald-600" />
                                        <span className="text-sm font-semibold text-slate-700">
                                            {fileName}
                                        </span>
                                        {!busy && (
                                            <button
                                                onClick={clear}
                                                className="ml-2 p-1 hover:bg-slate-100 rounded transition-all"
                                            >
                                                <X size={14} className="text-slate-500" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {(filtered.length > 0 || grouped.length > 0) && (
                                <div className="mt-4 flex items-center gap-4 text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-700">Filas filtradas:</span>
                                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-black">
                                            {filtered.length}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-700">Rutas procesadas:</span>
                                        <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-black">
                                            {grouped.length}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="mt-4 flex items-start gap-2 text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200">
                                <AlertCircle size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
                                <p>
                                    <span className="font-bold">Guardado automático:</span> El archivo se procesa y guarda automáticamente al cargarlo.
                                    Los datos existentes se preservan y solo se actualizan con nueva información.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {isToday && importLocked && showLockedInfo && (
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 text-center">
                        <Lock className="mx-auto text-amber-600 mb-3" size={40} />
                        <p className="font-black text-amber-900 mb-2">
                            Import bloqueado para hoy
                        </p>
                        <p className="text-sm text-amber-700">
                            Ya se realizó un import el día de hoy. Usa el botón "Desbloquear" si necesitas importar nueva data.
                        </p>
                    </div>
                )}

                {!isToday && (
                    <div className="bg-slate-100 border-2 border-slate-300 rounded-xl p-6 text-center">
                        <Calendar className="mx-auto text-slate-500 mb-3" size={40} />
                        <p className="font-black text-slate-700 mb-2">
                            Viendo fecha pasada
                        </p>
                        <p className="text-sm text-slate-600">
                            Solo puedes importar data para el día actual. Vuelve a hoy para cargar archivos.
                        </p>
                    </div>
                )}
            </div>

            {/* Tabla de datos */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl shadow-lg overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-black text-slate-900">
                            Rutas en sistema
                        </h2>
                        <p className="text-sm text-slate-600 mt-1">
                            Datos para: <span className="font-bold">{selectedDate}</span>
                            {filtroStatus !== "todos" && (
                                <>
                                    {" · "}
                                    <span className="font-bold text-blue-600">
                                        {registrosFiltrados.length} de {dbRows.length} registros
                                    </span>
                                </>
                            )}
                        </p>
                    </div>

                    <button
                        onClick={fetchDbRows}
                        disabled={dbBusy}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-black hover:to-slate-900 text-white rounded-xl transition-all font-bold text-sm shadow-md disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={dbBusy ? "animate-spin" : ""} />
                        {dbBusy ? "Actualizando..." : "Actualizar"}
                    </button>
                </div>

                <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-white border-b-2 border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-wider">
                                    Fecha Import
                                </th>
                                <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-wider">
                                    Ruta (Key)
                                </th>
                                <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-wider">
                                    Patente
                                </th>
                                <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-wider text-center">
                                    Confirmada
                                </th>
                                <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-wider text-center">
                                    Foto
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {registrosFiltrados.map((r) => (
                                <tr key={r.id} className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent transition-all">
                                    <td className="px-6 py-4">
                                        <span className="font-mono text-xs text-slate-600 font-semibold">
                                            {r.import_date || "-"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-mono text-xs text-slate-800 font-bold">
                                            {r.key}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center font-black text-blue-700 bg-gradient-to-r from-blue-50 to-blue-100 px-3 py-1 rounded-lg border border-blue-200 text-sm">
                                            {r.patente}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase ${
                                            r.status === "confirmada"
                                                ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                                                : "bg-amber-100 text-amber-700 border border-amber-300"
                                        }`}>
                                            {r.status === "confirmada" ? (
                                                <CheckCircle2 size={12} />
                                            ) : (
                                                <Clock size={12} />
                                            )}
                                            {r.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {r.confirmed_at ? (
                                            <CheckCircle2 className="inline text-emerald-600" size={20} />
                                        ) : (
                                            <X className="inline text-slate-300" size={20} />
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {r.foto_url ? (
                                            <CheckCircle2 className="inline text-blue-600" size={20} />
                                        ) : (
                                            <X className="inline text-slate-300" size={20} />
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {!registrosFiltrados.length && (
                                <tr>
                                    <td colSpan={6} className="p-16 text-center">
                                        <div className="flex flex-col items-center gap-3 text-slate-400">
                                            <div className="bg-slate-100 p-4 rounded-full">
                                                <AlertCircle size={40} className="opacity-50" />
                                            </div>
                                            <p className="font-bold text-lg">
                                                {dbBusy ? "Cargando datos..." :
                                                 filtroStatus !== "todos" ? "No hay registros que coincidan con el filtro" :
                                                 "Sin registros para esta fecha"}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-t-2 border-slate-200">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-xs font-bold text-slate-600">
                        <span>
                            {filtroStatus !== "todos" ? (
                                <>
                                    Mostrando: <span className="text-blue-600">{registrosFiltrados.length}</span> de{" "}
                                    <span className="text-slate-900">{dbRows.length}</span> registro{dbRows.length !== 1 ? "s" : ""}
                                </>
                            ) : (
                                <>
                                    Total: <span className="text-blue-600">{dbRows.length}</span> registro{dbRows.length !== 1 ? "s" : ""}
                                </>
                            )}
                        </span>
                        <span>Sistema CATEX • Centro de Bodega</span>
                    </div>
                </div>
            </div>
        </div>
    );
}


