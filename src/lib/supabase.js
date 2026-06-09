import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * The client is built lazily, on first use, rather than at module load. This
 * matters when the app runs against a different backend (VITE_BACKEND=go): the
 * Supabase adapter is still bundled, but its client is never constructed, so a
 * missing VITE_SUPABASE_URL no longer throws at startup.
 */
let _client = null;

function client() {
  if (_client) return _client;
  if (!url || !key) {
    // eslint-disable-next-line no-console
    console.error(
      '[supabase] Variables d\'environnement manquantes. ' +
        'Copie .env.example vers .env et renseigne VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.'
    );
  }
  _client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return _client;
}

export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const value = client()[prop];
      return typeof value === 'function' ? value.bind(_client) : value;
    },
  }
);
