package main

// Authorization & redaction tests for the resource engine (api.go) plus the
// pure security helpers (main.go, storage.go). These lock in the behavior the
// hardening commits introduced: read scoping, write ownership, identity forcing,
// the upsert-hijack guard, scene/profile redaction, login throttling, the
// ephemeral-frame filter, and storage path safety.

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// ---- Harness ------------------------------------------------------------

type harness struct {
	t   *testing.T
	srv *Server
	// user ids + session tokens
	dmID, p1ID, p2ID    string
	dmTok, p1Tok, p2Tok string
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	store, err := OpenStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("OpenStore: %v", err)
	}
	// Close the DB before t.TempDir cleanup, else Windows can't unlink the open file.
	t.Cleanup(func() { store.db.Close() })
	srv := &Server{store: store, hub: NewHub(), throttle: newLoginThrottle()}
	h := &harness{t: t, srv: srv}
	dm, _ := store.createUser("dm@x", "DM", "dm", "h")
	p1, _ := store.createUser("p1@x", "Player One", "player", "h")
	p2, _ := store.createUser("p2@x", "Player Two", "player", "h")
	h.dmID, h.p1ID, h.p2ID = dm.ID, p1.ID, p2.ID
	h.dmTok, _ = store.createSession(dm.ID)
	h.p1Tok, _ = store.createSession(p1.ID)
	h.p2Tok, _ = store.createSession(p2.ID)
	return h
}

func (h *harness) exec(sqlStr string, args ...any) {
	h.t.Helper()
	if _, err := h.srv.store.db.Exec(sqlStr, args...); err != nil {
		h.t.Fatalf("exec %q: %v", sqlStr, err)
	}
}

// call drives one API handler with a session cookie and returns the recorder.
func (h *harness) call(method, table, query, tok string, body any) *httptest.ResponseRecorder {
	h.t.Helper()
	var rdr io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rdr = bytes.NewReader(b)
	}
	target := "/api/" + table
	if query != "" {
		target += "?" + query
	}
	r := httptest.NewRequest(method, target, rdr)
	r.SetPathValue("table", table)
	if tok != "" {
		r.AddCookie(&http.Cookie{Name: "mk_session", Value: tok})
	}
	w := httptest.NewRecorder()
	switch method {
	case http.MethodGet:
		h.srv.apiList(w, r)
	case http.MethodPost:
		h.srv.apiInsert(w, r)
	case http.MethodPatch:
		h.srv.apiUpdate(w, r)
	case http.MethodDelete:
		h.srv.apiDelete(w, r)
	}
	return w
}

func decodeList(t *testing.T, w *httptest.ResponseRecorder) []map[string]any {
	t.Helper()
	var out []map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode list: %v (body=%s)", err, w.Body.String())
	}
	return out
}

func decodeObj(t *testing.T, w *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var out map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode obj: %v (body=%s)", err, w.Body.String())
	}
	return out
}

// ---- Read authorization -------------------------------------------------

func TestReadScope_SessionStateHidesGMKeys(t *testing.T) {
	h := newHarness(t)
	h.exec(`INSERT INTO session_state(key,value) VALUES ('campaign','"prep"'),('imagebank','"imgs"'),('clock','"t"')`)

	// Player: campaign & imagebank must be filtered out.
	got := map[string]bool{}
	for _, row := range decodeList(t, h.call(http.MethodGet, "session_state", "", h.p1Tok, nil)) {
		got[row["key"].(string)] = true
	}
	if got["campaign"] || got["imagebank"] {
		t.Fatalf("player saw GM-only keys: %v", got)
	}
	if !got["clock"] {
		t.Fatalf("player should still see shared keys: %v", got)
	}

	// DM: sees everything.
	dm := map[string]bool{}
	for _, row := range decodeList(t, h.call(http.MethodGet, "session_state", "", h.dmTok, nil)) {
		dm[row["key"].(string)] = true
	}
	if !dm["campaign"] || !dm["imagebank"] {
		t.Fatalf("DM should see all keys: %v", dm)
	}
}

