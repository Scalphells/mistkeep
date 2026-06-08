import { supabase } from './supabase.js';

/**
 * Data-access seam.
 *
 * Feature code talks to `backend.db / .realtime / .auth / .storage` instead of
 * importing the Supabase client directly. Today these delegate to Supabase, so
 * there is no behavior change. Later, a Go adapter can expose the same shape
 * against a self-hosted backend — one front end, two backends, swapped here.
 *
 * The surface intentionally mirrors the small subset of the Supabase client the
 * app actually uses, so migrating a feature is just: import `backend` and call
 * `backend.db.from(...)` / `backend.realtime.channel(...)` / `backend.auth.*` /
 * `backend.storage.from(...)`.
 */
export const backend = {
  db: {
    /** Query builder for a table (same chainable API as supabase.from). */
    from: (table) => supabase.from(table),
  },

  realtime: {
    /** Open a realtime channel (postgres_changes / broadcast / presence). */
    channel: (name, opts) => supabase.channel(name, opts),
    removeChannel: (ch) => supabase.removeChannel(ch),
  },

  auth: {
    signInWithPassword: (creds) => supabase.auth.signInWithPassword(creds),
    signUp: (creds) => supabase.auth.signUp(creds),
    signOut: () => supabase.auth.signOut(),
    getUser: () => supabase.auth.getUser(),
    getSession: () => supabase.auth.getSession(),
    updateUser: (attrs) => supabase.auth.updateUser(attrs),
    onAuthStateChange: (cb) => supabase.auth.onAuthStateChange(cb),
  },

  storage: {
    /** File operations for a bucket (same API as supabase.storage.from). */
    from: (bucket) => supabase.storage.from(bucket),
  },
};
