import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const baseSecurityHeaders = {
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  // No HSTS in dev: it's served over plain http://localhost, and HSTS is
  // meaningless (and can be actively confusing) outside of a real TLS
  // deployment.
};

// Strict CSP for `vite preview` (serves the built dist/ output, same as
// production - no inline scripts needed).
const previewHeaders = {
  ...baseSecurityHeaders,
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
};

// Relaxed CSP for the dev server ONLY. Vite's dev mode injects an inline
// <script type="module"> HMR client bootstrap, and @vitejs/plugin-react-swc
// injects an inline React Fast Refresh preamble - both are blocked by a
// strict script-src 'self' policy, which breaks local dev with a blank
// page and a "can't detect preamble" console error. This does NOT apply to
// the production build (see public/_headers and vercel.json, which stay
// strict) or to `vite preview` above.
const devHeaders = {
  ...baseSecurityHeaders,
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co ws://localhost:* http://localhost:*; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    headers: devHeaders,
  },
  preview: {
    headers: previewHeaders,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
