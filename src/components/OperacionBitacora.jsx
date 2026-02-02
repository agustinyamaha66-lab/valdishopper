import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";

// --- DATOS MAESTROS ---
const localesPorServicio = {
  LAT: ["120 Temuco", "121 Punta Arenas", "143 Talca", "144 Parral", "146 San Javier", "182 Buin", "276 Lampa", "41 Huechuraba", "42 Curicó", "518 Valparaíso", "54 La Florida 54", "608 Chillán", "611 La Florida 611", "618 Osorno", "627 San Vicente"],
  HD: ["120 Temuco", "121 Punta Arenas", "58 Viña", "606 Coronel", "608 Chillán", "618 Osorno", "657 Castro", "697 San Fernando", "94 Valdivia", "98 Concepción", "99 Puerto Montt"],
  SBA: ["171 San Bernardo", "528 Curicó", "569 Talca", "570 Cauquenes", "583 Constitución", "587 Tome"],
  CM: ["159 Macul", "19 Puerto Montt", "513 Talca", "68 Osorno", "903 San Pedro de la Paz", "990 Maipú"],
};

const motivosPorGrupo = {
  Sistemas: ["PEDIDO DUPLICADO", "PROBLEMAS EN AMIDA", "PROBLEMAS EN BEETRACK"],
  "Sala y Operacion": ["SIN APOYO LOCAL BAJA DOTACION WM", "LOCAL SOLICITA CIERRE DE VENTANA", "CIERRE DE LOCAL", "PROTESTA FUERA DEL LOCAL", "EVENTO CERCANO AL LOCAL", "BOLSAS SIN STOCK", "CARROS SIN STOCK", "COMPLICACIONES EN SALA", "CORTE DE LUZ LOCAL", "DEMORA REVISIÓN AP", "PEDIDOS ENCOLADOS", "FUGA PRESTADORES", "LLEGADA TARDE PRESTADORES", "DESABASTECIMIENTO BODEGA", "BAJA DEMANDA PEDIDOS"],
  "Ruta y entrega": ["ACCIDENTE EN RUTA", "ALTO TRAFICO", "CANCELADO/RECHAZADO", "DIRECCIÓN ERRÓNEA", "ESCALERA/ASCENSOR MALO", "FERRY", "MAL GEORREFERENCIADO", "OTRA TRANSPORTADORA", "SIN ESTACIONAMIENTOS", "SIN MORADORES"],
  Otros: ["OTROS", "APOYO POLIGONO OTRO LOCAL", "APOYO PEDIDOS OTRO LOCAL"],
};

const determinarKPI = (motivo) => {
  const criticos = ["CIERRE DE LOCAL", "SIN APOYO LOCAL BAJA DOTACION WM", "CORTE DE LUZ LOCAL", "PROTESTA FUERA DEL LOCAL", "ACCIDENTE EN RUTA"];
  const advertencia = ["ALTO TRAFICO", "PROBLEMAS EN AMIDA", "COMPLICACIONES EN SALA", "PEDIDOS ENCOLADOS"];
  if (criticos.includes(motivo)) return "CONTINGENCIA";
  if (advertencia.includes(motivo)) return "ALERTA OTEA";
  return "REPORTADO";
};

// --- TOAST ENTERPRISE ---
const ToastNotification = ({ notification, onClose }) => {
  if (!notification.visible) return null;

  const styles = {
    success: { wrap: "bg-emerald-50 border-emerald-500 text-emerald-900", icon: "✅", label: "OK" },
    error: { wrap: "bg-rose-50 border-rose-500 text-rose-900", icon: "⛔", label: "ERROR" },
    warning: { wrap: "bg-amber-50 border-amber-500 text-amber-900", icon: "⚠️", label: "ATENCIÓN" },
  };

  const s = styles[notification.type] || styles.success;

  return (
    <div
      className={`fixed top-24 right-6 z-[9999] flex items-start gap-3 px-4 py-3 rounded-2xl shadow-xl border-l-4 backdrop-blur transition-all duration-300 ${s.wrap} min-w-[320px]`}
      role="status"
    >
      <span className="text-xl mt-0.5">{s.icon}</span>
      <div className="flex-1">
        <p className="font-black text-[11px] uppercase tracking-widest">{s.label}</p>
        <p className="font-semibold text-sm leading-snug">{notification.message}</p>
      </div>
      <button onClick={onClose} className="text-slate-500 hover:text-slate-900 font-black text-lg" aria-label="Cerrar">
        ×
      </button>
    </div>
  );
};

const BadgeKPI = ({ value }) => {
  const map = {
    CONTINGENCIA: "bg-rose-50 text-rose-700 border-rose-200",
    "ALERTA OTEA": "bg-amber-50 text-amber-800 border-amber-200",
    REPORTADO: "bg-slate-50 text-slate-600 border-slate-200",
  };
  return (
    <span className={`text-[10px] font-black px-2 py-1 rounded-full border ${map[value] || map.REPORTADO}`}>
      {value}
    </span>
  );
};

