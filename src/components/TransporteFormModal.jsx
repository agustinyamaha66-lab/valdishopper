import { useEffect, useMemo, useState } from "react";

function normalizePatente(p) {
    return String(p || "")
        .toUpperCase()
        .replace(/\s+/g, "")
        .trim();
}

function normalizeHora(h) {
    let s = String(h || "").trim();
    if (!s) return "";

    if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);
    if (/^\d{1}:\d{2}$/.test(s)) s = `0${s}`;

    if (!/^\d{2}:\d{2}$/.test(s)) return s;

    const [hh, mm] = s.split(":").map((x) => Number(x));
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return s;

    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function ymd(d) {
    // YYYY-MM-DD en local
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

// ✅ Maestro Local -> Nodo
const LOCAL_NODO = [
    { local: "VALDIVIA", nodo: "94" },
    { local: "VIÑA", nodo: "58" },
    { local: "PTO MONTT", nodo: "99" },
    { local: "TEMUCO", nodo: "6004" },
    { local: "CHILLAN", nodo: "6010" },
    { local: "LA SERENA", nodo: "92" },
    { local: "RANCAGUA", nodo: "35" },
    { local: "IQUIQUE", nodo: "679" },
    { local: "CALAMA", nodo: "33" },
    { local: "PUNTA ARENAS", nodo: "121" },
    { local: "SANTIAGO", nodo: "RM" },
    { local: "CON CON", nodo: "747" },
];

export default function TransporteFormModal({
                                                open,
                                                onClose,
                                                onSubmit,
                                                fecha, // fechaFiltro actual (opcional, la usamos como default)
                                                defaultValues,
                                            }) {
    const isEdit = !!defaultValues?.id;

    // Rango permitido: hoy -1, hoy +2
    const hoy = useMemo(() => new Date(), []);
    const minDate = useMemo(() => ymd(addDays(hoy, -1)), [hoy]);
    const maxDate = useMemo(() => ymd(addDays(hoy, 2)), [hoy]);

    const initial = useMemo(() => {
        const defaultFecha =
            defaultValues?.fecha ||
            (fecha ? String(fecha).slice(0, 10) : ymd(hoy));

        const defaultLocal = (defaultValues?.local || "").toString().toUpperCase().trim();
        const found = LOCAL_NODO.find((x) => x.local === defaultLocal);

        return {
            fecha: defaultFecha,
            patente: defaultValues?.patente ?? "",
            hora_citacion: defaultValues?.hora_citacion
                ? String(defaultValues.hora_citacion).slice(0, 5)
                : "",
            local: found ? found.local : (defaultLocal || ""),
            nodo: found ? found.nodo : (defaultValues?.nodo ?? ""),
            // ✅ fijos
            numero_vuelta: 1,
            estado: "pendiente",
        };
    }, [defaultValues, fecha, hoy]);

    const [form, setForm] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        if (open) {
            setForm(initial);
            setErrorMsg("");
            setSaving(false);
        }
    }, [open, initial]);

    if (!open) return null;

    const setField = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

    const handleLocalChange = (local) => {
        const loc = String(local || "").toUpperCase().trim();
        const hit = LOCAL_NODO.find((x) => x.local === loc);
        setForm((prev) => ({
            ...prev,
            local: loc,
            nodo: hit ? hit.nodo : prev.nodo,
        }));
    };

    const handleSave = async (e) => {
        e?.preventDefault?.();
        setErrorMsg("");

        const patente = normalizePatente(form.patente);
        const hora = normalizeHora(form.hora_citacion);

        const fechaSel = String(form.fecha || "").slice(0, 10);
        const local = String(form.local || "").toUpperCase().trim();
        const nodo = String(form.nodo || "").trim();

        // ✅ fijos
        const numero_vuelta = 1;
        const estado = "pendiente";

        // Validaciones
        if (!fechaSel) return setErrorMsg("Fecha es obligatoria.");
        if (fechaSel < minDate || fechaSel > maxDate)
            return setErrorMsg(`Fecha fuera de rango. Permitido: ${minDate} a ${maxDate}.`);

        if (!patente) return setErrorMsg("Patente es obligatoria.");
        if (!hora || !/^\d{2}:\d{2}$/.test(hora))
            return setErrorMsg("Hora citación inválida (HH:MM).");

        const existsLocal = LOCAL_NODO.some((x) => x.local === local);
        if (!existsLocal) return setErrorMsg("Debes seleccionar un Local válido.");
        if (!nodo) return setErrorMsg("Nodo no puede quedar vacío.");

        const payload = {
            fecha: fechaSel,
            patente,
            hora_citacion: hora,
            local,
            nodo,
            numero_vuelta,
            estado,
        };

        setSaving(true);
        try {
            await onSubmit(payload, defaultValues?.id);
            onClose?.();
        } catch (err) {
            setErrorMsg(err?.message || "No se pudo guardar.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999]">
            <div
                className="absolute inset-0 bg-black/50"
                onClick={() => !saving && onClose?.()}
            />

            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
                    <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/70">
                                {isEdit ? "Editar ruta" : "Nueva ruta"}
                            </p>
                            <p className="font-black text-lg">
                                {isEdit ? "Actualizar asignación" : "Agregar asignación manual"}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => !saving && onClose?.()}
                            className="text-white/80 hover:text-white text-2xl font-black"
                            aria-label="Cerrar"
                            title="Cerrar"
                        >
                            ×
                        </button>
                    </div>

                    <form onSubmit={handleSave} className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* ✅ Fecha editable con rango */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                                    Fecha (hoy -1 / hoy +2)
                                </label>
                                <input
                                    type="date"
                                    min={minDate}
                                    max={maxDate}
                                    value={form.fecha}
                                    onChange={(e) => setField("fecha", e.target.value)}
                                    className="mt-2 w-full px-4 py-3 rounded-2xl border border-slate-200 font-bold"
                                />
                            </div>

                            {/* Hora citación */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                                    Hora citación (HH:MM)
                                </label>
                                <input
                                    value={form.hora_citacion}
                                    onChange={(e) => setField("hora_citacion", e.target.value)}
                                    placeholder="08:30"
                                    className="mt-2 w-full px-4 py-3 rounded-2xl border border-slate-200 font-bold"
                                />
                            </div>

                            {/* Patente */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                                    Patente
                                </label>
                                <input
                                    value={form.patente}
                                    onChange={(e) => setField("patente", e.target.value)}
                                    placeholder="LGYW36"
                                    className="mt-2 w-full px-4 py-3 rounded-2xl border border-slate-200 font-bold"
                                />
                            </div>

                            {/* Local (select) */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                                    Local / Ciudad
                                </label>
                                <select
                                    value={form.local}
                                    onChange={(e) => handleLocalChange(e.target.value)}
                                    className="mt-2 w-full px-4 py-3 rounded-2xl border border-slate-200 font-bold"
                                >
                                    <option value="">SELECCIONAR...</option>
                                    {LOCAL_NODO.map((x) => (
                                        <option key={x.local} value={x.local}>
                                            {x.local}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Nodo (auto) */}
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                                    Nodo (auto)
                                </label>
                                <input
                                    value={form.nodo}
                                    readOnly
                                    className="mt-2 w-full px-4 py-3 rounded-2xl border border-slate-200 font-bold bg-slate-50"
                                />
                                <p className="mt-2 text-xs text-slate-500 font-semibold">
                                    El nodo se asigna automáticamente según el Local.
                                </p>
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="mt-4 px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 font-bold">
                                {errorMsg}
                            </div>
                        )}

                        <div className="mt-6 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => !saving && onClose?.()}
                                className="px-5 py-3 rounded-2xl border border-slate-200 font-black hover:bg-slate-50 disabled:opacity-50"
                                disabled={saving}
                            >
                                Cancelar
                            </button>

                            <button
                                type="submit"
                                disabled={saving}
                                className="px-5 py-3 rounded-2xl bg-slate-900 text-white font-black hover:bg-slate-800 disabled:opacity-50"
                            >
                                {saving ? "Guardando..." : "Guardar"}
                            </button>
                        </div>

                        <div className="mt-4 text-xs text-slate-500 font-semibold">
                            Se guardará como: <span className="font-black">vuelta = 1</span> y{" "}
                            <span className="font-black">estado = pendiente</span>.
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
