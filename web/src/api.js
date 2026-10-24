// In dev the Go server runs on :8080. In production set VITE_API_URL at build
// time, or leave it empty when the Go server serves this app itself.
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? 'http://localhost:8080' : '');