func TestReadScope_ProfileEmailRedaction(t *testing.T) {
	h := newHarness(t)
	h.exec(`INSERT INTO profiles(id,email,display_name,role) VALUES (?, 'p1@x','P1','player'),(?, 'p2@x','P2','player')`, h.p1ID, h.p2ID)

	for _, row := range decodeList(t, h.call(http.MethodGet, "profiles", "", h.p1Tok, nil)) {
		if row["id"] == h.p1ID {
			if row["email"] != "p1@x" {
				t.Fatalf("user should see own email, got %v", row["email"])
			}
		} else if _, ok := row["email"]; ok {
			t.Fatalf("other user's email must be redacted, got %v", row["email"])
		}
	}
}

func TestReadScope_SceneRedaction(t *testing.T) {
	h := newHarness(t)
	state := `{"tokens":[{"id":"t1","hidden":true,"note":"ambush"},{"id":"t2","name":"Hero","note":"gm"}],` +
		`"pins":[{"id":"p1","revealed":true},{"id":"p2","revealed":false}],` +
		`"labels":[{"id":"l1","revealed":false}],` +
		`"walls":[{"x1":0,"y1":0,"x2":10,"y2":10}]}`
	h.exec(`INSERT INTO scenes(id,name,state) VALUES ('s1','Scene',?)`, state)

	row := decodeList(t, h.call(http.MethodGet, "scenes", "", h.p1Tok, nil))[0]
	var st map[string]any
	b, _ := json.Marshal(row["state"])
	json.Unmarshal(b, &st)

	toks := st["tokens"].([]any)
	if len(toks) != 1 {
		t.Fatalf("hidden token should be removed, tokens=%v", toks)
	}
	if _, hasNote := toks[0].(map[string]any)["note"]; hasNote {
		t.Fatalf("GM note must be stripped from visible token")
	}
	if pins := st["pins"].([]any); len(pins) != 1 {
		t.Fatalf("only revealed pins should remain, pins=%v", pins)
	}
	if labels := st["labels"].([]any); len(labels) != 0 {
		t.Fatalf("unrevealed labels should be removed, labels=%v", labels)
	}
	if walls := st["walls"].([]any); len(walls) != 1 {
		t.Fatalf("walls must be preserved (needed for vision), walls=%v", walls)
	}

	// DM keeps the hidden token and the note.
	dmRow := decodeList(t, h.call(http.MethodGet, "scenes", "", h.dmTok, nil))[0]
	var dmState map[string]any
	b2, _ := json.Marshal(dmRow["state"])
	json.Unmarshal(b2, &dmState)
	if len(dmState["tokens"].([]any)) != 2 {
		t.Fatalf("DM must see all tokens")
	}
}

// ---- Write authorization ------------------------------------------------

func TestWrite_DMTableRejectsPlayer(t *testing.T) {
	h := newHarness(t)
	w := h.call(http.MethodPost, "scenes", "", h.p1Tok, map[string]any{"name": "X"})
	if w.Code != http.StatusForbidden {
		t.Fatalf("player insert into scenes should be 403, got %d", w.Code)
	}
}

func TestWrite_OwnerForcedOnInsert(t *testing.T) {
	h := newHarness(t)
	// Player tries to create a character owned by someone else.
	w := h.call(http.MethodPost, "characters", "", h.p1Tok, map[string]any{"id": "c1", "name": "A", "owner_id": h.p2ID})
	if w.Code != http.StatusCreated {
		t.Fatalf("insert should succeed, got %d (%s)", w.Code, w.Body.String())
	}
	if owner := decodeObj(t, w)["owner_id"]; owner != h.p1ID {
		t.Fatalf("owner_id must be forced to the caller, got %v", owner)
	}
}

func TestWrite_UpsertHijackBlocked(t *testing.T) {
	h := newHarness(t)
	h.exec(`INSERT INTO characters(id,owner_id,name,data) VALUES ('c1',?, 'Victim','{}')`, h.p1ID)

	// p2 tries to overwrite p1's character via on_conflict.
	w := h.call(http.MethodPost, "characters", "on_conflict=id", h.p2Tok, map[string]any{"id": "c1", "name": "hacked"})
	if w.Code != http.StatusForbidden {
		t.Fatalf("upsert hijack must be 403, got %d (%s)", w.Code, w.Body.String())
	}
	// The owner can still upsert their own row.
	w2 := h.call(http.MethodPost, "characters", "on_conflict=id", h.p1Tok, map[string]any{"id": "c1", "name": "renamed"})
	if w2.Code != http.StatusCreated {
		t.Fatalf("owner upsert should succeed, got %d (%s)", w2.Code, w2.Body.String())
	}
}

