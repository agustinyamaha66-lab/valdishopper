import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import PageHeader from "../ui/PageHeader";
import {
  getCategoria,
  REGIONES_CHILE,
  normalizePatente,
  isValidPatente,
} from "../utils/catexPatente";
import { Search, Filter, X, Edit3, Save, Power } from "lucide-react";

const TABLE = "control_patentes_catex";

// -------------------- UI: Toast --------------------
function ToastNotification({ notification, onClose }) {
  if (!notification.visible) return null;

  const colors = {
    success: "bg-emerald-100 border-emerald-500 text-emerald-900",
    error: "bg-rose-100 border-rose-500 text-rose-900",
    info: "bg-blue-100 border-blue-500 text-blue-900",
    warning: "bg-amber-100 border-amber-500 text-amber-900",
  };

  return (
      <div
          className={`fixed top-24 right-6 z-[9999] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border-l-4 backdrop-blur-md ${
              colors[notification.type] || colors.info
          } min-w-[320px] animate-in slide-in-from-right duration-200`}
      >
        <div className="flex-1">
          <p className="font-black text-[10px] uppercase tracking-[0.25em]">NOTIFICACIÓN</p>
          <p className="text-sm font-semibold">{notification.message}</p>
        </div>
        <button onClick={onClose} className="text-slate-500 font-black hover:text-black">
          ×
        </button>
      </div>
  );
}

// -------------------- UI: Modal Genérico --------------------
function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
      <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-slate-900 font-black text-lg">{title}</h3>
            <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white border hover:bg-slate-100 flex items-center justify-center font-bold text-slate-500 transition"
            >
              ×
            </button>
          </div>
          <div className="p-6">{children}</div>
        </div>
      </div>
  );
}

// ✅ Formato m³ (Chile)
const formatM3 = (v) => {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "-";
  const valorFormateado = new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(v);
  return `${valorFormateado} m³`;
};

const sanitizePatenteInput = (value) => {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
};

// -------------------- COMPONENTE DE CAMPOS (REUTILIZABLE) --------------------
const PatenteFormFields = ({ form, setForm, loading }) => {
  const handleDimensionBlur = (field, e) => {
    let val = e.target.value;
    if (!val) return;

    val = val.replace(",", ".");

    if (!val.includes(".")) {
      if (val.length === 3) val = val.slice(0, 1) + "." + val.slice(1);
      else if (val.length === 4) val = val.slice(0, 2) + "." + val.slice(2);
    }

    const parts = val.split(".");
    let intPart = parts[0];
    let decPart = parts[1];

    if (intPart.length > 2) intPart = intPart.slice(0, 2);
    if (decPart && decPart.length > 2) decPart = decPart.slice(0, 2);

    const finalVal = decPart !== undefined ? `${intPart}.${decPart}` : intPart;
    setForm((prev) => ({ ...prev, [field]: finalVal }));
  };

  const handleNumberInput = (field, val) => {
    if (/^[0-9.,]*$/.test(val)) {
      setForm((prev) => ({ ...prev, [field]: val }));
    }
  };

  return (
      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
            Patente
          </label>
          <input
              value={form.patente}
              onChange={(e) =>
                  setForm((prev) => ({ ...prev, patente: sanitizePatenteInput(e.target.value) }))
              }
              className="w-full border rounded-xl p-3 font-black text-slate-800 uppercase outline-none focus:ring-2 focus:ring-[#d63384]/20 focus:border-[#d63384]"
              placeholder="Ej: ABCD12"
              maxLength={6}
              disabled={loading}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {["largo", "ancho", "alto"].map((field) => (
              <div key={field}>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1 capitalize">
                  {field}
                </label>
                <input
                    type="text"
                    inputMode="decimal"
                    value={form[field]}
                    onChange={(e) => handleNumberInput(field, e.target.value)}
                    onBlur={(e) => handleDimensionBlur(field, e)}
                    className="w-full border rounded-xl p-3 font-bold text-slate-800 text-center outline-none focus:border-[#d63384]"
                    placeholder="0.00"
                    disabled={loading}
                />
              </div>
          ))}
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
            Zona
          </label>
          <select
              value={form.zona}
              onChange={(e) => setForm((prev) => ({ ...prev, zona: e.target.value }))}
              className="w-full border rounded-xl p-3 font-bold text-slate-700 bg-white outline-none focus:border-[#d63384]"
              disabled={loading}
          >
            {REGIONES_CHILE.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
            ))}
          </select>
        </div>
      </div>
  );
};

