import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";
import { Activity } from "lucide-react";
import PageHeader from "../ui/PageHeader";
import { Link } from "react-router-dom";
import ChatCenter from "./ChatCenter";

// ✅ NUEVO: modal de formulario
import TransporteFormModal from "./TransporteFormModal";

// --- Patentes / Medidas ---
const PATENTES_TABLE = "control_patentes_catex";
const PATENTES_ROUTE = "/catastro-patentes";

// ✅ Toast enterprise
const ToastNotification = ({ notification, onClose }) => {
  if (!notification.visible) return null;

  const colors = {
    success: "bg-emerald-100 border-emerald-500 text-emerald-900",
    error: "bg-rose-100 border-rose-500 text-rose-900",
    info: "bg-blue-100 border-blue-500 text-blue-900",
    warning: "bg-amber-100 border-amber-500 text-amber-900",
  };

  const icon = { success: "✅", error: "⛔", info: "ℹ️", warning: "⚠️" };
  const title = { success: "LISTO", error: "ERROR", warning: "ATENCIÓN", info: "INFO" };

  return (
      <div
          className={`fixed top-24 right-6 z-[9999] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border-l-4 backdrop-blur-md ${
              colors[notification.type] || colors.info
          } min-w-[320px] animate-fade-in-up`}
      >
        <span className="text-2xl">{icon[notification.type] || "ℹ️"}</span>
        <div className="flex-1">
          <p className="font-black text-[10px] uppercase tracking-[0.25em]">
            {title[notification.type] || "INFO"}
          </p>
          <p className="text-sm font-semibold">{notification.message}</p>
        </div>
        <button onClick={onClose} className="text-slate-500 font-black hover:text-black">
          ×
        </button>
      </div>
  );
};