func TestWrite_IdentityForcedOnMessage(t *testing.T) {
	h := newHarness(t)
	w := h.call(http.MethodPost, "messages", "", h.p1Tok, map[string]any{
		"channel": "public", "content": "hi", "sender_id": h.p2ID, "sender_name": "DM",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("insert should succeed, got %d (%s)", w.Code, w.Body.String())
	}
	row := decodeObj(t, w)
	if row["sender_id"] != h.p1ID {
		t.Fatalf("sender_id must be forced to caller, got %v", row["sender_id"])
	}
	if row["sender_name"] != "Player One" {
		t.Fatalf("sender_name must come from the session, got %v", row["sender_name"])
	}
}

func TestWrite_ProfileSelfPromotionBlocked(t *testing.T) {
	h := newHarness(t)
	h.exec(`INSERT INTO profiles(id,email,display_name,role,color) VALUES (?, 'p1@x','P1','player','#111')`, h.p1ID)

	w := h.call(http.MethodPatch, "profiles", "id=eq."+h.p1ID, h.p1Tok, map[string]any{"role": "dm", "color": "#fff"})
	if w.Code != http.StatusOK {
		t.Fatalf("patch should succeed, got %d (%s)", w.Code, w.Body.String())
	}
	row := decodeObj(t, w)
	if row["role"] != "player" {
		t.Fatalf("role must stay 'player' (self-promotion blocked), got %v", row["role"])
	}
	if row["color"] != "#fff" {
		t.Fatalf("non-protected field should update, got %v", row["color"])
	}
}

func TestWrite_AuthTableDeleteOwnOnly(t *testing.T) {
	h := newHarness(t)
	// p1 posts a message (identity forced to p1).
	mw := h.call(http.MethodPost, "messages", "", h.p1Tok, map[string]any{"channel": "public", "content": "x"})
	id := decodeObj(t, mw)["id"].(string)

	// p2 cannot delete p1's message.
	if w := h.call(http.MethodDelete, "messages", "id=eq."+id, h.p2Tok, nil); w.Code != http.StatusForbidden {
		t.Fatalf("deleting another user's message should be 403, got %d", w.Code)
	}
	// p1 can delete their own.
	if w := h.call(http.MethodDelete, "messages", "id=eq."+id, h.p1Tok, nil); w.Code != http.StatusNoContent {
		t.Fatalf("deleting own message should be 204, got %d", w.Code)
	}
}

func TestRead_UnknownTableAndUnauth(t *testing.T) {
	h := newHarness(t)
	if w := h.call(http.MethodGet, "secrets", "", h.p1Tok, nil); w.Code != http.StatusNotFound {
		t.Fatalf("unknown table should be 404, got %d", w.Code)
	}
	if w := h.call(http.MethodGet, "characters", "", "", nil); w.Code != http.StatusUnauthorized {
		t.Fatalf("no session should be 401, got %d", w.Code)
	}
}

// ---- Pure helpers -------------------------------------------------------

func TestRowVisible(t *testing.T) {
	cases := []struct {
		table string
		row   map[string]any
		uid   string
		want  bool
	}{
		{"messages", map[string]any{"recipient_id": nil}, "u1", true},
		{"messages", map[string]any{"recipient_id": "u1"}, "u1", true},
		{"messages", map[string]any{"recipient_id": "u2", "sender_id": "u1"}, "u1", true},
		{"messages", map[string]any{"recipient_id": "u2", "sender_id": "u2"}, "u1", false},
		{"dice_rolls", map[string]any{"roll_type": "dm", "roller_id": "u2"}, "u1", false},
		{"dice_rolls", map[string]any{"roll_type": "dm", "roller_id": "u1"}, "u1", true},
		{"dice_rolls", map[string]any{"roll_type": "public"}, "u1", true},
		{"session_notes", map[string]any{"shared": int64(1)}, "u1", true},
		{"session_notes", map[string]any{"shared": int64(0), "created_by": "u2"}, "u1", false},
		{"handouts", map[string]any{"target_player": "u2"}, "u1", false},
		{"handouts", map[string]any{"target_player": nil}, "u1", true},
		{"session_state", map[string]any{"key": "campaign"}, "u1", false},
		{"session_state", map[string]any{"key": "clock"}, "u1", true},
		{"characters", map[string]any{}, "u1", true}, // shared table
	}
	for _, c := range cases {
		if got := rowVisible(c.table, c.row, c.uid); got != c.want {
			t.Errorf("rowVisible(%s, %v)=%v want %v", c.table, c.row, got, c.want)
		}
	}
}

func TestIsEphemeralFrame(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{`{"room":"main","event":"cursor","payload":{}}`, true},
		{`{"room":"main","presence":"track"}`, true},
		{`{"table":"messages","eventType":"INSERT","new":{}}`, false}, // forged data-change
		{`{"eventType":"UPDATE"}`, false},
		{`{"table":"scenes"}`, false},
		{`{"foo":1}`, false}, // no room
		{`not json`, false},
	}
	for _, c := range cases {
		if got := isEphemeralFrame([]byte(c.in)); got != c.want {
			t.Errorf("isEphemeralFrame(%s)=%v want %v", c.in, got, c.want)
		}
	}
}

