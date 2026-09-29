import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "output/**", "next-env.d.ts", "tests/v13-final-viewport-a11y.js", "tests/v13-conflict-merge-e2e.js", "tests/v13-conflict-merge-v3.js", "tests/v13-guest-migration-paper.js", "tests/v13-user-isolation-paper.js", "tests/v13-keyboard-smoke.js", "tests/v13-diag-login.js", "tests/v13-register.js"]),
]);
