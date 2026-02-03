import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase"; // Asegúrate de que esta ruta sea correcta
import * as XLSX from "xlsx";

/* =========================================
   1. TU COMPONENTE PAGE HEADER
   (Puedes moverlo a un archivo aparte e importarlo)
   ========================================= */
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
      {/* Fondo degradado corporativo */}
      <div className={`absolute inset-0 bg-gradient-to-r ${gradient}`} />

      {/* Contenido */}
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

        {/* Acciones a la derecha */}
        {right ? <div className="w-full xl:w-auto">{right}</div> : null}
      </div>
    </div>
  );
}

/* =========================================
   2. COMPONENTES AUXILIARES (Toast, KPI)
   ========================================= */
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
    <div className={`fixed top-24 right-6 z-[9999] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border-l-4 backdrop-blur-md ${colors[notification.type] || colors.info} min-w-[320px] animate-fade-in-up`}>
      <span className="text-2xl">{icon[notification.type] || "ℹ️"}</span>
      <div className="flex-1">
        <p className="font-black text-[10px] uppercase tracking-[0.25em]">{title[notification.type] || "INFO"}</p>
        <p className="text-sm font-semibold">{notification.message}</p>
      </div>
      <button onClick={onClose} className="text-slate-500 font-black hover:text-black">×</button>
    </div>
  );
};