func TestSafeStoragePath(t *testing.T) {
	// safeStoragePath returns a path under storageRoot()/<bucket> in the same form
	// (relative here, since DATA_DIR is unset); compare against that same root.
	root := filepath.Join(storageRoot(), "battlemap")

	if got, ok := safeStoragePath("battlemap", "maps/a.png"); !ok || !strings.HasPrefix(got, root) {
		t.Fatalf("normal path should resolve under bucket, got %q ok=%v", got, ok)
	}
	// Traversal in the path is neutralized (stays under the bucket root).
	if got, ok := safeStoragePath("battlemap", "../../etc/passwd"); !ok || !strings.HasPrefix(got, root) {
		t.Fatalf("path traversal must stay under bucket, got %q ok=%v", got, ok)
	}
	// Traversal / separators in the bucket are rejected outright.
	for _, b := range []string{"..", "a/b", `a\b`, ""} {
		if _, ok := safeStoragePath(b, "x"); ok {
			t.Fatalf("bucket %q should be rejected", b)
		}
	}
}

func TestCharacterPrivate_OwnerOnly(t *testing.T) {
	h := newHarness(t)
	h.exec(`INSERT INTO characters(id,owner_id,name,data) VALUES ('c1',?, 'P1 char','{}'),('c2',?, 'P2 char','{}')`, h.p1ID, h.p2ID)

	// The owner writes the private story of their own character.
	w := h.call(http.MethodPost, "character_private", "on_conflict=char_id", h.p1Tok, map[string]any{"char_id": "c1", "notes": "secret"})
	if w.Code != http.StatusCreated && w.Code != http.StatusOK {
		t.Fatalf("owner should write private story, got %d (%s)", w.Code, w.Body.String())
	}
	// A non-owner cannot write another character's private story.
	if w := h.call(http.MethodPost, "character_private", "on_conflict=char_id", h.p2Tok, map[string]any{"char_id": "c1", "notes": "hack"}); w.Code != http.StatusForbidden {
		t.Fatalf("non-owner write must be 403, got %d (%s)", w.Code, w.Body.String())
	}

	seesC1 := func(tok string) bool {
		for _, row := range decodeList(t, h.call(http.MethodGet, "character_private", "", tok, nil)) {
			if row["char_id"] == "c1" {
				return true
			}
		}
		return false
	}
	if seesC1(h.p2Tok) {
		t.Fatal("a non-owner must not read another character's private story")
	}
	if !seesC1(h.p1Tok) {
		t.Fatal("the owner must read their own private story")
	}
	if !seesC1(h.dmTok) {
		t.Fatal("the DM must read every private story")
	}
}

// ---- Per-campaign GM authorization ---------------------------------------

