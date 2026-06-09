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
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

//go:embed static
var staticFS embed.FS

// ---- Models -------------------------------------------------------------

type User struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"` // "dm" | "player"
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
);`

type Store struct{ db *sql.DB }

// dataDir is where the database and uploaded files live. Configurable via
// DATA_DIR so the binary and its data can sit anywhere (defaults to ./data).
func dataDir() string {
	if d := os.Getenv("DATA_DIR"); d != "" {
		return d
	}
	return "data"
}

func OpenStore(path string) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", "file:"+path+"?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)")
	if err != nil {
		return nil, err
	}
	// SQLite is single-writer. With the default connection pool, concurrent
	// writes (e.g. rapid scene switches) contend for the lock and a read on
	// another connection can observe a stale value before an in-flight write
	// commits — which corrupted scene state. Serialize all access on one
	// connection: every query runs in order, so a read always sees prior writes.
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		return nil, err
	}
	if _, err := db.Exec(appSchema); err != nil {
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

// sessionTTL is how long a session stays valid. RFC3339 timestamps sort
// lexicographically, so a string comparison enforces the cutoff.
const sessionTTL = 30 * 24 * time.Hour

func (s *Store) userBySession(tok string) (*User, error) {
	u := &User{}
	cutoff := time.Now().UTC().Add(-sessionTTL).Format(time.RFC3339)
	err := s.db.QueryRow(
		`SELECT u.id,u.email,u.display_name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.created_at>=?`,
		tok, cutoff).
		Scan(&u.ID, &u.Email, &u.DisplayName, &u.Role)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return u, err
}

func (s *Store) deleteSession(tok string) { _, _ = s.db.Exec(`DELETE FROM sessions WHERE token=?`, tok) }

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

func (s *Server) userFrom(r *http.Request) *User {
	c, err := r.Cookie("mk_session")
	if err != nil {
		return nil
	}
	u, _ := s.store.userBySession(c.Value)
	return u
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
	if len(in.Password) < 6 {
		httpErr(w, 400, "password too short (min 6 characters)")
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
	// Optional registration lockdown: the DM closes signups once players are in.
	// The very first account (the DM) is always allowed so the server can bootstrap.
	if n > 0 && os.Getenv("DISABLE_SIGNUP") == "1" {
		httpErr(w, 403, "registration is closed")
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
	setSession(w, r, tok)
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
	setSession(w, r, tok)
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

// ---- Realtime handlers --------------------------------------------------

func (s *Server) ws(w http.ResponseWriter, r *http.Request) {
	if s.userFrom(r) == nil {
		httpErr(w, 401, "unauthenticated")
		return
	}
	// Reject cross-origin WebSocket handshakes (prevents cross-site hijacking).
	// Same-origin is allowed by default; extra hosts can be permitted via
	// ALLOWED_ORIGINS (comma-separated host patterns, e.g. "vtt.example.com").
	opts := &websocket.AcceptOptions{}
	if o := os.Getenv("ALLOWED_ORIGINS"); o != "" {
		opts.OriginPatterns = strings.Split(o, ",")
	}
	c, err := websocket.Accept(w, r, opts)
	if err != nil {
		return
	}
	defer c.CloseNow()
	ctx := r.Context()
	ch := make(chan string, 16)
	s.hub.add("main", ch)
	defer s.hub.remove("main", ch)

	// Reader: relay incoming client messages as ephemeral broadcasts (ping, cursor…).
	go func() {
		for {
			_, data, err := c.Read(ctx)
			if err != nil {
				return
			}
			s.hub.broadcast("main", string(data))
		}
	}()

	// Writer: push hub events to this client.
	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-ch:
			if err := c.Write(ctx, websocket.MessageText, []byte(msg)); err != nil {
				return
			}
		}
	}
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

// isHTTPS reports whether the client connection is secure, directly (TLS) or
// via a trusted TLS-terminating proxy (X-Forwarded-Proto), or forced by env.
func isHTTPS(r *http.Request) bool {
	return r.TLS != nil ||
		strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") ||
		os.Getenv("SECURE_COOKIES") == "1"
}

func setSession(w http.ResponseWriter, r *http.Request, tok string) {
	http.SetCookie(w, &http.Cookie{
		Name: "mk_session", Value: tok, Path: "/",
		HttpOnly: true, SameSite: http.SameSiteLaxMode,
		Secure: isHTTPS(r),
		MaxAge: int(sessionTTL / time.Second),
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

// withMiddleware adds baseline security headers and bounds request body sizes.
// Storage uploads (multipart, self-capped) and the WebSocket opt out of the
// body limit so large maps and long-lived connections still work.
func withMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")

		if r.Method == http.MethodPost || r.Method == http.MethodPatch || r.Method == http.MethodPut {
			p := r.URL.Path
			if !strings.HasPrefix(p, "/storage/") && p != "/realtime" {
				limit := int64(16 << 20) // 16 MiB — scene state can be large
				if strings.HasPrefix(p, "/auth/") {
					limit = 64 << 10 // 64 KiB
				}
				r.Body = http.MaxBytesReader(w, r.Body, limit)
			}
		}
		next.ServeHTTP(w, r)
	})
}

// ---- Wiring -------------------------------------------------------------

// version is stamped at build time via -ldflags "-X main.version=...".
var version = "dev"

const usage = `mistkeep — self-hosted VTT server (single binary)

