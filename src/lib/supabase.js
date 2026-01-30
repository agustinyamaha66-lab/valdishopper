// src/lib/supabase.js

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ceqqxyszrkbuzvlqnvfp.supabase.co'

// LA CLAVE CORRECTA DEBE EMPEZAR ASÍ (NO ES sb_publishable...)
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlcXF4eXN6cmtidXp2bHFudmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNzUyNjIsImV4cCI6MjA4NDc1MTI2Mn0.xuv8LHS8HIq37IgWlj87cknnMQo2r3XBpnmTtC_Pu-U'

export const supabase = createClient(supabaseUrl, supabaseKey)