export default function Transporte() {
  const [viajes, setViajes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [notification, setNotification] = useState({
    visible: false,
    message: "",
    type: "success",
  });

  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split("T")[0]);

  // --- FILTROS ---
  const [filtroHora, setFiltroHora] = useState("");
  const [filtroDestino, setFiltroDestino] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("ALL");
  const [diaBloqueado, setDiaBloqueado] = useState(false);

  const fileInputRef = useRef(null);

  // ✅ NUEVO: estado modal/form
  const [formOpen, setFormOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);

  // ✅ NUEVO: estado para edición de comentarios
  const [editingComment, setEditingComment] = useState(null); // { id, text }

  // --- MAPA MEDIDAS POR PATENTE (desde catastro) ---
  const [patentesDimMap, setPatentesDimMap] = useState({});
  const [patentesDimLoading, setPatentesDimLoading] = useState(false);

  const fetchPatentesDim = async () => {
    setPatentesDimLoading(true);
    try {
      const { data, error } = await supabase
          .from(PATENTES_TABLE)
          .select("patente,largo,ancho,alto");

      if (error) throw error;

      const map = {};
      (data || []).forEach((r) => {
        const key = String(r.patente || "").toUpperCase().trim();
        if (!key) return;
        map[key] = { largo: r.largo, ancho: r.ancho, alto: r.alto };
      });
      setPatentesDimMap(map);
    } catch (e) {
      console.warn("⚠️ No se pudieron cargar medidas de patentes:", e?.message || e);
    } finally {
      setPatentesDimLoading(false);
    }
  };

  useEffect(() => {
    fetchPatentesDim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patenteTieneMedidas = (pat) => {
    const key = String(pat || "").toUpperCase().trim();
    const info = patentesDimMap[key];
    if (!info) return false;

    const largo = Number(info.largo);
    const ancho = Number(info.ancho);
    const alto = Number(info.alto);

    return [largo, ancho, alto].every((n) => Number.isFinite(n) && n > 0);
  };

  const showToast = (message, type = "success") => {
    setNotification({ visible: true, message, type });
    setTimeout(() => setNotification((prev) => ({ ...prev, visible: false })), 4000);
  };

  // --- REALTIME + CARGA ---
  useEffect(() => {
    fetchViajes();

    const channel = supabase
        .channel("tabla-transporte")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "asignaciones_transporte" },
            () => fetchViajes()
        )
        .subscribe();

    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaFiltro]);

  const fetchViajes = async () => {
    setRefreshing(true);

    const { data, error } = await supabase
        .from("asignaciones_transporte")
        .select("*")
        .eq("fecha", fechaFiltro)
        .order("hora_citacion", { ascending: true })
        .order("patente", { ascending: true })
        .order("numero_vuelta", { ascending: true });

    if (error) {
      showToast("Error al cargar viajes: " + error.message, "error");
    } else {
      const rows = data || [];
      setViajes(rows);
      setDiaBloqueado(rows.length > 0);
    }

    setTimeout(() => setRefreshing(false), 350);
  };

  // ✅ LIMPIAR DÍA
  const limpiarDia = async () => {
    const ok = window.confirm(
        `¿Seguro que quieres borrar TODAS las rutas del día ${fechaFiltro}?\n\n⚠️ Esta acción NO se puede deshacer.`
    );
    if (!ok) return;

    setLoading(true);
    try {
      const { error } = await supabase
          .from("asignaciones_transporte")
          .delete()
          .eq("fecha", fechaFiltro);

      if (error) throw error;

      showToast("Día limpiado correctamente ✅", "success");
      setViajes([]);
      setDiaBloqueado(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      showToast("Error al limpiar día: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // --- CARGA EXCEL ---
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (diaBloqueado) {
      showToast(
          "Este día ya tiene rutas cargadas. Para volver a cargar debes limpiar los datos o cambiar de día.",
          "warning"
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);

        if (!data.length) return showToast("El Excel está vacío", "error");
        setLoading(true);

        const filas = data.map((row) => {
          let rawHora = row["Citación"] || row["Citacion"] || row["citacion"] || row["Hora"];
          let horaFinal = "00:00";

          if (rawHora) {
            if (typeof rawHora === "number") {
              const totalSeconds = Math.floor(rawHora * 86400);
              const hours = Math.floor(totalSeconds / 3600);
              const minutes = Math.floor((totalSeconds % 3600) / 60);
              horaFinal = `${hours.toString().padStart(2, "0")}:${minutes
                  .toString()
                  .padStart(2, "0")}`;
            } else {
              let texto = rawHora.toString().trim();
              if (texto.length > 5 && texto.includes(":")) texto = texto.substring(0, 5);
              horaFinal = texto;
            }
          }

          const local = (row["Ciudad"] || row["ciudad"] || "Sin Ciudad").toString();
          const nodo = (row["Nodo"] || row["nodo"] || "").toString();
          const patente = (row["Patente"] || row["patente"] || "S/P")
              .toString()
              .trim()
              .toUpperCase();

          return {
            fecha: fechaFiltro,
            local,
            nodo,
            patente,
            hora_citacion: horaFinal,
            numero_vuelta: 1,
            estado: "pendiente",
            comentario: "", // ✅ NUEVO: inicializar comentario vacío
          };
        });

        const setNew = new Set();
        const filasFinales = filas.filter((f) => {
          const key = `${f.fecha}|${f.patente}|${(f.hora_citacion || "").trim()}|${(f.nodo || "").trim()}`;
          if (setNew.has(key)) return false;
          setNew.add(key);
          return true;
        });

        const { error } = await supabase.from("asignaciones_transporte").insert(filasFinales);
        if (error) throw error;

        showToast(`¡Éxito! ${filasFinales.length} rutas cargadas.`, "success");
        setDiaBloqueado(true);
        setEstadoFiltro("ALL");
        fetchViajes();
      } catch (error) {
        console.error(error);
        showToast("Error al procesar: " + error.message, "error");
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleExcel = handleFileUpload;

  // ✅ NUEVO: Guardar comentario
  const handleSaveComment = async (viajeId, newComment) => {
    try {
      const { error } = await supabase
          .from("asignaciones_transporte")
          .update({ comentario: newComment })
          .eq("id", viajeId);

      if (error) throw error;

      showToast("Comentario guardado ✅", "success");
      setEditingComment(null);
      fetchViajes();
    } catch (e) {
      showToast("Error al guardar comentario: " + e.message, "error");
    }
  };

  // ---------------- HELPERS / ESTADO OPERATIVO ----------------
  const markedSala = (v) => !!(v.hora_llegada || v.gps_llegada_lat || v.gps_llegada_lon);
  const markedFuera = (v) => !!v.hora_salida;
  const markedFin = (v) => !!v.hora_fin_reparto;

  const getEstadoOperativo = (v) => {
    if (v.hora_fin_reparto) return "EN_RUTA";
    if (v.hora_salida) return "EN_ANDEN";
    if (v.hora_llegada) return "EN_LOCAL";
    return "PENDIENTE";
  };

  const openMaps = (lat, lon) => {
    if (!lat || !lon) return;
    const url = `https://www.google.com/maps?q=${lat},${lon}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const formatHora = (h) => {
    if (!h) return "";
    const s = String(h).trim();
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) return s.slice(0, 5);

    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return s;
  };

  const excelDisabled = diaBloqueado || loading;

  // Dropdown horas únicas (08:00, 09:00, etc.)
  const horasDisponibles = useMemo(() => {
    const setH = new Set();
    (viajes || []).forEach((v) => {
      const hhmm = String(v.hora_citacion || "").slice(0, 5);
      if (/^\d{2}:\d{2}$/.test(hhmm)) setH.add(hhmm);
    });
    return Array.from(setH).sort();
  }, [viajes]);

  // ---------------- KPIs ----------------
  const kpis = useMemo(() => {
    const total = viajes.length;
    const pendiente = viajes.filter((v) => getEstadoOperativo(v) === "PENDIENTE").length;
    const enLocal = viajes.filter((v) => getEstadoOperativo(v) === "EN_LOCAL").length;
    const enAnden = viajes.filter((v) => getEstadoOperativo(v) === "EN_ANDEN").length;
    const enRuta = viajes.filter((v) => getEstadoOperativo(v) === "EN_RUTA").length;
    return { total, pendiente, enLocal, enAnden, enRuta };
  }, [viajes]);

  // ---------------- LISTA FILTRADA ----------------
  const listaFiltrada = useMemo(() => {
    return viajes.filter((v) => {
      const okHora = !filtroHora || String(v.hora_citacion || "").startsWith(filtroHora);

      const texto = (filtroDestino || "").toLowerCase();
      const okDestino =
          !texto ||
          String(v.local || "").toLowerCase().includes(texto) ||
          String(v.nodo || "").toLowerCase().includes(texto) ||
          String(v.patente || "").toLowerCase().includes(texto);

      const estadoOp = getEstadoOperativo(v);
      const okEstado = estadoFiltro === "ALL" || estadoOp === estadoFiltro;

      return okHora && okDestino && okEstado;
    });
  }, [viajes, filtroHora, filtroDestino, estadoFiltro]);

  const handleSubmitRutaManual = async (payload) => {
    const key = `${payload.fecha}|${payload.patente}|${payload.hora_citacion}|${payload.nodo || ""}`;

    const dup = (viajes || []).some((v) => {
      const k = `${v.fecha}|${String(v.patente || "").toUpperCase().trim()}|${String(v.hora_citacion || "").slice(0, 5)}|${String(v.nodo || "")}`;
      return k === key;
    });

    if (dup) throw new Error("Ya existe una ruta con esa patente/hora/nodo para este día.");

    const { error } = await supabase.from("asignaciones_transporte").insert([payload]);
    if (error) throw error;

    showToast("Ruta agregada ✅", "success");
    fetchViajes();
  };


  // ---------------- UI ----------------
  return (
      <div className="min-h-screen bg-slate-50">
        <ToastNotification
            notification={notification}
            onClose={() => setNotification((p) => ({ ...p, visible: false }))}
        />

        <PageHeader title="Transporte" subtitle="Planificación / Vista operativa" icon={Activity} />

        <div className="px-4 md:px-8 pb-10">
          {/* TOP ACTIONS */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                  Fecha
                </span>
                  <input
                      type="date"
                      value={fechaFiltro}
                      onChange={(e) => setFechaFiltro(e.target.value)}
                      className="px-3 py-2 rounded-2xl border border-slate-200 font-bold text-sm"
                  />
                </div>

                <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                  Excel
                </span>

                  <label
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 bg-white font-black text-xs
                  ${excelDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-slate-50"}`}
                      title={excelDisabled ? "Excel bloqueado (ya hay rutas cargadas)" : "Cargar Excel"}
                  >
                    Cargar lista
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleExcel}
                        className="hidden"
                        disabled={excelDisabled}
                    />
                  </label>
                </div>

                {/* ✅ NUEVO BOTÓN: abrir modal */}
                <button
                    type="button"
                    onClick={() => {
                      setEditingRow(null);
                      setFormOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-black text-xs"
                >
                  ➕ Agregar patente
                </button>

                <button
                    type="button"
                    onClick={limpiarDia}
                    disabled={loading || viajes.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 font-black text-xs hover:bg-rose-100 disabled:opacity-50"
                    title="Borrar todas las rutas del día"
                >
                  🧹 Limpiar día
                </button>

                <button
                    type="button"
                    onClick={fetchViajes}
                    disabled={refreshing}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-black text-xs disabled:opacity-50"
                >
                  🔄 Refrescar
                </button>
              </div>

              <div className="text-xs font-bold text-slate-500">
                {diaBloqueado ? (
                    <span className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800">
                  🔒 Excel bloqueado (ya hay rutas cargadas)
                </span>
                ) : (
                    <span className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                  ✅ Listo para cargar Excel
                </span>
                )}
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="Total" value={kpis.total} accent="border-slate-900" active={estadoFiltro === "ALL"} onClick={() => setEstadoFiltro("ALL")} />
            <KpiCard label="Pendiente" value={kpis.pendiente} accent="border-slate-400" active={estadoFiltro === "PENDIENTE"} onClick={() => setEstadoFiltro("PENDIENTE")} />
            <KpiCard label="En Local" value={kpis.enLocal} accent="border-orange-500" active={estadoFiltro === "EN_LOCAL"} onClick={() => setEstadoFiltro("EN_LOCAL")} />
            <KpiCard label="En Andén" value={kpis.enAnden} accent="border-blue-500" active={estadoFiltro === "EN_ANDEN"} onClick={() => setEstadoFiltro("EN_ANDEN")} />
            <KpiCard label="En Ruta" value={kpis.enRuta} accent="border-emerald-500" active={estadoFiltro === "EN_RUTA"} onClick={() => setEstadoFiltro("EN_RUTA")} />
          </div>

          {/* FILTROS */}
          <div className="mt-5 bg-white rounded-3xl shadow-sm border border-slate-200 p-4 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                  Filtrar por hora citación
                </p>
                <select
                    value={filtroHora}
                    onChange={(e) => setFiltroHora(e.target.value)}
                    className="mt-2 w-full px-4 py-3 rounded-2xl border border-slate-200 font-bold"
                >
                  <option value="">TODAS</option>
                  {horasDisponibles.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                  Buscar por local / nodo / patente
                </p>
                <input
                    value={filtroDestino}
                    onChange={(e) => setFiltroDestino(e.target.value)}
                    placeholder="Ej: Valdivia / 94 / FSLF70..."
                    className="mt-2 w-full px-4 py-3 rounded-2xl border border-slate-200 font-bold"
                />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                  Estado
                </p>
                <select
                    value={estadoFiltro}
                    onChange={(e) => setEstadoFiltro(e.target.value)}
                    className="mt-2 w-full px-4 py-3 rounded-2xl border border-slate-200 font-bold"
                >
                  <option value="ALL">TODOS</option>
                  <option value="PENDIENTE">PENDIENTE</option>
                  <option value="EN_LOCAL">EN LOCAL</option>
                  <option value="EN_ANDEN">EN ANDÉN</option>
                  <option value="EN_RUTA">EN RUTA</option>
                </select>
              </div>
            </div>
          </div>

          {/* TABLA */}
          <div className="mt-6 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                    Vista operativa
                  </p>
                  <p className="font-black text-slate-900">{listaFiltrada.length} rutas</p>
                </div>
                <div className="text-xs font-bold text-slate-500">{refreshing ? "Actualizando..." : ""}</div>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="min-w-[1200px] w-full">
                <thead className="bg-slate-900 text-white">
                <tr className="text-left text-[10px] font-black uppercase tracking-[0.25em]">
                  <th className="px-5 py-3">Patente</th>
                  <th className="px-5 py-3">Citación</th>
                  <th className="px-5 py-3">Local / Nodo</th>
                  <th className="px-5 py-3">Vuelta</th>
                  <th className="px-5 py-3">Local</th>
                  <th className="px-5 py-3">Andén</th>
                  <th className="px-5 py-3">Ruta</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Comentario</th> {/* ✅ NUEVA COLUMNA */}
                </tr>
                </thead>

                <tbody>
                {listaFiltrada.length === 0 ? (
                    <tr>
                      <td className="px-5 py-10 text-center text-slate-500 font-semibold" colSpan={9}>
                        No hay rutas para mostrar.
                      </td>
                    </tr>
                ) : (
                    listaFiltrada.map((viaje) => (
                        <tr key={viaje.id} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-5 py-4">
                            <div className="flex flex-col leading-tight">
                              <span className="font-black text-slate-900">{viaje.patente}</span>

                              <Link
                                  to={`${PATENTES_ROUTE}?patente=${encodeURIComponent(viaje.patente || "")}`}
                                  className={`mt-1 inline-flex w-fit items-center gap-2 px-2.5 py-1 rounded-full border text-[11px] font-black
                              ${
                                      patenteTieneMedidas(viaje.patente)
                                          ? "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                                          : "bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100"
                                  }
                              ${patentesDimLoading ? "opacity-60 pointer-events-none" : ""}`}
                                  title="Abrir catastro de patentes para editar medidas"
                              >
                                {patenteTieneMedidas(viaje.patente) ? "✅ Medidas OK" : "⚠️ Faltan medidas"}
                              </Link>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-900 font-black text-xs">
                          {String(viaje.hora_citacion || "").slice(0, 5)}
                        </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="font-black text-slate-900">{viaje.local || "—"}</div>
                            <div className="text-xs text-slate-500 font-bold">NODO: {viaje.nodo || "—"}</div>
                          </td>

                          <td className="px-5 py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-900 font-black text-xs">
                          #{viaje.numero_vuelta || 1}
                        </span>
                          </td>

                          <td className="px-5 py-4 text-slate-700 font-bold">
                            {markedSala(viaje) ? (
                                <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-900 font-black text-xs">
                              {formatHora(viaje.hora_llegada) || "EN LOCAL"}
                            </span>

                                  {viaje.gps_llegada_lat && viaje.gps_llegada_lon && (
                                      <button
                                          onClick={() => openMaps(viaje.gps_llegada_lat, viaje.gps_llegada_lon)}
                                          title="Ver ubicación de llegada"
                                          className="text-blue-600 hover:text-blue-800 hover:scale-110 transition"
                                      >
                                        📍
                                      </button>
                                  )}
                                </div>
                            ) : (
                                "—"
                            )}
                          </td>

                          <td className="px-5 py-4 text-slate-700 font-bold">
                            {markedFuera(viaje) ? (
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-900 font-black text-xs">
                            {formatHora(viaje.hora_salida)}
                          </span>
                            ) : (
                                "—"
                            )}
                          </td>

                          <td className="px-5 py-4 text-slate-700 font-bold">
                            {markedFin(viaje) ? (
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 font-black text-xs">
                            {formatHora(viaje.hora_fin_reparto)}
                          </span>
                            ) : (
                                "—"
                            )}
                          </td>

                          <td className="px-5 py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-900 font-black text-xs">
                          {getEstadoOperativo(viaje).replace("_", " ")}
                        </span>
                          </td>

                          {/* ✅ NUEVA CELDA: Comentario editable */}
                          <td className="px-5 py-4">
                            {editingComment?.id === viaje.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                      type="text"
                                      value={editingComment.text}
                                      onChange={(e) =>
                                          setEditingComment({ ...editingComment, text: e.target.value })
                                      }
                                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                      placeholder="Escribe un comentario..."
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          handleSaveComment(viaje.id, editingComment.text);
                                        }
                                        if (e.key === "Escape") {
                                          setEditingComment(null);
                                        }
                                      }}
                                  />
                                  <button
                                      onClick={() => handleSaveComment(viaje.id, editingComment.text)}
                                      className="px-3 py-2 rounded-xl bg-emerald-500 text-white font-black text-xs hover:bg-emerald-600"
                                      title="Guardar comentario"
                                  >
                                    ✓
                                  </button>
                                  <button
                                      onClick={() => setEditingComment(null)}
                                      className="px-3 py-2 rounded-xl bg-slate-200 text-slate-700 font-black text-xs hover:bg-slate-300"
                                      title="Cancelar"
                                  >
                                    ✕
                                  </button>
                                </div>
                            ) : (
                                <div
                                    onClick={() =>
                                        setEditingComment({ id: viaje.id, text: viaje.comentario || "" })
                                    }
                                    className="cursor-pointer px-3 py-2 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors min-h-[38px] flex items-center"
                                    title="Click para editar comentario"
                                >
                                  {viaje.comentario ? (
                                      <span className="text-sm font-semibold text-slate-900">
                                    {viaje.comentario}
                                  </span>
                                  ) : (
                                      <span className="text-sm text-slate-400 font-semibold italic">
                                    Sin comentario
                                  </span>
                                  )}
                                </div>
                            )}
                          </td>
                        </tr>
                    ))
                )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ✅ NUEVO: Modal */}
          <TransporteFormModal
              open={formOpen}
              onClose={() => setFormOpen(false)}
              onSubmit={handleSubmitRutaManual}
              fecha={fechaFiltro}
              defaultValues={editingRow}
          />

          {/* Centro de chats (botón flotante) */}
          <ChatCenter />
        </div>
      </div>
  );
}

function KpiCard({ label, value, accent, active, onClick }) {
  return (
      <button
          type="button"
          onClick={onClick}
          className={`text-left bg-white rounded-2xl p-4 shadow-sm border border-slate-200 border-l-4 ${accent}
        transition-all duration-150 cursor-pointer select-none
        hover:shadow-md hover:-translate-y-[1px]
        ${active ? "ring-2 ring-slate-900/10" : ""}`}
      >
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">{label}</p>
        <p className="text-3xl font-black text-slate-900 mt-1">{value}</p>
      </button>
  );
}