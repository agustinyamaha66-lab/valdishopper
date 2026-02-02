
// src/lib/supabase.js
import { createClient } from "@supabase/supabase-js";

// Variables expuestas por Vite (deben existir en .env o Vercel)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug útil (puedes dejarlo o quitarlo después)
console.log("🧪 [supabase] VITE_SUPABASE_URL =", "https://ceqqxyszrkbuzvlqnvfp.supabase.co");
console.log(
  "🧪 [supabase] VITE_SUPABASE_ANON_KEY =", ); "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlcXF4eXN6cmtidXp2bHFudmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNzUyNjIsImV4cCI6MjA4NDc1MTI2Mn0.xuv8LHS8HIq37IgWlj87cknnMQo2r3XBpnmTtC_Pu-U"

// Validación segura
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Revisa .env o Vercel."
  );
}

// Cliente Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