Usage: mistkeep [--version | --help]

Environment:
  PORT             port to listen on (default 8787)
  DATA_DIR         directory for the database + uploaded files (default ./data)
  DISABLE_SIGNUP   set to 1 to close registration once players have signed up
  ALLOWED_ORIGINS  extra comma-separated WebSocket origin host patterns
  SECURE_COOKIES   set to 1 to force the Secure flag on the session cookie
  NO_BROWSER       set to 1 to not open a browser on launch (headless servers)

On launch it opens your browser at http://localhost:PORT. Create the first
account — it becomes the DM.`

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "-v", "--version", "version":
			fmt.Println("mistkeep", version)
			return
		case "-h", "--help", "help":
			fmt.Println(usage)
			return
		}
	}

	store, err := OpenStore(filepath.Join(dataDir(), "mistkeep.db"))
	if err != nil {
		log.Fatal(err)
	}
	s := &Server{store: store, hub: NewHub()}
	mux := http.NewServeMux()

	mux.HandleFunc("POST /auth/signup", s.signup)
	mux.HandleFunc("POST /auth/login", s.login)
	mux.HandleFunc("POST /auth/logout", s.logout)
	mux.HandleFunc("GET /auth/me", s.me)

	// Generic resource engine (see api.go): every whitelisted table at /api/{table}.
	mux.HandleFunc("GET /api/{table}", s.apiList)
	mux.HandleFunc("POST /api/{table}", s.apiInsert)
	mux.HandleFunc("PATCH /api/{table}", s.apiUpdate)
	mux.HandleFunc("DELETE /api/{table}", s.apiDelete)

	mux.HandleFunc("GET /realtime", s.ws)

	// File storage (see storage.go).
	mux.HandleFunc("POST /storage/{bucket}", s.storageUpload)
	mux.HandleFunc("POST /storage/{bucket}/sign", s.storageSign)
	mux.HandleFunc("GET /storage/{bucket}/{path...}", s.storageGet)
	mux.HandleFunc("DELETE /storage/{bucket}", s.storageDelete)

	// Front end embedded in the binary (single-file deploy).
	sub, err := fs.Sub(staticFS, "static")
	if err != nil {
		log.Fatal(err)
	}
	mux.Handle("/", http.FileServer(http.FS(sub)))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8787"
	}
	addr := ":" + port
	srv := &http.Server{
		Handler: withMiddleware(mux),
		// ReadHeaderTimeout guards against slowloris without capping long-lived
		// WebSocket connections or large uploads (so no ReadTimeout/WriteTimeout).
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatal(err)
	}
	url := "http://localhost:" + port
	log.Printf("Mistkeep %s (SQLite + WebSocket, embedded UI) on %s", version, url)
	openBrowser(url) // convenience for desktop use; NO_BROWSER=1 to skip (servers)
	log.Fatal(srv.Serve(ln))
}

// openBrowser tries to open the default browser at url. Best-effort: failures
// (e.g. on a headless server) are ignored. Set NO_BROWSER=1 to disable.
func openBrowser(url string) {
	if os.Getenv("NO_BROWSER") == "1" {
		return
	}
	var cmd string
	var args []string
	switch runtime.GOOS {
	case "windows":
		cmd, args = "rundll32", []string{"url.dll,FileProtocolHandler", url}
	case "darwin":
		cmd, args = "open", []string{url}
	default:
		cmd, args = "xdg-open", []string{url}
	}
	_ = exec.Command(cmd, args...).Start()
}