export default function OperacionBitacora() {
  const [incidencias, setIncidencias] = useState([]);
  const [loading, setLoading] = useState(false);

  const [notification, setNotification] = useState({ visible: false, message: "", type: "success" });

  const showToast = (message, type = "success") => {
    setNotification({ visible: true, message, type });
    setTimeout(() => setNotification((prev) => ({ ...prev, visible: false })), 3000);
  };

  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split("T")[0],
    servicio: "LAT",
    local: "",
    sg: "",
    grupo: "",
    motivo: "",
    observacion: "",
  });

  useEffect(() => {
    fetchIncidencias();
  }, []);

  const fetchIncidencias = async () => {
    const { data, error } = await supabase
      .from("incidencias")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      showToast("Error al cargar incidencias: " + error.message, "error");
      return;
    }
    if (data) setIncidencias(data);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "servicio") setFormData({ ...formData, servicio: value, local: "" });
    else if (name === "grupo") setFormData({ ...formData, grupo: value, motivo: "" });
    else setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.local || !formData.grupo || !formData.motivo) {
      showToast("Faltan datos: Local o Motivo no seleccionados", "error");
      return;
    }

    if ((formData.observacion || "").trim().length < 5) {
      showToast("La observación es muy corta (mínimo 5 letras)", "warning");
      return;
    }

    setLoading(true);

    const payload = { ...formData, kpi: determinarKPI(formData.motivo) };

    const { error } = await supabase.from("incidencias").insert([payload]);

    if (error) {
      showToast("Error al guardar: " + error.message, "error");
      setLoading(false);
      return;
    }

    showToast("Incidencia registrada exitosamente", "success");
    await fetchIncidencias();
    setFormData({ ...formData, sg: "", grupo: "", motivo: "", observacion: "" });
    setLoading(false);
  };

  // KPIs rápidos para cabecera (enterprise)
  const resumen = useMemo(() => {
    const total = incidencias.length;
    const cont = incidencias.filter((i) => i.kpi === "CONTINGENCIA").length;
    const alerta = incidencias.filter((i) => i.kpi === "ALERTA OTEA").length;
    const rep = incidencias.filter((i) => i.kpi === "REPORTADO").length;
    return { total, cont, alerta, rep };
  }, [incidencias]);

  return (
    <div className="min-h-screen px-4 md:px-8 py-8 relative">
      {/* Fondo enterprise difuminado */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50" />
        <div className="absolute top-[-12%] right-[-10%] w-[560px] h-[560px] bg-slate-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-[-18%] left-[-12%] w-[640px] h-[640px] bg-slate-200/30 rounded-full blur-3xl" />
      </div>

      {/* Notificación flotante */}
      <ToastNotification
        notification={notification}
        onClose={() => setNotification((p) => ({ ...p, visible: false }))}
      />

      {/* Header executive */}
      <div className="relative overflow-hidden rounded-2xl border border-white/20 shadow-xl mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b1f44]/95 via-[#163a6b]/90 to-[#0b1f44]/95" />
        <div className="absolute inset-0 backdrop-blur-xl" />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-10 left-10 h-28 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-10 right-10 h-28 w-64 rounded-full bg-cyan-300/10 blur-2xl" />
        </div>

        <div className="relative z-10 px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/70">
              Operaciones • Bitácora & Control
            </p>
            <h1 className="mt-1 text-2xl md:text-3xl font-black text-white tracking-tight">
              Registro de Incidencias
            </h1>
            <p className="text-white/70 text-sm mt-1">

            </p>
          </div>

          <div className="flex flex-wrap gap-3">

          </div>
        </div>
      </div>

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Formulario */}
        <div className="lg:col-span-4">
          <div className="bg-white/90 backdrop-blur rounded-2xl border border-slate-200 shadow-md overflow-hidden">
            <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nueva incidencia</p>
                <h2 className="text-lg font-black text-[#1e3c72]">Registro operacional</h2>
              </div>
              <span className="text-[10px] font-black px-2 py-1 rounded-full bg-[#1e3c72]/10 text-[#1e3c72] border border-[#1e3c72]/20">
                CCO
              </span>
            </div>

            <div className="p-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Fecha */}
                <div>
                  <label className="text-xs font-bold text-slate-500">FECHA</label>
                  <input
                    type="date"
                    name="fecha"
                    value={formData.fecha}
                    onChange={handleChange}
                    className="w-full border border-slate-200 p-2.5 rounded-xl font-semibold"
                  />
                </div>

                {/* Servicio + Local */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-1">
                    <label className="text-xs font-bold text-slate-500">SERVICIO</label>
                    <select
                      name="servicio"
                      value={formData.servicio}
                      onChange={handleChange}
                      className="w-full border border-slate-200 p-2.5 rounded-xl font-black text-[#1e3c72]"
                    >
                      <option value="LAT">LAT</option>
                      <option value="HD">HD</option>
                      <option value="SBA">SBA</option>
                      <option value="CM">CM</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-500">LOCAL</label>
                    <select
                      name="local"
                      value={formData.local}
                      onChange={handleChange}
                      className="w-full border border-slate-200 p-2.5 rounded-xl font-semibold"
                    >
                      <option value="">Seleccione...</option>
                      {localesPorServicio[formData.servicio]?.map((l, i) => (
                        <option key={i} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* SG */}
                <div>
                  <label className="text-xs font-bold text-slate-500">SG (OPCIONAL)</label>
                  <input
                    type="number"
                    name="sg"
                    value={formData.sg}
                    onChange={handleChange}
                    placeholder="Ej: 994123"
                    className="w-full border border-slate-200 p-2.5 rounded-xl font-mono font-bold text-[#1e3c72]"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Identificador interno para trazabilidad (si aplica).</p>
                </div>

                {/* Motivo */}
                <div>
                  <label className="text-xs font-bold text-slate-500">MOTIVO</label>
                  <div className="grid grid-cols-1 gap-2">
                    <select
                      name="grupo"
                      value={formData.grupo}
                      onChange={handleChange}
                      className="w-full border border-slate-200 p-2.5 rounded-xl font-semibold"
                    >
                      <option value="">Grupo...</option>
                      {Object.keys(motivosPorGrupo).map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>

                    <select
                      name="motivo"
                      value={formData.motivo}
                      onChange={handleChange}
                      disabled={!formData.grupo}
                      className="w-full border border-slate-200 p-2.5 rounded-xl font-semibold disabled:opacity-60"
                    >
                      <option value="">Motivo...</option>
                      {motivosPorGrupo[formData.grupo]?.map((m, i) => (
                        <option key={i} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!!formData.motivo && (
                    <div className="mt-2 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">KPI</span>
                      <BadgeKPI value={determinarKPI(formData.motivo)} />
                    </div>
                  )}
                </div>

                {/* Observación */}
                <div>
                  <label className="text-xs font-bold text-slate-500">OBSERVACIÓN (mín. 5 caracteres)</label>
                  <textarea
                    name="observacion"
                    rows="3"
                    value={formData.observacion}
                    onChange={handleChange}
                    className="w-full border border-slate-200 p-2.5 rounded-xl resize-none uppercase"
                    placeholder="Describe brevemente la situación..."
                  />
                </div>

                <button
                  disabled={loading}
                  className="w-full rounded-xl bg-[#1e3c72] hover:bg-[#163a6b] text-white font-black py-3 text-sm shadow-sm transition active:scale-[0.99] disabled:opacity-60"
                >
                  {loading ? "Guardando..." : "Guardar incidencia"}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="lg:col-span-8">
          <div className="bg-white/90 backdrop-blur rounded-2xl border border-slate-200 shadow-md overflow-hidden">
            <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Historial</p>
                <h2 className="text-lg font-black text-[#1e3c72]">Últimos ingresos</h2>
              </div>

              <button
                type="button"
                onClick={fetchIncidencias}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-black text-xs"
              >
                Actualizar
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gradient-to-r from-[#0b1f44] via-[#163a6b] to-[#0b1f44] text-white text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Servicio</th>
                    <th className="px-4 py-3">Local</th>
                    <th className="px-4 py-3">SG</th>
                    <th className="px-4 py-3">Motivo</th>
                    <th className="px-4 py-3">KPI</th>
                  </tr>
                </thead>

                <tbody>
                  {incidencias.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-slate-100 hover:bg-slate-50/70 odd:bg-white even:bg-slate-50/40 transition-colors"
                    >
                      <td className="px-4 py-2 font-bold text-slate-600">{item.fecha}</td>
                      <td className="px-4 py-2 font-black text-slate-900">{item.servicio || "-"}</td>
                      <td className="px-4 py-2 font-black text-[#1e3c72]">{item.local}</td>
                      <td className="px-4 py-2 font-mono text-xs text-slate-700">{item.sg || "-"}</td>
                      <td className="px-4 py-2 text-xs text-slate-700 max-w-[420px]">
                        <span className="font-semibold">{item.motivo}</span>
                      </td>
                      <td className="px-4 py-2">
                        <BadgeKPI value={item.kpi} />
                      </td>
                    </tr>
                  ))}

                  {incidencias.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500 font-semibold">
                        Sin registros todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t bg-white flex items-center justify-between text-xs text-slate-500">
              <span>
                Mostrando <span className="font-bold text-slate-700">{incidencias.length}</span> registros (últimos 50).
              </span>
              <span className="font-semibold">CCO • Valdishopper</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
