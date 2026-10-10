import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const placeholder = /replace-with|change-me|changeme|your-database-host|your-app\.|example\.com|example\.invalid/i;

/**
 * Validate deployment settings without returning or logging their values.
 * Loopback PostgreSQL is valid for self-hosting; local HTTP needs an explicit flag.
 * @param {Record<string, string | undefined>} env
 * @param {{ allowLocal?: boolean }} options
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateDeploymentEnv(env, { allowLocal = false } = {}) {
  const errors = [];
  try {
    const database = new URL(env.DATABASE_URL ?? "");
    if (!["postgres:", "postgresql:"].includes(database.protocol)
      || !database.hostname || !database.username || !database.password
      || database.pathname.length <= 1 || database.hash
      || placeholder.test(env.DATABASE_URL ?? "")) {
      errors.push("DATABASE_URL must be a complete PostgreSQL URL with real database credentials.");
    }
  } catch {
    errors.push("DATABASE_URL must be a complete PostgreSQL URL with real database credentials.");
  }

  if (!env.AUTH_SECRET || env.AUTH_SECRET.trim().length < 32 || placeholder.test(env.AUTH_SECRET)) {
    errors.push("AUTH_SECRET must be a new random secret of at least 32 characters.");
  }

  try {
    const auth = new URL(env.AUTH_URL ?? "");
    const isLocal = loopbackHosts.has(auth.hostname.toLowerCase());
    const allowedProtocol = auth.protocol === "https:" || (allowLocal && isLocal && auth.protocol === "http:");
    if (!allowedProtocol || !auth.hostname || auth.username || auth.password || auth.search || auth.hash
      || (isLocal && !allowLocal) || placeholder.test(env.AUTH_URL ?? "")) {
      errors.push("AUTH_URL must be the site's HTTPS URL; loopback preview URLs require --allow-local.");
    }
  } catch {
    errors.push("AUTH_URL must be the site's HTTPS URL; loopback preview URLs require --allow-local.");
  }

  if (env.AUTH_TRUST_HOST !== "true") {
    errors.push("AUTH_TRUST_HOST must be true for the configured trusted deployment proxy.");
  }
  if (env.NODE_ENV !== "production") {
    errors.push("NODE_ENV must be production.");
  }
  const port = env.PORT ?? "3000";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    errors.push("PORT must be an integer between 1 and 65535.");
  }
  return { ok: errors.length === 0, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== "--allow-local")) {
    console.error("Usage: node scripts/deploy-check.mjs [--allow-local]");
    process.exitCode = 1;
  } else {
    const result = validateDeploymentEnv(process.env, { allowLocal: args.includes("--allow-local") });
    if (!result.ok) {
      for (const error of result.errors) console.error(error);
      process.exitCode = 1;
    } else {
      console.log(args.includes("--allow-local")
        ? "Local production-preview environment check passed (not a public deployment)."
        : "Production environment check passed.");
    }
  }
}