// ==================== COMPONENTE PRINCIPAL ====================
export default function CatastroPatente() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // Estados
  const [editingId, setEditingId] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const [form, setForm] = useState({
    patente: "",
    largo: "",
    ancho: "",
    alto: "",
    zona: "No definida",
  });

  // Filtros
  const [filterPatente, setFilterPatente] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("TODAS");
  const [filterZona, setFilterZona] = useState("TODAS");

  // ✅ NUEVO filtro estado activo
  const [filterActivo, setFilterActivo] = useState("ACTIVAS"); // ACTIVAS | INACTIVAS | TODAS

  // Notificaciones y Modales
  const [notification, setNotification] = useState({ visible: false, message: "", type: "info" });
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null });
  const [duplicateModal, setDuplicateModal] = useState({
    open: false,
    patente: "",
    existing: null,
    payload: null,
  });

  const showToast = (message, type = "info") => {
    setNotification({ visible: true, message, type });
    setTimeout(() => setNotification((p) => ({ ...p, visible: false })), 3500);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ patente: "", largo: "", ancho: "", alto: "", zona: "No definida" });
    setEditModalOpen(false);
  };

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase.from(TABLE).select("*").order("patente", { ascending: true });
    setLoading(false);
    if (error) showToast("Error cargando patentes: " + error.message, "error");
    else setRows(data || []);
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const availableCategorias = useMemo(() => {
    const cats = new Set(rows.map((r) => r.categoria).filter(Boolean));
    return Array.from(cats).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const p = String(r.patente || "").toUpperCase();
      const q = filterPatente.toUpperCase();
      if (filterPatente && !p.includes(q)) return false;
      if (filterCategoria !== "TODAS" && r.categoria !== filterCategoria) return false;
      if (filterZona !== "TODAS" && r.zona !== filterZona) return false;

      // ✅ filtro activo
      const activo = r.activo !== false; // default true si no existe
      if (filterActivo === "ACTIVAS" && !activo) return false;
      if (filterActivo === "INACTIVAS" && activo) return false;

      return true;
    });
  }, [rows, filterPatente, filterCategoria, filterZona, filterActivo]);

  const clearFilters = () => {
    setFilterPatente("");
    setFilterCategoria("TODAS");
    setFilterZona("TODAS");
    setFilterActivo("ACTIVAS");
  };

  const parseNumber = (val) => {
    const n = parseFloat(String(val).replace(",", "."));
    return Number.isNaN(n) ? null : n;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const patenteNorm = normalizePatente(form.patente);
    if (!isValidPatente(patenteNorm)) {
      showToast("Patente inválida (debe ser 6 caracteres). Ej: ABCD12", "warning");
      return;
    }

    const largo = parseNumber(form.largo);
    const ancho = parseNumber(form.ancho);
    const alto = parseNumber(form.alto);

    if (!largo || !ancho || !alto || largo <= 0 || ancho <= 0 || alto <= 0) {
      showToast("Dimensiones inválidas. Verifica que sean positivas.", "warning");
      return;
    }

    const volumen = Number((largo * ancho * alto).toFixed(3));
    const categoria = getCategoria(volumen);

    const payload = {
      patente: patenteNorm,
      largo,
      ancho,
      alto,
      volumen,
      categoria,
      zona: form.zona || "No definida",
      // ✅ por defecto activa al crear
      activo: true,
    };

    setLoading(true);

    try {
      if (editingId) {
        // No tocamos "activo" al editar, a menos que quieras.
        const { activo, ...payloadSinActivo } = payload;
        const { error } = await supabase.from(TABLE).update(payloadSinActivo).eq("id", editingId);
        if (error) throw error;
        showToast("Patente actualizada correctamente.", "success");
        resetForm();
        await fetchRows();
        return;
      }

      const { data: existing, error: exErr } = await supabase
          .from(TABLE)
          .select("*")
          .eq("patente", patenteNorm)
          .maybeSingle();
      if (exErr) throw exErr;

      if (existing?.id) {
        setDuplicateModal({ open: true, patente: patenteNorm, existing, payload });
        return;
      }

      const { error } = await supabase.from(TABLE).insert([payload]);
      if (error) throw error;

      showToast("Patente registrada.", "success");
      resetForm();
      await fetchRows();
    } catch (err) {
      showToast("Error: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const confirmDuplicateUpdate = async () => {
    if (!duplicateModal.existing?.id || !duplicateModal.payload) return;
    setLoading(true);
    try {
      // Al sobreescribir, también puedes reactivarla:
      const payload = { ...duplicateModal.payload, activo: true };

      const { error } = await supabase.from(TABLE).update(payload).eq("id", duplicateModal.existing.id);
      if (error) throw error;

      showToast(`Patente ${duplicateModal.patente} actualizada.`, "success");
      setDuplicateModal({ open: false, patente: "", existing: null, payload: null });
      resetForm();
      await fetchRows();
    } catch (err) {
      showToast("Error: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setForm({
      patente: sanitizePatenteInput(r.patente || ""),
      largo: r.largo ? String(r.largo) : "",
      ancho: r.ancho ? String(r.ancho) : "",
      alto: r.alto ? String(r.alto) : "",
      zona: r.zona || "No definida",
    });
    setEditModalOpen(true);
  };

  // ✅ NUEVO: Activar/Desactivar (soft delete)
  const toggleActivo = async (row) => {
    const activoActual = row.activo !== false;
    const nuevoEstado = !activoActual;

    const ok = window.confirm(
        nuevoEstado
            ? `¿Activar la patente ${row.patente}?`
            : `¿Desactivar la patente ${row.patente}?\n\nNo se borrará, solo quedará inactiva.`
    );
    if (!ok) return;

    setLoading(true);
    try {
      const updatePayload = {
        activo: nuevoEstado,
        // opcional:
        // desactivada_at: nuevoEstado ? null : new Date().toISOString(),
      };

      const { error } = await supabase.from(TABLE).update(updatePayload).eq("id", row.id);
      if (error) throw error;

      showToast(
          nuevoEstado ? `Patente ${row.patente} activada ✅` : `Patente ${row.patente} desactivada ⚠️`,
          nuevoEstado ? "success" : "warning"
      );

      await fetchRows();
    } catch (err) {
      showToast("Error: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // (Tu delete físico lo dejo, pero ya no es lo recomendado)
  const confirmDelete = async () => {
    const id = deleteModal.id;
    if (!id) return;
    setLoading(true);
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    setLoading(false);
    setDeleteModal({ open: false, id: null });
    if (error) showToast("Error al eliminar", "error");
    else {
      showToast("Registro eliminado.", "success");
      if (editingId === id) resetForm();
      fetchRows();
    }
  };

  return (
      <div className="p-6 font-sans">
        <ToastNotification
            notification={notification}
            onClose={() => setNotification((p) => ({ ...p, visible: false }))}
        />

        {/* --- MODAL DE EDICIÓN --- */}
        <Modal open={editModalOpen} title="Editar Patente" onClose={resetForm}>
          <form onSubmit={handleSubmit}>
            <PatenteFormFields form={form} setForm={setForm} loading={loading} />

            <div className="flex gap-2 mt-6 justify-end">
              <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-[#d63384] hover:bg-pink-600 text-white rounded-xl font-black shadow-lg shadow-pink-200 transition-all active:scale-95 flex items-center gap-2"
              >
                <Save size={16} />
                {loading ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </form>
        </Modal>

        {/* --- MODAL DUPLICADO --- */}
        <Modal open={duplicateModal.open} title="Patente Existente" onClose={() => setDuplicateModal({ open: false })}>
          <p className="text-sm text-slate-600 mb-6">
            La patente <b>{duplicateModal.patente}</b> ya existe. ¿Deseas sobreescribir los datos actuales?
          </p>
          <div className="flex justify-end gap-2">
            <button
                onClick={() => setDuplicateModal({ open: false })}
                className="px-4 py-2 border rounded-xl font-bold text-slate-600"
            >
              Cancelar
            </button>
            <button
                onClick={confirmDuplicateUpdate}
                className="px-4 py-2 bg-[#d63384] text-white rounded-xl font-bold"
            >
              Sobreescribir
            </button>
          </div>
        </Modal>



        <PageHeader
            title="Catastro Patentes CATEX"
            subtitle="Registro de dimensiones, volumen (m³), categoría y región (zona)."
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* --- FORM NUEVO REGISTRO --- */}
          <div className="bg-white border rounded-2xl p-5 shadow-sm h-fit sticky top-6">
            <div className="flex items-center gap-2 border-b pb-3 mb-4">
              <div className="w-2 h-6 bg-[#0b1f44] rounded-full"></div>
              <h3 className="font-black text-slate-800">Nuevo Registro</h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <PatenteFormFields form={form} setForm={setForm} loading={loading} />

              <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 rounded-xl bg-[#0b1f44] hover:bg-[#152c55] text-white font-black py-3 transition shadow-lg shadow-blue-900/10 active:scale-95"
              >
                {loading ? "Procesando..." : "Registrar Patente"}
              </button>
            </form>
          </div>

          {/* --- LISTADO Y FILTROS --- */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-black text-slate-800 flex items-center gap-2">
                  <Filter size={18} className="text-[#d63384]" />
                  Filtros
                </h4>
                {(filterPatente || filterCategoria !== "TODAS" || filterZona !== "TODAS" || filterActivo !== "ACTIVAS") && (
                    <button
                        onClick={clearFilters}
                        className="text-[11px] font-bold text-rose-500 flex items-center gap-1 hover:underline"
                    >
                      <X size={12} /> Limpiar filtros
                    </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                    Buscar Patente
                  </label>
                  <div className="relative">
                    <input
                        value={filterPatente}
                        onChange={(e) => setFilterPatente(e.target.value)}
                        placeholder="..."
                        className="w-full border rounded-xl pl-8 pr-3 py-2 font-black text-slate-800 uppercase text-sm outline-none focus:border-[#d63384]"
                    />
                    <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Categoría</label>
                  <select
                      value={filterCategoria}
                      onChange={(e) => setFilterCategoria(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2 font-bold text-slate-700 text-sm outline-none"
                  >
                    <option value="TODAS">Todas</option>
                    {availableCategorias.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Zona</label>
                  <select
                      value={filterZona}
                      onChange={(e) => setFilterZona(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2 font-bold text-slate-700 text-sm outline-none"
                  >
                    <option value="TODAS">Todas</option>
                    {REGIONES_CHILE.map((zona) => (
                        <option key={zona} value={zona}>
                          {zona}
                        </option>
                    ))}
                  </select>
                </div>

                {/* ✅ NUEVO: Estado */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Estado</label>
                  <select
                      value={filterActivo}
                      onChange={(e) => setFilterActivo(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2 font-bold text-slate-700 text-sm outline-none"
                  >
                    <option value="ACTIVAS">Activas</option>
                    <option value="INACTIVAS">Inactivas</option>
                    <option value="TODAS">Todas</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-slate-800">Control Patentes</h3>
                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-black">
                {filtered.length}
              </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#0b1f44] text-white text-[10px] uppercase tracking-widest">
                  <tr>
                    <th className="text-left py-3 px-4 rounded-l-lg">Patente</th>
                    <th className="text-center py-3 px-2">Dimensiones</th>
                    <th className="text-center py-3 px-2">Volumen</th>
                    <th className="text-center py-3 px-2">Categoría</th>
                    <th className="text-left py-3 px-4">Región</th>
                    <th className="text-center py-3 px-2">Estado</th>
                    <th className="text-right py-3 px-4 rounded-r-lg">Acción</th>
                  </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                  {filtered.map((r) => {
                    const activo = r.activo !== false;

                    return (
                        <tr key={r.id} className="hover:bg-blue-50/50 transition-colors">
                          <td className="py-3 px-4">
                          <span className="font-black text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                            {r.patente}
                          </span>
                          </td>

                          <td className="py-3 px-2 text-center text-slate-500 font-mono text-xs">
                            {r.largo} x {r.ancho} x {r.alto}
                          </td>

                          <td className="py-3 px-2 text-center text-slate-700 font-bold">
                            {formatM3(r.volumen)}
                          </td>

                          <td className="py-3 px-2 text-center">
                          <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                            {r.categoria}
                          </span>
                          </td>

                          <td className="py-3 px-4 text-slate-600 font-semibold text-xs">{r.zona}</td>

                          {/* ✅ Estado badge */}
                          <td className="py-3 px-2 text-center">
                            {activo ? (
                                <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                              ACTIVA
                            </span>
                            ) : (
                                <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                              INACTIVA
                            </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                                onClick={() => startEdit(r)}
                                className="text-xs font-bold text-slate-500 hover:text-[#0b1f44] underline inline-flex items-center gap-1"
                            >
                              <Edit3 size={12} /> Editar
                            </button>

                            {/* ✅ Activar/Desactivar */}
                            <button
                                onClick={() => toggleActivo(r)}
                                className={`text-xs font-black underline inline-flex items-center gap-1 ${
                                    activo ? "text-amber-600 hover:text-amber-800" : "text-emerald-600 hover:text-emerald-800"
                                }`}
                                title={activo ? "Desactivar (no borra)" : "Activar"}
                            >
                              <Power size={12} />
                              {activo ? "Desactivar" : "Activar"}
                            </button>

                            {/* Delete físico (opcional, no recomendado) */}
                            <button
                                onClick={() => setDeleteModal({ open: true, id: r.id })}
                                className="text-xs font-bold text-rose-400 hover:text-rose-600 underline"
                            >
                            </button>
                          </td>
                        </tr>
                    );
                  })}

                  {filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          <p className="font-bold">No se encontraron patentes</p>
                        </td>
                      </tr>
                  )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
