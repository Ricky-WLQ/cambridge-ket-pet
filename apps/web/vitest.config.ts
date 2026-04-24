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
  resolve: {
    alias: {
      "server-only": serverOnlyEmpty,
    },
  },
});
