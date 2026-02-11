import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { MessageSquare, X, Search, Users, Clock } from "lucide-react";
import ChatPanel from "./ChatPanel";

const TABLE = "mensajes_chat";

function cleanStr(x) {
  return String(x ?? "").trim();
}

function timeAgo(dateString) {
  if (!dateString) return "";

  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Ahora";
  if (diffMins < 60) return `Hace ${diffMins}m`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays}d`;

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ChatCenter({ fecha }) {
  const [open, setOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [mensajes, setMensajes] = useState([]);
  const [selectedPatente, setSelectedPatente] = useState("");

  const [q, setQ] = useState("");
  const channelRef = useRef(null);

  const fetchUltimos = async () => {
    setLoading(true);
    try {
      let query = supabase
          .from(TABLE)
          .select("id, created_at, patente, remitente, contenido, url_imagen")
          .order("created_at", { ascending: false })
          .limit(1000);

      const { data, error } = await query;
      if (error) throw error;

      setMensajes(data || []);
    } catch (e) {
      console.error("[ChatCenter] fetchUltimos error:", e);
    } finally {
      setLoading(false);
    }
  };

  // Realtime global
  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const ch = supabase
        .channel("mensajes_chat_global")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: TABLE }, (payload) => {
          const row = payload.new;
          setMensajes((prev) => [row, ...prev].slice(0, 1200));
        })
        .subscribe();

    channelRef.current = ch;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    fetchUltimos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Construir conversaciones
  const conversaciones = useMemo(() => {
    const map = new Map();

    for (const m of mensajes) {
      const patente = cleanStr(m.patente).toUpperCase();
      if (!patente) continue;

      if (!map.has(patente)) {
        const hasImage = cleanStr(m.url_imagen);
        const textPreview = cleanStr(m.contenido);

        map.set(patente, {
          patente,
          last_at: m.created_at,
          last_text: textPreview || (hasImage ? "📷 Imagen" : ""),
          last_from: m.remitente,
          pending: m.remitente === "chofer",
        });
      }
    }

    let list = Array.from(map.values());

    // Búsqueda
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((c) => c.patente.toLowerCase().includes(needle));
    }

    // Ordenar por más reciente
    list.sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime());

    return list;
  }, [mensajes, q]);

  const pendingCount = useMemo(
      () => conversaciones.filter((c) => c.pending).length,
      [conversaciones]
  );

  const abrir = () => {
    setOpen(true);
    if (!selectedPatente && conversaciones[0]?.patente) {
      setSelectedPatente(conversaciones[0].patente);
    }
  };

  const cerrar = () => setOpen(false);

  return (
      <>
        {/* BOTÓN FLOTANTE MEJORADO */}
        <button
            type="button"
            onClick={abrir}
            className="fixed bottom-6 right-6 z-[9997] group"
            title="Centro de mensajes"
        >
          <div className="relative">
            {/* Animación de pulso para notificaciones */}
            {pendingCount > 0 && (
                <span className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-75" />
            )}

            {/* Botón principal */}
            <div className="relative rounded-full shadow-2xl border-2 border-white bg-gradient-to-r from-blue-500 to-blue-600 text-white w-16 h-16 flex items-center justify-center hover:from-blue-600 hover:to-blue-700 active:scale-95 transition-all duration-200">
              <MessageSquare size={26} strokeWidth={2.5} />

              {/* Badge de notificaciones */}
              {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs font-black rounded-full min-w-[24px] h-6 px-2 flex items-center justify-center border-2 border-white shadow-lg">
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
              )}
            </div>
          </div>

          {/* Tooltip */}
          <span className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          {pendingCount > 0 ? `${pendingCount} mensaje${pendingCount > 1 ? 's' : ''} pendiente${pendingCount > 1 ? 's' : ''}` : "Centro de mensajes"}
        </span>
        </button>

        {/* DRAWER MEJORADO */}
        {open && (
            <div className="fixed inset-0 z-[9998] flex items-end md:items-stretch justify-end">
              {/* Overlay */}
              <button
                  type="button"
                  onClick={cerrar}
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                  aria-label="Cerrar centro de mensajes"
              />

              {/* Panel principal */}
              <div className="relative w-full md:w-[1000px] h-[90vh] md:h-full bg-white rounded-t-3xl md:rounded-none md:rounded-l-3xl shadow-2xl overflow-hidden flex">
                {/* LISTA IZQUIERDA */}
                <div className="w-full md:w-[380px] border-r border-slate-200 flex flex-col bg-slate-50">
                  {/* Header */}
                  <div className="px-5 py-4 border-b bg-gradient-to-r from-slate-900 to-slate-800 text-white">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                          <MessageSquare size={20} />
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-white/70">
                            Centro de Mensajes
                          </div>
                          <div className="font-black text-lg">
                            {loading ? "Cargando..." : `${conversaciones.length} chats`}
                          </div>
                        </div>
                      </div>

                      <button
                          type="button"
                          onClick={cerrar}
                          className="p-2 rounded-xl hover:bg-white/10 active:scale-95 transition"
                          title="Cerrar"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* Estadísticas rápidas */}
                    <div className="mt-4 flex items-center gap-4">
                      <div className="flex items-center gap-2 text-xs">
                        <Users size={14} className="text-white/70" />
                        <span className="font-bold text-white/90">
                      {conversaciones.length} activas
                    </span>
                      </div>
                      {pendingCount > 0 && (
                          <>
                            <div className="w-1 h-1 rounded-full bg-white/30" />
                            <div className="flex items-center gap-2 text-xs">
                              <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                              <span className="font-bold text-white/90">
                          {pendingCount} pendientes
                        </span>
                            </div>
                          </>
                      )}
                    </div>
                  </div>

                  {/* Buscador y controles */}
                  <div className="p-4 border-b bg-white">
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                          placeholder="Buscar por patente..."
                          className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition"
                      />
                      {q && (
                          <button
                              onClick={() => setQ("")}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <X size={14} />
                          </button>
                      )}
                    </div>

                    <button
                        onClick={fetchUltimos}
                        disabled={loading}
                        className="mt-3 w-full rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-black px-4 py-2.5 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Clock size={14} className={loading ? "animate-spin" : ""} />
                      {loading ? "Actualizando..." : "Actualizar lista"}
                    </button>
                  </div>

                  {/* Lista de conversaciones */}
                  <div className="flex-1 overflow-auto">
                    {conversaciones.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 px-4">
                          <MessageSquare size={48} className="opacity-30" />
                          <span className="font-semibold text-center">
                      {q ? "No se encontraron conversaciones" : "No hay conversaciones activas"}
                    </span>
                          {q && (
                              <button
                                  onClick={() => setQ("")}
                                  className="text-blue-600 text-sm font-bold hover:underline"
                              >
                                Limpiar búsqueda
                              </button>
                          )}
                        </div>
                    ) : (
                        conversaciones.map((c) => {
                          const active = c.patente === selectedPatente;
                          return (
                              <button
                                  key={c.patente}
                                  onClick={() => setSelectedPatente(c.patente)}
                                  className={`w-full text-left px-4 py-4 border-b border-slate-100 hover:bg-white transition-colors ${
                                      active ? "bg-blue-50 border-l-4 border-l-blue-500" : "bg-slate-50/50"
                                  }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  {/* Avatar y patente */}
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm ${
                                        c.pending
                                            ? "bg-gradient-to-br from-rose-500 to-rose-600 text-white"
                                            : "bg-gradient-to-br from-slate-200 to-slate-300 text-slate-700"
                                    }`}>
                                      {c.patente.substring(0, 2)}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <div className="font-black text-slate-900 text-base">
                                        {c.patente}
                                      </div>
                                      <div className="mt-0.5 text-xs text-slate-600 line-clamp-1 font-medium">
                                        {c.last_from === "chofer" ? (
                                            <span className="font-bold text-slate-800">Chofer: </span>
                                        ) : (
                                            <span className="font-bold text-blue-700">Tú: </span>
                                        )}
                                        {c.last_text || "—"}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Badge y tiempo */}
                                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                    {c.pending ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full bg-rose-500 text-white">
                                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                NUEVO
                              </span>
                                    ) : (
                                        <span className="text-[10px] font-black px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                                LEÍDO
                              </span>
                                    )}

                                    <div className="text-[10px] font-mono text-slate-400">
                                      {timeAgo(c.last_at)}
                                    </div>
                                  </div>
                                </div>
                              </button>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* CHAT DERECHA */}
                <div className="flex-1 min-w-0 flex flex-col">
                  {selectedPatente ? (
                      <>
                        {/* Header del chat actual */}
                        <div className="px-5 py-4 border-b bg-white flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-black">
                              {selectedPatente.substring(0, 2)}
                            </div>
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                                Conversación con
                              </div>
                              <div className="font-black text-slate-900 text-lg">
                                {selectedPatente}
                              </div>
                            </div>
                          </div>

                          {fecha && (
                              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-xs font-black text-blue-800">
                                📅 {fecha}
                              </div>
                          )}
                        </div>

                        {/* Chat panel */}
                        <div className="flex-1 min-h-0">
                          <ChatPanel
                              patenteInicial={selectedPatente}
                              fecha={fecha}
                              height="100%"
                              hideHeader={true}
                          />
                        </div>
                      </>
                  ) : (
                      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-50">
                        <MessageSquare size={64} className="opacity-30" />
                        <div className="text-center">
                          <div className="font-bold text-lg text-slate-600">
                            Selecciona una conversación
                          </div>
                          <div className="text-sm mt-1">
                            Elige una patente de la lista para ver los mensajes
                          </div>
                        </div>
                      </div>
                  )}
                </div>
              </div>
            </div>
        )}
      </>
  );
}