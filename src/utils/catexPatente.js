// src/utils/catexPatente.js

export function getCategoria(volume) {
  const v = Number(volume);
  if (Number.isNaN(v)) return "N/A";
  if (v >= 16) return "C16-35";
  if (v >= 11) return "C11-15";
  if (v >= 6) return "C06-10";
  if (v >= 3) return "C01-05";
  if (v >= 0) return "SUV";
  return "N/A";
}

// Regiones de Chile (incluye No definida al final)
export const REGIONES_CHILE = [
  "Arica",
  "Iquique",
  "Antofagasta",
  "Calama",
  "Copiapo",
  "La serena",
  "Valparaiso / Viña del Mar",
  "Rancagua",
  "Santiago",
  "Talca",
  "Chillan",
  "Concepción",
  "Temuco",
  "Valdivia",
  "Puerto Montt",
  "Coyhaique",
  "Punta Arenas",
  "No definida"
];

// Normaliza patente (quita espacios/guiones y uppercase)
export function normalizePatente(input = "") {
  return String(input).toUpperCase().replace(/[\s-]/g, "").trim();
}

// Valida patente: exactamente 6 caracteres alfanuméricos
export function isValidPatente(patente = "") {
  const p = normalizePatente(patente);
  return /^[A-Z0-9]{6}$/.test(p);
}
