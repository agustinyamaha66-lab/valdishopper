import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";

// ✅ Toast enterprise
const ToastNotification = ({ notification, onClose }) => {
  if (!notification.visible) return null;

  const colors = {
    success: "bg-emerald-100 border-emerald-500 text-emerald-900",
    error: "bg-rose-100 border-rose-500 text-rose-900",
    info: "bg-blue-100 border-blue-500 text-blue-900",
    warning: "bg-amber-100 border-amber-500 text-amber-900",
  };

  const icon = {
    success: "✅",
    error: "⛔",
    info: "ℹ️",
    warning: "⚠️",
  };

  const title = {
    success: "LISTO",
    error: "ERROR",
    warning: "ATENCIÓN",
    info: "INFO",
  };

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

  // ✅ fecha filtro
  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split("T")[0]);

  // --- FILTROS ---
  const [filtroHora, setFiltroHora] = useState("");
  const [filtroDestino, setFiltroDestino] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("ALL");
  const [diaBloqueado, setDiaBloqueado] = useState(false);
  const fileInputRef = useRef(null);

  const showToast = (message, type = "success") => {
    setNotification({ visible: true, message, type });
    setTimeout(() => setNotification((prev) => ({ ...prev, visible: false })), 4000);
  };

  // --- 1) CARGA + REALTIME ---
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

    return () => {
      supabase.removeChannel(channel);
    };
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

  // ✅ enviar mensaje 1 a 1 (a un chofer)
  const enviarMensaje = async (id, patente) => {
    const mensaje = prompt(`Escribe mensaje para el conductor de la patente ${patente}:`);
    if (!mensaje || mensaje.trim() === "") return;

    try {
      const { error } = await supabase
        .from("asignaciones_transporte")
        .update({ mensaje_admin: mensaje.trim() })
        .eq("id", id);

      if (error) throw error;
      showToast("Mensaje enviado correctamente ✅", "success");
    } catch (e) {
      showToast("Error al enviar mensaje: " + e.message, "error");
    }
  };

  // ✅ ALERTA MASIVA
  const enviarMensajeMasivo = async () => {
    const mensaje = prompt(
      `ALERTA MASIVA (${fechaFiltro})\n\nEscribe el mensaje que le llegará a TODOS los choferes del día:`
    );
    if (!mensaje || mensaje.trim() === "") return;

    const ok = window.confirm(
      `Se enviará este mensaje a TODAS las rutas del día ${fechaFiltro}.\n\n"${mensaje.trim()}"\n\n¿Continuar?`
    );
    if (!ok) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("asignaciones_transporte")
        .update({ mensaje_admin: mensaje.trim() })
        .eq("fecha", fechaFiltro)
        .select("id");

      if (error) throw error;

      const total = (data || []).length;
      showToast(`Alerta masiva enviada a ${total} rutas ✅`, "success");
    } catch (e) {
      showToast("Error al enviar alerta masiva: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // ✅ limpiar día
  const limpiarDia = async () => {
    const ok = window.confirm(
      `¿Seguro que quieres BORRAR todas las rutas del día ${fechaFiltro}?\n\nEsto no se puede deshacer.`
    );
    if (!ok) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("asignaciones_transporte").delete().eq("fecha", fechaFiltro);
      if (error) throw error;

      setViajes([]);
      setFiltroHora("");
      setFiltroDestino("");
      setEstadoFiltro("ALL");
      setDiaBloqueado(false);
      showToast("Datos del día eliminados. Puedes cargar un Excel nuevo.", "success");
    } catch (err) {
      showToast("Error al limpiar: " + err.message, "error");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchViajes();
    }
  };

  // --- 2) CARGA EXCEL ---
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
              horaFinal = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
            } else {
              let texto = rawHora.toString().trim();
              if (texto.length > 5 && texto.includes(":")) texto = texto.substring(0, 5);
              horaFinal = texto;
            }
          }

          const local = (row["Ciudad"] || row["ciudad"] || "Sin Ciudad").toString();
          const nodo = (row["Nodo"] || row["nodo"] || "").toString();
          const patente = (row["Patente"] || row["patente"] || "S/P").toString().trim().toUpperCase();

          return {
            fecha: fechaFiltro,
            local,
            nodo,
            patente,
            hora_citacion: horaFinal,
            numero_vuelta: 1,
            estado: "pendiente",
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

  // --- FILTROS ---
  const horasDisponibles = useMemo(() => {
    const horas = viajes.map((v) => v.hora_citacion).filter((h) => h);
    return [...new Set(horas)].sort();
  }, [viajes]);

  const viajesBase = useMemo(() => {
    const q = (filtroDestino || "").toLowerCase().trim();
    return viajes.filter((v) => {
      const matchHora = !filtroHora || (v.hora_citacion && v.hora_citacion === filtroHora);
      const matchDestino =
        !q ||
        (v.local && String(v.local).toLowerCase().includes(q)) ||
        (v.nodo && String(v.nodo).toLowerCase().includes(q)) ||
        (v.patente && String(v.patente).toLowerCase().includes(q));
      return matchHora && matchDestino;
    });
  }, [viajes, filtroHora, filtroDestino]);

  // ✅ ESTADOS
  const getStatusKey = (v) => {
    if (v.hora_fin_reparto) return "EN_RUTA";
    if (v.hora_salida) return "En_ANDEN";
    if (v.hora_llegada) return "EN_SALA";
    return "ESPERANDO";
  };

  const getStatus = (v) => {
    const key = getStatusKey(v);
    if (key === "EN_RUTA") return { label: "EN RUTA", color: "bg-emerald-600 text-white" };
    if (key === "EN_ANDEN") return { label: "EN_ANDEN", color: "bg-blue-600 text-white" };
    if (key === "EN_SALA") return { label: "EN SALA", color: "bg-amber-300 text-slate-900" };
    return { label: "ESPERANDO", color: "bg-slate-100 text-slate-600" };
  };

  const viajesFiltrados = useMemo(() => {
    if (estadoFiltro === "ALL") return viajesBase;
    return viajesBase.filter((v) => getStatusKey(v) === estadoFiltro);
  }, [viajesBase, estadoFiltro]);

  // 🔥🔥🔥 FUNCIÓN CORREGIDA PARA SOPORTAR TEXTO Y FECHAS 🔥🔥🔥
  const formatTime = (valor) => {
    if (!valor) return "-";

    // Si ya viene como texto corto (ej: "14:30" o "14:30:00"), lo mostramos directo
    // Esto arregla el problema con tu columna 'hora_llegada' que es de tipo TEXTO
    if (typeof valor === "string" && valor.length < 10 && valor.includes(":")) {
      return valor.substring(0, 5); // Asegura mostrar solo HH:MM
    }

    // Si parece una fecha ISO larga, intentamos parsearla
    try {
      const date = new Date(valor);
      if (isNaN(date.getTime())) {
         // Si falla el parseo, devolvemos el valor original como string por seguridad
         return String(valor);
      }
      return date.toLocaleTimeString("es-CL", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Santiago",
      });
    } catch (e) {
      return String(valor);
    }
  };

  const totalRutas = viajesBase.length;
  const esperando = viajesBase.filter((v) => getStatusKey(v) === "ESPERANDO").length;
  const enSala = viajesBase.filter((v) => getStatusKey(v) === "EN_SALA").length;
  const abierto = viajesBase.filter((v) => getStatusKey(v) === "EN_ANDEN").length;
  const enRuta = viajesBase.filter((v) => getStatusKey(v) === "EN_RUTA").length;

  const uploadDisabled = loading || diaBloqueado;

  const toggleEstado = (key) => {
    setEstadoFiltro((prev) => (prev === key ? "ALL" : key));
  };

  return (
    <div className="relative min-h-screen p-6 font-sans">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50" />
        <div className="absolute top-[-18%] right-[-14%] w-[620px] h-[620px] bg-slate-200/45 rounded-full blur-3xl" />
        <div className="absolute bottom-[-18%] left-[-14%] w-[640px] h-[640px] bg-slate-200/35 rounded-full blur-3xl" />
      </div>

      <ToastNotification notification={notification} onClose={() => setNotification({ ...notification, visible: false })} />

      <div className="max-w-[1400px] mx-auto rounded-2xl border border-slate-200 shadow-xl overflow-hidden bg-white/70 backdrop-blur">
        <div className="bg-gradient-to-r from-[#0b1f44] via-[#14345f] to-[#0b1f44] text-white px-6 py-5 border-b-4 border-[#d63384]">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/60"></p>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                TORRE DE CONTROL <span className="text-[#d63384]">CATEX</span>
              </h1>
              <p className="text-xs text-white/70 mt-1">Planificación, monitoreo operativo y mensajería.</p>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <select
                value={filtroHora}
                onChange={(e) => setFiltroHora(e.target.value)}
                className="text-[#0b1f44] text-xs font-black p-3 rounded-xl cursor-pointer border border-white/10 outline-none shadow bg-white"
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
                placeholder="🔎 Buscar destino / nodo / patente..."
                value={filtroDestino}
                onChange={(e) => setFiltroDestino(e.target.value)}
                className="text-[#0b1f44] text-xs font-black p-3 rounded-xl w-64 shadow bg-white outline-none focus:ring-2 focus:ring-[#d63384]"
              />

              <input
                type="date"
                value={fechaFiltro}
                onChange={(e) => setFechaFiltro(e.target.value)}
                className="text-[#0b1f44] font-black p-3 rounded-xl cursor-pointer shadow bg-white text-sm"
              />

              <button
                onClick={fetchViajes}
                className={`rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest shadow border border-white/10 bg-white/10 hover:bg-white/15 transition flex items-center gap-2 ${
                  refreshing ? "opacity-70" : ""
                }`}
                title="Actualizar"
              >
                <span className={refreshing ? "animate-spin" : ""}>↻</span>
                Actualizar
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 bg-white border-b">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard
              label="Rutas"
              value={totalRutas}
              accent="border-[#14345f]"
              active={estadoFiltro === "ALL"}
              onClick={() => setEstadoFiltro("ALL")}
            />
            <KpiCard
              label="Pendiente"
              value={esperando}
              accent="border-slate-300"
              active={estadoFiltro === "ESPERANDO"}
              onClick={() => toggleEstado("ESPERANDO")}
            />
            <KpiCard
              label="En sala"
              value={enSala}
              accent="border-amber-400"
              active={estadoFiltro === "EN_SALA"}
              onClick={() => toggleEstado("EN_SALA")}
            />
            <KpiCard
              label=" EN ANDEN"
              value={abierto}
              accent="border-blue-600"
              active={estadoFiltro === "EN ANDEN"}
              onClick={() => toggleEstado("EN ANDEN")}
            />
            <KpiCard
              label="En ruta"
              value={enRuta}
              accent="border-emerald-600"
              active={estadoFiltro === "EN_RUTA"}
              onClick={() => toggleEstado("EN_RUTA")}
            />
          </div>

          <div className="mt-3 text-[11px] text-slate-600 font-semibold">
            Filtro Estado:{" "}
            <span className="font-black text-slate-900">
              {estadoFiltro === "ALL"
                ? "TODOS"
                : estadoFiltro === "ESPERANDO"
                ? "ESPERANDO"
                : estadoFiltro === "EN_ANDEN"
                ? "EN ANDEN"
                : estadoFiltro === "ABIERTO"
                ? "ABIERTO"
                : "EN RUTA"}
            </span>
            {estadoFiltro !== "ALL" && (
              <button
                onClick={() => setEstadoFiltro("ALL")}
                className="ml-3 text-[10px] font-black uppercase tracking-widest text-blue-700 hover:underline"
              >
                limpiar filtro
              </button>
            )}
          </div>
        </div>

        <div className="px-6 py-5 bg-white border-b">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Planificación</p>
                <h3 className="font-black text-[#14345f] text-lg">CARGA DE RUTAS (1 Excel por día)</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Para volver a cargar, usa <b>Limpiar día</b> o cambia la fecha.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <button
                  onClick={enviarMensajeMasivo}
                  disabled={loading || viajes.length === 0}
                  className={`rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest shadow border transition active:scale-95
                    ${
                      loading || viajes.length === 0
                        ? "opacity-50 pointer-events-none bg-amber-100 text-amber-900 border-amber-200"
                        : "bg-amber-400 hover:bg-amber-500 text-slate-900 border-amber-300"
                    }`}
                >
                  📣 Alerta masiva
                </button>

                <button
                  onClick={limpiarDia}
                  disabled={loading}
                  className={`rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest shadow border transition active:scale-95
                    ${
                      loading
                        ? "opacity-50 pointer-events-none bg-rose-50 text-rose-800 border-rose-200"
                        : "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                    }`}
                >
                  🧹 Limpiar día
                </button>

                <label
                  className={`rounded-xl px-5 py-3 text-xs font-black uppercase tracking-widest shadow transition active:scale-95 flex items-center gap-2 cursor-pointer border
                    ${
                      uploadDisabled
                        ? "opacity-50 pointer-events-none bg-slate-200 text-slate-600 border-slate-300"
                        : "bg-[#d63384] hover:bg-pink-600 text-white border-pink-300/40"
                    }`}
                >
                  {loading ? (
                    <>
                      <span className="animate-spin">↻</span> Procesando...
                    </>
                  ) : diaBloqueado ? (
                    <>🔒 Excel bloqueado</>
                  ) : (
                    <>⬆️ Cargar Excel</>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploadDisabled}
                  />
                </label>
              </div>
            </div>

            {diaBloqueado && (
              <div className="text-[12px] text-amber-900 bg-amber-100/60 border border-amber-200 rounded-xl px-4 py-3">
                🔒 Ya hay rutas cargadas para <b>{fechaFiltro}</b>. Para cargar otro Excel:{" "}
                <b>Limpiar día</b> o <b>cambiar fecha</b>.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white">
          <div className="px-6 py-4 bg-slate-50 border-b flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h6 className="font-black text-[#14345f] uppercase text-sm tracking-widest">Vista operativa</h6>
              <span className="bg-blue-100 text-blue-900 text-[10px] font-black px-2 py-1 rounded-full border border-blue-200">
                {viajesFiltrados.length} rutas
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#0b1f44] text-white uppercase font-black text-[11px] tracking-widest">
                <tr>
                  <th className="p-4 whitespace-nowrap">Patente</th>
                  <th className="p-4 whitespace-nowrap">Citación</th>
                  <th className="p-4 min-w-[240px]">Destino / Nodo</th>
                  <th className="p-4 text-center whitespace-nowrap">Vuelta</th>
                  <th className="p-4 text-center whitespace-nowrap">Llegada (Sala)</th>
                  <th className="p-4 text-center whitespace-nowrap">anden</th>
                  <th className="p-4 text-center whitespace-nowrap">En Ruta</th>
                  <th className="p-4 text-center whitespace-nowrap">Estado</th>
                  <th className="p-4 text-center whitespace-nowrap">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {viajesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="p-12 text-center text-slate-400">
                      <p className="font-black text-lg">No hay rutas coincidentes</p>
                      <p className="text-xs mt-1">
                        Prueba cambiando filtros o carga un Excel para el día seleccionado.
                      </p>
                    </td>
                  </tr>
                ) : (
                  viajesFiltrados.map((viaje) => {
                    const st = getStatus(viaje);
                    return (
                      <tr key={viaje.id} className="hover:bg-blue-50/50 transition-colors">
                        <td className="p-4">
                          <div className="font-black text-[#14345f] text-lg leading-none">{viaje.patente}</div>
                        </td>

                        <td className="p-4">
                          <span className="inline-flex items-center bg-slate-100 text-slate-800 font-mono font-black px-3 py-1 rounded-xl border border-slate-200">
                            {viaje.hora_citacion}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="font-bold text-slate-900 leading-tight">{viaje.local}</div>
                          <div className="text-[10px] text-slate-500 font-black uppercase mt-1 tracking-widest">
                            Nodo: {viaje.nodo}
                          </div>
                        </td>

                        <td className="p-4 text-center">
                          <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-xl text-xs font-black border border-slate-200">
                            #{viaje.numero_vuelta}
                          </span>
                        </td>

                        <td className="p-4 text-center font-mono text-slate-700">
                          {viaje.hora_llegada ? (
                            <div className="flex flex-col items-center">
                              <span className="font-black text-slate-900">{formatTime(viaje.hora_llegada)}</span>
                              {viaje.gps_llegada_lat && viaje.gps_llegada_lon && (
                                <a
                                  href={`https://www.google.com/maps?q=${viaje.gps_llegada_lat},${viaje.gps_llegada_lon}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 inline-flex items-center gap-1 text-[10px] text-blue-700 font-black hover:underline bg-blue-50 px-3 py-1 rounded-full border border-blue-200"
                                >
                                  📍 Ver mapa
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        <td className="p-4 text-center font-mono text-blue-700 font-black">{formatTime(viaje.hora_salida)}</td>

                        <td className="p-4 text-center font-mono text-emerald-700 font-black">{formatTime(viaje.hora_fin_reparto)}</td>

                        <td className="p-4 text-center">
                          <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black shadow-sm ${st.color}`}>
                            {st.label}
                          </span>
                        </td>

                        <td className="p-4 text-center">
                          <button
                            onClick={() => enviarMensaje(viaje.id, viaje.patente)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest border border-orange-200 bg-white hover:bg-orange-50 text-orange-600 hover:text-orange-700 shadow-sm transition active:scale-95"
                            title="Enviar mensaje al conductor"
                          >
                            📩 Avisar
                          </button>
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

function KpiCard({ label, value, accent, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left bg-white rounded-2xl p-4 shadow-sm border border-slate-200 border-l-4 ${accent}
        transition-all duration-150 cursor-pointer select-none
        hover:shadow-md hover:-translate-y-[1px]
        active:translate-y-0 active:shadow-sm
        ${active ? "ring-2 ring-[#d63384] shadow-md" : ""}
      `}
    >
      <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">{label}</div>
      <div className="text-3xl font-black text-slate-900 mt-1">{value}</div>
      <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
        {active ? "Activo (click para quitar)" : "Click para filtrar"}
      </div>
    </button>
  );
}