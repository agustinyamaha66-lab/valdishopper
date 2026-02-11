import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { Send, Loader2, Image as ImageIcon, RefreshCw, X } from "lucide-react";

const TABLE = "mensajes_chat";

function startEndISO(fecha) {
  const start = new Date(`${fecha}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return [start.toISOString(), end.toISOString()];
}

function cleanUrl(u) {
  const s = String(u ?? "").trim();
  if (!s) return "";

  const lower = s.toLowerCase();
  if (lower === "null" || lower === "undefined") return "";

  // ✅ bloquear basura común cuando la columna viene como json/objeto
  if (s === "{}" || s === "[]" || s === "[object Object]" || lower === "true" || lower === "false") {
    return "";
  }

  // ✅ aceptar solo URLs válidas (Supabase publicUrl suele ser https)
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:image/")) {
    return s;
  }

  return "";
}

function formatTime(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();

  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function ChatPanel({
                                    patenteInicial,
                                    fecha,
                                    height = "420px",
                                    hideHeader = false,
                                    onMessageSent,
                                  }) {
  const [loading, setLoading] = useState(false);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const [previewUrl, setPreviewUrl] = useState("");
  const endRef = useRef(null);

  const patente = useMemo(
      () => (patenteInicial || "").toUpperCase().trim(),
      [patenteInicial]
  );

  const scrollToBottom = (behavior = "smooth") => {
    endRef.current?.scrollIntoView({ behavior });
  };

  const fetchMensajes = async () => {
    if (!patente) {
      setMensajes([]);
      return;
    }

    setLoading(true);
    try {
      let q = supabase
          .from(TABLE)
          .select("*")
          .eq("patente", patente)
          .order("created_at", { ascending: true })
          .limit(500);

      if (fecha) {
        const [startISO, endISO] = startEndISO(fecha);
        q = q.gte("created_at", startISO).lt("created_at", endISO);
      }

      const { data, error } = await q;
      if (error) throw error;

      setMensajes(data || []);
      setTimeout(() => scrollToBottom("auto"), 40);
    } catch (e) {
      console.error("[ChatPanel] fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const enviar = async () => {
    const msg = texto.trim();
    if (!msg || !patente) return;

    setSending(true);
    try {
      const { error } = await supabase.from(TABLE).insert({
        patente,
        remitente: "admin",
        contenido: msg,
        url_imagen: null, // ✅ MUY IMPORTANTE: evita "adjunto fantasma"
      });

      if (error) throw error;

      setTexto("");
      await fetchMensajes();
      setTimeout(scrollToBottom, 60);
      if (onMessageSent) onMessageSent();
    } catch (e) {
      console.error("[ChatPanel] send error:", e);
      alert("No se pudo enviar el mensaje. Verifica los permisos de la tabla.");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    fetchMensajes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patente, fecha]);

  // Realtime INSERT
  useEffect(() => {
    if (!patente) return;

    const channel = supabase
        .channel(`mensajes_chat_${patente}`)
        .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: TABLE },
            (payload) => {
              const row = payload.new;
              if (row?.patente !== patente) return;

              if (fecha && row?.created_at) {
                const [startISO, endISO] = startEndISO(fecha);
                const t = new Date(row.created_at).toISOString();
                if (!(t >= startISO && t < endISO)) return;
              }

              setMensajes((prev) => [...prev, row]);
              setTimeout(scrollToBottom, 60);
            }
        )
        .subscribe();

    return () => supabase.removeChannel(channel);
  }, [patente, fecha]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollBtn(!isAtBottom);
  };

  return (
      <div className="h-full w-full flex flex-col bg-white relative">
        {/* Modal preview de imagen */}
        {previewUrl ? (
            <div className="absolute inset-0 z-[50] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-50">
                  <div className="font-black text-slate-900">Vista previa</div>
                  <button
                      className="p-2 rounded-xl border border-slate-200 hover:bg-white active:scale-95 transition"
                      onClick={() => setPreviewUrl("")}
                      title="Cerrar"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="p-4 bg-slate-50">
                  <img
                      src={previewUrl}
                      alt="adjunto"
                      className="w-full max-h-[75vh] object-contain rounded-2xl border-2 border-slate-200 bg-white shadow-lg"
                  />
                </div>
              </div>
            </div>
        ) : null}

        {!hideHeader && (
            <div className="px-5 py-4 border-b bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                    Conversación
                  </div>
                  <div className="font-black text-slate-900 text-lg">
                    {patente || "Sin patente seleccionada"}
                  </div>
                </div>

                <button
                    onClick={fetchMensajes}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-black transition disabled:opacity-50"
                    title="Refrescar mensajes"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                  Refrescar
                </button>
              </div>

              {fecha && (
                  <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[11px] font-black text-blue-800">
                    📅 Filtrado por: {fecha}
                  </div>
              )}
            </div>
        )}

        <div
            className="flex-1 overflow-auto px-4 py-4 space-y-2 bg-slate-50 scroll-smooth"
            style={{ height }}
            onScroll={handleScroll}
        >
          {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 className="animate-spin text-slate-400" size={32} />
                <span className="text-slate-500 font-semibold">Cargando mensajes...</span>
              </div>
          ) : !patente ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                <MessageSquare size={48} className="opacity-50" />
                <span className="font-semibold">Selecciona una patente para ver el chat</span>
              </div>
          ) : mensajes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                <MessageSquare size={48} className="opacity-50" />
                <span className="font-semibold">No hay mensajes aún</span>
                <span className="text-sm">Inicia la conversación enviando un mensaje</span>
              </div>
          ) : (
              mensajes.map((m, idx) => {
                const isAdmin = m.remitente === "admin";
                const imgUrl = cleanUrl(m.url_imagen);
                const hasContent = !!m.contenido?.trim();

                // Agrupar mensajes consecutivos del mismo remitente
                const prevMsg = idx > 0 ? mensajes[idx - 1] : null;
                const showAvatar = !prevMsg || prevMsg.remitente !== m.remitente;

                return (
                    <div
                        key={m.id ?? `${m.created_at}-${m.contenido}`}
                        className={`flex gap-3 ${isAdmin ? "flex-row-reverse" : "flex-row"}`}
                    >
                      {/* Avatar (solo si es el primer mensaje del grupo) */}
                      {showAvatar ? (
                          <div
                              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                                  isAdmin
                                      ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                                      : "bg-gradient-to-br from-slate-700 to-slate-800 text-white"
                              }`}
                          >
                            {isAdmin ? "A" : "C"}
                          </div>
                      ) : (
                          <div className="w-8" /> // Espacio para alinear mensajes
                      )}

                      <div className={`flex flex-col max-w-[75%] ${isAdmin ? "items-end" : "items-start"}`}>
                        {/* Nombre del remitente (solo en primer mensaje del grupo) */}
                        {showAvatar && (
                            <div className={`text-[10px] font-black uppercase tracking-wider mb-1 ${
                                isAdmin ? "text-blue-700" : "text-slate-600"
                            }`}>
                              {isAdmin ? "Central" : "Chofer"}
                            </div>
                        )}

                        {/* Burbuja de mensaje */}
                        <div
                            className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                                isAdmin
                                    ? "bg-blue-500 text-white rounded-tr-sm"
                                    : "bg-white border border-slate-200 text-slate-900 rounded-tl-sm"
                            }`}
                        >
                          {/* Contenido del mensaje */}
                          {hasContent && (
                              <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                {m.contenido}
                              </div>
                          )}

                          {/* Imagen adjunta */}
                          {imgUrl && (
                              <button
                                  type="button"
                                  onClick={() => setPreviewUrl(imgUrl)}
                                  className={`${hasContent ? "mt-2" : ""} flex items-center gap-2 text-xs font-bold hover:underline transition ${
                                      isAdmin ? "text-blue-100" : "text-blue-600"
                                  }`}
                                  title="Ver imagen adjunta"
                              >
                                <ImageIcon size={14} />
                                <span>Ver imagen adjunta</span>
                              </button>
                          )}
                        </div>

                        {/* Hora */}
                        <div className={`text-[10px] font-mono mt-1 ${
                            isAdmin ? "text-slate-400" : "text-slate-400"
                        }`}>
                          {formatTime(m.created_at)}
                        </div>
                      </div>
                    </div>
                );
              })
          )}

          <div ref={endRef} />
        </div>

        {/* Botón para bajar si el usuario subió */}
        {showScrollBtn && (
            <button
                onClick={() => scrollToBottom("smooth")}
                className="absolute bottom-32 right-8 p-3 rounded-full bg-white shadow-xl border border-slate-200 text-blue-600 hover:text-blue-700 active:scale-95 transition-all z-10 animate-bounce"
                title="Bajar al final"
            >
              <RefreshCw size={20} className="rotate-180" />
            </button>
        )}

        {/* Input de mensaje */}
        <div className="p-4 border-t bg-white">
          <div className="flex items-end gap-3">
          <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={2}
              placeholder={patente ? "Escribe tu mensaje..." : "Selecciona una patente primero"}
              className="flex-1 resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400 transition"
              disabled={!patente || sending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
          />

            <button
                onClick={enviar}
                disabled={!patente || sending || !texto.trim()}
                className="h-[52px] min-w-[52px] rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-black hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 px-4 transition shadow-lg hover:shadow-xl active:scale-95"
                title="Enviar mensaje"
            >
              {sending ? (
                  <Loader2 className="animate-spin" size={18} />
              ) : (
                  <>
                    <Send size={18} />
                    <span className="hidden sm:inline">Enviar</span>
                  </>
              )}
            </button>
          </div>

          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-4">
            <span>💡 <strong>Enter</strong> para enviar</span>
            <span>•</span>
            <span><strong>Shift + Enter</strong> para nueva línea</span>
          </div>
        </div>
      </div>
  );
}

// Importar el componente que falta
import { MessageSquare } from "lucide-react";