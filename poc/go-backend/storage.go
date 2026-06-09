package main

// File storage (G5).
//
//   POST   /storage/{bucket}            multipart: path + file  (DM only)
//   POST   /storage/{bucket}/sign       { path } -> { signedUrl }
//   GET    /storage/{bucket}/{path...}  serve the file (authenticated only)
//   DELETE /storage/{bucket}            { paths: [...] }        (DM only)
//
// Files are stored under ./data/storage/<bucket>/<path>. Buckets are private:
// reads require a session. Paths are sanitized to prevent traversal.

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// storageRoot is the on-disk root for uploaded files, under the data dir.
func storageRoot() string { return filepath.Join(dataDir(), "storage") }

// safeStoragePath resolves <root>/<bucket>/<path> and rejects traversal.
func safeStoragePath(bucket, p string) (string, bool) {
	if bucket == "" || strings.ContainsAny(bucket, `/\`) || strings.Contains(bucket, "..") {
		return "", false
	}
	clean := filepath.Clean("/" + strings.TrimPrefix(p, "/")) // drop any ".." segments
	full := filepath.Join(storageRoot(), bucket, clean)
	root, err1 := filepath.Abs(filepath.Join(storageRoot(), bucket))
	abs, err2 := filepath.Abs(full)
	if err1 != nil || err2 != nil || !strings.HasPrefix(abs, root) {
		return "", false
	}
	return full, true
}

func (s *Server) storageUpload(w http.ResponseWriter, r *http.Request) {
	u := s.userFrom(r)
	if u == nil {
		httpErr(w, 401, "unauthenticated")
		return
	}
	if u.Role != "dm" {
		httpErr(w, 403, "forbidden")
		return
	}
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		httpErr(w, 400, "bad multipart form")
		return
	}
	p := r.FormValue("path")
	file, _, err := r.FormFile("file")
	if err != nil {
		httpErr(w, 400, "missing file")
		return
	}
	defer file.Close()
	full, ok := safeStoragePath(r.PathValue("bucket"), p)
	if !ok {
		httpErr(w, 400, "bad path")
		return
	}
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		httpErr(w, 500, "mkdir failed")
		return
	}
	dst, err := os.Create(full)
	if err != nil {
		httpErr(w, 500, "create failed")
		return
	}
	defer dst.Close()
	if _, err := io.Copy(dst, file); err != nil {
		httpErr(w, 500, "write failed")
		return
	}
	writeJSON(w, 200, map[string]any{"path": p, "Key": r.PathValue("bucket") + "/" + p})
}

func (s *Server) storageSign(w http.ResponseWriter, r *http.Request) {
	if s.userFrom(r) == nil {
		httpErr(w, 401, "unauthenticated")
		return
	}
	var in struct {
		Path string `json:"path"`
	}
	if json.NewDecoder(r.Body).Decode(&in) != nil {
		httpErr(w, 400, "bad request")
		return
	}
	bucket := r.PathValue("bucket")
	full, ok := safeStoragePath(bucket, in.Path)
	if !ok {
		httpErr(w, 400, "bad path")
		return
	}
	if _, err := os.Stat(full); err != nil {
		httpErr(w, 404, "not found")
		return
	}
	// Private bucket: the "signed" URL just points at the authenticated GET route.
	writeJSON(w, 200, map[string]any{"signedUrl": "/storage/" + bucket + "/" + strings.TrimPrefix(in.Path, "/")})
}

func (s *Server) storageGet(w http.ResponseWriter, r *http.Request) {
	if s.userFrom(r) == nil {
		httpErr(w, 401, "unauthenticated")
		return
	}
	full, ok := safeStoragePath(r.PathValue("bucket"), r.PathValue("path"))
	if !ok {
		httpErr(w, 400, "bad path")
		return
	}
	http.ServeFile(w, r, full)
}

func (s *Server) storageDelete(w http.ResponseWriter, r *http.Request) {
	u := s.userFrom(r)
	if u == nil {
		httpErr(w, 401, "unauthenticated")
		return
	}
	if u.Role != "dm" {
		httpErr(w, 403, "forbidden")
		return
	}
	var in struct {
		Paths []string `json:"paths"`
	}
	if json.NewDecoder(r.Body).Decode(&in) != nil {
		httpErr(w, 400, "bad request")
		return
	}
	bucket := r.PathValue("bucket")
	for _, p := range in.Paths {
		if full, ok := safeStoragePath(bucket, p); ok {
			_ = os.Remove(full)
		}
	}
	w.WriteHeader(204)
}
