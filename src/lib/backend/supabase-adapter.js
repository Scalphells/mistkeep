import { supabase } from '../supabase.js';

/**
 * Supabase implementation of the data-access seam (the hosted edition).
 * Thin passthrough to the Supabase client.
 */
export const supabaseAdapter = {
  db: {
    from: (table) => supabase.from(table),
  },

  rpc: (name, args) => supabase.rpc(name, args),

  realtime: {
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
    from: (bucket) => supabase.storage.from(bucket),
  },
};
