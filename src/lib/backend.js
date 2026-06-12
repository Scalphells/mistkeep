import { supabaseAdapter } from './backend/supabase-adapter.js';
import { goAdapter } from './backend/go-adapter.js';

/**
 * Data-access seam.
 *
 * Feature code talks to `backend.db / .rpc / .realtime / .auth / .storage` instead of a
 * specific backend. The adapter is chosen at build time:
 *   - default            -> Supabase (the hosted edition)
 *   - VITE_BACKEND=go     -> the self-hosted Go server (poc/go-backend)
 *
 * One front end, two backends — swapped here, nothing else changes.
 */
const useGo = import.meta.env && import.meta.env.VITE_BACKEND === 'go';

export const backend = useGo ? goAdapter : supabaseAdapter;
