import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

// --- 1. COMPONENTE PAGE HEADER (Limpio) ---
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
      <div className={`absolute inset-0 bg-gradient-to-r ${gradient}`} />

      {/* Decoración de fondo sutil */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-10 left-10 h-28 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 right-10 h-28 w-64 rounded-full bg-cyan-300/10 blur-2xl" />
      </div>

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
        {right ? <div className="w-full xl:w-auto">{right}</div> : null}
      </div>
    </div>
  );
}

// --- DATOS MAESTROS ---
const localesPorServicio = {
  LAT: ["120 Temuco", "121 Punta Arenas", "143 Talca", "144 Parral", "146 San Javier", "182 Buin", "276 Lampa", "41 Huechuraba", "42 Curicó", "518 Valparaíso", "54 La Florida ", "608 Chillán", "611 La Florida ", "618 Osorno", "627 San Vicente"],
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
    <div className={`fixed top-24 right-6 z-[9999] flex items-start gap-3 px-4 py-3 rounded-2xl shadow-xl border-l-4 backdrop-blur transition-all duration-300 ${s.wrap} min-w-[320px] animate-fade-in-up`}>
      <span className="text-xl mt-0.5">{s.icon}</span>
      <div className="flex-1">
        <p className="font-black text-[11px] uppercase tracking-widest">{s.label}</p>
        <p className="font-semibold text-sm leading-snug">{notification.message}</p>
      </div>
      <button onClick={onClose} className="text-slate-500 hover:text-slate-900 font-black text-lg">×</button>
    </div>
  );
};

const BadgeKPI = ({ value }) => {
  const map = {
    CONTINGENCIA: "bg-rose-50 text-rose-700 border-rose-200",
    "ALERTA OTEA": "bg-amber-50 text-amber-800 border-amber-200",
    REPORTADO: "bg-slate-50 text-slate-600 border-slate-200",
  };
  return <span className={`text-[10px] font-black px-2 py-1 rounded-full border ${map[value] || map.REPORTADO}`}>{value}</span>;
};

