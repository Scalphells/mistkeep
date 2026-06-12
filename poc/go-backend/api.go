package main

// Generic resource engine (G4).
//
// Serves the data-access contract the goAdapter expects:
//   GET    /api/{table}?col=eq.val&order=col.asc&limit=N&single=1|2
//   POST   /api/{table}            (insert; ?on_conflict=col for upsert)
//   PATCH  /api/{table}?col=eq.val
//   DELETE /api/{table}?col=eq.val
//
// Safety: only whitelisted tables/columns are ever interpolated into SQL; all
// values go through ? placeholders. Authorization (the RLS equivalent) is per
// table: "dm" (DM only), "owner" (the row owner or the DM), "auth" (any signed-in
// user). JSON columns are stored as TEXT and returned as JSON.

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

// appSchema mirrors the Postgres migrations (supabase/migrations). JSON columns
// are TEXT, booleans are INTEGER, timestamps are ISO-8601 TEXT with a default so
// the front end can omit them (Postgres set them via DEFAULT now()).
const ts = `(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`

const appSchema = `
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY, email TEXT, display_name TEXT,
  role TEXT NOT NULL DEFAULT 'player', character_id TEXT, color TEXT,
  created_at TEXT DEFAULT ` + ts + `, updated_at TEXT DEFAULT ` + ts + `
);
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY, owner_id TEXT, name TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT DEFAULT ` + ts + `, updated_by TEXT
);
CREATE TABLE IF NOT EXISTS initiative (
  entity_id TEXT PRIMARY KEY, name TEXT NOT NULL, initiative INTEGER NOT NULL DEFAULT 0,
  hp INTEGER, hp_max INTEGER, hp_temp INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0,
  conditions TEXT DEFAULT '[]', effects TEXT DEFAULT '[]', death_saves TEXT, status TEXT,
  char_id TEXT, updated_at TEXT DEFAULT ` + ts + `, updated_by TEXT
);
CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT 'Scene', state TEXT DEFAULT '{}', sort INTEGER DEFAULT 0,
  created_by TEXT, created_at TEXT DEFAULT ` + ts + `, updated_at TEXT DEFAULT ` + ts + `
);
CREATE TABLE IF NOT EXISTS session_state (
  key TEXT PRIMARY KEY, value TEXT, updated_at TEXT DEFAULT ` + ts + `, updated_by TEXT
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, channel TEXT NOT NULL DEFAULT 'public', content TEXT NOT NULL,
  sender_id TEXT, sender_name TEXT NOT NULL, recipient_id TEXT, created_at TEXT DEFAULT ` + ts + `
);
CREATE TABLE IF NOT EXISTS dice_rolls (
  id TEXT PRIMARY KEY, roll_name TEXT NOT NULL, dice TEXT NOT NULL, result INTEGER NOT NULL,
  details TEXT, roll_type TEXT NOT NULL DEFAULT 'public', roller_id TEXT, roller_name TEXT NOT NULL,
  created_at TEXT DEFAULT ` + ts + `
);
CREATE TABLE IF NOT EXISTS compendium (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, data TEXT DEFAULT '{}',
  created_by TEXT, created_at TEXT DEFAULT ` + ts + `, updated_at TEXT DEFAULT ` + ts + `
);
CREATE TABLE IF NOT EXISTS handouts (
  id TEXT PRIMARY KEY, title TEXT, description TEXT, content_type TEXT, text_content TEXT,
  image_url TEXT, target_player TEXT, pushed_by TEXT, pushed_at TEXT DEFAULT ` + ts + `
);
CREATE TABLE IF NOT EXISTS session_notes (
  id TEXT PRIMARY KEY, content TEXT NOT NULL, created_by TEXT, shared INTEGER DEFAULT 0,
  created_at TEXT DEFAULT ` + ts + `
);
CREATE TABLE IF NOT EXISTS vault_notes (
  path TEXT PRIMARY KEY, content TEXT NOT NULL DEFAULT '', is_folder INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT ` + ts + `, updated_by TEXT
);`

type Policy struct {
	Columns  []string
	JSONCols []string
	PK       string
	OwnerCol string // "" if none
	Write    string // "dm" | "owner" | "auth" | "char_owner"
	SelfCol  string // for "auth" tables: column that must equal the user id to
	// update/delete a row (e.g. messages.sender_id). "" means fully open.
}

func (p Policy) hasCol(c string) bool {
	for _, x := range p.Columns {
		if x == c {
			return true
		}
	}
	return false
}

func (p Policy) isJSON(c string) bool {
	for _, x := range p.JSONCols {
		if x == c {
			return true
		}
	}
	return false
}

