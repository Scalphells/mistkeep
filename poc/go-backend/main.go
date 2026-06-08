// Mistkeep — Go backend PoC (G1 SQLite + G2 bcrypt).
//
// Demonstrates the pieces that would replace Supabase, now with persistence:
//   - auth: signup / login / logout / me (cookie session, bcrypt password hash)
//   - data: a "characters" resource with authorization (the RLS equivalent),
//           stored in SQLite (pure Go driver, no CGO)
//   - realtime: an in-memory hub that pushes data changes and relays events
//
// Realtime still uses Server-Sent Events here; production would use WebSocket.
//
// First run:
//   go mod tidy      # downloads modernc.org/sqlite and golang.org/x/crypto
//   go run .         # then open http://localhost:8787
//
// Data is stored in ./data/mistkeep.db (delete it to reset).
package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

// ---- Models -------------------------------------------------------------

type User struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"` // "dm" | "player"
}

type Character struct {
	ID      string          `json:"id"`
	OwnerID string          `json:"owner_id"`
	Name    string          `json:"name"`
	Data    json.RawMessage `json:"data"`
}

// ---- Store (SQLite) -----------------------------------------------------

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  email        TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role         TEXT NOT NULL,
  pass_hash    TEXT NOT NULL,
  created_at   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS characters (
  id       TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  data     TEXT NOT NULL DEFAULT '{}'
);`

type Store struct{ db *sql.DB }

func OpenStore(path string) (*Store, error) {
	if err := os.MkdirAll("data", 0o755); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", "file:"+path+"?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)")
	if err != nil {
		return nil, err
	}
	if _, err := db.Exec(schema); err != nil {
		return nil, err
	}
	return &Store{db: db}, nil
}

func (s *Store) countUsers() (int, error) {
	var n int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&n)
	return n, err
}

func (s *Store) createUser(email, name, role, passHash string) (*User, error) {
	u := &User{ID: id("u"), Email: email, DisplayName: name, Role: role}
	_, err := s.db.Exec(
		`INSERT INTO users(id,email,display_name,role,pass_hash,created_at) VALUES(?,?,?,?,?,?)`,
		u.ID, email, name, role, passHash, now())
	return u, err
}

// userByEmail returns the user and its password hash (empty user if not found).
func (s *Store) userByEmail(email string) (*User, string, error) {
	u := &User{}
	var hash string
	err := s.db.QueryRow(
		`SELECT id,email,display_name,role,pass_hash FROM users WHERE email=?`, email).
		Scan(&u.ID, &u.Email, &u.DisplayName, &u.Role, &hash)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, "", nil
	}
	return u, hash, err
}

func (s *Store) createSession(userID string) (string, error) {
	tok := token()
	_, err := s.db.Exec(`INSERT INTO sessions(token,user_id,created_at) VALUES(?,?,?)`, tok, userID, now())
	return tok, err
}

func (s *Store) userBySession(tok string) (*User, error) {
	u := &User{}
	err := s.db.QueryRow(
		`SELECT u.id,u.email,u.display_name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?`, tok).
		Scan(&u.ID, &u.Email, &u.DisplayName, &u.Role)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return u, err
}

func (s *Store) deleteSession(tok string) { _, _ = s.db.Exec(`DELETE FROM sessions WHERE token=?`, tok) }

func (s *Store) listCharacters() ([]*Character, error) {
	rows, err := s.db.Query(`SELECT id,owner_id,name,data FROM characters ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*Character{}
	for rows.Next() {
		c := &Character{}
		var data string
		if err := rows.Scan(&c.ID, &c.OwnerID, &c.Name, &data); err != nil {
			return nil, err
		}
		c.Data = json.RawMessage(data)
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) getCharacter(cid string) (*Character, error) {
	c := &Character{}
	var data string
	err := s.db.QueryRow(`SELECT id,owner_id,name,data FROM characters WHERE id=?`, cid).
		Scan(&c.ID, &c.OwnerID, &c.Name, &data)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	c.Data = json.RawMessage(data)
	return c, nil
}

func (s *Store) createCharacter(owner, name string, data json.RawMessage) (*Character, error) {
	c := &Character{ID: id("c"), OwnerID: owner, Name: name, Data: data}
	_, err := s.db.Exec(`INSERT INTO characters(id,owner_id,name,data) VALUES(?,?,?,?)`,
		c.ID, owner, name, string(data))
	return c, err
}

func (s *Store) updateCharacter(c *Character) error {
	_, err := s.db.Exec(`UPDATE characters SET name=?, data=? WHERE id=?`, c.Name, string(c.Data), c.ID)
	return err
}

func (s *Store) deleteCharacter(cid string) error {
	_, err := s.db.Exec(`DELETE FROM characters WHERE id=?`, cid)
	return err
}

