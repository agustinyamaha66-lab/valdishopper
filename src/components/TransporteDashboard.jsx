import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import PageHeader from "../ui/PageHeader";
import { BarChart2, RefreshCw, Filter, X, TrendingUp, Clock, MapPin, AlertCircle } from "lucide-react";

const TABLE = "asignaciones_transporte";

const CENTROS = [
    { label: "VALDIVIA — 94", local: "VALDIVIA", nodo: "94" },
    { label: "VIÑA — 58", local: "VIÑA", nodo: "58" },
    { label: "PTO MONTT — 99", local: "PTO MONTT", nodo: "99" },
    { label: "TEMUCO — 6004", local: "TEMUCO", nodo: "6004" },
    { label: "CHILLAN — 6010", local: "CHILLAN", nodo: "6010" },
    { label: "LA SERENA — 92", local: "LA SERENA", nodo: "92" },
    { label: "RANCAGUA — 35", local: "RANCAGUA", nodo: "35" },
    { label: "IQUIQUE — 679", local: "IQUIQUE", nodo: "679" },
    { label: "CALAMA — 33", local: "CALAMA", nodo: "33" },
    { label: "PUNTA ARENAS — 121", local: "PUNTA ARENAS", nodo: "121" },
    { label: "SANTIAGO — RM", local: "SANTIAGO", nodo: "RM" },
    { label: "CON CON — 747", local: "CON CON", nodo: "747" },
];

function normTxt(s) {
    return String(s || "").trim().toUpperCase();
}

function yyyyMmDd(d) {
    const date = new Date(d);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function startOfWeekMon(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function endOfWeekSun(date) {
    const d = startOfWeekMon(date);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
}

function startOfMonth(date) {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
}

function endOfMonth(date) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + 1, 0);
    d.setHours(23, 59, 59, 999);
    return d;
}

function toDateTime(fechaYYYYMMDD, timeOrIso) {
    if (!fechaYYYYMMDD || !timeOrIso) return null;
    const s = String(timeOrIso).trim();
    if (!s) return null;

    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
        const hhmm = s.length >= 5 ? s.slice(0, 5) : s;
        const [hStr, mStr] = hhmm.split(":");
        const h = Number(hStr);
        const m = Number(mStr);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;

        const d = new Date(`${fechaYYYYMMDD}T00:00:00`);
        if (Number.isNaN(d.getTime())) return null;
        d.setHours(h, m, 0, 0);
        return d;
    }

    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d;
}

function diffMinutes(a, b) {
    if (!a || !b) return null;
    return Math.round((a.getTime() - b.getTime()) / 60000);
}

// ========== COMPONENTES UI MEJORADOS ==========

