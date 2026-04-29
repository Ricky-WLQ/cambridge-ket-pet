import { defineConfig } from "vitest/config";
import { createRequire } from "node:module";
import path from "node:path";

const req = createRequire(import.meta.url);

// Under vitest (plain Node, no Next.js server/client split) the throwing
// `server-only` marker is inappropriate — it exists purely to let Next.js
// catch accidental client-side imports at build time. Point it at the
// package's own no-op variant (the same file Next.js resolves through the
// "react-server" export condition). We still rely on Next's build-time
// enforcement in production.
const serverOnlyMain = req.resolve("server-only");
const serverOnlyEmpty = path.join(path.dirname(serverOnlyMain), "empty.js");

export default defineConfig({
  test: {
    // jsdom for React component tests (PortalProvider, Mascot, snapshot tests
    // for portal hubs in Phase B+). Pure-Node tests like voice.test.ts work
    // under jsdom too — there's no need for a per-file environment override.
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "server-only": serverOnlyEmpty,
      // Mirror the Next.js / tsconfig "@/*" path alias so vitest resolves
      // imports like `@/lib/speaking/photo-library` the same way the app does
      // at build time. Vite's built-in tsconfig-paths support is inconsistent
      // across filename shapes (hyphens, nested dirs), so we set this
      // explicitly.
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