func TestCampaignGM_Scoped(t *testing.T) {
	h := newHarness(t)
	// p1 runs a second campaign; p2 is not a member of it.
	h.exec(`INSERT INTO campaigns(id, name) VALUES ('c2','Second')`)
	h.exec(`INSERT INTO campaign_members(campaign_id, user_id, role) VALUES ('c2', ?, 'dm')`, h.p1ID)

	// GM of c2 writes GM-only tables there…
	if w := h.call(http.MethodPost, "session_state", "", h.p1Tok, map[string]any{"campaign_id": "c2", "key": "clock", "value": map[string]any{"min": 1}}); w.Code != 201 {
		t.Fatalf("campaign GM insert in own campaign: got %d (%s)", w.Code, w.Body.String())
	}
	// …but not in the default campaign (member there, not GM).
	if w := h.call(http.MethodPost, "session_state", "", h.p1Tok, map[string]any{"key": "hacked", "value": 1}); w.Code != 403 {
		t.Fatalf("player must not write GM tables of the default campaign: got %d", w.Code)
	}
	// Updates targeting another campaign's rows are rejected…
	h.exec(`INSERT INTO session_state(key, value) VALUES ('clock','{"min":0}')`) // default campaign
	if w := h.call(http.MethodPatch, "session_state", "campaign_id=eq."+defaultCampaignID+"&key=eq.clock", h.p1Tok, map[string]any{"value": 2}); w.Code != 403 {
		t.Fatalf("cross-campaign update must be rejected: got %d", w.Code)
	}
	// …while updates within the GM's campaign pass.
	if w := h.call(http.MethodPatch, "session_state", "campaign_id=eq.c2&key=eq.clock", h.p1Tok, map[string]any{"value": 2}); w.Code != 200 {
		t.Fatalf("update in own campaign: got %d (%s)", w.Code, w.Body.String())
	}
	// The GM vault is scoped: p1 sees their campaign's notes, not the admin's.
	h.exec(`INSERT INTO vault_notes(path, content) VALUES ('secret.md','admin prep')`)
	if w := h.call(http.MethodPost, "vault_notes", "", h.p1Tok, map[string]any{"campaign_id": "c2", "path": "c2.md", "content": "x"}); w.Code != 201 {
		t.Fatalf("campaign GM vault insert: got %d (%s)", w.Code, w.Body.String())
	}
	list := decodeList(t, h.call(http.MethodGet, "vault_notes", "", h.p1Tok, nil))
	if len(list) != 1 || list[0]["path"] != "c2.md" {
		t.Fatalf("campaign GM must see only their campaign's vault, got %v", list)
	}
	// Membership gate: p2 cannot post into a campaign they don't belong to.
	if w := h.call(http.MethodPost, "messages", "", h.p2Tok, map[string]any{"campaign_id": "c2", "channel": "public", "content": "hi", "sender_name": "x"}); w.Code != 403 {
		t.Fatalf("non-member write must be rejected: got %d", w.Code)
	}
	// A non-admin cannot relocate rows: campaign_id in an update body is ignored.
	if w := h.call(http.MethodPatch, "session_state", "campaign_id=eq.c2&key=eq.clock", h.p1Tok, map[string]any{"campaign_id": defaultCampaignID, "value": 3}); w.Code != 200 {
		t.Fatalf("update with campaign_id in body: got %d (%s)", w.Code, w.Body.String())
	}
	var n int
	if err := h.srv.store.db.QueryRow(`SELECT COUNT(*) FROM session_state WHERE campaign_id='c2' AND key='clock'`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("row must stay in its campaign (n=%d, err=%v)", n, err)
	}
	// Anyone can create their own campaign (becoming its owner).
	if w := h.call(http.MethodPost, "campaigns", "", h.p2Tok, map[string]any{"name": "Mine"}); w.Code != 201 {
		t.Fatalf("player campaign creation: got %d (%s)", w.Code, w.Body.String())
	}
}

