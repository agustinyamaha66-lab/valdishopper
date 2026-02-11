import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { UploadCloud, X, Save, RefreshCw, FileSpreadsheet } from "lucide-react";
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
    // Identificador: CTVSXXXXXX  => patente = desde índice 4
    const s = norm(identificador).toUpperCase();
    if (!s.startsWith("CTVS")) return "";
    return s.slice(4).trim(); // lo que viene después de CTVS
}

export default function DevolucionesImportExcel() {
    const [fileName, setFileName] = useState("");
    const [rawRows, setRawRows] = useState([]);
    const [busy, setBusy] = useState(false);

    const [dbBusy, setDbBusy] = useState(false);
    const [dbRows, setDbRows] = useState([]);
    const [onlyToday, setOnlyToday] = useState(true);

    const importDate = useMemo(() => {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }, []);

    const onPickFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
        setRawRows(Array.isArray(json) ? json : []);
    };

    // Mapea columnas reales del Excel "catex ruteo.xlsx"
    const filtered = useMemo(() => {
        return rawRows
            .map((r) => ({
                identificador_ruta: norm(r["Identificador ruta"]),
                identificador: norm(r["Identificador"]),
                transportadora: norm(r["Transportadora"]),
                estado: norm(r["Estado"]),
                sub_estado: norm(r["Subestado"]),
                sg: norm(r["SG"]), // SG “operativo” en tu excel
                numero_orden: norm(r["Número de orden"]),
            }))
            .filter((x) => {
                const idok = lower(x.identificador).startsWith("ctvs");
                const tok = lower(x.transportadora) === "valdishopper";
                const eok = lower(x.estado) === "no entregado";
                return idok && tok && eok && !!x.identificador_ruta;
            });
    }, [rawRows]);

    // Agrupar por Identificador ruta (1 fila por ruta)
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
            // patente: si aún no tiene y aparece otra fila con CTVS
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
            let q = supabase
                .from(TABLE)
                .select("id, created_at, import_date, patente, id_manifiesto, key, status, foto_url, confirmed_at")
                .order("created_at", { ascending: false })
                .limit(500);

            if (onlyToday) q = q.eq("import_date", importDate);

            const { data, error } = await q;
            if (error) throw error;
            setDbRows(data || []);
        } catch (e) {
            console.error(e);
            alert(e?.message || "Error cargando datos");
        } finally {
            setDbBusy(false);
        }
    };

    useEffect(() => {
        fetchDbRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onlyToday]);

    const clear = () => {
        setFileName("");
        setRawRows([]);
    };

    const guardar = async () => {
        if (!grouped.length) return;
        setBusy(true);

        try {
            const keys = grouped.map((g) => g.identificador_ruta);
            const existingMap = new Map();

            // Traer existentes para preservar status/confirmación
            for (const c of chunk(keys, 500)) {
                const { data, error } = await supabase
                    .from(TABLE)
                    .select("key, status, foto_url, confirmed_at, confirmed_source, patente, id_manifiesto")
                    .in("key", c);

                if (error) throw error;
                (data || []).forEach((r) => existingMap.set(r.key, r));
            }

            const payload = grouped.map((g) => {
                const existing = existingMap.get(g.identificador_ruta);

                const preservedStatus = existing?.status || "pendiente";
                const preservedFoto = existing?.foto_url || null;
                const preservedConfirmedAt = existing?.confirmed_at || null;
                const preservedConfirmedSource = existing?.confirmed_source || null;

                return {
                    // unidad única por ruta
                    key: g.identificador_ruta,
                    id_manifiesto: g.identificador_ruta,

                    // patente derivada (si ya existía confirmada con otra patente, preserva la existente)
                    patente: (existing?.patente || g.patente || "SINPAT").toUpperCase(),

                    import_date: importDate,
                    source_filename: fileName || null,

                    // metadata
                    identificador: g.identificador,
                    transportadora: g.transportadora,
                    estado: g.estado,
                    sub_estado: g.sub_estado,     // JSON de subestados
                    sg: g.sg,                     // JSON lista Orden
                    numero_orden: g.numero_orden, // JSON lista Número de orden

                    // preservar confirmación si ya ocurrió
                    status: preservedStatus,
                    foto_url: preservedFoto,
                    confirmed_at: preservedConfirmedAt,
                    confirmed_source: preservedConfirmedSource,
                };
            });

            // Upsert por key=ruta
            for (const p of chunk(payload, 500)) {
                const { error } = await supabase
                    .from(TABLE)
                    .upsert(p, { onConflict: "key" });
                if (error) throw error;
            }

            await fetchDbRows();
            alert(`Import OK: ${payload.length} rutas procesadas`);
        } catch (e) {
            console.error(e);
            alert(e?.message || "Error importando");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="p-6 space-y-5">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-lg font-black text-slate-900">Importar Devoluciones (por Ruta)</h1>
                        <p className="text-sm text-slate-600 mt-1">
                            Un registro por <b>Identificador ruta</b>. El chofer confirma la ruta y se asume que incluye todos los SG.
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            Fecha lógica: <b>{importDate}</b> · Tabla: <b>{TABLE}</b>
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {!!rawRows.length && (
                            <button
                                type="button"
                                onClick={clear}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-black"
                                disabled={busy}
                            >
                                <X size={18} /> Limpiar
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={guardar}
                            disabled={busy || !grouped.length}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save size={18} />
                            {busy ? "Guardando..." : "Guardar en Supabase"}
                        </button>
                    </div>
                </div>

                <div className="mt-4 flex items-center gap-3 flex-wrap">
                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-black cursor-pointer">
                        <UploadCloud size={18} />
                        Cargar Excel
                        <input type="file" accept=".xlsx,.xls" onChange={onPickFile} className="hidden" />
                    </label>

                    <div className="text-sm text-slate-700">
                        <span className="font-black">Archivo:</span>{" "}
                        {fileName ? <span className="font-semibold">{fileName}</span> : <span className="text-slate-500">Ninguno</span>}
                    </div>

                    <div className="text-sm text-slate-700">
                        <span className="font-black">Filas filtradas:</span> <span className="font-semibold">{filtered.length}</span>
                        <span className="mx-2 text-slate-300">|</span>
                        <span className="font-black">Rutas:</span> <span className="font-semibold">{grouped.length}</span>
                    </div>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h2 className="text-base font-black text-slate-900">Rutas en sistema</h2>
                        <p className="text-sm text-slate-600 mt-1">
                            Se carga desde Supabase (persistente). Status: <b>pendiente</b> / <b>confirmada</b>.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setOnlyToday((v) => !v)}
                            className={`px-4 py-2 rounded-xl font-black border ${
                                onlyToday
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
                            }`}
                        >
                            {onlyToday ? "Solo hoy: ON" : "Solo hoy: OFF"}
                        </button>

                        <button
                            type="button"
                            onClick={fetchDbRows}
                            disabled={dbBusy}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white font-black disabled:opacity-50"
                        >
                            <RefreshCw size={18} className={dbBusy ? "animate-spin" : ""} />
                            {dbBusy ? "Actualizando..." : "Actualizar"}
                        </button>
                    </div>
                </div>

                <div className="mt-4 overflow-auto">
                    <table className="min-w-[900px] w-full text-sm">
                        <thead className="bg-slate-50 text-slate-700">
                        <tr>
                            <th className="text-left p-3">Import date</th>
                            <th className="text-left p-3">Ruta (key)</th>
                            <th className="text-left p-3">Patente</th>
                            <th className="text-left p-3">Status</th>
                            <th className="text-left p-3">Confirmada</th>
                            <th className="text-left p-3">Foto</th>
                        </tr>
                        </thead>
                        <tbody>
                        {dbRows.map((r) => (
                            <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                                <td className="p-3">{r.import_date || "-"}</td>
                                <td className="p-3 font-mono text-xs">{r.key}</td>
                                <td className="p-3 font-black">{r.patente}</td>
                                <td className="p-3">{r.status}</td>
                                <td className="p-3">{r.confirmed_at ? "SI" : "NO"}</td>
                                <td className="p-3">{r.foto_url ? "SI" : "NO"}</td>
                            </tr>
                        ))}
                        {!dbRows.length && (
                            <tr>
                                <td colSpan={6} className="p-6 text-slate-500">
                                    {dbBusy ? "Cargando..." : "Sin registros"}
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
