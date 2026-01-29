import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'


// --- DATOS MAESTROS ---
const localesPorServicio = {
  LAT: ["120 Temuco", "121 Punta Arenas", "143 Talca", "144 Parral", "146 San Javier", "182 Buin", "276 Lampa", "41 Huechuraba", "42 Curicó", "518 Valparaíso", "54 La Florida 54", "608 Chillán", "611 La Florida 611", "618 Osorno", "627 San Vicente"],
  HD: ["120 Temuco", "121 Punta Arenas", "58 Viña", "606 Coronel", "608 Chillán", "618 Osorno", "657 Castro", "697 San Fernando", "94 Valdivia", "98 Concepción", "99 Puerto Montt"],
  SBA: ["171 San Bernardo", "528 Curicó", "569 Talca", "570 Cauquenes", "583 Constitución", "587 Tome"],
  CM: ["159 Macul", "19 Puerto Montt", "513 Talca", "68 Osorno", "903 San Pedro de la Paz", "990 Maipú"],
  "MODELO MIXTO": ["95 La Reina", "45 Maipú", "58 Viña", "99 Puerto Montt", "98 Concepción"],
  "ESTIVALES": ["120 Temuco", "121 Punta Arenas", "58 Viña", "606 Coronel", "608 Chillán", "618 Osorno", "657 Castro", "697 San Fernando", "94 Valdivia", "98 Concepción", "99 Puerto Montt"],
  CATEX: ["33 Kennedy", "71 La Florida", "75 Maipú", "76 La Reina", "78 Puente Alto", "81 Peñalolén", "88 Tobalaba", "92 La Dehesa"]
}

// Estado Inicial
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

const formatCLP = (value) => {
  if (!value) return '';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value);
}

// --- UTILIDADES ---
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