func TestMigrations(t *testing.T) {
	store, err := OpenStore(filepath.Join(t.TempDir(), "m.db"))
	if err != nil {
		t.Fatalf("OpenStore: %v", err)
	}
	t.Cleanup(func() { store.db.Close() })

	version := func() int {
		var v int
		if err := store.db.QueryRow(`PRAGMA user_version`).Scan(&v); err != nil {
			t.Fatalf("read user_version: %v", err)
		}
		return v
	}

	// A fresh database is stamped at the latest version.
	if got := version(); got != len(migrations) {
		t.Fatalf("fresh DB user_version=%d, want %d", got, len(migrations))
	}

	// v3: the fixed default campaign exists and absorbs writes that omit
	// campaign_id (column DEFAULT), so the current single-campaign front
	// keeps working unchanged.
	var sys string
	if err := store.db.QueryRow(`SELECT system FROM campaigns WHERE id = ?`, defaultCampaignID).Scan(&sys); err != nil {
		t.Fatalf("default campaign missing: %v", err)
	}
	if sys != "dnd5e-2014" {
		t.Fatalf("default campaign system=%q, want dnd5e-2014", sys)
	}
	if _, err := store.db.Exec(`INSERT INTO session_state(key, value) VALUES('mig_probe','{}')`); err != nil {
		t.Fatalf("untagged insert: %v", err)
	}
	var cid string
	if err := store.db.QueryRow(`SELECT campaign_id FROM session_state WHERE key='mig_probe'`).Scan(&cid); err != nil || cid != defaultCampaignID {
		t.Fatalf("untagged row campaign_id=%q err=%v, want default campaign", cid, err)
	}

	// v4: composite keys — the same semantic key may exist once PER campaign.
	if _, err := store.db.Exec(`INSERT INTO campaigns (id, name) VALUES ('c_second','Two')`); err != nil {
		t.Fatalf("second campaign: %v", err)
	}
	if _, err := store.db.Exec(`INSERT INTO session_state(campaign_id, key, value) VALUES('c_second','mig_probe','{}')`); err != nil {
		t.Fatalf("same key in a second campaign must be allowed (composite PK): %v", err)
	}
	if _, err := store.db.Exec(`INSERT INTO session_state(key, value) VALUES('mig_probe','{}')`); err == nil {
		t.Fatal("duplicate key within the SAME campaign must still conflict")
	}

	// Simulate a real pre-versioning database: baseline tables present but
	// user_version 0 (deployments older than the migration system). Replaying
	// from zero must converge — v1/v2 are idempotent, v3 adds columns that a
	// legacy database does not have yet.
	legacyPath := filepath.Join(t.TempDir(), "legacy.db")
	legacy, err := sql.Open("sqlite", "file:"+legacyPath+"?_pragma=foreign_keys(1)")
	if err != nil {
		t.Fatalf("open legacy: %v", err)
	}
	if _, err := legacy.Exec(schema + "\n" + appSchema); err != nil {
		t.Fatalf("seed legacy schema: %v", err)
	}
	if err := legacy.Close(); err != nil {
		t.Fatalf("close legacy: %v", err)
	}
	migrated, err := OpenStore(legacyPath)
	if err != nil {
		t.Fatalf("migrate legacy DB: %v", err)
	}
	t.Cleanup(func() { migrated.db.Close() })
	var v0 int
	if err := migrated.db.QueryRow(`PRAGMA user_version`).Scan(&v0); err != nil || v0 != len(migrations) {
		t.Fatalf("legacy DB user_version=%d err=%v, want %d", v0, err, len(migrations))
	}
}

