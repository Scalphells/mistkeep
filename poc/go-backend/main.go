// Mistkeep — Go backend PoC.
//
// Demonstrates, with the Go standard library only (no external modules), the
// pieces that would replace Supabase:
//   - auth: signup / login / logout / me (cookie session)
//   - data: a "characters" resource with authorization (the RLS equivalent)
//   - realtime: a hub that pushes data changes and relays ephemeral events
//
// Storage is in-memory and passwords use SHA-256 — both are PoC shortcuts.
// Production would use SQLite (modernc.org/sqlite), bcrypt/argon2, and WebSocket
// (this PoC uses Server-Sent Events to stay dependency-free).
//
// Run:  go run .   then open http://localhost:8787
package main

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"
)

// ---- Models -------------------------------------------------------------

type User struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"` // "dm" | "player"
	salt        string
	hash        string
}

type Character struct {
	ID      string          `json:"id"`
	OwnerID string          `json:"owner_id"`
	Name    string          `json:"name"`
	Data    json.RawMessage `json:"data"`
}

// ---- In-memory store (swap for SQLite later) ----------------------------

type Store struct {
	mu         sync.RWMutex
	users      map[string]*User
	byEmail    map[string]*User
	sessions   map[string]string // token -> userID
	characters map[string]*Character
}

func NewStore() *Store {
	return &Store{
		users:      map[string]*User{},
		byEmail:    map[string]*User{},
		sessions:   map[string]string{},
		characters: map[string]*Character{},
	}
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
		default: // drop if the client is slow
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
	s.store.mu.RLock()
	defer s.store.mu.RUnlock()
	uid, ok := s.store.sessions[c.Value]
	if !ok {
		return nil
	}
	return s.store.users[uid]
}

// ---- Authorization (the RLS equivalent) ---------------------------------

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
	s.store.mu.Lock()
	if _, exists := s.store.byEmail[in.Email]; exists {
		s.store.mu.Unlock()
		httpErr(w, 409, "email already registered")
		return
	}
	role := "player"
	if len(s.store.users) == 0 {
		role = "dm" // the first account is the DM
	}
	salt := token()[:16]
	u := &User{
		ID: id("u"), Email: in.Email, DisplayName: in.DisplayName,
		Role: role, salt: salt, hash: hashPw(salt, in.Password),
	}
	s.store.users[u.ID] = u
	s.store.byEmail[u.Email] = u
	tok := token()
	s.store.sessions[tok] = u.ID
	s.store.mu.Unlock()
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
	s.store.mu.Lock()
	u := s.store.byEmail[in.Email]
	if u == nil || subtle.ConstantTimeCompare([]byte(u.hash), []byte(hashPw(u.salt, in.Password))) != 1 {
		s.store.mu.Unlock()
		httpErr(w, 401, "invalid credentials")
		return
	}
	tok := token()
	s.store.sessions[tok] = u.ID
	s.store.mu.Unlock()
	setSession(w, tok)
	writeJSON(w, 200, publicUser(u))
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie("mk_session"); err == nil {
		s.store.mu.Lock()
		delete(s.store.sessions, c.Value)
		s.store.mu.Unlock()
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
	s.store.mu.RLock()
	defer s.store.mu.RUnlock()
	out := make([]*Character, 0, len(s.store.characters))
	for _, c := range s.store.characters {
		out = append(out, c)
	}
	writeJSON(w, 200, out)
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
	c := &Character{ID: id("c"), OwnerID: u.ID, Name: in.Name, Data: in.Data}
	s.store.mu.Lock()
	s.store.characters[c.ID] = c
	s.store.mu.Unlock()
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
	s.store.mu.Lock()
	c := s.store.characters[r.PathValue("id")]
	if c == nil {
		s.store.mu.Unlock()
		httpErr(w, 404, "not found")
		return
	}
	if !canWriteCharacter(u, c) {
		s.store.mu.Unlock()
		httpErr(w, 403, "forbidden")
		return
	}
	if in.Name != nil {
		c.Name = *in.Name
	}
	if in.Data != nil {
		c.Data = in.Data
	}
	s.store.mu.Unlock()
	s.emit("character.updated", c)
	writeJSON(w, 200, c)
}

func (s *Server) deleteChar(w http.ResponseWriter, r *http.Request) {
	u := s.userFrom(r)
	if u == nil {
		httpErr(w, 401, "unauthenticated")
		return
	}
	id := r.PathValue("id")
	s.store.mu.Lock()
	c := s.store.characters[id]
	if c == nil {
		s.store.mu.Unlock()
		httpErr(w, 404, "not found")
		return
	}
	if !canWriteCharacter(u, c) {
		s.store.mu.Unlock()
		httpErr(w, 403, "forbidden")
		return
	}
	delete(s.store.characters, id)
	s.store.mu.Unlock()
	s.emit("character.deleted", map[string]string{"id": id})
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

// rtBroadcast relays an ephemeral event (ping, cursor, "pull players here")
// to everyone, without touching the database.
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

// PoC only. Use bcrypt or argon2id in production.
func hashPw(salt, pw string) string {
	h := sha256.Sum256([]byte(salt + ":" + pw))
	return hex.EncodeToString(h[:])
}

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
	s := &Server{store: NewStore(), hub: NewHub()}
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
	log.Printf("Mistkeep PoC backend on http://localhost%s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