// ---- Realtime hub -------------------------------------------------------

type Hub struct {
	mu    sync.Mutex
	rooms map[string]map[chan string]bool
}

func NewHub() *Hub { return &Hub{rooms: map[string]map[chan string]bool{}} }

func (h *Hub) add(room string, ch chan string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[room] == nil {
		h.rooms[room] = map[chan string]bool{}
	}
	h.rooms[room][ch] = true
}

func (h *Hub) remove(room string, ch chan string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[room] != nil {
		delete(h.rooms[room], ch)
	}
}

func (h *Hub) broadcast(room, msg string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.rooms[room] {
		select {
		case ch <- msg:
		default:
		}
	}
}

// ---- Server -------------------------------------------------------------

type Server struct {
	store *Store
	hub   *Hub
}

func (s *Server) emit(kind string, v any) {
	b, _ := json.Marshal(map[string]any{"kind": kind, "payload": v})
	s.hub.broadcast("main", string(b))
}

func (s *Server) userFrom(r *http.Request) *User {
	c, err := r.Cookie("mk_session")
	if err != nil {
		return nil
	}
	u, _ := s.store.userBySession(c.Value)
	return u
}

// Authorization — the RLS equivalent.
func canWriteCharacter(u *User, c *Character) bool {
	return u.Role == "dm" || c.OwnerID == u.ID
}

// ---- Auth handlers ------------------------------------------------------

func (s *Server) signup(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email       string `json:"email"`
		Password    string `json:"password"`
		DisplayName string `json:"display_name"`
	}
	if json.NewDecoder(r.Body).Decode(&in) != nil || in.Email == "" || in.Password == "" {
		httpErr(w, 400, "email and password required")
		return
	}
	if existing, _, _ := s.store.userByEmail(in.Email); existing != nil {
		httpErr(w, 409, "email already registered")
		return
	}
	n, err := s.store.countUsers()
	if err != nil {
		httpErr(w, 500, "db error")
		return
	}
	role := "player"
	if n == 0 {
		role = "dm" // the first account is the DM
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		httpErr(w, 500, "hash error")
		return
	}
	u, err := s.store.createUser(in.Email, in.DisplayName, role, string(hash))
	if err != nil {
		httpErr(w, 500, "could not create user")
		return
	}
	tok, err := s.store.createSession(u.ID)
	if err != nil {
		httpErr(w, 500, "session error")
		return
	}
	setSession(w, tok)
	writeJSON(w, 200, publicUser(u))
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if json.NewDecoder(r.Body).Decode(&in) != nil {
		httpErr(w, 400, "bad request")
		return
	}
	u, hash, err := s.store.userByEmail(in.Email)
	if err != nil {
		httpErr(w, 500, "db error")
		return
	}
	if u == nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(in.Password)) != nil {
		httpErr(w, 401, "invalid credentials")
		return
	}
	tok, err := s.store.createSession(u.ID)
	if err != nil {
		httpErr(w, 500, "session error")
		return
	}
	setSession(w, tok)
	writeJSON(w, 200, publicUser(u))
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie("mk_session"); err == nil {
		s.store.deleteSession(c.Value)
	}
	http.SetCookie(w, &http.Cookie{Name: "mk_session", Value: "", Path: "/", MaxAge: -1})
	w.WriteHeader(204)
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	u := s.userFrom(r)
	if u == nil {
		httpErr(w, 401, "unauthenticated")
		return
	}
	writeJSON(w, 200, publicUser(u))
}

// ---- Character handlers -------------------------------------------------

func (s *Server) listChars(w http.ResponseWriter, r *http.Request) {
	if s.userFrom(r) == nil {
		httpErr(w, 401, "unauthenticated")
		return
	}
	list, err := s.store.listCharacters()
	if err != nil {
		httpErr(w, 500, "db error")
		return
	}
	writeJSON(w, 200, list)
}

func (s *Server) createChar(w http.ResponseWriter, r *http.Request) {
	u := s.userFrom(r)
	if u == nil {
		httpErr(w, 401, "unauthenticated")
		return
	}
	var in struct {
		Name string          `json:"name"`
		Data json.RawMessage `json:"data"`
	}
	if json.NewDecoder(r.Body).Decode(&in) != nil || in.Name == "" {
		httpErr(w, 400, "name required")
		return
	}
	if in.Data == nil {
		in.Data = json.RawMessage("{}")
	}
	c, err := s.store.createCharacter(u.ID, in.Name, in.Data)
	if err != nil {
		httpErr(w, 500, "db error")
		return
	}
	s.emit("character.created", c)
	writeJSON(w, 201, c)
}