func TestJoinCampaignRPC(t *testing.T) {
	h := newHarness(t)
	// p1 runs a second campaign with an invite code; p2 is not a member.
	h.exec(`INSERT INTO campaigns(id, name, invite_code) VALUES ('c2','Second','ABCD-2345')`)
	h.exec(`INSERT INTO campaign_members(campaign_id, user_id, role) VALUES ('c2', ?, 'dm')`, h.p1ID)

	// The RPC route is not /api/{table}, so drive the handler directly.
	rpc := func(tok string, body any) *httptest.ResponseRecorder {
		var rdr io.Reader
		if body != nil {
			b, _ := json.Marshal(body)
			rdr = bytes.NewReader(b)
		}
		r := httptest.NewRequest(http.MethodPost, "/rpc/join_campaign", rdr)
		if tok != "" {
			r.AddCookie(&http.Cookie{Name: "mk_session", Value: tok})
		}
		w := httptest.NewRecorder()
		h.srv.rpcJoinCampaign(w, r)
		return w
	}

	if w := rpc("", map[string]any{"code": "ABCD-2345"}); w.Code != 401 {
		t.Fatalf("anonymous join must be rejected: got %d", w.Code)
	}
	if w := rpc(h.p2Tok, map[string]any{"code": ""}); w.Code != 400 {
		t.Fatalf("empty code: got %d", w.Code)
	}
	if w := rpc(h.p2Tok, map[string]any{"code": "ZZZZ-9999"}); w.Code != 404 {
		t.Fatalf("unknown code: got %d", w.Code)
	}

	// Codes are normalized (case + surrounding whitespace) before lookup.
	w := rpc(h.p2Tok, map[string]any{"code": "  abcd-2345 "})
	if w.Code != 200 {
		t.Fatalf("join with valid code: got %d (%s)", w.Code, w.Body.String())
	}
	var got string
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil || got != "c2" {
		t.Fatalf("join must return the campaign id, got %q (err=%v)", w.Body.String(), err)
	}
	var role string
	if err := h.srv.store.db.QueryRow(`SELECT role FROM campaign_members WHERE campaign_id='c2' AND user_id=?`, h.p2ID).Scan(&role); err != nil || role != "player" {
		t.Fatalf("membership row: role=%q err=%v, want player", role, err)
	}

	// Re-joining is idempotent and must not escalate an existing role.
	if w := rpc(h.p1Tok, map[string]any{"code": "ABCD-2345"}); w.Code != 200 {
		t.Fatalf("re-join by existing member: got %d (%s)", w.Code, w.Body.String())
	}
	if err := h.srv.store.db.QueryRow(`SELECT role FROM campaign_members WHERE campaign_id='c2' AND user_id=?`, h.p1ID).Scan(&role); err != nil || role != "dm" {
		t.Fatalf("existing DM role must be preserved: role=%q err=%v", role, err)
	}
	var n int
	if err := h.srv.store.db.QueryRow(`SELECT COUNT(*) FROM campaign_members WHERE campaign_id='c2'`).Scan(&n); err != nil || n != 2 {
		t.Fatalf("memberships in c2: n=%d err=%v, want 2", n, err)
	}
}

// Storage writes are scoped per campaign: the first path segment names the
// campaign (front-prefixed keys); unprefixed paths belong to the default
// campaign; the global "dm" keeps its server-owner bypass.
func TestShutdownRPC(t *testing.T) {
	h := newHarness(t)
	h.srv.quit = make(chan struct{}) // main() sets this; the harness does not
	call := func(tok string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(http.MethodPost, "/rpc/shutdown", nil)
		if tok != "" {
			r.AddCookie(&http.Cookie{Name: "mk_session", Value: tok})
		}
		w := httptest.NewRecorder()
		h.srv.rpcShutdown(w, r)
		return w
	}
	quitClosed := func() bool {
		select {
		case <-h.srv.quit:
			return true
		default:
			return false
		}
	}
	if w := call(""); w.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated: want 401, got %d", w.Code)
	}
	if w := call(h.p1Tok); w.Code != http.StatusForbidden {
		t.Fatalf("player: want 403, got %d", w.Code)
	}
	if quitClosed() {
		t.Fatal("a non-DM request must not stop the server")
	}
	if w := call(h.dmTok); w.Code != http.StatusOK {
		t.Fatalf("DM: want 200, got %d", w.Code)
	}
	if !quitClosed() {
		t.Fatal("a DM request must signal shutdown")
	}
}

