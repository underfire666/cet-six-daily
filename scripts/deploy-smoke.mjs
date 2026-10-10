import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const options = { baseUrl: "http://127.0.0.1:3180", phase: "full", expectedVersion: "15.0.0", readOnly: false };
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--read-only") options.readOnly = true;
  else if (["--base-url", "--phase", "--state-file", "--expected-version"].includes(arg)) {
    const value = args[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
    options[{ "--base-url": "baseUrl", "--phase": "phase", "--state-file": "stateFile", "--expected-version": "expectedVersion" }[arg]] = value;
  } else throw new Error("Usage: node scripts/deploy-smoke.mjs [--base-url URL] [--read-only] [--phase pre-migration|full|after-restart] [--state-file PATH] [--expected-version VERSION]");
}

const base = new URL(options.baseUrl);
assert.ok(["http:", "https:"].includes(base.protocol) && !base.username && !base.password && !base.search && !base.hash, "Use an HTTP(S) site URL without credentials or query parameters");
assert.ok(["pre-migration", "full", "after-restart"].includes(options.phase), "Unknown smoke phase");
if (!options.readOnly && options.phase !== "pre-migration") {
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname), "Write smoke tests are restricted to a loopback site");
  assert.equal(process.env.DEPLOY_SMOKE_ISOLATED_TEST_DB, "1", "Write smoke tests require an explicitly isolated temporary database");
  assert.ok(options.stateFile, "Write smoke tests require a private temporary state file");
}