export default function GestionCostos() {
  const [loading, setLoading] = useState(false)
  const [registros, setRegistros] = useState([])
  const [formData, setFormData] = useState({
    ...initialState,
    fecha: new Date().toISOString().split('T')[0]
  })

  useEffect(() => { fetchRegistros() }, [])

  const fetchRegistros = async () => {
    // Solo traemos los últimos 20 para mostrar en la tabla de ingreso rápido
    const { data } = await supabase.from('costos_extra').select('*').order('created_at', { ascending: false }).limit(20)
    if (data) setRegistros(data)
  }

  // --- LÓGICA DE FORMULARIO ---
  const esFalsoFleteHD = () => (formData.servicio === 'HD' || formData.servicio === 'ESTIVALES') && formData.tipo === 'FALSO FLETE';

  const handleMontoChange = (e) => {
    const { name, value } = e.target
    const soloNumeros = value.replace(/\D/g, '')
    if (soloNumeros.length > 7) return;
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
    if (!formData.local) return alert("Selecciona una Sala/Local")
    if (formData.modalidad === 'PAGO' && !formData.tipo) return alert("Debes seleccionar un CONCEPTO");

    if (formData.modalidad === 'PAGO') {
        if (formData.tipoDocumento === 'PATENTE') {
            const regexPatente = /^([A-Z]{4}\d{2}|[A-Z]{2}\d{4})$/;
            if (!regexPatente.test(formData.patente)) return alert("⛔ ERROR EN PATENTE:\nFormatos: ABCD12 o AB1234");
        } else {
            const rutLimpio = formData.patente.replace(/\./g, '').toUpperCase();
            if (!validarRutChileno(rutLimpio)) return alert("⛔ ERROR EN RUT");
            setFormData(prev => ({...prev, patente: formatearRut(rutLimpio)}));
        }
        if (!esFalsoFleteHD() && (!formData.montoPrestador || parseInt(formData.montoPrestador) <= 0)) return alert("⛔ FALTA EL MONTO");
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

    if (error) alert("Error: " + error.message)
    else {
      alert("Registro Guardado ✅")
      fetchRegistros()
      setFormData({ ...initialState, fecha: new Date().toISOString().split('T')[0] })
    }
    setLoading(false)
  }

  return (
    <div className="bg-gray-100 min-h-screen p-6 font-sans">
      <div className="bg-gradient-to-r from-black via-[#1e3c72] to-[#1e3c72] text-white p-4 rounded-xl flex justify-between items-center shadow-lg border-b-4 border-[#d63384] mb-6">
        <div><h1 className="text-2xl font-black tracking-tight">REGISTRO OPERACIONAL</h1><p className="text-xs text-[#d63384] font-bold tracking-widest uppercase">Ingreso de Costos</p></div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 animate-fade-in">
          {/* FORMULARIO */}
          <div className="w-full lg:w-5/12">
            <div className="bg-white rounded shadow-sm border-t-4 border-[#d63384] h-full">
              <div className="p-4 border-b"><h6 className="text-[#1e3c72] font-bold flex items-center gap-2"> NUEVO MOVIMIENTO</h6></div>
              <div className="p-5">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex rounded-md shadow-sm mb-4" role="group">
                    <button type="button" onClick={() => setFormData({...formData, modalidad: 'PAGO'})} className={`flex-1 py-2 text-sm font-bold border ${formData.modalidad === 'PAGO' ? 'bg-[#1e3c72] text-white border-[#1e3c72]' : 'bg-white text-gray-700'}`}>PAGAR PRESTADOR</button>
                    <button type="button" onClick={() => setFormData({...formData, modalidad: 'COBRO'})} className={`flex-1 py-2 text-sm font-bold border ${formData.modalidad === 'COBRO' ? 'bg-[#1e3c72] text-white border-[#1e3c72]' : 'bg-white text-gray-700'}`}>SOLO COBRO CLIENTE</button>
                  </div>

                  <div><label className="text-xs font-bold text-gray-500">FECHA EVENTO</label><input type="date" name="fecha" value={formData.fecha} onChange={handleChange} className="w-full border p-2 rounded" /></div>

                  <div className="flex gap-2">
                    <div className="w-1/2">
                      <label className="text-xs font-bold text-gray-500">SERVICIO</label>
                      <select name="servicio" value={formData.servicio} onChange={handleChange} className="w-full border p-2 rounded" required><option value="">SEL...</option>{Object.keys(localesPorServicio).map(svc => (<option key={svc} value={svc}>{svc}</option>))}</select>
                    </div>
                    <div className="w-1/2">
                      <label className="text-xs font-bold text-gray-500">SALA / LOCAL</label>
                      <select name="local" value={formData.local} onChange={handleChange} className="w-full border p-2 rounded" disabled={!formData.servicio} required><option value="">{formData.servicio ? 'Seleccione...' : '← Elija Servicio'}</option>{formData.servicio && localesPorServicio[formData.servicio]?.map((l, i) => (<option key={i} value={l}>{l}</option>))}</select>
                    </div>
                  </div>

                  {formData.modalidad === 'PAGO' && (
                    <div className="bg-gray-50 p-3 rounded border border-gray-200">
                      <div className="flex gap-2 mb-2">
                        <div className="w-1/2">
                          <div className="flex justify-between items-center mb-1">
                             <label className="text-xs font-bold text-gray-500">IDENTIFICADOR</label>
                             <div className="flex bg-gray-200 rounded p-0.5">
                                <button type="button" onClick={() => setFormData(prev => ({...prev, tipoDocumento: 'PATENTE', patente: ''}))} className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all ${formData.tipoDocumento === 'PATENTE' ? 'bg-white text-[#1e3c72] shadow' : 'text-gray-500'}`}>PAT</button>
                                <button type="button" onClick={() => setFormData(prev => ({...prev, tipoDocumento: 'RUT', patente: ''}))} className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all ${formData.tipoDocumento === 'RUT' ? 'bg-white text-green-600 shadow' : 'text-gray-500'}`}>RUT</button>
                             </div>
                          </div>
                          <input type="text" name="patente" value={formData.patente} onChange={handleIdentificadorChange} onBlur={handleRutBlur} placeholder={formData.tipoDocumento === 'PATENTE' ? "ABCD12" : "12.345.678-K"} className="w-full border p-2 rounded font-mono uppercase font-bold text-center tracking-wide" maxLength={formData.tipoDocumento === 'PATENTE' ? 6 : 12} />
                        </div>
                        <div className="w-1/2">
                          <label className="text-xs font-bold text-gray-500">CONCEPTO</label>
                          <select name="tipo" value={formData.tipo} onChange={handleChange} className="w-full border p-2 rounded text-sm text-[#1e3c72] font-bold"><option value="">Seleccione...</option><option value="AMBULANCIA">AMBULANCIA</option><option value="DOBLE RUTA">DOBLE RUTA</option><option value="FALSO FLETE">FALSO FLETE</option><option value="INCENTIVO">INCENTIVO</option><option value="OTRO">OTRO</option></select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500">MONTO A PAGAR <span className="text-red-500">*</span></label>
                        {esFalsoFleteHD() ? (
                          <select name="porcentaje" value={formData.porcentaje} onChange={handleChange} className="w-full border p-2 rounded font-bold text-[#1e3c72]"><option value="50%">50%</option><option value="70%">70%</option><option value="100%">100%</option></select>
                        ) : (
                          <input type="text" name="montoPrestador" value={formatCLP(formData.montoPrestador)} onChange={handleMontoChange} placeholder="$ 0" className="w-full border p-2 rounded font-bold text-right text-[#1e3c72]" />
                        )}
                      </div>
                    </div>
                  )}

                  {formData.modalidad === 'PAGO' && (
                    <div className="flex items-center gap-2 pl-4"><input type="checkbox" name="incluirCobro" checked={formData.incluirCobro} onChange={handleChange} className="w-4 h-4 text-[#d63384]" /><label className="text-sm font-bold text-[#1e3c72]">INCLUIR COBRO AL CLIENTE</label></div>
                  )}

                  {(formData.modalidad === 'COBRO' || formData.incluirCobro) && (
                    <div className="bg-white border-2 border-[#1e3c72] p-3 rounded">
                      <h6 className="text-[#d63384] font-bold text-xs mb-2">DATOS COBRO CLIENTE</h6>
                      <div className="mb-2"><label className="text-xs font-bold text-gray-500">MONTO A COBRAR</label><input type="text" name="montoCliente" value={formatCLP(formData.montoCliente)} onChange={handleMontoChange} className="w-full border p-2 rounded font-bold" placeholder="$ 0" /></div>
                      <div><label className="text-xs font-bold text-gray-500">DETALLE</label><input type="text" name="detalleCliente" value={formData.detalleCliente} onChange={handleChange} placeholder="Ej: Multa rechazo" className="w-full border p-2 rounded text-sm" /></div>
                    </div>
                  )}

                  <div><label className="text-xs font-bold text-gray-500">COMENTARIO</label><textarea name="comentario" value={formData.comentario} onChange={handleChange} rows="2" className="w-full border p-2 rounded uppercase" required></textarea></div>
                  <button disabled={loading} className="w-full bg-[#1e3c72] hover:bg-[#14284d] text-white font-bold py-3 rounded border-b-4 border-black active:border-b-0 active:translate-y-1 transition-all">{loading ? 'PROCESANDO...' : 'GUARDAR REGISTRO  '}</button>
                </form>
              </div>
            </div>
          </div>

          {/* TABLA RECIENTE */}
          <div className="w-full lg:w-7/12">
            <div className="bg-white rounded shadow-sm border-t-4 border-[#d63384] h-full">
              <div className="p-4 border-b flex justify-between items-center"><h6 className="text-[#1e3c72] font-bold text-uppercase"> ÚLTIMOS INGRESOS (20)</h6><button onClick={fetchRegistros} className="text-gray-400 hover:text-blue-600"></button></div>
              <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-gray-100 text-xs text-gray-500 uppercase"><tr><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Servicio</th><th className="px-4 py-2">Sala</th><th className="px-4 py-2">Concepto</th><th className="px-4 py-2">Pago</th><th className="px-4 py-2">Cobro</th></tr></thead><tbody>{registros.length === 0 ? (<tr><td colSpan="6" className="text-center py-6 text-gray-400">Sin datos recientes</td></tr>) : (registros.map(reg => (<tr key={reg.id} className="border-b hover:bg-blue-50"><td className="px-4 py-3">{reg.fecha_evento}</td><td className="px-4 py-3 font-bold text-[#1e3c72]">{reg.servicio}</td><td className="px-4 py-3 font-bold">{reg.local}</td><td className="px-4 py-3"><span className="bg-gray-200 px-2 py-1 rounded text-xs font-bold">{reg.tipo_concepto}</span></td><td className="px-4 py-3 font-mono">{!isNaN(reg.monto_prestador) ? formatCLP(reg.monto_prestador) : reg.monto_prestador}</td><td className="px-4 py-3 text-red-600 font-bold">{reg.monto_cliente > 0 ? formatCLP(reg.monto_cliente) : '-'}</td></tr>)))}</tbody></table></div>
            </div>
          </div>
      </div>
    </div>
  )
}
