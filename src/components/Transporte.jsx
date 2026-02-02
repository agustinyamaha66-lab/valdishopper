import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";

// ✅ Toast pro (sin perder tu estilo)
const ToastNotification = ({ notification, onClose }) => {
  if (!notification.visible) return null;
  const colors = {
    success: "bg-green-100 border-green-500 text-green-800",
    error: "bg-red-100 border-red-500 text-red-800",
    info: "bg-blue-100 border-blue-500 text-blue-800",
    warning: "bg-yellow-100 border-yellow-500 text-yellow-800",
  };
  const icon = {
    success: "✅",
    error: "⚠️",
    info: "ℹ️",
    warning: "⚠️",
  };

  return (
    <div
      className={`fixed top-24 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded shadow-xl border-l-4 ${
        colors[notification.type] || colors.info
      } min-w-[300px] animate-fade-in-up`}
    >
      <span className="text-xl">{icon[notification.type] || "ℹ️"}</span>
      <div className="flex-1">
        <p className="font-bold text-xs uppercase">
          {notification.type === "success"
            ? "LISTO"
            : notification.type === "error"
            ? "ERROR"
            : notification.type === "warning"
            ? "ATENCIÓN"
            : "INFO"}
        </p>
        <p className="text-sm">{notification.message}</p>
      </div>
      <button onClick={onClose} className="text-gray-500 font-bold hover:text-black">
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
  const [filtroDestino, setFiltroDestino] = useState(""); // ahora también filtra por patente

  // ✅ bloqueo de carga por día (si ya hay data)
  const [diaBloqueado, setDiaBloqueado] = useState(false);

  // ✅ ref input file
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

  // ✅ NUEVO: ALERTA MASIVA (a todos los choferes del día seleccionado)
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
      // 🔥 Esto fuerza UPDATE en todas las filas del día => Realtime lo envía a cada chofer
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

  // --- 2) CARGA EXCEL (1 por día) ---
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
          };
        });

        // dedupe solo dentro del excel
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

  // ✅ ahora filtroDestino busca por: local, nodo, patente
  const viajesFiltrados = viajes.filter((v) => {
    const matchHora = !filtroHora || (v.hora_citacion && v.hora_citacion === filtroHora);

    const q = (filtroDestino || "").toLowerCase().trim();
    const matchDestino =
      !q ||
      (v.local && String(v.local).toLowerCase().includes(q)) ||
      (v.nodo && String(v.nodo).toLowerCase().includes(q)) ||
      (v.patente && String(v.patente).toLowerCase().includes(q)); // ✅ patente

    return matchHora && matchDestino;
  });

  const getStatus = (v) => {
    if (v.hora_fin_reparto) return { label: "EN RUTA", color: "bg-green-600 text-white" };
    if (v.hora_salida) return { label: "ABIERTO", color: "bg-blue-600 text-white" };
    if (v.hora_llegada) return { label: "EN SALA", color: "bg-yellow-400 text-black" };
    return { label: "ESPERANDO", color: "bg-gray-200 text-gray-500" };
  };

  const formatTime = (isoString) => {
    if (!isoString) return "-";
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString("es-CL", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Santiago",
      });
    } catch (e) {
      return "-";
    }
  };

  const totalRutas = viajesFiltrados.length;
  const esperando = viajesFiltrados.filter((v) => !v.hora_llegada && !v.hora_salida && !v.hora_fin_reparto).length;
  const enSala = viajesFiltrados.filter((v) => v.hora_llegada && !v.hora_salida && !v.hora_fin_reparto).length;
  const abierto = viajesFiltrados.filter((v) => v.hora_salida && !v.hora_fin_reparto).length;
  const enRuta = viajesFiltrados.filter((v) => v.hora_fin_reparto).length;

  const uploadDisabled = loading || diaBloqueado;

  return (
    <div className="bg-gray-100 min-h-screen p-6 font-sans">
      <ToastNotification
        notification={notification}
        onClose={() => setNotification({ ...notification, visible: false })}
      />

      {/* HEADER */}
      <div className="bg-[#1e3c72] text-white p-4 rounded-t-xl flex flex-col md:flex-row justify-between items-center shadow-lg border-b-4 border-[#d63384] mb-4 gap-4">
        <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2">
          TORRE DE CONTROL CATEX
        </h1>

        <div className="flex flex-wrap gap-3 items-center justify-center md:justify-end">
          <select
            value={filtroHora}
            onChange={(e) => setFiltroHora(e.target.value)}
            className="text-[#1e3c72] text-xs font-bold p-2.5 rounded cursor-pointer border-2 border-transparent focus:border-[#d63384] outline-none shadow-md bg-white"
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
            className="text-[#1e3c72] text-xs font-bold p-2.5 rounded w-56 shadow-md border-none outline-none focus:ring-2 focus:ring-[#d63384]"
          />

          <input
            type="date"
            value={fechaFiltro}
            onChange={(e) => setFechaFiltro(e.target.value)}
            className="text-[#1e3c72] font-bold p-2 rounded cursor-pointer shadow-md text-sm"
          />
        </div>
      </div>

      {/* MÉTRICAS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-lg p-3 shadow border-l-4 border-[#1e3c72]">
          <div className="text-[10px] font-bold text-gray-500 uppercase">Rutas</div>
          <div className="text-2xl font-black text-[#1e3c72]">{totalRutas}</div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow border-l-4 border-gray-300">
          <div className="text-[10px] font-bold text-gray-500 uppercase">Pendiente de llegada</div>
          <div className="text-2xl font-black text-gray-700">{esperando}</div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow border-l-4 border-yellow-400">
          <div className="text-[10px] font-bold text-gray-500 uppercase">En sala</div>
          <div className="text-2xl font-black text-gray-700">{enSala}</div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow border-l-4 border-blue-600">
          <div className="text-[10px] font-bold text-gray-500 uppercase">Abierto</div>
          <div className="text-2xl font-black text-gray-700">{abierto}</div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow border-l-4 border-green-600">
          <div className="text-[10px] font-bold text-gray-500 uppercase">En ruta</div>
          <div className="text-2xl font-black text-gray-700">{enRuta}</div>
        </div>
      </div>

      {/* CARGA / MENSAJES */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 flex flex-col gap-3 border-l-4 border-[#1e3c72]">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h3 className="font-bold text-[#1e3c72] text-lg">PLANIFICACIÓN DE VIAJES</h3>
            <p className="text-xs text-gray-500">
              Carga <b>1 Excel por día</b>. Para volver a cargar, usa <b>Limpiar día</b> o cambia la fecha.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 items-center justify-center">
            {/* ✅ NUEVO BOTÓN ALERTA MASIVA */}
            <button
              onClick={enviarMensajeMasivo}
              disabled={loading || viajes.length === 0}
              className={`bg-yellow-400 hover:bg-yellow-500 text-black font-black py-2.5 px-4 rounded text-sm border border-yellow-300 shadow transition-all active:scale-95 ${
                loading || viajes.length === 0 ? "opacity-50 pointer-events-none" : ""
              }`}
              title="Envía un mensaje a TODOS los choferes del día seleccionado"
            >
              📣 ALERTA MASIVA
            </button>

            <button
              onClick={limpiarDia}
              disabled={loading}
              className={`bg-red-50 hover:bg-red-100 text-red-700 font-black py-2.5 px-4 rounded text-sm border border-red-200 shadow transition-all active:scale-95 ${
                loading ? "opacity-50 pointer-events-none" : ""
              }`}
              title="Borra todas las rutas del día seleccionado"
            >
              🧹 LIMPIAR DÍA
            </button>

            <label
              className={`cursor-pointer bg-[#d63384] hover:bg-pink-600 text-white font-bold py-2.5 px-6 rounded text-sm shadow transition-all active:scale-95 flex items-center gap-2 ${
                uploadDisabled ? "opacity-50 pointer-events-none" : ""
              }`}
              title={
                diaBloqueado
                  ? "Este día ya tiene datos. Limpia el día o cambia la fecha para cargar otro Excel."
                  : "Cargar Excel"
              }
            >
              {loading ? (
                <>
                  <span className="animate-spin">↻</span> PROCESANDO...
                </>
              ) : diaBloqueado ? (
                <>🔒 EXCEL BLOQUEADO</>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>{" "}
                  CARGAR EXCEL
                </>
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
          <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            🔒 Ya hay rutas cargadas para <b>{fechaFiltro}</b>. Para cargar otro Excel:{" "}
            <b>Limpiar día</b> o <b>cambiar fecha</b>.
          </div>
        )}
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-lg shadow overflow-hidden border-t-4 border-[#1e3c72]">
        <div className="p-3 bg-gray-50 flex justify-between items-center border-b">
          <div className="flex items-center gap-2">
            <h6 className="font-black text-[#1e3c72] uppercase text-sm">VISTA OPERATIVA</h6>
            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
              {viajesFiltrados.length} RUTAS
            </span>
          </div>
          <button
            onClick={fetchViajes}
            className={`text-blue-600 font-bold p-2 hover:bg-blue-50 rounded-full transition-all ${
              refreshing ? "animate-spin" : "hover:rotate-180"
            }`}
            title="Actualizar Tabla"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#1e3c72] text-white uppercase font-bold text-xs">
              <tr>
                <th className="p-3 whitespace-nowrap">Patente</th>
                <th className="p-3 whitespace-nowrap">Citación</th>
                <th className="p-3 min-w-[200px]">Destino / Nodo</th>
                <th className="p-3 text-center whitespace-nowrap">Vuelta</th>
                <th className="p-3 text-center bg-yellow-50/10 whitespace-nowrap">Llegada (Sala)</th>
                <th className="p-3 text-center bg-blue-50/10 whitespace-nowrap">Apertura</th>
                <th className="p-3 text-center bg-green-50/10 whitespace-nowrap">Inicio Ruta</th>
                <th className="p-3 text-center whitespace-nowrap">Estado</th>
                <th className="p-3 text-center whitespace-nowrap">Acción</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {viajesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-12 text-center text-gray-400">
                    <p className="font-bold text-lg">No hay rutas coincidentes</p>
                    <p className="text-xs mt-1">Prueba cambiando filtros o carga un Excel para el día seleccionado.</p>
                  </td>
                </tr>
              ) : (
                viajesFiltrados.map((viaje) => {
                  const st = getStatus(viaje);
                  return (
                    <tr key={viaje.id} className="hover:bg-blue-50 transition-colors group">
                      <td className="p-3 font-black text-[#1e3c72] text-lg">{viaje.patente}</td>

                      <td className="p-3">
                        <span className="bg-gray-100 text-gray-700 font-mono font-bold px-2 py-1 rounded border border-gray-200">
                          {viaje.hora_citacion}
                        </span>
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-gray-800 leading-tight">{viaje.local}</div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">
                          Nodo: {viaje.nodo}
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        <span className="bg-gray-200 text-gray-600 px-2 py-1 rounded text-xs font-bold">
                          #{viaje.numero_vuelta}
                        </span>
                      </td>

                      <td className="p-3 text-center font-mono text-gray-600">
                        {viaje.hora_llegada ? (
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-black">{formatTime(viaje.hora_llegada)}</span>
                            {viaje.gps_llegada_lat && viaje.gps_llegada_lon && (
                              <a
                                href={`https://www.google.com/maps?q=${viaje.gps_llegada_lat},${viaje.gps_llegada_lon}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-[9px] text-blue-600 font-bold hover:text-blue-800 hover:underline mt-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-100"
                              >
                                📍 MAPA
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>

                      <td className="p-3 text-center font-mono text-blue-600 font-bold">{formatTime(viaje.hora_salida)}</td>

                      <td className="p-3 text-center font-mono text-green-600 font-bold">
                        {formatTime(viaje.hora_fin_reparto)}
                      </td>

                      <td className="p-3 text-center">
                        <div className={`px-2 py-1 rounded text-[10px] font-black inline-block shadow-sm ${st.color}`}>
                          {st.label}
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        <button
                          onClick={() => enviarMensaje(viaje.id, viaje.patente)}
                          className="bg-white text-orange-500 hover:bg-orange-50 hover:text-orange-600 px-3 py-1.5 rounded text-xs font-bold border border-orange-200 transition-colors flex items-center justify-center gap-1 mx-auto shadow-sm"
                          title="Enviar mensaje al conductor"
                        >
                          📩 <span className="hidden xl:inline">AVISAR</span>
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
  );
}
