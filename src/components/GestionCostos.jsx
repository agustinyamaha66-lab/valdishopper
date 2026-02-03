import PageHeader from "../ui/PageHeader";
import { DollarSign } from "lucide-react";
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  Receipt,
  Calendar,
  MapPin,
  Hash,
  FileText,
  Save,
  AlertCircle,
  CheckCircle2,
  CreditCard
} from 'lucide-react'

// --- DATOS MAESTROS ---
const localesPorServicio = {
 LAT: [
  "41 Huechuraba",
  "42 Curicó",
  "54 La Florida ",
  "71 Ñuñoa",
  "75 Maipú (Pajaritos)",
  "76 La Florida",
  "88 Los Dominicos",
  "92 La Serena",
  "94 Valdivia",
  "98 Concepción",
  "99 Puerto Montt ",
  "120 Temuco",
  "121 Punta Arenas",
  "143 Talca",
  "144 Parral",
  "146 San Javier",
  "182 Buin",
  "276 Lampa",
  "518 Valparaíso",
  "608 Chillán",
  "611 La Florida ",
  "618 Osorno",
  "627 San Vicente",
  "647 Maitencillo",
  "655 Antofagasta",
  "657 Castro",
  "658 Puerto Varas",
  "693 La Pintana",
  "697 San Fernando",
  "929 Puerto Montt ",
  "952 Talcahuano"
],

  SBA: ["171 San Bernardo", "528 Curicó", "569 Talca", "570 Cauquenes", "583 Constitución", "587 Tome"],
  CM: ["159 Macul", "19 Puerto Montt", "513 Talca", "68 Osorno", "903 San Pedro de la Paz", "990 Maipú"],
  "MODELO MIXTO": ["95 La Reina", "45 Maipú", "58 Viña", "99 Puerto Montt", "98 Concepción"],
  "ESTIVALES": ["120 Temuco", "121 Punta Arenas", "58 Viña", "606 Coronel", "608 Chillán", "618 Osorno", "657 Castro", "697 San Fernando", "94 Valdivia", "98 Concepción", "99 Puerto Montt"],
  CATEX: [
  "33 Calama",
  "35 Rancagua",
  "58 Viña",
  "78 Iquique",
  "92 La Serena",
  "94 Valdivia",
  "99 Puerto Montt",
  "121 Punta Arenas",
  "747 Concón",
  "6004 Temuco",
  "6010 Chillán"
]
}

const initialState = {
  modalidad: 'PAGO',
  servicio: '',
  local: '',
  patente: '',
  tipoDocumento: 'PATENTE',
  tipo: '',
  montoPrestador: '',
  porcentaje: '50%',
  incluirCobro: false,
  montoCliente: '',
  detalleCliente: '',
  comentario: ''
}

// Helpers
const formatCLP = (value) => {
  if (!value) return '';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value);
}

const formatearRut = (rut) => {
  const actual = rut.replace(/^0+/, "").replace(/[^0-9kK]+/g, "").toUpperCase();
  if (actual === '') return '';
  const cuerpo = actual.slice(0, -1);
  const dv = actual.slice(-1);
  return (cuerpo.length > 0 ? new Intl.NumberFormat("es-CL").format(cuerpo) + "-" : "") + dv;
}

const validarRutChileno = (rut) => {
  if (!/^[0-9]+-[0-9kK]{1}$/.test(rut)) return false;
  const split = rut.split('-');
  let num = split[0].replace(/\./g, "");
  let dv = split[1].toUpperCase();
  let M = 0, S = 1;
  for (; num; num = Math.floor(num / 10)) S = (S + num % 10 * (9 - M++ % 6)) % 11;
  const dvEsperado = S ? S - 1 : 'K';
  return dvEsperado == dv;
}