var tables = map[string]Policy{
	"profiles":      {Columns: []string{"id", "email", "display_name", "role", "character_id", "color", "active_campaign_id", "prefs", "created_at", "updated_at"}, JSONCols: []string{"prefs"}, PK: "id", OwnerCol: "id", Write: "owner"},
	"characters":    {Columns: []string{"id", "owner_id", "name", "data", "campaign_id", "updated_at", "updated_by"}, JSONCols: []string{"data"}, PK: "id", OwnerCol: "owner_id", Write: "owner"},
	"initiative":    {Columns: []string{"entity_id", "name", "initiative", "hp", "hp_max", "hp_temp", "sort_order", "conditions", "effects", "death_saves", "status", "char_id", "campaign_id", "updated_at", "updated_by"}, JSONCols: []string{"conditions", "effects", "death_saves"}, PK: "entity_id", Write: "dm"},
	"scenes":        {Columns: []string{"id", "name", "state", "sort", "created_by", "campaign_id", "created_at", "updated_at"}, JSONCols: []string{"state"}, PK: "id", Write: "dm"},
	"session_state": {Columns: []string{"key", "value", "campaign_id", "updated_at", "updated_by"}, JSONCols: []string{"value"}, PK: "key", Write: "dm"},
	"messages":      {Columns: []string{"id", "channel", "content", "sender_id", "sender_name", "recipient_id", "campaign_id", "created_at"}, PK: "id", Write: "auth", SelfCol: "sender_id"},
	"dice_rolls":    {Columns: []string{"id", "roll_name", "dice", "result", "details", "roll_type", "roller_id", "roller_name", "campaign_id", "created_at"}, JSONCols: []string{"details"}, PK: "id", Write: "auth", SelfCol: "roller_id"},
	"compendium":    {Columns: []string{"id", "kind", "name", "data", "created_by", "campaign_id", "created_at", "updated_at"}, JSONCols: []string{"data"}, PK: "id", Write: "dm"},
	"handouts":      {Columns: []string{"id", "title", "description", "content_type", "text_content", "image_url", "target_player", "pushed_by", "campaign_id", "pushed_at"}, PK: "id", Write: "dm"},
	"session_notes": {Columns: []string{"id", "content", "created_by", "shared", "campaign_id", "created_at"}, PK: "id", Write: "dm"},
	"vault_notes":   {Columns: []string{"path", "content", "is_folder", "campaign_id", "updated_at", "updated_by"}, PK: "path", Write: "dm"},
	// Private story: owned indirectly via char_id -> characters.owner_id (see readScope / char_owner).
	"character_private": {Columns: []string{"char_id", "notes", "updated_at", "updated_by"}, PK: "char_id", Write: "char_owner"},
	// Multi-campaign: anyone may create their own campaign (they become its
	// owner + GM); the member list is managed by that campaign's GM/owner.
	"campaigns":        {Columns: []string{"id", "name", "system", "owner_id", "created_at", "updated_at"}, PK: "id", OwnerCol: "owner_id", Write: "owner"},
	"campaign_members": {Columns: []string{"campaign_id", "user_id", "role", "character_id", "created_at"}, PK: "campaign_id", Write: "campaign_dm"},
}

var reserved = map[string]bool{"order": true, "limit": true, "single": true, "on_conflict": true, "select": true}

type filter struct{ col, op, val string }

func parseFilters(q url.Values, p Policy) ([]filter, error) {
	var fs []filter
	for k, vs := range q {
		if reserved[k] {
			continue
		}
		if !p.hasCol(k) {
			return nil, fmt.Errorf("unknown column %q", k)
		}
		for _, v := range vs {
			op, val, ok := strings.Cut(v, ".")
			if !ok {
				return nil, fmt.Errorf("bad filter %q", v)
			}
			fs = append(fs, filter{col: k, op: op, val: val})
		}
	}
	return fs, nil
}

func whereSQL(fs []filter) (string, []any) {
	if len(fs) == 0 {
		return "", nil
	}
	var parts []string
	var args []any
	for _, f := range fs {
		switch f.op {
		case "neq":
			parts = append(parts, f.col+" <> ?")
			args = append(args, f.val)
		case "in":
			vals := strings.Split(strings.Trim(f.val, "()"), ",")
			ph := strings.TrimRight(strings.Repeat("?,", len(vals)), ",")
			parts = append(parts, f.col+" IN ("+ph+")")
			for _, v := range vals {
				args = append(args, v)
			}
		default: // eq and anything else
			parts = append(parts, f.col+" = ?")
			args = append(args, f.val)
		}
	}
	return " WHERE " + strings.Join(parts, " AND "), args
}

func toStore(p Policy, c string, v any) any {
	if p.isJSON(c) {
		b, _ := json.Marshal(v)
		return string(b)
	}
	if b, ok := v.(bool); ok {
		if b {
			return 1
		}
		return 0
	}
	return v
}