func TestStorageCampaignScoped(t *testing.T) {
	h := newHarness(t)
	t.Setenv("DATA_DIR", t.TempDir()) // uploads land in a throwaway dir
	h.exec(`INSERT INTO campaigns(id, name) VALUES ('c2','Second')`)
	h.exec(`INSERT INTO campaign_members(campaign_id, user_id, role) VALUES ('c2', ?, 'dm')`, h.p1ID)

	upload := func(tok, path string) *httptest.ResponseRecorder {
		var buf bytes.Buffer
		mw := multipart.NewWriter(&buf)
		_ = mw.WriteField("path", path)
		fw, _ := mw.CreateFormFile("file", "f.bin")
		_, _ = fw.Write([]byte("img"))
		_ = mw.Close()
		r := httptest.NewRequest(http.MethodPost, "/storage/battlemap", &buf)
		r.Header.Set("Content-Type", mw.FormDataContentType())
		r.SetPathValue("bucket", "battlemap")
		if tok != "" {
			r.AddCookie(&http.Cookie{Name: "mk_session", Value: tok})
		}
		w := httptest.NewRecorder()
		h.srv.storageUpload(w, r)
		return w
	}
	del := func(tok string, paths ...string) {
		b, _ := json.Marshal(map[string]any{"paths": paths})
		r := httptest.NewRequest(http.MethodDelete, "/storage/battlemap", bytes.NewReader(b))
		r.SetPathValue("bucket", "battlemap")
		r.AddCookie(&http.Cookie{Name: "mk_session", Value: tok})
		w := httptest.NewRecorder()
		h.srv.storageDelete(w, r)
		if w.Code != 204 {
			t.Fatalf("delete: got %d (%s)", w.Code, w.Body.String())
		}
	}
	onDisk := func(parts ...string) bool {
		_, err := os.Stat(filepath.Join(append([]string{storageRoot(), "battlemap"}, parts...)...))
		return err == nil
	}

	if w := upload("", "c2/maps/x.png"); w.Code != 401 {
		t.Fatalf("anonymous upload: got %d, want 401", w.Code)
	}
	// p2 is GM nowhere: rejected everywhere.
	if w := upload(h.p2Tok, "c2/maps/x.png"); w.Code != 403 {
		t.Fatalf("non-GM upload to c2: got %d, want 403", w.Code)
	}
	if w := upload(h.p2Tok, "maps/x.png"); w.Code != 403 {
		t.Fatalf("non-GM unprefixed upload: got %d, want 403", w.Code)
	}
	// p1 is GM of c2 only: may write under c2/, not elsewhere.
	if w := upload(h.p1Tok, "c2/maps/x.png"); w.Code != 200 {
		t.Fatalf("c2 GM upload to c2: got %d (%s)", w.Code, w.Body.String())
	}
	if w := upload(h.p1Tok, "maps/x.png"); w.Code != 403 {
		t.Fatalf("c2 GM unprefixed upload (default campaign): got %d, want 403", w.Code)
	}
	// A made-up prefix is NOT a campaign: falls back to the default campaign.
	if w := upload(h.p1Tok, "not-a-campaign/maps/x.png"); w.Code != 403 {
		t.Fatalf("c2 GM upload under unknown prefix: got %d, want 403", w.Code)
	}
	// The global dm (GM of the default campaign) still writes legacy paths.
	if w := upload(h.dmTok, "maps/legacy.png"); w.Code != 200 {
		t.Fatalf("global dm unprefixed upload: got %d (%s)", w.Code, w.Body.String())
	}

	// Delete: out-of-scope paths are skipped, in-scope ones removed.
	del(h.p1Tok, "maps/legacy.png", "c2/maps/x.png")
	if !onDisk("maps", "legacy.png") {
		t.Fatal("c2 GM must not delete a default-campaign file")
	}
	if onDisk("c2", "maps", "x.png") {
		t.Fatal("c2 GM delete of own campaign file must succeed")
	}
}

func TestLoginThrottle(t *testing.T) {
	th := newLoginThrottle()
	const ip = "10.0.0.1"
	if !th.allowed(ip) {
		t.Fatal("fresh IP should be allowed")
	}
	for i := 0; i < loginMaxFails; i++ {
		th.fail(ip)
	}
	if th.allowed(ip) {
		t.Fatal("IP should be blocked after reaching the failure threshold")
	}
	th.success(ip)
	if !th.allowed(ip) {
		t.Fatal("a successful login should clear the block")
	}
	// A different IP is unaffected.
	if !th.allowed("10.0.0.2") {
		t.Fatal("unrelated IP must not be blocked")
	}
}