// Badge Concepto
const ConceptoBadge = ({ tipo }) => {
    const styles = {
        'AMBULANCIA': 'bg-red-50 text-red-700 border-red-200',
        'DOBLE RUTA': 'bg-blue-50 text-blue-700 border-blue-200',
        'FALSO FLETE': 'bg-orange-50 text-orange-700 border-orange-200',
        'INCENTIVO': 'bg-green-50 text-green-700 border-green-200',
        'OTRO': 'bg-gray-50 text-gray-700 border-gray-200',
        'SOLO COBRO': 'bg-purple-50 text-purple-700 border-purple-200'
    }
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${styles[tipo] || styles['OTRO']} uppercase tracking-wide`}>
            {tipo}
        </span>
    )
}

export default function GestionCostos() {
  const [loading, setLoading] = useState(false)
  const [registros, setRegistros] = useState([])
  const [formData, setFormData] = useState({
    ...initialState,
    fecha: new Date().toISOString().split('T')[0]
  })

  // Toast simple state
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

  useEffect(() => { fetchRegistros() }, [])

  const showToast = (msg, type = 'success') => {
      setToast({ show: true, msg, type });
      setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 3000);
  }

  const fetchRegistros = async () => {
    const { data } = await supabase.from('costos_extra').select('*').order('created_at', { ascending: false }).limit(20)
    if (data) setRegistros(data)
  }

  const esFalsoFleteHD = () => (formData.servicio === 'HD' || formData.servicio === 'ESTIVALES') && formData.tipo === 'FALSO FLETE';

  const handleMontoChange = (e) => {
    const { name, value } = e.target
    const soloNumeros = value.replace(/\D/g, '')
    if (soloNumeros.length > 9) return;
    setFormData({ ...formData, [name]: soloNumeros })
  }

  const handleIdentificadorChange = (e) => {
    let val = e.target.value;
    if (formData.tipoDocumento === 'RUT') val = val.replace(/[^0-9kK\-\.]/g, '');
    else { if (val.length > 6) return; val = val.toUpperCase(); }
    setFormData({ ...formData, patente: val });
  }

  const handleRutBlur = () => {
    if (formData.tipoDocumento === 'RUT' && formData.patente) {
      setFormData(prev => ({...prev, patente: formatearRut(prev.patente)}))
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    if (name === 'servicio') setFormData({ ...formData, servicio: value, local: '' })
    else {
      const valorFinal = (name === 'local' || type === 'checkbox') ? value : value.toUpperCase();
      setFormData({ ...formData, [name]: type === 'checkbox' ? checked : valorFinal })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.local) return showToast("Selecciona una Sala/Local", "error");
    if (formData.modalidad === 'PAGO' && !formData.tipo) return showToast("Debes seleccionar un CONCEPTO", "error");

    if (formData.modalidad === 'PAGO') {
        if (formData.tipoDocumento === 'PATENTE') {
            const regexPatente = /^([A-Z]{4}\d{2}|[A-Z]{2}\d{4})$/;
            if (!regexPatente.test(formData.patente)) return showToast("FORMATO PATENTE INVÁLIDO (Ej: ABCD12)", "error");
        } else {
            const rutLimpio = formData.patente.replace(/\./g, '').toUpperCase();
            if (!validarRutChileno(rutLimpio)) return showToast("RUT INVÁLIDO", "error");
            setFormData(prev => ({...prev, patente: formatearRut(rutLimpio)}));
        }
        if (!esFalsoFleteHD() && (!formData.montoPrestador || parseInt(formData.montoPrestador) <= 0)) return showToast("FALTA EL MONTO A PAGAR", "error");
    }

    setLoading(true)
    let montoFinalPrestador = formData.montoPrestador
    if (esFalsoFleteHD() && formData.modalidad === 'PAGO') montoFinalPrestador = formData.porcentaje

    const payload = {
      fecha_evento: formData.fecha,
      servicio: formData.servicio,
      local: formData.local,
      modalidad: formData.modalidad,
      patente: formData.modalidad === 'PAGO' ? formData.patente : '-',
      tipo_concepto: formData.modalidad === 'PAGO' ? formData.tipo : 'SOLO COBRO',
      monto_prestador: formData.modalidad === 'PAGO' ? montoFinalPrestador : '0',
      tiene_cobro: formData.incluirCobro || formData.modalidad === 'COBRO',
      monto_cliente: (formData.incluirCobro || formData.modalidad === 'COBRO') ? (formData.montoCliente || 0) : 0,
      detalle_cliente: (formData.incluirCobro || formData.modalidad === 'COBRO') ? formData.detalleCliente : '-',
      comentario: formData.comentario,
      usuario_registro: 'Usuario Activo'
    }

    const { error } = await supabase.from('costos_extra').insert([payload]);

    if (error) showToast("Error: " + error.message, "error");
    else {
      showToast("Movimiento registrado correctamente", "success");
      fetchRegistros()
      setFormData({ ...initialState, fecha: new Date().toISOString().split('T')[0] })
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 font-sans animate-fade-in relative">

      {/* TOAST NOTIFICATION */}
      {toast.show && (
          <div className={`fixed top-24 right-6 z-50 px-6 py-4 rounded-xl shadow-2xl border-l-4 transform transition-all duration-300 animate-in slide-in-from-right flex items-center gap-3 ${toast.type === 'error' ? 'bg-red-50 border-red-500 text-red-800' : 'bg-emerald-50 border-emerald-500 text-emerald-800'}`}>
              {toast.type === 'error' ? <AlertCircle size={24}/> : <CheckCircle2 size={24}/>}
              <div>
                  <p className="font-bold text-xs uppercase tracking-wider opacity-80">{toast.type === 'error' ? 'Error' : 'Éxito'}</p>
                  <p className="font-semibold text-sm">{toast.msg}</p>
              </div>
          </div>
      )}

    <PageHeader
  title="Gestión de Costos"
  subtitle="Registro de pagos extraordinarios y cobros a clientes"
  icon={DollarSign}
/>



      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* --- FORMULARIO (COLUMNA IZQUIERDA) --- */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-6">

              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                 <h2 className="text-[#1e3c72] font-bold text-sm uppercase tracking-wide flex items-center gap-2">
                    <CreditCard size={16} /> Nuevo Movimiento
                 </h2>
              </div>

              <div className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">

                  {/* Selector de Modalidad (Segmented Control) */}
                  <div className="bg-slate-100 p-1 rounded-xl flex font-bold text-sm">
                    <button
                        type="button"
                        onClick={() => setFormData({...formData, modalidad: 'PAGO'})}
                        className={`flex-1 py-2.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${formData.modalidad === 'PAGO' ? 'bg-white text-[#1e3c72] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <DollarSign size={16}/> Pagar Prestador
                    </button>
                    <button
                        type="button"
                        onClick={() => setFormData({...formData, modalidad: 'COBRO'})}
                        className={`flex-1 py-2.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${formData.modalidad === 'COBRO' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Receipt size={16}/> Solo Cobro
                    </button>
                  </div>

                  {/* Datos Básicos */}
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Fecha Evento</label>
                        <div className="relative">
                            <input type="date" name="fecha" value={formData.fecha} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#1e3c72] outline-none" />
                            <Calendar className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
                        </div>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Servicio</label>
                        <select name="servicio" value={formData.servicio} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-lg text-sm font-bold text-[#1e3c72] focus:ring-2 focus:ring-[#1e3c72] outline-none" required>
                            <option value="">Sel...</option>
                            {Object.keys(localesPorServicio).map(svc => (<option key={svc} value={svc}>{svc}</option>))}
                        </select>
                     </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Local / Sala</label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-3 text-slate-400" size={16} />
                        <select name="local" value={formData.local} onChange={handleChange} className="w-full border border-slate-200 p-2.5 pl-9 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3c72] outline-none disabled:bg-slate-50" disabled={!formData.servicio} required>
                            <option value="">{formData.servicio ? 'Seleccione ubicación...' : '← Elija Servicio primero'}</option>
                            {formData.servicio && localesPorServicio[formData.servicio]?.map((l, i) => (<option key={i} value={l}>{l}</option>))}
                        </select>
                    </div>
                  </div>

                  {/* Sección PAGO PRESTADOR */}
                  {formData.modalidad === 'PAGO' && (
                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-blue-100 text-blue-600 text-[9px] font-bold px-2 py-1 rounded-bl-lg uppercase tracking-wide">Área Pagos</div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                             <label className="text-xs font-bold text-slate-500 uppercase">Identificador</label>
                             <div className="flex bg-white border border-slate-200 rounded p-0.5">
                                <button type="button" onClick={() => setFormData(prev => ({...prev, tipoDocumento: 'PATENTE', patente: ''}))} className={`px-2 py-0.5 text-[9px] font-bold rounded ${formData.tipoDocumento === 'PATENTE' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>PAT</button>
                                <button type="button" onClick={() => setFormData(prev => ({...prev, tipoDocumento: 'RUT', patente: ''}))} className={`px-2 py-0.5 text-[9px] font-bold rounded ${formData.tipoDocumento === 'RUT' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>RUT</button>
                             </div>
                          </div>
                          <div className="relative">
                              <Hash className="absolute left-3 top-3 text-slate-400" size={14} />
                              <input type="text" name="patente" value={formData.patente} onChange={handleIdentificadorChange} onBlur={handleRutBlur} placeholder={formData.tipoDocumento === 'PATENTE' ? "ABCD12" : "12345678-K"} className="w-full border border-slate-200 p-2.5 pl-9 rounded-lg font-mono uppercase font-bold tracking-wide focus:ring-2 focus:ring-[#1e3c72] outline-none text-center" maxLength={formData.tipoDocumento === 'PATENTE' ? 6 : 12} />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Concepto</label>
                          <select name="tipo" value={formData.tipo} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-lg text-xs font-bold text-[#1e3c72] focus:ring-2 focus:ring-[#1e3c72] outline-none">
                              <option value="">Seleccione...</option><option value="AMBULANCIA">AMBULANCIA</option><option value="DOBLE RUTA">DOBLE RUTA</option><option value="FALSO FLETE">FALSO FLETE</option><option value="INCENTIVO">INCENTIVO</option><option value="OTRO">OTRO</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Monto a Pagar</label>
                        {esFalsoFleteHD() ? (
                          <select name="porcentaje" value={formData.porcentaje} onChange={handleChange} className="w-full border border-slate-200 p-2.5 rounded-lg font-bold text-[#1e3c72]"><option value="50%">50%</option><option value="70%">70%</option><option value="100%">100%</option></select>
                        ) : (
                          <div className="relative">
                              <DollarSign className="absolute left-3 top-3 text-slate-400" size={16} />
                              <input type="text" name="montoPrestador" value={formatCLP(formData.montoPrestador)} onChange={handleMontoChange} placeholder="0" className="w-full border border-slate-200 p-2.5 pl-8 rounded-lg font-bold text-right text-slate-800 focus:ring-2 focus:ring-[#1e3c72] outline-none" />
                          </div>
                        )}
                      </div>

                      {/* Checkbox Cobro */}
                      <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-emerald-300 transition-colors">
                          <input type="checkbox" name="incluirCobro" checked={formData.incluirCobro} onChange={handleChange} className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500" />
                          <span className="text-xs font-bold text-slate-600 uppercase">Incluir cobro al cliente</span>
                      </label>
                    </div>
                  )}

                  {/* Sección COBRO CLIENTE */}
                  {(formData.modalidad === 'COBRO' || formData.incluirCobro) && (
                    <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center gap-2 mb-2 text-emerald-700 font-bold text-xs uppercase tracking-wide">
                          <Receipt size={14} /> Datos de Facturación
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-[10px] font-bold text-emerald-600 uppercase mb-1 block">Monto Cobro</label>
                              <input type="text" name="montoCliente" value={formatCLP(formData.montoCliente)} onChange={handleMontoChange} className="w-full border border-emerald-200 p-2.5 rounded-lg font-bold text-emerald-700 bg-white focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="$ 0" />
                          </div>
                          <div>
                              <label className="text-[10px] font-bold text-emerald-600 uppercase mb-1 block">Detalle / Motivo</label>
                              <input type="text" name="detalleCliente" value={formData.detalleCliente} onChange={handleChange} placeholder="Ej: Multa rechazo" className="w-full border border-emerald-200 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none" />
                          </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Comentario Adicional</label>
                    <div className="relative">
                        <FileText className="absolute left-3 top-3 text-slate-400" size={16} />
                        <textarea name="comentario" value={formData.comentario} onChange={handleChange} rows="2" className="w-full border border-slate-200 p-2.5 pl-9 rounded-lg text-sm uppercase resize-none focus:ring-2 focus:ring-[#1e3c72] outline-none" placeholder="Observaciones..." required></textarea>
                    </div>
                  </div>

                  <button disabled={loading} className="w-full bg-[#1e3c72] hover:bg-[#152a50] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-900/10 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70">
                    {loading ? <span className="animate-spin">↻</span> : <Save size={18} />}
                    {loading ? 'Procesando...' : 'Guardar Registro'}
                  </button>

                </form>
              </div>
            </div>
          </div>

          {/* --- TABLA RECIENTE (COLUMNA DERECHA) --- */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                 <h2 className="text-slate-700 font-bold text-sm uppercase tracking-wide">Últimos Ingresos</h2>
                 <button onClick={fetchRegistros} className="text-xs font-bold text-[#1e3c72] hover:underline">Actualizar</button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500 font-bold tracking-wider">
                        <tr>
                            <th className="px-5 py-3">Fecha</th>
                            <th className="px-5 py-3">Servicio</th>
                            <th className="px-5 py-3">Concepto</th>
                            <th className="px-5 py-3 text-right">Pago</th>
                            <th className="px-5 py-3 text-right">Cobro</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                        {registros.length === 0 ? (
                            <tr><td colSpan="5" className="text-center py-10 text-slate-400">Sin movimientos recientes</td></tr>
                        ) : (
                            registros.map(reg => (
                                <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-5 py-3 text-slate-600 font-medium whitespace-nowrap">{reg.fecha_evento}</td>
                                    <td className="px-5 py-3">
                                        <div className="font-bold text-[#1e3c72] text-xs">{reg.servicio}</div>
                                        <div className="text-[10px] text-slate-400 truncate max-w-[100px]" title={reg.local}>{reg.local}</div>
                                    </td>
                                    <td className="px-5 py-3">
                                        <ConceptoBadge tipo={reg.tipo_concepto} />
                                    </td>
                                    <td className="px-5 py-3 text-right font-mono font-medium text-slate-700">
                                        {!isNaN(reg.monto_prestador) ? formatCLP(reg.monto_prestador) : reg.monto_prestador}
                                    </td>
                                    <td className="px-5 py-3 text-right font-mono font-bold text-emerald-600">
                                        {reg.monto_cliente > 0 ? formatCLP(reg.monto_cliente) : '-'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
              </div>
            </div>
          </div>

      </div>
    </div>
  )
}