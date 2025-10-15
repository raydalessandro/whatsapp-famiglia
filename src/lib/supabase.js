import { createClient } from '@supabase/supabase-js';

// Leggi le variabili d'ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verifica che le variabili siano definite
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Mancano le variabili d\'ambiente Supabase!\n' +
    'Assicurati di aver creato il file .env.local con:\n' +
    '- VITE_SUPABASE_URL\n' +
    '- VITE_SUPABASE_ANON_KEY'
  );
}

// Crea e esporta il client Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});