function Chip({ children, tone = "slate", icon: Icon }) {
    const tones = {
        slate: "bg-slate-100 text-slate-800 border-slate-300",
        emerald: "bg-emerald-50 text-emerald-700 border-emerald-300",
        rose: "bg-rose-50 text-rose-700 border-rose-300",
        amber: "bg-amber-50 text-amber-700 border-amber-300",
        blue: "bg-blue-50 text-blue-700 border-blue-300",
    };
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${tones[tone] || tones.slate}`}>
            {Icon && <Icon size={14} />}
            {children}
        </span>
    );
}

function KpiCard({ label, value, hint, tone = "slate", icon: Icon, trend }) {
    const tones = {
        slate: { border: "border-slate-400", bg: "bg-slate-50", text: "text-slate-900" },
        emerald: { border: "border-emerald-400", bg: "bg-emerald-50", text: "text-emerald-900" },
        rose: { border: "border-rose-400", bg: "bg-rose-50", text: "text-rose-900" },
        amber: { border: "border-amber-400", bg: "bg-amber-50", text: "text-amber-900" },
        blue: { border: "border-blue-400", bg: "bg-blue-50", text: "text-blue-900" },
    };

    const colors = tones[tone] || tones.slate;

    return (
        <div className={`${colors.bg} rounded-xl p-5 shadow-sm border-2 ${colors.border} transition-all hover:shadow-md`}>
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        {Icon && <Icon size={16} className="text-slate-600" />}
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">{label}</p>
                    </div>
                    <p className={`text-4xl font-black ${colors.text} mb-1`}>{value}</p>
                    {hint && <p className="text-xs font-semibold text-slate-600">{hint}</p>}
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold ${
                        trend > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                        <TrendingUp size={12} className={trend < 0 ? 'rotate-180' : ''} />
                        {Math.abs(trend)}%
                    </div>
                )}
            </div>
        </div>
    );
}

function BarRow({ label, value, max, right, tone = "slate" }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;

    const barColors = {
        slate: "bg-slate-700",
        emerald: "bg-emerald-500",
        rose: "bg-rose-500",
        amber: "bg-amber-500",
        blue: "bg-blue-500",
    };

    return (
        <div className="grid grid-cols-[100px_1fr_72px] items-center gap-4">
            <div className="text-xs font-bold text-slate-700 truncate" title={label}>{label}</div>
            <div className="relative h-8 rounded-lg bg-slate-100 overflow-hidden border border-slate-200">
                <div
                    className={`h-full ${barColors[tone]} transition-all duration-500 ease-out flex items-center justify-end px-2`}
                    style={{ width: `${pct}%` }}
                >
                    {pct > 15 && <span className="text-xs font-bold text-white">{pct}%</span>}
                </div>
            </div>
            <div className="text-sm font-black text-slate-800 text-right">{right ?? value}</div>
        </div>
    );
}

export default function TransporteDashboard() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Estados de filtros
    const [rangePreset, setRangePreset] = useState("SEMANA");
    const [dateStart, setDateStart] = useState("");
    const [dateEnd, setDateEnd] = useState("");
    const [filterCentro, setFilterCentro] = useState("ALL");
    const [filterPatente, setFilterPatente] = useState("");

    // Inicializar fechas correctamente
    useEffect(() => {
        const today = new Date();
        const todayStr = yyyyMmDd(today);

        if (rangePreset === "DIA") {
            setDateStart(todayStr);
            setDateEnd(todayStr);
        } else if (rangePreset === "SEMANA") {
            const weekStart = startOfWeekMon(today);
            const weekEnd = endOfWeekSun(today);
            setDateStart(yyyyMmDd(weekStart));
            setDateEnd(yyyyMmDd(weekEnd));
        } else if (rangePreset === "MES") {
            const monthStart = startOfMonth(today);
            const monthEnd = endOfMonth(today);
            setDateStart(yyyyMmDd(monthStart));
            setDateEnd(yyyyMmDd(monthEnd));
        }
    }, [rangePreset]);

    const hasAnyFilter = filterCentro !== "ALL" || !!filterPatente.trim();

    const resetFilters = () => {
        setFilterCentro("ALL");
        setFilterPatente("");
    };

    const fetchData = async () => {
        if (!dateStart || !dateEnd) return;

        setLoading(true);
        setError("");
        try {
            const { data, error: qErr } = await supabase
                .from(TABLE)
                .select(
                    "id,fecha,local,nodo,patente,numero_vuelta,estado,hora_citacion,hora_llegada,hora_salida,hora_fin_reparto,gps_llegada_lat,gps_llegada_lon"
                )
                .gte("fecha", dateStart)
                .lte("fecha", dateEnd)
                .order("fecha", { ascending: false })
                .order("hora_citacion", { ascending: false });

            if (qErr) throw qErr;
            setRows(data || []);
        } catch (e) {
            setError(e?.message || "Error al cargar datos");
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (dateStart && dateEnd) {
            fetchData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateStart, dateEnd]);

    const filtered = useMemo(() => {
        const patenteQ = normTxt(filterPatente);
        const centro = CENTROS.find((c) => c.label === filterCentro);

        return (rows || []).filter((r) => {
            if (centro) {
                const rLocal = normTxt(r.local);
                const rNodo = normTxt(r.nodo);
                if (centro.local && rLocal !== normTxt(centro.local)) return false;
                if (centro.nodo && rNodo !== normTxt(centro.nodo)) return false;
            }
            if (patenteQ && !normTxt(r.patente).includes(patenteQ)) return false;
            return true;
        });
    }, [rows, filterCentro, filterPatente]);

    const metrics = useMemo(() => {
        const totalRutas = filtered.length;

        const patentesSet = new Set(
            filtered.map((r) => normTxt(r.patente)).filter(Boolean)
        );
        const patentes = patentesSet.size;

        let withArrival = 0;
        let missingArrival = 0;
        let missingGPS = 0;

        const delays = [];
        const byCentroDelaySum = new Map();
        const byCentroDelayCount = new Map();
        const arrivalsByHour = new Array(24).fill(0);
        const byPatenteCount = new Map();

        for (const r of filtered) {
            const pat = normTxt(r.patente) || "(S/P)";
            byPatenteCount.set(pat, (byPatenteCount.get(pat) || 0) + 1);

            if (!(r.gps_llegada_lat && r.gps_llegada_lon)) missingGPS += 1;

            const fecha = r.fecha;
            const dtCita = toDateTime(fecha, r.hora_citacion);
            const dtLleg = toDateTime(fecha, r.hora_llegada);

            if (!dtLleg) {
                missingArrival += 1;
                continue;
            }
            withArrival += 1;

            const delayMin = dtCita ? diffMinutes(dtLleg, dtCita) : null;
            if (delayMin !== null) {
                delays.push(delayMin);

                const centroKey = `${normTxt(r.local) || "SIN LOCAL"} — ${normTxt(r.nodo) || "SIN NODO"}`;
                byCentroDelaySum.set(centroKey, (byCentroDelaySum.get(centroKey) || 0) + delayMin);
                byCentroDelayCount.set(centroKey, (byCentroDelayCount.get(centroKey) || 0) + 1);
            }

            const h = dtLleg.getHours();
            if (h >= 0 && h <= 23) arrivalsByHour[h] += 1;
        }

        const avgDelay = delays.length
            ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length)
            : 0;

        const onTimeCount = delays.filter((d) => d <= 10).length;
        const onTimePct = delays.length ? Math.round((onTimeCount / delays.length) * 100) : 0;

        const topPatentes = Array.from(byPatenteCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([patente, count]) => ({ patente, count }));

        const topCentrosDelay = Array.from(byCentroDelaySum.entries())
            .map(([centroKey, sum]) => {
                const n = byCentroDelayCount.get(centroKey) || 0;
                return { centroKey, avgDelay: n ? Math.round(sum / n) : 0, n };
            })
            .sort((a, b) => b.avgDelay - a.avgDelay)
            .slice(0, 10);

        const hours = arrivalsByHour.map((count, h) => ({ h, count }));
        const topHours = hours
            .filter((x) => x.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

        const maxTopHour = topHours.length ? Math.max(...topHours.map((x) => x.count)) : 0;

        return {
            totalRutas,
            patentes,
            withArrival,
            missingArrival,
            missingGPS,
            avgDelay,
            onTimePct,
            topPatentes,
            topCentrosDelay,
            topHours,
            maxTopHour,
        };
    }, [filtered]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            <PageHeader
                title="Dashboard de Transporte"
                subtitle="Análisis de rendimiento operacional y KPIs de puntualidad"
                icon={BarChart2}
            />

            <div className="px-4 md:px-8 pb-10 space-y-6">
                {/* Panel de Filtros */}
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <Filter size={18} className="text-slate-700" />
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Filtros y Rango</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-5">
                        {/* Preset de rango */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                                Período
                            </label>
                            <select
                                value={rangePreset}
                                onChange={(e) => setRangePreset(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-lg border-2 border-slate-300 font-semibold text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                            >
                                <option value="DIA">Hoy</option>
                                <option value="SEMANA">Esta Semana</option>
                                <option value="MES">Este Mes</option>
                                <option value="CUSTOM">Personalizado</option>
                            </select>
                        </div>

                        {/* Fecha inicio */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                                Desde
                            </label>
                            <input
                                type="date"
                                value={dateStart}
                                disabled={rangePreset !== "CUSTOM"}
                                onChange={(e) => setDateStart(e.target.value)}
                                className={`w-full px-4 py-2.5 rounded-lg border-2 font-semibold text-sm transition-all ${
                                    rangePreset !== "CUSTOM"
                                        ? "bg-slate-100 border-slate-300 cursor-not-allowed opacity-60"
                                        : "border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                }`}
                            />
                        </div>

                        {/* Fecha fin */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                                Hasta
                            </label>
                            <input
                                type="date"
                                value={dateEnd}
                                disabled={rangePreset !== "CUSTOM"}
                                onChange={(e) => setDateEnd(e.target.value)}
                                className={`w-full px-4 py-2.5 rounded-lg border-2 font-semibold text-sm transition-all ${
                                    rangePreset !== "CUSTOM"
                                        ? "bg-slate-100 border-slate-300 cursor-not-allowed opacity-60"
                                        : "border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                }`}
                            />
                        </div>

                        {/* Centro */}
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                                Centro (Local + Nodo)
                            </label>
                            <select
                                value={filterCentro}
                                onChange={(e) => setFilterCentro(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-lg border-2 border-slate-300 font-semibold text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                            >
                                <option value="ALL">TODOS LOS CENTROS</option>
                                {CENTROS.map((c) => (
                                    <option key={c.label} value={c.label}>
                                        {c.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Patente */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                                Patente
                            </label>
                            <input
                                value={filterPatente}
                                onChange={(e) => setFilterPatente(e.target.value)}
                                placeholder="Ej: LGYW36"
                                className="w-full px-4 py-2.5 rounded-lg border-2 border-slate-300 font-semibold text-sm uppercase focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-t border-slate-200">
                        <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                            <span>Mostrando</span>
                            <Chip tone="blue">{filtered.length}</Chip>
                            <span>de</span>
                            <Chip tone="slate">{rows.length}</Chip>
                            <span>registros</span>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={fetchData}
                                disabled={loading}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 disabled:opacity-50 transition-all shadow-sm hover:shadow-md"
                            >
                                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                                {loading ? "Cargando..." : "Actualizar"}
                            </button>

                            {hasAnyFilter && (
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border-2 border-slate-300 bg-white font-bold text-sm hover:bg-slate-50 transition-all"
                                >
                                    <X size={16} />
                                    Limpiar Filtros
                                </button>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="mt-4 px-4 py-3 rounded-lg bg-rose-50 border-2 border-rose-300 text-rose-800 font-semibold flex items-center gap-2">
                            <AlertCircle size={18} />
                            {error}
                        </div>
                    )}
                </div>

                {/* KPIs Principales */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard
                        label="Rutas Totales"
                        value={metrics.totalRutas}
                        tone="slate"
                        hint="en el período seleccionado"
                    />
                    <KpiCard
                        label="Patentes Activas"
                        value={metrics.patentes}
                        tone="blue"
                        icon={MapPin}
                        hint="vehículos únicos"
                    />
                    <KpiCard
                        label="Puntualidad"
                        value={`${metrics.onTimePct}%`}
                        tone={metrics.onTimePct >= 80 ? "emerald" : metrics.onTimePct >= 60 ? "amber" : "rose"}
                        hint="≤ 10 min de retraso"
                    />
                    <KpiCard
                        label="Retraso Promedio"
                        value={`${metrics.avgDelay}m`}
                        tone={metrics.avgDelay <= 10 ? "emerald" : metrics.avgDelay <= 30 ? "amber" : "rose"}
                        icon={Clock}
                        hint="vs hora de citación"
                    />
                </div>

                {/* Gráficos Principales */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Distribución Horaria */}
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Clock size={18} className="text-slate-700" />
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Distribución Horaria</h3>
                                </div>
                                <p className="text-lg font-black text-slate-900">Picos de llegadas por hora</p>
                            </div>
                            <Chip tone="blue" icon={BarChart2}>{metrics.withArrival}</Chip>
                        </div>

                        <div className="space-y-3">
                            {metrics.topHours.length ? (
                                metrics.topHours.map((x) => (
                                    <BarRow
                                        key={x.h}
                                        label={`${String(x.h).padStart(2, "0")}:00 hrs`}
                                        value={x.count}
                                        max={metrics.maxTopHour}
                                        right={`${x.count} rutas`}
                                        tone="blue"
                                    />
                                ))
                            ) : (
                                <div className="text-center py-12 text-slate-500 font-semibold">
                                    <Clock size={32} className="mx-auto mb-2 opacity-30" />
                                    Sin datos de llegadas
                                </div>
                            )}
                        </div>

                        <p className="mt-5 pt-4 border-t border-slate-200 text-xs text-slate-600 font-medium">
                            📊 Mostrando las 8 horas con mayor volumen de llegadas
                        </p>
                    </div>

                    {/* Centros Críticos */}
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <AlertCircle size={18} className="text-rose-600" />
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-rose-700">Centros Críticos</h3>
                                </div>
                                <p className="text-lg font-black text-slate-900">Mayor retraso promedio</p>
                            </div>
                            <Chip tone="rose">Top 10</Chip>
                        </div>

                        <div className="space-y-3">
                            {metrics.topCentrosDelay.length ? (
                                (() => {
                                    const max = Math.max(...metrics.topCentrosDelay.map((x) => x.avgDelay));
                                    return metrics.topCentrosDelay.map((x, idx) => (
                                        <BarRow
                                            key={x.centroKey}
                                            label={`${idx + 1}. ${x.centroKey.length > 12 ? x.centroKey.slice(0, 12) + "…" : x.centroKey}`}
                                            value={x.avgDelay}
                                            max={max}
                                            right={`${x.avgDelay}m`}
                                            tone={x.avgDelay > 30 ? "rose" : x.avgDelay > 15 ? "amber" : "emerald"}
                                        />
                                    ));
                                })()
                            ) : (
                                <div className="text-center py-12 text-slate-500 font-semibold">
                                    <MapPin size={32} className="mx-auto mb-2 opacity-30" />
                                    Datos insuficientes
                                </div>
                            )}
                        </div>

                        <p className="mt-5 pt-4 border-t border-slate-200 text-xs text-slate-600 font-medium">
                            ⚠️ Calculado con rutas que tienen citación y llegada registradas
                        </p>
                    </div>
                </div>

                {/* Tablas de Detalle */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Patentes */}
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 bg-slate-900 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <MapPin size={18} className="text-white" />
                                <h3 className="font-black text-white text-sm uppercase tracking-wider">Ranking de Patentes</h3>
                            </div>
                            <Chip tone="slate">{metrics.topPatentes.length}</Chip>
                        </div>

                        <div className="overflow-auto max-h-96">
                            <table className="w-full">
                                <thead className="bg-slate-100 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-700">#</th>
                                    <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-700">Patente</th>
                                    <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-700">Rutas</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                {metrics.topPatentes.map((r, idx) => (
                                    <tr key={r.patente} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-3 text-sm font-bold text-slate-500">{idx + 1}</td>
                                        <td className="px-6 py-3 font-black text-slate-900">{r.patente}</td>
                                        <td className="px-6 py-3 text-right">
                                                <span className="inline-block px-3 py-1 rounded-lg bg-blue-100 text-blue-900 font-black text-sm">
                                                    {r.count}
                                                </span>
                                        </td>
                                    </tr>
                                ))}
                                {metrics.topPatentes.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-12 text-center text-slate-500 font-semibold">
                                            Sin datos disponibles
                                        </td>
                                    </tr>
                                )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Calidad de Datos */}
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <BarChart2 size={18} className="text-slate-700" />
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Calidad de Datos</h3>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-slate-700">Total de Rutas</span>
                                    <span className="text-2xl font-black text-slate-900">{metrics.totalRutas}</span>
                                </div>
                                <div className="h-2 rounded-full bg-slate-200">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '100%' }} />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-slate-700">Con Hora de Llegada</span>
                                    <span className="text-2xl font-black text-emerald-600">{metrics.withArrival}</span>
                                </div>
                                <div className="h-2 rounded-full bg-slate-200">
                                    <div
                                        className="h-full bg-emerald-500 rounded-full transition-all"
                                        style={{ width: `${metrics.totalRutas ? (metrics.withArrival / metrics.totalRutas * 100) : 0}%` }}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-slate-700">Sin Hora de Llegada</span>
                                    <span className="text-2xl font-black text-rose-600">{metrics.missingArrival}</span>
                                </div>
                                <div className="h-2 rounded-full bg-slate-200">
                                    <div
                                        className="h-full bg-rose-500 rounded-full transition-all"
                                        style={{ width: `${metrics.totalRutas ? (metrics.missingArrival / metrics.totalRutas * 100) : 0}%` }}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-slate-700">Sin Coordenadas GPS</span>
                                    <span className="text-2xl font-black text-amber-600">{metrics.missingGPS}</span>
                                </div>
                                <div className="h-2 rounded-full bg-slate-200">
                                    <div
                                        className="h-full bg-amber-500 rounded-full transition-all"
                                        style={{ width: `${metrics.totalRutas ? (metrics.missingGPS / metrics.totalRutas * 100) : 0}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-5 border-t border-slate-200 grid grid-cols-2 gap-3">
                            <div className="text-center p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                                <p className="text-xs font-bold text-emerald-700 mb-1">Completitud</p>
                                <p className="text-2xl font-black text-emerald-900">
                                    {metrics.totalRutas ? Math.round((metrics.withArrival / metrics.totalRutas) * 100) : 0}%
                                </p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-200">
                                <p className="text-xs font-bold text-blue-700 mb-1">Con GPS</p>
                                <p className="text-2xl font-black text-blue-900">
                                    {metrics.totalRutas ? Math.round(((metrics.totalRutas - metrics.missingGPS) / metrics.totalRutas) * 100) : 0}%
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}