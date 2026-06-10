package main

// Authorization & redaction tests for the resource engine (api.go) plus the
// pure security helpers (main.go, storage.go). These lock in the behavior the
// hardening commits introduced: read scoping, write ownership, identity forcing,
// the upsert-hijack guard, scene/profile redaction, login throttling, the
// ephemeral-frame filter, and storage path safety.

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
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
