/**
 * Go-backend implementation of the data-access seam.
 *
 * Talks to the self-hosted Go server over REST + WebSocket. This file is the
 * CONTRACT the Go endpoints must satisfy (see poc/go-backend). It mirrors the
 * small subset of the Supabase client the app actually uses, returning the same
 * `{ data, error }` shape so feature code is unchanged.
 *
 * REST contract (table = resource):
 *   GET    /api/:table?<col>=eq.<val>&order=<col>.asc&limit=N&single=1|2
 *   POST   /api/:table            (insert; ?on_conflict=<col> for upsert)
 *   PATCH  /api/:table?<col>=eq.<val>
 *   DELETE /api/:table?<col>=eq.<val>
 * RPC:     POST /rpc/:name (JSON args -> JSON result)
 * Auth:    POST /auth/signup|login|logout, GET /auth/me  (cookie session)
 * Storage: POST /storage/:bucket (multipart), GET /storage/:bucket/:path?token,
 *          DELETE /storage/:bucket/:path
 * Realtime: WS /realtime. Server frames: { table, eventType, new, old } for data
 *          changes, or { room, event, payload } for ephemeral broadcasts.
 */

const BASE = (import.meta.env && import.meta.env.VITE_GO_API) || '';

async function req(method, path, { body, headers, raw } = {}) {
  const res = await fetch(BASE + path, {
    method,
    credentials: 'include',
    headers: { ...(body && !raw ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: raw ? body : body != null ? JSON.stringify(body) : undefined,
  });
  return res;
}

/* ── db: chainable query builder (thenable, like supabase) ──────────────── */

class Query {
  constructor(table) {
    this.table = table;
    this._filters = [];
    this._method = 'GET';
    this._body = null;
    this._order = null;
    this._limit = null;
    this._single = 0; // 0 none | 1 single | 2 maybeSingle
    this._onConflict = null;
  }
  select(cols) { this._select = cols || '*'; return this; }
  insert(row) { this._method = 'POST'; this._body = row; return this; }
  upsert(row, opts) { this._method = 'POST'; this._body = row; this._onConflict = opts?.onConflict || null; return this; }
  update(patch) { this._method = 'PATCH'; this._body = patch; return this; }
  delete() { this._method = 'DELETE'; return this; }
  eq(col, val) { this._filters.push([col, 'eq', val]); return this; }
  neq(col, val) { this._filters.push([col, 'neq', val]); return this; }
  in(col, vals) { this._filters.push([col, 'in', `(${vals.join(',')})`]); return this; }
  order(col, opts) { this._order = `${col}.${opts?.ascending === false ? 'desc' : 'asc'}`; return this; }
  limit(n) { this._limit = n; return this; }
  single() { this._single = 1; return this; }
  maybeSingle() { this._single = 2; return this; }

  // Thenable: `await backend.db.from(t).select().eq(...)` resolves to {data,error}.
  then(onFulfilled, onRejected) { return this._run().then(onFulfilled, onRejected); }

  async _run() {
    try {
      const qs = new URLSearchParams();
      for (const [col, op, val] of this._filters) qs.append(col, `${op}.${val}`);
      if (this._order) qs.set('order', this._order);
      if (this._limit != null) qs.set('limit', String(this._limit));
      if (this._single) qs.set('single', String(this._single));
      if (this._onConflict) qs.set('on_conflict', this._onConflict);
      const q = qs.toString();
      const path = `/api/${encodeURIComponent(this.table)}${q ? `?${q}` : ''}`;
      const res = await req(this._method, path, { body: this._body });
      if (res.status === 204) return { data: null, error: null };
      const json = await res.json().catch(() => null);
      if (!res.ok) return { data: null, error: { message: json?.error || `HTTP ${res.status}` } };
      return { data: json, error: null };
    } catch (e) {
      return { data: null, error: { message: e.message } };
    }
  }
}

/* ── realtime: one WebSocket, multiple channels ─────────────────────────── */

let _ws = null;
let _wsReady = false;
let _queue = [];
const _channels = new Set();

function ensureWS() {
  if (_ws) return;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const host = BASE ? BASE.replace(/^https?:\/\//, '') : location.host;
  _ws = new WebSocket(`${proto}://${host}/realtime`);
  _ws.onopen = () => { _wsReady = true; _queue.forEach((m) => _ws.send(m)); _queue = []; };
  _ws.onclose = () => { _ws = null; _wsReady = false; if (_channels.size) setTimeout(ensureWS, 1500); };
  _ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    _channels.forEach((ch) => ch._dispatch(msg));
  };
}

function wsSend(obj) {
  const data = JSON.stringify(obj);
  if (_wsReady) _ws.send(data);
  else { ensureWS(); _queue.push(data); }
}

class Channel {
  constructor(name, opts) {
    this.name = name;
    this._handlers = [];
    this._presence = {}; // key -> payload (online members in this room)
    this._presenceKey = opts?.config?.presence?.key || null;
  }
  on(type, a, b) {
    if (type === 'postgres_changes') this._handlers.push({ type, filter: a, cb: b });
    else if (type === 'broadcast') this._handlers.push({ type, event: a?.event, cb: b });
    else if (type === 'presence') this._handlers.push({ type, event: a?.event, cb: b });
    return this;
  }
  subscribe(cb) { _channels.add(this); ensureWS(); if (cb) cb('SUBSCRIBED'); return this; }
  send(message) { wsSend({ room: this.name, ...message }); return Promise.resolve('ok'); }
  unsubscribe() { _channels.delete(this); return Promise.resolve('ok'); }

  /* presence: gossip over broadcast, no server-side state needed.
     The hub already relays every client frame, so members announce themselves
     and re-announce when a newcomer appears; the map converges on all peers. */
  track(payload) {
    const key = this._presenceKey || payload?.id || 'anon';
    this._presence[key] = payload || {};
    wsSend({ room: this.name, presence: 'track', key, payload: payload || {} });
    this._fireSync();
    return Promise.resolve('ok');
  }
  untrack() {
    const key = this._presenceKey;
    if (key) {
      delete this._presence[key];
      wsSend({ room: this.name, presence: 'untrack', key });
      this._fireSync();
    }
    return Promise.resolve('ok');
  }
  presenceState() { return this._presence; }

  _fireSync() {
    for (const h of this._handlers) {
      if (h.type === 'presence' && (h.event === 'sync' || !h.event)) h.cb();
    }
  }

  _dispatch(msg) {
    // Presence frames are routed by room, separate from the data/broadcast feed.
    if (msg.room === this.name && msg.presence) {
      if (msg.presence === 'track' && msg.key) {
        const known = Object.prototype.hasOwnProperty.call(this._presence, msg.key);
        this._presence[msg.key] = msg.payload || {};
        this._fireSync();
        // Re-announce ourselves so a newcomer learns we're here (only for new
        // peers, so this stays bounded and converges).
        if (!known && this._presenceKey && this._presence[this._presenceKey] && msg.key !== this._presenceKey) {
          wsSend({ room: this.name, presence: 'track', key: this._presenceKey, payload: this._presence[this._presenceKey] });
        }
      } else if (msg.presence === 'untrack' && msg.key) {
        delete this._presence[msg.key];
        this._fireSync();
      }
      return;
    }
    for (const h of this._handlers) {
      if (h.type === 'postgres_changes' && msg.table) {
        if (h.filter?.table && h.filter.table !== msg.table) continue;
        // Honor a `col=eq.value` filter (e.g. per-key session_state feeds).
        const f = h.filter?.filter;
        if (f) {
          const mm = /^(\w+)=eq\.(.+)$/.exec(f);
          if (mm && String(msg.new?.[mm[1]]) !== mm[2]) continue;
        }
        h.cb({ eventType: msg.eventType, new: msg.new, old: msg.old, table: msg.table });
      } else if (h.type === 'broadcast' && msg.room === this.name && msg.event === h.event) {
        h.cb({ event: msg.event, payload: msg.payload });
      }
    }
  }
}

/* ── auth ───────────────────────────────────────────────────────────────── */

async function authPost(path, body) {
  const res = await req('POST', path, { body });
  const json = await res.json().catch(() => null);
  if (!res.ok) return { data: { user: null, session: null }, error: { message: json?.error || `HTTP ${res.status}` } };
  return { data: { user: json, session: { user: json } }, error: null };
}

let _authCbs = [];

/* ── storage ────────────────────────────────────────────────────────────── */

function storageBucket(bucket) {
  return {
    async upload(path, file, _opts) {
      const fd = new FormData();
      fd.append('path', path);
      fd.append('file', file);
      const res = await req('POST', `/storage/${encodeURIComponent(bucket)}`, { body: fd, raw: true });
      const json = await res.json().catch(() => null);
      if (!res.ok) return { data: null, error: { message: json?.error || `HTTP ${res.status}` } };
      return { data: json, error: null };
    },
    async createSignedUrl(path, expiresIn) {
      const res = await req('POST', `/storage/${encodeURIComponent(bucket)}/sign`, { body: { path, expiresIn } });
      const json = await res.json().catch(() => null);
      if (!res.ok) return { data: null, error: { message: json?.error || `HTTP ${res.status}` } };
      return { data: { signedUrl: json.signedUrl }, error: null };
    },
    async remove(paths) {
      const res = await req('DELETE', `/storage/${encodeURIComponent(bucket)}`, { body: { paths } });
      if (!res.ok) { const j = await res.json().catch(() => null); return { data: null, error: { message: j?.error || `HTTP ${res.status}` } }; }
      return { data: { paths }, error: null };
    },
    getPublicUrl(path) {
      return { data: { publicUrl: `${BASE}/storage/${encodeURIComponent(bucket)}/${path}` } };
    },
  };
}

export const goAdapter = {
  db: {
    from: (table) => new Query(table),
  },
  async rpc(name, args) {
    try {
      const res = await req('POST', `/rpc/${encodeURIComponent(name)}`, { body: args || {} });
      const json = await res.json().catch(() => null);
      if (!res.ok) return { data: null, error: { message: json?.error || `HTTP ${res.status}` } };
      return { data: json, error: null };
    } catch (e) {
      return { data: null, error: { message: e.message } };
    }
  },
  realtime: {
    channel: (name, opts) => new Channel(name, opts),
    removeChannel: (ch) => ch?.unsubscribe?.(),
  },
  auth: {
    signInWithPassword: ({ email, password }) => authPost('/auth/login', { email, password }),
    signUp: ({ email, password, options }) => authPost('/auth/signup', { email, password, display_name: options?.data?.display_name }),
    async signOut() { await req('POST', '/auth/logout'); _authCbs.forEach((cb) => cb('SIGNED_OUT', null)); return { error: null }; },
    async getUser() {
      const res = await req('GET', '/auth/me');
      if (!res.ok) return { data: { user: null }, error: null };
      return { data: { user: await res.json() }, error: null };
    },
    async getSession() {
      const res = await req('GET', '/auth/me');
      if (!res.ok) return { data: { session: null }, error: null };
      const user = await res.json();
      return { data: { session: { user } }, error: null };
    },
    updateUser: (attrs) => authPost('/auth/update', attrs),
    onAuthStateChange: (cb) => {
      _authCbs.push(cb);
      return { data: { subscription: { unsubscribe: () => { _authCbs = _authCbs.filter((x) => x !== cb); } } } };
    },
  },
  storage: {
    from: (bucket) => storageBucket(bucket),
  },
};
