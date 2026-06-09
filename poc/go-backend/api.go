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
	Write    string // "dm" | "owner" | "auth"
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
	"profiles":      {Columns: []string{"id", "email", "display_name", "role", "character_id", "color", "created_at", "updated_at"}, PK: "id", OwnerCol: "id", Write: "owner"},
	"characters":    {Columns: []string{"id", "owner_id", "name", "data", "updated_at", "updated_by"}, JSONCols: []string{"data"}, PK: "id", OwnerCol: "owner_id", Write: "owner"},
	"initiative":    {Columns: []string{"entity_id", "name", "initiative", "hp", "hp_max", "hp_temp", "sort_order", "conditions", "effects", "death_saves", "status", "char_id", "updated_at", "updated_by"}, JSONCols: []string{"conditions", "effects", "death_saves"}, PK: "entity_id", Write: "dm"},
	"scenes":        {Columns: []string{"id", "name", "state", "sort", "created_by", "created_at", "updated_at"}, JSONCols: []string{"state"}, PK: "id", Write: "dm"},
	"session_state": {Columns: []string{"key", "value", "updated_at", "updated_by"}, JSONCols: []string{"value"}, PK: "key", Write: "dm"},
	"messages":      {Columns: []string{"id", "channel", "content", "sender_id", "sender_name", "recipient_id", "created_at"}, PK: "id", Write: "auth"},
	"dice_rolls":    {Columns: []string{"id", "roll_name", "dice", "result", "details", "roll_type", "roller_id", "roller_name", "created_at"}, JSONCols: []string{"details"}, PK: "id", Write: "auth"},
	"compendium":    {Columns: []string{"id", "kind", "name", "data", "created_by", "created_at", "updated_at"}, JSONCols: []string{"data"}, PK: "id", Write: "dm"},
	"handouts":      {Columns: []string{"id", "title", "description", "content_type", "text_content", "image_url", "target_player", "pushed_by", "pushed_at"}, PK: "id", Write: "dm"},
	"session_notes": {Columns: []string{"id", "content", "created_by", "shared", "created_at"}, PK: "id", Write: "dm"},
	"vault_notes":   {Columns: []string{"path", "content", "is_folder", "updated_at", "updated_by"}, PK: "path", Write: "dm"},
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

func (s *Server) fetchOne(table string, p Policy, pk any) map[string]any {
	rows, err := s.store.db.Query("SELECT * FROM "+table+" WHERE "+p.PK+" = ?", pk)
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

func (s *Server) emitChange(table, eventType string, row map[string]any) {
	b, _ := json.Marshal(map[string]any{"table": table, "eventType": eventType, "new": row})
	s.hub.broadcast("main", string(b))
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
	if p.Write == "dm" && u.Role != "dm" {
		httpErr(w, 403, "forbidden")
		return
	}
	var body map[string]any
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		httpErr(w, 400, "bad request")
		return
	}
	// Owner rule: a non-DM may only write rows they own.
	if p.Write == "owner" && u.Role != "dm" && p.OwnerCol != "" {
		body[p.OwnerCol] = u.ID
	}
	// profiles: identity and role are authoritative from the session, never the
	// client. Mirrors the Supabase RLS/trigger — the first account is the DM, and
	// nobody can self-promote by posting role:"dm".
	if table == "profiles" {
		body["id"] = u.ID
		body["email"] = u.Email
		body["role"] = u.Role
	}
	// Generate the primary key when the client relies on a DB default (the
	// uuid-default tables: dice_rolls, messages, scenes, handouts…). Tables whose
	// PK is client-supplied (characters.id, initiative.entity_id, session_state.key,
	// vault_notes.path) already carry a value, so this is a no-op for them.
	if v, ok := body[p.PK]; !ok || v == nil || v == "" {
		body[p.PK] = id(table)
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
	if oc := r.URL.Query().Get("on_conflict"); oc != "" && p.hasCol(oc) {
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
	row := s.fetchOne(table, p, body[p.PK])
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

// mayWrite enforces the table's authorization rule for update/delete.
func (s *Server) mayWrite(u *User, table string, p Policy, where string, wargs []any) bool {
	switch p.Write {
	case "auth":
		return true
	case "dm":
		return u.Role == "dm"
	case "owner":
		if u.Role == "dm" {
			return true
		}
		if p.OwnerCol == "" {
			return false
		}
		// Every targeted row must belong to the user.
		rows, err := s.store.db.Query("SELECT "+p.OwnerCol+" FROM "+table+where, wargs...)
		if err != nil {
			return false
		}
		defer rows.Close()
		any := false
		for rows.Next() {
			any = true
			var owner sql.NullString
			if rows.Scan(&owner) != nil || owner.String != u.ID {
				return false
			}
		}
		return any
	}
	return false
}