function KpiCard({ label, value, accent, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left bg-white rounded-2xl p-4 shadow-sm border border-slate-200 border-l-4 ${accent} transition-all duration-150 cursor-pointer select-none hover:shadow-md hover:-translate-y-[1px] active:translate-y-0 active:shadow-sm ${active ? "ring-2 ring-[#d63384] shadow-md" : ""}`}
    >
      <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">{label}</div>
      <div className="text-3xl font-black text-slate-900 mt-1">{value}</div>
      <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">{active ? "Activo" : "Filtrar"}</div>
    </button>
  );
}

/* =========================================
   3. PÁGINA PRINCIPAL ACTUALIZADA
   ========================================= */
export default function Transporte() {
  // --- ESTADOS ---
  const [viajes, setViajes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState({ visible: false, message: "", type: "success" });
  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split("T")[0]);
  const [filtroHora, setFiltroHora] = useState("");
  const [filtroDestino, setFiltroDestino] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("ALL");
  const [diaBloqueado, setDiaBloqueado] = useState(false);
  const fileInputRef = useRef(null);

  const showToast = (message, type = "success") => {
    setNotification({ visible: true, message, type });
    setTimeout(() => setNotification((prev) => ({ ...prev, visible: false })), 4000);
  };

  // --- LÓGICA DE CARGA Y SUPABASE ---
  useEffect(() => {
    fetchViajes();
    const channel = supabase
      .channel("tabla-transporte")
      .on("postgres_changes", { event: "*", schema: "public", table: "asignaciones_transporte" }, () => fetchViajes())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
    setTimeout(() => setRefreshing(false), 400);
  };

  // ... (MANTENEMOS TUS FUNCIONES DE MENSAJERÍA, EXCEL Y BORRADO IGUALES) ...
  // [Por brevedad, asumo que aquí van: enviarMensaje, enviarMensajeMasivo, limpiarDia, handleFileUpload]

  const enviarMensaje = async (id, patente) => {
    const mensaje = prompt(`Escribe mensaje para el conductor de la patente ${patente}:`);
    if (!mensaje?.trim()) return;
    try {
      const { error } = await supabase.from("asignaciones_transporte").update({ mensaje_admin: mensaje.trim() }).eq("id", id);
      if (error) throw error;
      showToast("Mensaje enviado correctamente ✅", "success");
    } catch (e) { showToast("Error: " + e.message, "error"); }
  };

  const enviarMensajeMasivo = async () => {
    const mensaje = prompt(`ALERTA MASIVA (${fechaFiltro})\n\nMensaje para TODOS:`);
    if (!mensaje?.trim()) return;
    if (!window.confirm(`Enviar a TODAS las rutas del día ${fechaFiltro}?\n\n"${mensaje.trim()}"`)) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("asignaciones_transporte").update({ mensaje_admin: mensaje.trim() }).eq("fecha", fechaFiltro);
      if (error) throw error;
      showToast(`Alerta masiva enviada ✅`, "success");
    } catch (e) { showToast("Error: " + e.message, "error"); } finally { setLoading(false); }
  };

  const limpiarDia = async () => {
    if (!window.confirm(`¿BORRAR todas las rutas del día ${fechaFiltro}?`)) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("asignaciones_transporte").delete().eq("fecha", fechaFiltro);
      if (error) throw error;
      setViajes([]); setFiltroHora(""); setFiltroDestino(""); setEstadoFiltro("ALL"); setDiaBloqueado(false);
      showToast("Datos eliminados.", "success");
    } catch (err) { showToast("Error: " + err.message, "error"); } finally { setLoading(false); if(fileInputRef.current) fileInputRef.current.value = ""; fetchViajes(); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (diaBloqueado) {
      showToast("Día con rutas cargadas. Limpia o cambia fecha.", "warning");
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
        if (!data.length) return showToast("Excel vacío", "error");
        setLoading(true);

        const filas = data.map((row) => {
           // ... (Tu lógica de parsing de hora y datos se mantiene igual)
           let rawHora = row["Citación"] || row["Citacion"] || row["citacion"] || row["Hora"];
           let horaFinal = "00:00";
           if (rawHora) {
             if (typeof rawHora === "number") {
               const totalSeconds = Math.floor(rawHora * 86400);
               const hours = Math.floor(totalSeconds / 3600);
               const minutes = Math.floor((totalSeconds % 3600) / 60);
               horaFinal = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
             } else {
               let texto = rawHora.toString().trim();
               if (texto.length > 5 && texto.includes(":")) texto = texto.substring(0, 5);
               horaFinal = texto;
             }
           }
           return {
             fecha: fechaFiltro,
             local: (row["Ciudad"] || row["ciudad"] || "Sin Ciudad").toString(),
             nodo: (row["Nodo"] || row["nodo"] || "").toString(),
             patente: (row["Patente"] || row["patente"] || "S/P").toString().trim().toUpperCase(),
             hora_citacion: horaFinal,
             numero_vuelta: 1,
             estado: "pendiente",
           };
        });

        // ... (Tu lógica de dedupe se mantiene igual)
        const setNew = new Set();
        const filasFinales = filas.filter((f) => {
          const key = `${f.fecha}|${f.patente}|${f.hora_citacion}|${f.nodo}`;
          if (setNew.has(key)) return false;
          setNew.add(key); return true;
        });

        const { error } = await supabase.from("asignaciones_transporte").insert(filasFinales);
        if (error) throw error;
        showToast(`${filasFinales.length} rutas cargadas.`, "success");
        setDiaBloqueado(true); setEstadoFiltro("ALL"); fetchViajes();
      } catch (error) { showToast("Error: " + error.message, "error"); } finally { setLoading(false); if(fileInputRef.current) fileInputRef.current.value = ""; }
    };
    reader.readAsBinaryString(file);
  };

  // --- FILTROS Y ESTADÍSTICAS (Igual) ---
  const horasDisponibles = useMemo(() => {
    const horas = viajes.map((v) => v.hora_citacion).filter((h) => h);
    return [...new Set(horas)].sort();
  }, [viajes]);

  const viajesBase = useMemo(() => {
    const q = (filtroDestino || "").toLowerCase().trim();
    return viajes.filter((v) => {
      const matchHora = !filtroHora || (v.hora_citacion === filtroHora);
      const matchDestino = !q || v.local?.toLowerCase().includes(q) || v.nodo?.toLowerCase().includes(q) || v.patente?.toLowerCase().includes(q);
      return matchHora && matchDestino;
    });
  }, [viajes, filtroHora, filtroDestino]);

  const getStatusKey = (v) => {
    if (v.hora_fin_reparto) return "EN_RUTA";
    if (v.hora_salida) return "ABIERTO";
    if (v.hora_llegada) return "EN_SALA";
    return "ESPERANDO";
  };

  const getStatus = (v) => {
    const key = getStatusKey(v);
    if (key === "EN_RUTA") return { label: "EN RUTA", color: "bg-emerald-600 text-white" };
    if (key === "ABIERTO") return { label: "ABIERTO", color: "bg-blue-600 text-white" };
    if (key === "EN_SALA") return { label: "EN SALA", color: "bg-amber-300 text-slate-900" };
    return { label: "ESPERANDO", color: "bg-slate-100 text-slate-600" };
  };

  const viajesFiltrados = useMemo(() => {
    if (estadoFiltro === "ALL") return viajesBase;
    return viajesBase.filter((v) => getStatusKey(v) === estadoFiltro);
  }, [viajesBase, estadoFiltro]);

  const totalRutas = viajesBase.length;
  const esperando = viajesBase.filter((v) => getStatusKey(v) === "ESPERANDO").length;
  const enSala = viajesBase.filter((v) => getStatusKey(v) === "EN_SALA").length;
  const abierto = viajesBase.filter((v) => getStatusKey(v) === "ABIERTO").length;
  const enRuta = viajesBase.filter((v) => getStatusKey(v) === "EN_RUTA").length;
  const uploadDisabled = loading || diaBloqueado;
  const toggleEstado = (key) => setEstadoFiltro((prev) => (prev === key ? "ALL" : key));
  const formatTime = (iso) => { try { return new Date(iso).toLocaleTimeString("es-CL", {hour:"2-digit",minute:"2-digit",timeZone:"America/Santiago"}); } catch { return "-"; } };

  return (
    <div className="relative min-h-screen p-6 font-sans">
      {/* Fondo enterprise */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50" />
        <div className="absolute top-[-18%] right-[-14%] w-[620px] h-[620px] bg-slate-200/45 rounded-full blur-3xl" />
        <div className="absolute bottom-[-18%] left-[-14%] w-[640px] h-[640px] bg-slate-200/35 rounded-full blur-3xl" />
      </div>

      <ToastNotification notification={notification} onClose={() => setNotification({ ...notification, visible: false })} />

      {/* =======================================================
          AQUÍ ESTÁ LA INTEGRACIÓN DEL NUEVO PAGE HEADER
          ======================================================= */}
      <div className="max-w-[1400px] mx-auto">
        <PageHeader
          eyebrow=""
          title={
            /* Usamos un fragmento para mantener el color rosa de CATEX */
            <>
              TORRE DE CONTROL <span className="text-[#d63384]">CATEX</span>
            </>
          }
          subtitle="Planificación, monitoreo operativo y mensajería en tiempo real."
          // La propiedad 'right' ahora contiene todos tus filtros
          right={
            <div className="flex flex-wrap gap-3 items-center justify-end">
              <select
                value={filtroHora}
                onChange={(e) => setFiltroHora(e.target.value)}
                className="text-[#0b1f44] text-xs font-black p-3 rounded-xl cursor-pointer border border-white/10 outline-none shadow-lg bg-white min-w-[140px]"
              >
                <option value="">🕒 TODAS LAS HORAS</option>
                {horasDisponibles.map((h) => (
                  <option key={h} value={h}>
                    {h} hrs
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="🔎 Buscar destino / nodo..."
                value={filtroDestino}
                onChange={(e) => setFiltroDestino(e.target.value)}
                className="text-[#0b1f44] text-xs font-black p-3 rounded-xl w-64 shadow-lg bg-white outline-none focus:ring-2 focus:ring-[#d63384]"
              />

              <input
                type="date"
                value={fechaFiltro}
                onChange={(e) => setFechaFiltro(e.target.value)}
                className="text-[#0b1f44] font-black p-3 rounded-xl cursor-pointer shadow-lg bg-white text-sm"
              />

              <button
                onClick={fetchViajes}
                className={`rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest shadow-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 transition flex items-center gap-2 ${
                  refreshing ? "opacity-70" : ""
                }`}
                title="Actualizar tabla"
              >
                <span className={refreshing ? "animate-spin" : ""}>↻</span>
              </button>
            </div>
          }
        />

        {/* CONTENEDOR PRINCIPAL (Resto del Dashboard) */}
        <div className="rounded-2xl border border-slate-200 shadow-xl overflow-hidden bg-white/70 backdrop-blur">

          {/* KPI / MÉTRICAS */}
          <div className="px-6 py-5 bg-white border-b">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KpiCard label="Rutas" value={totalRutas} accent="border-[#14345f]" active={estadoFiltro === "ALL"} onClick={() => setEstadoFiltro("ALL")} />
              <KpiCard label="Pendiente" value={esperando} accent="border-slate-300" active={estadoFiltro === "ESPERANDO"} onClick={() => toggleEstado("ESPERANDO")} />
              <KpiCard label="En sala" value={enSala} accent="border-amber-400" active={estadoFiltro === "EN_SALA"} onClick={() => toggleEstado("EN_SALA")} />
              <KpiCard label="Abierto" value={abierto} accent="border-blue-600" active={estadoFiltro === "ABIERTO"} onClick={() => toggleEstado("ABIERTO")} />
              <KpiCard label="En ruta" value={enRuta} accent="border-emerald-600" active={estadoFiltro === "EN_RUTA"} onClick={() => toggleEstado("EN_RUTA")} />
            </div>

            <div className="mt-3 text-[11px] text-slate-600 font-semibold">
              Filtro Estado: <span className="font-black text-slate-900">{estadoFiltro.replace("_", " ")}</span>
              {estadoFiltro !== "ALL" && <button onClick={() => setEstadoFiltro("ALL")} className="ml-3 text-[10px] font-black uppercase text-blue-700 hover:underline">limpiar</button>}
            </div>
          </div>

          {/* BARRA DE ACCIONES (Cargar Excel / Mensajes) */}
          <div className="px-6 py-5 bg-white border-b">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 flex flex-col md:flex-row items-center justify-between gap-4">
               <div>
                  <h3 className="font-black text-[#14345f] text-sm uppercase tracking-widest">Acciones Operativas</h3>
                  <p className="text-xs text-slate-500">Gestión de datos del día {fechaFiltro}</p>
               </div>
               <div className="flex flex-wrap gap-3 items-center">
                  <button onClick={enviarMensajeMasivo} disabled={loading || viajes.length === 0} className="rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest shadow border bg-amber-400 hover:bg-amber-500 text-slate-900 border-amber-300 disabled:opacity-50 disabled:bg-slate-200">📣 Alerta Masiva</button>
                  <button onClick={limpiarDia} disabled={loading} className="rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest shadow border bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 disabled:opacity-50">🧹 Limpiar</button>
                  <label className={`rounded-xl px-5 py-3 text-xs font-black uppercase tracking-widest shadow transition cursor-pointer border flex items-center gap-2 ${uploadDisabled ? "opacity-50 bg-slate-200 text-slate-600" : "bg-[#d63384] hover:bg-pink-600 text-white"}`}>
                    {loading ? "Procesando..." : diaBloqueado ? "🔒 Bloqueado" : "⬆️ Cargar Excel"}
                    <input ref={fileInputRef} type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" disabled={uploadDisabled} />
                  </label>
               </div>
            </div>
          </div>

          {/* TABLA DE RESULTADOS */}
          <div className="bg-white overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#0b1f44] text-white uppercase font-black text-[11px] tracking-widest">
                <tr>
                  <th className="p-4">Patente</th>
                  <th className="p-4">Citación</th>
                  <th className="p-4 min-w-[240px]">Destino / Nodo</th>
                  <th className="p-4 text-center">Vuelta</th>
                  <th className="p-4 text-center">Llegada</th>
                  <th className="p-4 text-center">Apertura</th>
                  <th className="p-4 text-center">Inicio</th>
                  <th className="p-4 text-center">Estado</th>
                  <th className="p-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {viajesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="p-12 text-center text-slate-400">
                      <p className="font-black text-lg">No hay datos</p>
                      <p className="text-xs">Ajusta los filtros o carga un Excel.</p>
                    </td>
                  </tr>
                ) : (
                  viajesFiltrados.map((viaje) => {
                    const st = getStatus(viaje);
                    return (
                      <tr key={viaje.id} className="hover:bg-blue-50/50 transition-colors">
                        <td className="p-4 font-black text-[#14345f] text-lg">{viaje.patente}</td>
                        <td className="p-4"><span className="bg-slate-100 text-slate-800 font-mono font-black px-3 py-1 rounded-xl border border-slate-200">{viaje.hora_citacion}</span></td>
                        <td className="p-4">
                          <div className="font-bold text-slate-900">{viaje.local}</div>
                          <div className="text-[10px] text-slate-500 font-black uppercase mt-1">Nodo: {viaje.nodo}</div>
                        </td>
                        <td className="p-4 text-center"><span className="bg-slate-100 px-3 py-1 rounded-xl text-xs font-black">#{viaje.numero_vuelta}</span></td>
                        <td className="p-4 text-center font-mono text-slate-700">
                           {viaje.hora_llegada ? (
                              <div>{formatTime(viaje.hora_llegada)}
                              {viaje.gps_llegada_lat && <a href={`https://maps.google.com/?q=${viaje.gps_llegada_lat},${viaje.gps_llegada_lon}`} target="_blank" rel="noreferrer" className="block text-[9px] text-blue-600 font-black uppercase mt-1">📍 Mapa</a>}
                              </div>
                           ) : "-"}
                        </td>
                        <td className="p-4 text-center font-mono text-blue-700 font-black">{formatTime(viaje.hora_salida)}</td>
                        <td className="p-4 text-center font-mono text-emerald-700 font-black">{formatTime(viaje.hora_fin_reparto)}</td>
                        <td className="p-4 text-center"><span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black shadow-sm ${st.color}`}>{st.label}</span></td>
                        <td className="p-4 text-center">
                          <button onClick={() => enviarMensaje(viaje.id, viaje.patente)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest border border-orange-200 bg-white hover:bg-orange-50 text-orange-600 shadow-sm transition">📩 Avisar</button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}