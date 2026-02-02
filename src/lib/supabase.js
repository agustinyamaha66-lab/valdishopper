// src/lib/supabase.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ [supabase] Variables faltantes:", {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
  });
  throw new Error("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Revisa .env o Vercel.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
