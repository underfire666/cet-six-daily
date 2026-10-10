import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateDeploymentEnv } from "./deploy-check.mjs";

const args = process.argv.slice(2);
if (args.some((argument) => !["--allow-local", "--standalone"].includes(argument))) {
  console.error("Usage: node scripts/start-production.mjs [--standalone] [--allow-local]");
  process.exit(1);
}

const env = { ...process.env, NODE_ENV: "production", HOSTNAME: process.env.HOSTNAME || "0.0.0.0", PORT: process.env.PORT || "3000" };
const checked = validateDeploymentEnv(env, { allowLocal: args.includes("--allow-local") });
if (!checked.ok) {
  for (const error of checked.errors) console.error(error);
  process.exit(1);
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let entry;
let cwd = projectRoot;
let childArgs = [];
if (args.includes("--standalone")) {
  const candidates = [resolve(projectRoot, "server.js"), resolve(projectRoot, ".next/standalone/server.js")];
  entry = candidates.find((candidate) => existsSync(candidate));
  if (!entry) {
    console.error("Standalone build is missing. Run npm run build and npm run deploy:prepare first.");
    process.exit(1);
  }
  cwd = dirname(entry);
} else {
  const require = createRequire(import.meta.url);
  entry = require.resolve("next/dist/bin/next");
  childArgs = ["start", "--hostname", env.HOSTNAME, "--port", env.PORT];
}

const child = spawn(process.execPath, [entry, ...childArgs], { cwd, env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", () => {
  console.error("Production server could not start.");
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal === "SIGINT" || signal === "SIGTERM" ? 0 : 1);
});
