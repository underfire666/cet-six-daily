import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "output/**", "next-env.d.ts", "tests/v13-final-viewport-a11y.js", "tests/v13-conflict-merge-e2e.js"]),
]);
