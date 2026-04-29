import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const noHardcodedZhJsx = require("./eslint-rules/no-hardcoded-zh-jsx.js");

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Phase A: warn-only on hardcoded Chinese in JSX. Phase L flips to "error".
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/i18n/zh-CN.ts", "src/**/__tests__/**"],
    plugins: {
      "ket-pet": { rules: { "no-hardcoded-zh-jsx": noHardcodedZhJsx } },
    },
    rules: {
      "ket-pet/no-hardcoded-zh-jsx": "warn",
    },
  },
]);

export default eslintConfig;
