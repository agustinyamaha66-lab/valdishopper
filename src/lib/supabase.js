
import { createClient } from '@supabase/supabase-js'

// 👇 AQUÍ PEGASTE TU LINK REAL
const supabaseUrl = 'https://ceqqxyszrkbuzvlqnvfp.supabase.co'

// 👇 AQUÍ VA TU CLAVE "anon public" (esa ya la debías tener)
const supabaseKey = 'sb_publishable_62b3jcxbXz5JMSGrBP194w_X3dSNZiu'

export const supabase = createClient(supabaseUrl, supabaseKey)