func scanRows(rows *sql.Rows, p Policy) ([]map[string]any, error) {
	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	out := []map[string]any{}
	for rows.Next() {
		vals := make([]any, len(cols))
		ptrs := make([]any, len(cols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, err
		}
		m := map[string]any{}
		for i, c := range cols {
			v := vals[i]
			if p.isJSON(c) {
				var s string
				switch t := v.(type) {
				case string:
					s = t
				case []byte:
					s = string(t)
				}
				if s == "" {
					m[c] = nil
				} else {
					m[c] = json.RawMessage(s)
				}
				continue
			}
			if b, ok := v.([]byte); ok {
				m[c] = string(b)
			} else {
				m[c] = v
			}
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// fetchOne returns the row matching the primary key. When the table is
// campaign-scoped and a campaign is supplied, the lookup is narrowed to that
// campaign: with composite keys (session_state, initiative, vault_notes) the
// same PK value may exist once PER campaign, and returning the wrong row would
// leak another campaign's value into the response / realtime echo.
func (s *Server) fetchOne(table string, p Policy, pk any, campaign any) map[string]any {
	q := "SELECT * FROM " + table + " WHERE " + p.PK + " = ?"
	args := []any{pk}
	if c := asStr(campaign); c != "" && p.hasCol("campaign_id") {
		q += " AND campaign_id = ?"
		args = append(args, c)
	}
	rows, err := s.store.db.Query(q, args...)
	if err != nil {
		return nil
	}
	defer rows.Close()
	list, err := scanRows(rows, p)
	if err != nil || len(list) == 0 {
		return nil
	}
	return list[0]
}

// ---- Campaign authorization (per-campaign GM, mirrors Supabase 0026) ----
//
// Authority over game tables belongs to the GM OF THE ROW'S CAMPAIGN
// (campaign_members.role = 'dm'), not only the site admin (users.role): the
// same account can run one campaign and play in another. The global "dm"
// remains a server-owner bypass — on a self-hosted single binary the admin
// owns the SQLite file anyway.

// Subquery fragments (each consumes one `?` = user id).
const dmCampaignsSub = "(SELECT campaign_id FROM campaign_members WHERE user_id = ? AND role = 'dm')"
const memberCampaignsSub = "(SELECT campaign_id FROM campaign_members WHERE user_id = ?)"

func (s *Server) isMember(uid, campaign string) bool {
	if uid == "" || campaign == "" {
		return false
	}
	var n int
	_ = s.store.db.QueryRow(`SELECT COUNT(*) FROM campaign_members WHERE campaign_id=? AND user_id=?`, campaign, uid).Scan(&n)
	return n > 0
}

func (s *Server) isCampaignDM(uid, campaign string) bool {
	if uid == "" || campaign == "" {
		return false
	}
	var n int
	_ = s.store.db.QueryRow(`SELECT COUNT(*) FROM campaign_members WHERE campaign_id=? AND user_id=? AND role='dm'`, campaign, uid).Scan(&n)
	return n > 0
}

func (s *Server) ownsCampaign(uid, campaign string) bool {
	if uid == "" || campaign == "" {
		return false
	}
	var n int
	_ = s.store.db.QueryRow(`SELECT COUNT(*) FROM campaigns WHERE id=? AND owner_id=?`, campaign, uid).Scan(&n)
	return n > 0
}

// charCampaign returns the campaign of a character ("" if unknown).
func (s *Server) charCampaign(charID string) string {
	if charID == "" {
		return ""
	}
	var c sql.NullString
	if s.store.db.QueryRow(`SELECT campaign_id FROM characters WHERE id=?`, charID).Scan(&c) != nil {
		return ""
	}
	return c.String
}

// allRowsInDMCampaigns reports whether EVERY row matched by the filter lives
// in a campaign the user runs. Zero matching rows is allowed: a write that
// touches nothing is a harmless no-op, and the front's UPDATE-then-INSERT
// pattern relies on the empty UPDATE succeeding.
func (s *Server) allRowsInDMCampaigns(table, where string, wargs []any, uid string) bool {
	q := "SELECT COUNT(*) FROM " + table + where + " AND campaign_id NOT IN " + dmCampaignsSub
	args := append(append([]any{}, wargs...), uid)
	var bad int
	if err := s.store.db.QueryRow(q, args...).Scan(&bad); err != nil {
		return false
	}
	return bad == 0
}

// ---- Read authorization (the RLS-equivalent for SELECT) -----------------
//
// Reads were previously open to any signed-in user, which leaked the DM's
// secrets (campaign prep, whispers, hidden GM rolls, private/targeted notes
// and handouts). readScope adds a per-table WHERE fragment that limits a
// non-DM to the rows they may see; rowVisible is the same predicate applied to
// a single row, used to filter realtime broadcasts so the WebSocket cannot
// bypass the REST filter.
//
// NOTE: `scenes.state` is a single blob the player UI needs to render the map
// (walls/lights drive client-side vision), so it stays readable; stripping the
// hidden tokens / GM notes it contains requires a filtered projection and is
// left as a documented residual.
// Every game table is scoped to the campaigns the user is a MEMBER of, and
// each per-table secrecy rule opens up for the GM of that campaign.
func readScope(u *User, table string) (string, []any) {
	if u.Role == "dm" {
		return "", nil
	}
	switch table {
	case "messages":
		return " campaign_id IN " + memberCampaignsSub +
				" AND (recipient_id IS NULL OR recipient_id = ? OR sender_id = ? OR campaign_id IN " + dmCampaignsSub + ")",
			[]any{u.ID, u.ID, u.ID, u.ID}
	case "dice_rolls":
		return " campaign_id IN " + memberCampaignsSub +
				" AND (roll_type <> 'dm' OR roller_id = ? OR campaign_id IN " + dmCampaignsSub + ")",
			[]any{u.ID, u.ID, u.ID}
	case "session_notes":
		return " campaign_id IN " + memberCampaignsSub +
				" AND (shared = 1 OR created_by = ? OR campaign_id IN " + dmCampaignsSub + ")",
			[]any{u.ID, u.ID, u.ID}
	case "handouts":
		return " campaign_id IN " + memberCampaignsSub +
				" AND (target_player IS NULL OR target_player = ? OR campaign_id IN " + dmCampaignsSub + ")",
			[]any{u.ID, u.ID, u.ID}
	case "compendium":
		return " campaign_id IN " + memberCampaignsSub +
				" AND (kind IN ('spell','item') OR campaign_id IN " + dmCampaignsSub + ")",
			[]any{u.ID, u.ID}
	case "session_state":
		// GM-only preparation keys stay private to that campaign's GM.
		return " campaign_id IN " + memberCampaignsSub +
				" AND (key NOT IN ('campaign','imagebank') OR campaign_id IN " + dmCampaignsSub + ")",
			[]any{u.ID, u.ID}
	case "vault_notes":
		// GM campaign vault: visible only to the GM of the campaign.
		return " campaign_id IN " + dmCampaignsSub, []any{u.ID}
	case "character_private":
		// Private story: the character's owner, or the GM of its campaign.
		return " char_id IN (SELECT id FROM characters WHERE owner_id = ? OR campaign_id IN " + dmCampaignsSub + ")",
			[]any{u.ID, u.ID}
	case "campaigns":
		return " (id IN " + memberCampaignsSub + " OR owner_id = ?)", []any{u.ID, u.ID}
	case "campaign_members":
		return " campaign_id IN " + memberCampaignsSub, []any{u.ID}
	case "characters", "initiative", "scenes":
		return " campaign_id IN " + memberCampaignsSub, []any{u.ID}
	}
	return "", nil // profiles: global identity, shared with the table
}

// rowVisible reports whether a non-DM user may see this row over realtime.
func rowVisible(table string, row map[string]any, uid string) bool {
	switch table {
	case "messages":
		r := asStr(row["recipient_id"])
		return r == "" || r == uid || asStr(row["sender_id"]) == uid
	case "dice_rolls":
		return asStr(row["roll_type"]) != "dm" || asStr(row["roller_id"]) == uid
	case "session_notes":
		return isTruthy(row["shared"]) || asStr(row["created_by"]) == uid
	case "handouts":
		t := asStr(row["target_player"])
		return t == "" || t == uid
	case "compendium":
		k := asStr(row["kind"])
		return k == "spell" || k == "item"
	case "session_state":
		k := asStr(row["key"])
		return k != "campaign" && k != "imagebank"
	case "vault_notes":
		return false
	case "campaigns", "campaign_members":
		// Membership checks need a DB query; the front fetches these over REST
		// only, so realtime frames stay DM-only rather than leak campaign names.
		return false
	}
	return true
}

func asStr(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case []byte:
		return string(t)
	}
	return ""
}

func isTruthy(v any) bool {
	switch t := v.(type) {
	case int64:
		return t != 0
	case float64:
		return t != 0
	case bool:
		return t
	case string:
		return t != "" && t != "0"
	}
	return false
}

// filterSceneState redacts a scene's `state` blob for a non-DM: hidden tokens and
// their GM notes, unrevealed pins and labels are removed. Walls/lights/fog stay
// because the player UI needs them for client-side vision. Mirrors the front-end
// visibility rules. On any parse error it returns the value unchanged (the state
// is DM-authored valid JSON in practice).
func filterSceneState(v any) any {
	raw, ok := rawBytes(v)
	if !ok {
		return v
	}
	var st map[string]any
	if json.Unmarshal(raw, &st) != nil {
		return v
	}
	if arr, ok := st["tokens"].([]any); ok {
		kept := make([]any, 0, len(arr))
		for _, t := range arr {
			tm, ok := t.(map[string]any)
			if !ok {
				kept = append(kept, t)
				continue
			}
			if b, _ := tm["hidden"].(bool); b {
				continue // hidden enemy/object: invisible to players
			}
			delete(tm, "note") // GM note on the token
			kept = append(kept, tm)
		}
		st["tokens"] = kept
	}
	if _, ok := st["pins"]; ok {
		st["pins"] = keepRevealed(st["pins"])
	}
	if _, ok := st["labels"]; ok {
		st["labels"] = keepRevealed(st["labels"])
	}
	b, err := json.Marshal(st)
	if err != nil {
		return v
	}
	return json.RawMessage(b)
}

func keepRevealed(v any) any {
	arr, ok := v.([]any)
	if !ok {
		return v
	}
	kept := make([]any, 0, len(arr))
	for _, e := range arr {
		m, ok := e.(map[string]any)
		if !ok {
			kept = append(kept, e)
			continue
		}
		if b, _ := m["revealed"].(bool); b {
			kept = append(kept, m)
		}
	}
	return kept
}

func rawBytes(v any) ([]byte, bool) {
	switch t := v.(type) {
	case json.RawMessage:
		return []byte(t), true
	case []byte:
		return t, true
	case string:
		return []byte(t), true
	}
	return nil, false
}

func redactSceneRow(row map[string]any) map[string]any {
	out := make(map[string]any, len(row))
	for k, v := range row {
		out[k] = v
	}
	out["state"] = filterSceneState(row["state"])
	return out
}

// redactProfileRow drops the email — players see each other's name/color/role,
// not their email address. Callers keep the row's own email for its owner.
func redactProfileRow(row map[string]any) map[string]any {
	out := make(map[string]any, len(row))
	for k, v := range row {
		out[k] = v
	}
	delete(out, "email")
	return out
}

func changeMsg(table, eventType string, row map[string]any) string {
	b, _ := json.Marshal(map[string]any{"table": table, "eventType": eventType, "new": row})
	return string(b)
}

// emitChange pushes a row change over realtime, filtered per subscriber so the
// WebSocket never leaks rows a player may not read (mirrors readScope). DELETE
// events carry no payload and go to everyone.
func (s *Server) emitChange(table, eventType string, row map[string]any) {
	if row == nil {
		s.hub.broadcast("main", changeMsg(table, eventType, nil))
		return
	}
	dmMsg := changeMsg(table, eventType, row)
	// Non-DM subscribers get a redacted variant where a table exposes secrets:
	// scenes.state (hidden tokens, GM notes, unrevealed pins/labels) and profiles
	// (other users' email). Mirrors the REST read filters.
	playerMsg := dmMsg
	switch table {
	case "scenes":
		playerMsg = changeMsg(table, eventType, redactSceneRow(row))
	case "profiles":
		playerMsg = changeMsg(table, eventType, redactProfileRow(row))
	}
	// Private story: notes must reach only the owning player, the campaign's GM
	// and the admin. Resolve the character's owner/campaign once.
	privOwner, privCampaign := "", ""
	if table == "character_private" {
		cid := asStr(row["char_id"])
		privOwner = s.charOwner(cid)
		privCampaign = s.charCampaign(cid)
	}
	rowCampaign := asStr(row["campaign_id"])
	s.hub.broadcastFiltered("main", func(sub *subscriber) (string, bool) {
		if sub.role == "dm" {
			return dmMsg, true
		}
		if table == "character_private" {
			if (privOwner != "" && sub.uid == privOwner) || s.isCampaignDM(sub.uid, privCampaign) {
				return dmMsg, true
			}
			return "", false
		}
		// Campaign layer (mirrors readScope): rows reach only the members of
		// their campaign, and that campaign's GM gets the unredacted variant.
		if rowCampaign != "" {
			if !s.isMember(sub.uid, rowCampaign) {
				return "", false
			}
			if s.isCampaignDM(sub.uid, rowCampaign) {
				return dmMsg, true
			}
		}
		if !rowVisible(table, row, sub.uid) {
			return "", false
		}
		// A profile's owner still receives their own email.
		if table == "profiles" && asStr(row["id"]) == sub.uid {
			return dmMsg, true
		}
		return playerMsg, true
	})
}

// ---- Handlers -----------------------------------------------------------

func (s *Server) apiList(w http.ResponseWriter, r *http.Request) {
	u := s.userFrom(r)
	if u == nil {
		httpErr(w, 401, "unauthenticated")
		return
	}
	table := r.PathValue("table")
	p, ok := tables[table]
	if !ok {
		httpErr(w, 404, "unknown table")
		return
	}
	q := r.URL.Query()
	fs, err := parseFilters(q, p)
	if err != nil {
		httpErr(w, 400, err.Error())
		return
	}
	where, args := whereSQL(fs)
	// Read authorization: scope a non-DM to the rows they may see.
	if frag, fargs := readScope(u, table); frag != "" {
		if where == "" {
			where = " WHERE" + frag
		} else {
			where += " AND" + frag
		}
		args = append(args, fargs...)
	}
	q1 := "SELECT * FROM " + table + where
	if o := q.Get("order"); o != "" {
		col, dir, _ := strings.Cut(o, ".")
		if p.hasCol(col) {
			d := "ASC"
			if dir == "desc" {
				d = "DESC"
			}
			q1 += " ORDER BY " + col + " " + d
		}
	}
	if l := q.Get("limit"); l != "" {
		if n, e := strconv.Atoi(l); e == nil {
			q1 += " LIMIT " + strconv.Itoa(n)
		}
	}
	rows, err := s.store.db.Query(q1, args...)
	if err != nil {
		httpErr(w, 500, err.Error())
		return
	}
	defer rows.Close()
	list, err := scanRows(rows, p)
	if err != nil {
		httpErr(w, 500, err.Error())
		return
	}
	// Redact GM secrets from scene state for non-DM readers (the row itself stays
	// readable because the player UI needs the map).
	if table == "scenes" && u.Role != "dm" {
		for _, row := range list {
			row["state"] = filterSceneState(row["state"])
		}
	}
	// Players see each other's name/color/role but not their email.
	if table == "profiles" && u.Role != "dm" {
		for _, row := range list {
			if asStr(row["id"]) != u.ID {
				delete(row, "email")
			}
		}
	}
	if single := q.Get("single"); single == "1" || single == "2" {
		if len(list) == 0 {
			if single == "1" {
				httpErr(w, 406, "no rows")
				return
			}
			writeJSON(w, 200, nil)
			return
		}
		writeJSON(w, 200, list[0])
		return
	}
	writeJSON(w, 200, list)
}

func (s *Server) apiInsert(w http.ResponseWriter, r *http.Request) {
	u := s.userFrom(r)
	if u == nil {
		httpErr(w, 401, "unauthenticated")
		return
	}
	table := r.PathValue("table")
	p, ok := tables[table]
	if !ok {
		httpErr(w, 404, "unknown table")
		return
	}
	// GM-only tables without campaign scoping stay admin-only; campaign-scoped
	// ones accept the campaign's own GM (checked below, once the body is read).
	if p.Write == "dm" && u.Role != "dm" && !p.hasCol("campaign_id") {
		httpErr(w, 403, "forbidden")
		return
	}
	var body map[string]any
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		httpErr(w, 400, "bad request")
		return
	}
	// Campaign scoping (mirrors the Supabase membership RLS):
	//   - writing into a campaign requires being one of its members;
	//   - GM-only tables accept the campaign's own GM, not just the site admin.
	// campaign_members itself is exempt: joining is what CREATES membership
	// (its own GM/owner rule follows below).
	if u.Role != "dm" && p.Write != "campaign_dm" && p.hasCol("campaign_id") {
		cid := asStr(body["campaign_id"])
		if cid == "" {
			cid = defaultCampaignID // what the column DEFAULT would assign
			body["campaign_id"] = cid
		}
		if !s.isMember(u.ID, cid) {
			httpErr(w, 403, "forbidden")
			return
		}
		if p.Write == "dm" && !s.isCampaignDM(u.ID, cid) {
			httpErr(w, 403, "forbidden")
			return
		}
	}
	// Member list: managed by the campaign's GM, or its owner (so the creator
	// can register their own GM membership right after creating the campaign).
	if p.Write == "campaign_dm" && u.Role != "dm" {
		cid := asStr(body["campaign_id"])
		if !s.isCampaignDM(u.ID, cid) && !s.ownsCampaign(u.ID, cid) {
			httpErr(w, 403, "forbidden")
			return
		}
	}
	// Owner rule: a non-DM may only write rows they own.
	if p.Write == "owner" && u.Role != "dm" && p.OwnerCol != "" {
		body[p.OwnerCol] = u.ID
	}
	// Private story: a non-DM may only write the private notes of a character
	// they own (indirectly, via char_id -> characters.owner_id) — or of a
	// character in a campaign they run. Covers upsert.
	if p.Write == "char_owner" && u.Role != "dm" {
		cid := asStr(body["char_id"])
		if !s.userOwnsChar(cid, u.ID) && !s.isCampaignDM(u.ID, s.charCampaign(cid)) {
			httpErr(w, 403, "forbidden")
			return
		}
	}
	// profiles: identity and role are authoritative from the session, never the
	// client. Mirrors the Supabase RLS/trigger — the first account is the DM, and
	// nobody can self-promote by posting role:"dm".
	if table == "profiles" {
		body["id"] = u.ID
		body["email"] = u.Email
		body["role"] = u.Role
	}
	// Chat and dice: a non-DM cannot forge the author. The DM stays free to post
	// as a narrator / monster card. Mirrors the trust model (DM is trusted).
	if u.Role != "dm" {
		switch table {
		case "messages":
			body["sender_id"] = u.ID
			body["sender_name"] = displayName(u)
		case "dice_rolls":
			body["roller_id"] = u.ID
			body["roller_name"] = displayName(u)
		}
	}
	// Generate the primary key when the client relies on a DB default (the
	// uuid-default tables: dice_rolls, messages, scenes, handouts…). Tables whose
	// PK is client-supplied (characters.id, initiative.entity_id, session_state.key,
	// vault_notes.path) already carry a value, so this is a no-op for them.
	if v, ok := body[p.PK]; !ok || v == nil || v == "" {
		body[p.PK] = id(table)
	}
	// Upsert hijack guard: ON CONFLICT DO UPDATE could otherwise let a non-DM
	// overwrite (and steal ownership of) a row they don't own by posting its
	// primary key. If a conflicting row already exists, it must belong to them.
	oc := r.URL.Query().Get("on_conflict")
	if oc != "" && u.Role != "dm" && p.Write == "owner" && p.OwnerCol != "" {
		if existing := s.fetchOne(table, p, body[p.PK], body["campaign_id"]); existing != nil && asStr(existing[p.OwnerCol]) != u.ID {
			httpErr(w, 403, "forbidden")
			return
		}
	}
	var cols []string
	var args []any
	for _, c := range p.Columns {
		if v, ok := body[c]; ok {
			cols = append(cols, c)
			args = append(args, toStore(p, c, v))
		}
	}
	if len(cols) == 0 {
		httpErr(w, 400, "no known columns")
		return
	}
	ph := strings.TrimRight(strings.Repeat("?,", len(cols)), ",")
	q1 := "INSERT INTO " + table + " (" + strings.Join(cols, ",") + ") VALUES (" + ph + ")"
	if oc != "" && p.hasCol(oc) {
		var sets []string
		for _, c := range cols {
			if c != oc {
				sets = append(sets, c+"=excluded."+c)
			}
		}
		if len(sets) > 0 {
			q1 += " ON CONFLICT(" + oc + ") DO UPDATE SET " + strings.Join(sets, ",")
		}
	}
	if _, err := s.store.db.Exec(q1, args...); err != nil {
		log.Printf("insert %s failed: %v", table, err)
		httpErr(w, 500, err.Error())
		return
	}
	row := s.fetchOne(table, p, body[p.PK], body["campaign_id"])
	s.emitChange(table, "INSERT", row)
	writeJSON(w, 201, row)
}

func (s *Server) apiUpdate(w http.ResponseWriter, r *http.Request) {
	u := s.userFrom(r)
	if u == nil {
		httpErr(w, 401, "unauthenticated")
		return
	}
	table := r.PathValue("table")
	p, ok := tables[table]
	if !ok {
		httpErr(w, 404, "unknown table")
		return
	}
	fs, err := parseFilters(r.URL.Query(), p)
	if err != nil {
		httpErr(w, 400, err.Error())
		return
	}
	where, wargs := whereSQL(fs)
	if where == "" {
		httpErr(w, 400, "update requires a filter")
		return
	}
	if !s.mayWrite(u, table, p, where, wargs) {
		httpErr(w, 403, "forbidden")
		return
	}
	var body map[string]any
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		httpErr(w, 400, "bad request")
		return
	}
	// Identity/role are session-authoritative on profiles (as on insert). Without
	// this, a player could PATCH their own profile to role:"dm" and appear/act as
	// DM on every client. The server's own authorization reads users.role, but the
	// front derives isDM from profiles.role, so this must stay locked here too.
	if table == "profiles" {
		delete(body, "id")
		delete(body, "email")
		delete(body, "role")
	}
	// A row's campaign is immutable for non-admins: letting an UPDATE rewrite
	// campaign_id would move rows between campaigns (vandalism or smuggling).
	if u.Role != "dm" {
		delete(body, "campaign_id")
	}
	var sets []string
	var args []any
	for _, c := range p.Columns {
		if c == p.PK {
			continue
		}
		if v, ok := body[c]; ok {
			sets = append(sets, c+"=?")
			args = append(args, toStore(p, c, v))
		}
	}
	if len(sets) == 0 {
		httpErr(w, 400, "nothing to update")
		return
	}
	args = append(args, wargs...)
	if _, err := s.store.db.Exec("UPDATE "+table+" SET "+strings.Join(sets, ",")+where, args...); err != nil {
		httpErr(w, 500, err.Error())
		return
	}
	// Return the first matching row.
	rows, _ := s.store.db.Query("SELECT * FROM "+table+where+" LIMIT 1", wargs...)
	var row map[string]any
	if rows != nil {
		if list, _ := scanRows(rows, p); len(list) > 0 {
			row = list[0]
		}
		rows.Close()
	}
	s.emitChange(table, "UPDATE", row)
	writeJSON(w, 200, row)
}

func (s *Server) apiDelete(w http.ResponseWriter, r *http.Request) {
	u := s.userFrom(r)
	if u == nil {
		httpErr(w, 401, "unauthenticated")
		return
	}
	table := r.PathValue("table")
	p, ok := tables[table]
	if !ok {
		httpErr(w, 404, "unknown table")
		return
	}
	fs, err := parseFilters(r.URL.Query(), p)
	if err != nil {
		httpErr(w, 400, err.Error())
		return
	}
	where, wargs := whereSQL(fs)
	if where == "" {
		httpErr(w, 400, "delete requires a filter")
		return
	}
	if !s.mayWrite(u, table, p, where, wargs) {
		httpErr(w, 403, "forbidden")
		return
	}
	if _, err := s.store.db.Exec("DELETE FROM "+table+where, wargs...); err != nil {
		httpErr(w, 500, err.Error())
		return
	}
	s.emitChange(table, "DELETE", nil)
	w.WriteHeader(204)
}

// mayWrite enforces the table's authorization rule for update/delete. The GM
// of a campaign has full write authority over that campaign's rows (mirrors
// the Supabase is_dm_of policies).
func (s *Server) mayWrite(u *User, table string, p Policy, where string, wargs []any) bool {
	switch p.Write {
	case "auth":
		if u.Role == "dm" {
			return true
		}
		// "auth" tables (messages, dice_rolls) accept inserts from anyone, but a
		// non-DM may only update/delete their OWN rows — otherwise a player could
		// edit the DM's messages or wipe the whole chat/roll log. The campaign's
		// GM may, though (e.g. clearing their campaign's chat).
		if p.SelfCol == "" {
			return true
		}
		if s.allRowsOwnedBy(table, p.SelfCol, where, wargs, u.ID) {
			return true
		}
		return p.hasCol("campaign_id") && s.allRowsInDMCampaigns(table, where, wargs, u.ID)
	case "dm":
		if u.Role == "dm" {
			return true
		}
		return p.hasCol("campaign_id") && s.allRowsInDMCampaigns(table, where, wargs, u.ID)
	case "owner":
		if u.Role == "dm" {
			return true
		}
		if p.OwnerCol != "" && s.allRowsOwnedBy(table, p.OwnerCol, where, wargs, u.ID) {
			return true
		}
		// The campaign's GM manages every row of the campaigns they run
		// (e.g. syncing a player's sheet HP from the combat tracker).
		return p.hasCol("campaign_id") && s.allRowsInDMCampaigns(table, where, wargs, u.ID)
	case "campaign_dm":
		if u.Role == "dm" {
			return true
		}
		// Every targeted membership row must belong to a campaign the user
		// runs or owns.
		rows, err := s.store.db.Query("SELECT DISTINCT campaign_id FROM "+table+where, wargs...)
		if err != nil {
			return false
		}
		defer rows.Close()
		for rows.Next() {
			var cid sql.NullString
			if rows.Scan(&cid) != nil {
				return false
			}
			if !s.isCampaignDM(u.ID, cid.String) && !s.ownsCampaign(u.ID, cid.String) {
				return false
			}
		}
		return true
	case "char_owner":
		if u.Role == "dm" {
			return true
		}
		// Each targeted private row must belong to a character the user owns,
		// or to a character in a campaign they run.
		rows, err := s.store.db.Query("SELECT char_id FROM "+table+where, wargs...)
		if err != nil {
			return false
		}
		defer rows.Close()
		matched := false
		for rows.Next() {
			matched = true
			var cid sql.NullString
			if rows.Scan(&cid) != nil {
				return false
			}
			if !s.userOwnsChar(cid.String, u.ID) && !s.isCampaignDM(u.ID, s.charCampaign(cid.String)) {
				return false
			}
		}
		return matched
	}
	return false
}

// charOwner returns the owner_id of a character, or "" if unknown/unowned.
func (s *Server) charOwner(charID string) string {
	if charID == "" {
		return ""
	}
	var owner sql.NullString
	if s.store.db.QueryRow("SELECT owner_id FROM characters WHERE id = ?", charID).Scan(&owner) != nil {
		return ""
	}
	if owner.Valid {
		return owner.String
	}
	return ""
}

// userOwnsChar reports whether uid owns the character charID (for the
// indirectly-owned character_private table).
func (s *Server) userOwnsChar(charID, uid string) bool {
	return uid != "" && s.charOwner(charID) == uid
}

// allRowsOwnedBy returns true iff at least one row matches the filter and EVERY
// matching row's `col` equals uid. `table` and `col` are whitelisted (never
// client input); the filter values are parameterized.
func (s *Server) allRowsOwnedBy(table, col, where string, wargs []any, uid string) bool {
	rows, err := s.store.db.Query("SELECT "+col+" FROM "+table+where, wargs...)
	if err != nil {
		return false
	}
	defer rows.Close()
	any := false
	for rows.Next() {
		any = true
		var owner sql.NullString
		if rows.Scan(&owner) != nil || owner.String != uid {
			return false
		}
	}
	return any
}

// displayName is the name shown for a user, falling back to the email.
func displayName(u *User) string {
	if u.DisplayName != "" {
		return u.DisplayName
	}
	return u.Email
}
