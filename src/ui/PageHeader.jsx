import React from "react";

export default function PageHeader({
  eyebrow = "",
  title = "",
  subtitle = "",
  icon: Icon = null,
  iconClassName = "text-[#d63384]",
  gradient = "from-[#0b1f44]/95 via-[#163a6b]/90 to-[#0b1f44]/95",
  right = null, // opcional: botones/acciones a la derecha
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/20 shadow-xl mb-8">
      {/* Fondo degradado corporativo */}
      <div className={`absolute inset-0 bg-gradient-to-r ${gradient}`} />

      {/* Contenido */}
      <div className="relative z-10 px-6 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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

        {/* Acciones a la derecha (opcional) */}
        {right ? <div className="w-full md:w-auto">{right}</div> : null}
      </div>
    </div>
  );
}