// --- COMPONENTE PRINCIPAL ---
export default function OperacionBitacora() {
  const [incidencias, setIncidencias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ visible: false, message: "", type: "success" });

  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split("T")[0],
    servicio: "LAT",
    local: "",
    sg: "",
    grupo: "",
    motivo: "",
    observacion: "",
  });

  const showToast = (message, type = "success") => {
    setNotification({ visible: true, message, type });
    setTimeout(() => setNotification((prev) => ({ ...prev, visible: false })), 3000);
  };

  useEffect(() => { fetchIncidencias(); }, []);

  const fetchIncidencias = async () => {
    const { data, error } = await supabase.from("incidencias").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) { showToast("Error al cargar: " + error.message, "error"); return; }
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
    if (!formData.local || !formData.grupo || !formData.motivo) { showToast("Faltan datos obligatorios", "error"); return; }
    if ((formData.observacion || "").trim().length < 5) { showToast("Observación muy corta", "warning"); return; }
    setLoading(true);
    const payload = { ...formData, kpi: determinarKPI(formData.motivo) };
    const { error } = await supabase.from("incidencias").insert([payload]);
    if (error) { showToast("Error al guardar: " + error.message, "error"); setLoading(false); return; }
    showToast("Incidencia registrada", "success");
    await fetchIncidencias();
    setFormData({ ...formData, sg: "", grupo: "", motivo: "", observacion: "" });
    setLoading(false);
  };

  return (
    <div className="min-h-screen px-4 md:px-8 py-8 relative">
      {/* Fondo enterprise */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50" />
        <div className="absolute top-[-12%] right-[-10%] w-[560px] h-[560px] bg-slate-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-[-18%] left-[-12%] w-[640px] h-[640px] bg-slate-200/30 rounded-full blur-3xl" />
      </div>

      <ToastNotification notification={notification} onClose={() => setNotification((p) => ({ ...p, visible: false }))} />

      {/* ===========================================================
          PAGE HEADER (Sin KPIs/Métricas)
          =========================================================== */}
      <PageHeader
        eyebrow=""
        title="REGISTRO DE INCIDENCIAS"
        subtitle="Plataforma de gestión y trazabilidad de contingencias operativas."
        // Se ha eliminado la propiedad 'right' que contenía los contadores
      />

      {/* Layout Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* COLUMNA IZQUIERDA: FORMULARIO */}
        <div className="lg:col-span-4">
          <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200 shadow-xl overflow-hidden sticky top-6">
            <div className="px-5 py-4 border-b bg-slate-50/80 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nueva incidencia</p>
                <h2 className="text-lg font-black text-[#1e3c72]">Ingreso de datos</h2>
              </div>
              <span className="text-[10px] font-black px-2 py-1 rounded-full bg-[#1e3c72]/10 text-[#1e3c72] border border-[#1e3c72]/20">CCO</span>
            </div>

            <div className="p-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Fecha */}
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1">FECHA</label>
                  <input type="date" name="fecha" value={formData.fecha} onChange={handleChange} className="w-full border border-slate-200 bg-slate-50/50 focus:bg-white p-2.5 rounded-xl font-semibold outline-none focus:ring-2 focus:ring-[#1e3c72]/20 transition-all" />
                </div>

                {/* Servicio + Local */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-1">
                    <label className="text-xs font-bold text-slate-500 ml-1">SERVICIO</label>
                    <select name="servicio" value={formData.servicio} onChange={handleChange} className="w-full border border-slate-200 bg-slate-50/50 focus:bg-white p-2.5 rounded-xl font-black text-[#1e3c72] outline-none transition-all">
                      <option value="LAT">LAT</option><option value="HD">HD</option><option value="SBA">SBA</option><option value="CM">CM</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-500 ml-1">LOCAL</label>
                    <select name="local" value={formData.local} onChange={handleChange} className="w-full border border-slate-200 bg-slate-50/50 focus:bg-white p-2.5 rounded-xl font-semibold outline-none transition-all">
                      <option value="">Seleccione...</option>
                      {localesPorServicio[formData.servicio]?.map((l, i) => <option key={i} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>

                {/* SG */}
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1">SG (OPCIONAL)</label>
                  <input type="number" name="sg" value={formData.sg} onChange={handleChange} placeholder="Ej: 994123" className="w-full border border-slate-200 bg-slate-50/50 focus:bg-white p-2.5 rounded-xl font-mono font-bold text-[#1e3c72] outline-none transition-all" />
                </div>

                {/* Motivos */}
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1">MOTIVO & KPI</label>
                  <div className="grid grid-cols-1 gap-2">
                    <select name="grupo" value={formData.grupo} onChange={handleChange} className="w-full border border-slate-200 bg-slate-50/50 focus:bg-white p-2.5 rounded-xl font-semibold outline-none transition-all">
                      <option value="">Grupo...</option>
                      {Object.keys(motivosPorGrupo).map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <select name="motivo" value={formData.motivo} onChange={handleChange} disabled={!formData.grupo} className="w-full border border-slate-200 bg-slate-50/50 focus:bg-white p-2.5 rounded-xl font-semibold disabled:opacity-50 outline-none transition-all">
                      <option value="">Motivo...</option>
                      {motivosPorGrupo[formData.grupo]?.map((m, i) => <option key={i} value={m}>{m}</option>)}
                    </select>
                  </div>
                  {!!formData.motivo && (
                    <div className="mt-2 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 animate-fade-in-up">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nivel de Impacto</span>
                      <BadgeKPI value={determinarKPI(formData.motivo)} />
                    </div>
                  )}
                </div>

                {/* Observación */}
                <div>
                  <label className="text-xs font-bold text-slate-500 ml-1">OBSERVACIÓN</label>
                  <textarea name="observacion" rows="3" value={formData.observacion} onChange={handleChange} className="w-full border border-slate-200 bg-slate-50/50 focus:bg-white p-2.5 rounded-xl resize-none uppercase outline-none focus:ring-2 focus:ring-[#1e3c72]/20 transition-all" placeholder="Detalle de la incidencia..." />
                </div>

                <button disabled={loading} className="w-full rounded-xl bg-[#1e3c72] hover:bg-[#163a6b] text-white font-black py-3 text-sm shadow-lg shadow-blue-900/10 transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed">
                  {loading ? "Guardando..." : "GUARDAR REGISTRO"}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: TABLA */}
        <div className="lg:col-span-8">
          <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b bg-slate-50/80 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Historial</p>
                <h2 className="text-lg font-black text-[#1e3c72]">Últimos ingresos</h2>
              </div>
              <button type="button" onClick={fetchIncidencias} className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-black text-xs shadow-sm transition">
                ↻ Actualizar
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#1e3c72] text-white text-xs uppercase font-black tracking-wider">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap">Fecha</th>
                    <th className="px-4 py-3 text-center">Servicio</th>
                    <th className="px-4 py-3">Local</th>
                    <th className="px-4 py-3">Motivo</th>
                    <th className="px-4 py-3 text-center">KPI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {incidencias.map((item) => (
                    <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-500 whitespace-nowrap">{item.fecha}</td>
                      <td className="px-4 py-3 text-center">
                          <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-[10px] font-black">{item.servicio || "-"}</span>
                      </td>
                      <td className="px-4 py-3">
                          <div className="font-black text-[#1e3c72]">{item.local}</div>
                          {item.sg && <div className="text-[10px] text-slate-400 font-mono mt-0.5">SG: {item.sg}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 max-w-[300px]">
                        <div className="font-bold">{item.motivo}</div>
                        {item.observacion && <div className="text-slate-500 mt-1 line-clamp-1 italic text-[11px]">"{item.observacion}"</div>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <BadgeKPI value={item.kpi} />
                      </td>
                    </tr>
                  ))}
                  {incidencias.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400 font-bold">Sin registros recientes.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t bg-slate-50 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              <span>Registros: {incidencias.length}</span>
              <span>Valdishopper • CCO</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}