const checks = [];
function passed(label) { checks.push(label); console.log(`PASS ${label}`); }
function status(response, expected, label) {
  assert.equal(response.status, expected, `${label}: unexpected HTTP status`);
  passed(label);
}
function client(initialCookies = []) {
  const cookies = new Map(initialCookies);
  return {
    cookies,
    async call(path, init = {}) {
      const target = new URL(path, base);
      assert.equal(target.origin, base.origin, "Smoke requests must stay on the selected site");
      const headers = new Headers(init.headers);
      if (cookies.size) headers.set("cookie", [...cookies].map(([key, value]) => `${key}=${value}`).join("; "));
      let response;
      try {
        response = await fetch(target, { ...init, headers, redirect: "manual", signal: AbortSignal.timeout(12_000) });
      } catch {
        throw new Error(`${init.method ?? "GET"} ${target.pathname}: request failed`);
      }
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(";", 1)[0];
        const separator = pair.indexOf("=");
        if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
      }
      return response;
    },
  };
}
function json(body) {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}
async function waitForStatus(path, expected) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await anonymous.call(path);
      if (response.status === expected) return response;
      await response.arrayBuffer();
    } catch { /* Startup and restart can temporarily refuse connections. */ }
    await sleep(1_000);
  }
  throw new Error(`${path}: service did not reach HTTP ${expected}`);
}
async function checkHealthAndReadiness(expectedReady) {
  const health = await waitForStatus("/api/health", 200);
  assert.match(health.headers.get("cache-control") ?? "", /no-store/, "Liveness must not be cached");
  const healthBody = await health.json();
  assert.equal(healthBody.status, "ok", "Liveness payload");
  assert.equal(healthBody.version, options.expectedVersion, "Liveness application version");
  passed("liveness and application version");
  const ready = await waitForStatus("/api/ready", expectedReady);
  assert.match(ready.headers.get("cache-control") ?? "", /no-store/, "Readiness must not be cached");
  const readyBody = await ready.json();
  assert.deepEqual(Object.keys(readyBody).sort(), ["status", "version"], "Readiness must not disclose connection details");
  assert.equal(readyBody.status, expectedReady === 200 ? "ready" : "unavailable", "Readiness payload");
  assert.equal(readyBody.version, options.expectedVersion, "Readiness application version");
  passed(expectedReady === 200 ? "database schema is ready" : "empty database remains unready");
}
async function publicSmoke() {
  const pages = new Map();
  for (const path of ["/", "/practice/exams", "/me/about"]) {
    const response = await anonymous.call(path);
    status(response, 200, `public page ${path}`);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/, `HTML page ${path}`);
    pages.set(path, await response.text());
  }
  // AccountResetGate renders a loading shell in initial HTML. The hydrated
  // About version is verified separately by the real-browser acceptance check;
  // the HTTP smoke verifies the application version through /api/health.
  const assets = [...pages.get("/").matchAll(/(?:src|href)="([^"]*\/_next\/static\/[^"]+)"/g)].map((match) => match[1].replaceAll("&amp;", "&"));
  for (const [extension, contentType] of [["js", /javascript/], ["css", /text\/css/]]) {
    const asset = assets.find((path) => new RegExp(`\\.${extension}(?:\\?|$)`).test(path));
    assert.ok(asset, `Production HTML references ${extension} assets`);
    const response = await anonymous.call(asset);
    status(response, 200, `production ${extension} asset`);
    assert.match(response.headers.get("content-type") ?? "", contentType, `${extension} asset content type`);
    assert.ok((await response.arrayBuffer()).byteLength > 20, `${extension} asset is populated`);
  }
  const audio = await anonymous.call("/audio/cet6/2026-06-2/g7.mp3", { headers: { range: "bytes=0-1023" } });
  status(audio, 206, "real listening audio range request");
  assert.match(audio.headers.get("content-range") ?? "", /^bytes 0-1023\/\d+$/, "Audio Content-Range");
  assert.match(audio.headers.get("content-type") ?? "", /^audio\//, "Audio content type");
  const bytes = new Uint8Array(await audio.arrayBuffer());
  assert.equal(bytes.byteLength, 1024, "Audio range byte count");
  assert.ok((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0), "Real audio contains an MP3 header");
  passed("real MP3 data is present");
  for (const path of ["/api/private-papers", "/api/sync/pull"]) {
    const response = await anonymous.call(path);
    status(response, 401, `anonymous guard ${path}`);
    await response.arrayBuffer();
  }
  const deniedPush = await anonymous.call("/api/sync/push", json({ mutations: [] }));
  status(deniedPush, 401, "anonymous sync write guard");
  await deniedPush.arrayBuffer();
}
async function login(user, credentials) {
  const csrf = await user.call("/api/auth/csrf");
  status(csrf, 200, "credentials CSRF endpoint");
  const { csrfToken } = await csrf.json();
  assert.ok(typeof csrfToken === "string" && csrfToken.length > 0, "CSRF token exists");
  const callback = await user.call("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" },
    body: new URLSearchParams({ csrfToken, email: credentials.email, password: credentials.password, callbackUrl: base.href }),
  });
  status(callback, 200, "credentials sign-in response");
  await callback.arrayBuffer();
  const response = await user.call("/api/auth/session");
  status(response, 200, "authenticated session endpoint");
  const session = await response.json();
  assert.ok(session.user?.id === credentials.id && session.user?.email === credentials.email, "Signed-in identity matches the temporary test account");
  passed("credentials sign-in establishes the correct session");
}
async function pullSettings(user, expected) {
  const response = await user.call("/api/sync/pull");
  status(response, 200, "authenticated sync pull");
  const data = await response.json();
  assert.ok(data.settings?.userId === expected.id, "Sync settings belong to the signed-in test owner");
  assert.ok(data.settings?.payload?.deploymentSmoke === expected.marker, "Synced settings survive write and read");
  passed("owner-scoped synced settings round-trip");
}
async function writeSmoke() {
  const credentials = { email: `v15-deploy-${randomUUID()}@test.invalid`, password: randomBytes(24).toString("hex") };
  const response = await anonymous.call("/api/auth/register", json({ ...credentials, confirmPassword: credentials.password }));
  status(response, 201, "temporary account registration");
  const registered = await response.json();
  assert.ok(typeof registered.id === "string" && registered.id.length > 0 && registered.email === credentials.email, "Registration returns a test owner identity");
  credentials.id = registered.id;
  const user = client();
  await login(user, credentials);
  const marker = randomUUID();
  const mutationId = randomUUID();
  const mutations = [{ mutationId, entityType: "settings", entityId: "me", operation: "upsert", payload: { payload: { deploymentSmoke: marker } } }];
  const pushed = await user.call("/api/sync/push", json({ mutations }));
  status(pushed, 200, "authenticated sync push");
  const pushedBody = await pushed.json();
  assert.deepEqual(pushedBody.applied, [mutationId], "Sync mutation is applied once");
  assert.deepEqual(pushedBody.skipped, [], "First sync mutation is not skipped");
  await pullSettings(user, { id: credentials.id, marker });
  const repeated = await user.call("/api/sync/push", json({ mutations }));
  status(repeated, 200, "repeated sync push");
  const repeatedBody = await repeated.json();
  assert.deepEqual(repeatedBody.applied, [], "Repeated mutation is not reapplied");
  assert.deepEqual(repeatedBody.skipped, [mutationId], "Repeated mutation is skipped idempotently");
  passed("sync mutation idempotency");
  await writeFile(resolve(options.stateFile), JSON.stringify({ ...credentials, marker, cookies: [...user.cookies] }), { mode: 0o600 });
  passed("private restart state saved outside the repository");
}
async function restartSmoke() {
  const state = JSON.parse(await readFile(resolve(options.stateFile), "utf8"));
  const original = client(state.cookies);
  const response = await original.call("/api/auth/session");
  status(response, 200, "session after process restart");
  const session = await response.json();
  assert.ok(session.user?.id === state.id, "The original session survives a restart with the same runtime secret");
  passed("original session survives restart");
  await pullSettings(original, state);
  const fresh = client();
  await login(fresh, state);
  await pullSettings(fresh, state);
  passed("registered account and synced data survive database and application restart");
}

const anonymous = client();
async function main() {
  if (options.phase === "pre-migration") {
    await checkHealthAndReadiness(503);
  } else {
    await checkHealthAndReadiness(200);
    await publicSmoke();
    if (!options.readOnly) {
      if (options.phase === "after-restart") await restartSmoke();
      else await writeSmoke();
    }
  }
  console.log(`Deployment smoke ${options.readOnly ? "read-only " : ""}${options.phase}: ${checks.length} checks passed.`);
}
main().catch((error) => {
  // Do not print assertion details that could contain a session cookie or secret.
  console.error(`Deployment smoke failed: ${error instanceof Error ? error.message.split("\n", 1)[0] : "unexpected error"}`);
  process.exitCode = 1;
});