func (s *Server) patchChar(w http.ResponseWriter, r *http.Request) {
	u := s.userFrom(r)
	if u == nil {
		httpErr(w, 401, "unauthenticated")
		return
	}
	var in struct {
		Name *string         `json:"name"`
		Data json.RawMessage `json:"data"`
	}
	if json.NewDecoder(r.Body).Decode(&in) != nil {
		httpErr(w, 400, "bad request")
		return
	}
	c, err := s.store.getCharacter(r.PathValue("id"))
	if err != nil {
		httpErr(w, 500, "db error")
		return
	}
	if c == nil {
		httpErr(w, 404, "not found")
		return
	}
	if !canWriteCharacter(u, c) {
		httpErr(w, 403, "forbidden")
		return
	}
	if in.Name != nil {
		c.Name = *in.Name
	}
	if in.Data != nil {
		c.Data = in.Data
	}
	if err := s.store.updateCharacter(c); err != nil {
		httpErr(w, 500, "db error")
		return
	}
	s.emit("character.updated", c)
	writeJSON(w, 200, c)
}

func (s *Server) deleteChar(w http.ResponseWriter, r *http.Request) {
	u := s.userFrom(r)
	if u == nil {
		httpErr(w, 401, "unauthenticated")
		return
	}
	cid := r.PathValue("id")
	c, err := s.store.getCharacter(cid)
	if err != nil {
		httpErr(w, 500, "db error")
		return
	}
	if c == nil {
		httpErr(w, 404, "not found")
		return
	}
	if !canWriteCharacter(u, c) {
		httpErr(w, 403, "forbidden")
		return
	}
	if err := s.store.deleteCharacter(cid); err != nil {
		httpErr(w, 500, "db error")
		return
	}
	s.emit("character.deleted", map[string]string{"id": cid})
	w.WriteHeader(204)
}

// ---- Realtime handlers --------------------------------------------------

func (s *Server) sse(w http.ResponseWriter, r *http.Request) {
	if s.userFrom(r) == nil {
		httpErr(w, 401, "unauthenticated")
		return
	}
	fl, ok := w.(http.Flusher)
	if !ok {
		httpErr(w, 500, "streaming unsupported")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	ch := make(chan string, 16)
	s.hub.add("main", ch)
	defer s.hub.remove("main", ch)
	fmt.Fprint(w, "event: ready\ndata: {}\n\n")
	fl.Flush()
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case msg := <-ch:
			fmt.Fprintf(w, "data: %s\n\n", msg)
			fl.Flush()
		case <-ticker.C:
			fmt.Fprint(w, ": keep-alive\n\n")
			fl.Flush()
		}
	}
}

func (s *Server) rtBroadcast(w http.ResponseWriter, r *http.Request) {
	if s.userFrom(r) == nil {
		httpErr(w, 401, "unauthenticated")
		return
	}
	body, _ := io.ReadAll(io.LimitReader(r.Body, 1<<16))
	s.hub.broadcast("main", string(body))
	w.WriteHeader(204)
}

// ---- Helpers ------------------------------------------------------------

func publicUser(u *User) map[string]any {
	return map[string]any{"id": u.ID, "email": u.Email, "display_name": u.DisplayName, "role": u.Role}
}

func id(prefix string) string {
	b := make([]byte, 8)
	rand.Read(b)
	return prefix + "_" + hex.EncodeToString(b)
}

func token() string {
	b := make([]byte, 24)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func now() string { return time.Now().UTC().Format(time.RFC3339) }

func setSession(w http.ResponseWriter, tok string) {
	http.SetCookie(w, &http.Cookie{
		Name: "mk_session", Value: tok, Path: "/",
		HttpOnly: true, SameSite: http.SameSiteLaxMode,
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func httpErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// ---- Wiring -------------------------------------------------------------

func main() {
	store, err := OpenStore("data/mistkeep.db")
	if err != nil {
		log.Fatal(err)
	}
	s := &Server{store: store, hub: NewHub()}
	mux := http.NewServeMux()

	mux.HandleFunc("POST /auth/signup", s.signup)
	mux.HandleFunc("POST /auth/login", s.login)
	mux.HandleFunc("POST /auth/logout", s.logout)
	mux.HandleFunc("GET /auth/me", s.me)

	mux.HandleFunc("GET /api/characters", s.listChars)
	mux.HandleFunc("POST /api/characters", s.createChar)
	mux.HandleFunc("PATCH /api/characters/{id}", s.patchChar)
	mux.HandleFunc("DELETE /api/characters/{id}", s.deleteChar)

	mux.HandleFunc("GET /realtime", s.sse)
	mux.HandleFunc("POST /realtime/broadcast", s.rtBroadcast)

	mux.Handle("/", http.FileServer(http.Dir("static")))

	addr := ":8787"
	log.Printf("Mistkeep PoC backend (SQLite) on http://localhost%s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
