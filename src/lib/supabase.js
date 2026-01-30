// src/lib/supabase.js

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ceqqxyszrkbuzvlqnvfp.supabase.co'

// LA CLAVE CORRECTA DEBE EMPEZAR ASÍ (NO ES sb_publishable...)
const supabaseKey = 'sb_publishable_62b3jcxbXz5JMSGrBP194w_X3dSNZiu'

export const supabase = createClient(supabaseUrl, supabaseKey)