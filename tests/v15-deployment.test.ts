import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { validateDeploymentEnv } from "../scripts/deploy-check.mjs";

const valid = {
  DATABASE_URL: "postgresql://cet:strong-db-password@db.internal:5432/cet_daily?schema=public",
  AUTH_SECRET: "a-unique-random-production-secret-of-64-characters-0123456789abcdef",
  AUTH_URL: "https://cet-demo.onrender.com",
  AUTH_TRUST_HOST: "true",
  NODE_ENV: "production",
};

test("V15 deployment accepts managed PostgreSQL and a configured HTTPS origin", () => {
  assert.deepEqual(validateDeploymentEnv(valid), { ok: true, errors: [] });
});
test("V15 self-hosted PostgreSQL may use loopback", () => {
  assert.equal(validateDeploymentEnv({ ...valid, DATABASE_URL: "postgresql://cet:db-password@localhost:5432/cet" }).ok, true);
});
test("V15 environment rejects missing settings without leaking provided secrets", () => {
  const credentials = "secret-account-password";
  const result = validateDeploymentEnv({ DATABASE_URL: `https://u:${credentials}@db.invalid` });
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 5);
  assert.equal(JSON.stringify(result).includes(credentials), false);
});
test("V15 refuses placeholder database, secret, and origin values", () => {
  for (const changes of [
    { DATABASE_URL: "postgresql://user:replace-with-password@db.internal:5432/cet" },
    { AUTH_SECRET: "replace-with-a-very-long-random-secret" },
    { AUTH_URL: "https://your-app.onrender.com" },
  ]) assert.equal(validateDeploymentEnv({ ...valid, ...changes }).ok, false);
});
test("V15 database URLs require PostgreSQL, credentials and a database name", () => {
  for (const DATABASE_URL of ["", "not-a-url", "mysql://u:p@db/cet", "postgresql://db/cet", "postgresql://u:p@db/"]) {
    assert.equal(validateDeploymentEnv({ ...valid, DATABASE_URL }).ok, false);
  }
});
test("V15 HTTPS origin rejects credentials, queries, and fragments", () => {
  for (const AUTH_URL of ["http://cet-demo.onrender.com", "https://u:p@cet-demo.onrender.com", "https://cet-demo.onrender.com?a=1", "https://cet-demo.onrender.com/#x"]) {
    assert.equal(validateDeploymentEnv({ ...valid, AUTH_URL }).ok, false);
  }
});
test("V15 local HTTP preview requires the explicit flag and a loopback host", () => {
  for (const AUTH_URL of ["http://localhost:3055", "http://127.0.0.1:3055", "http://[::1]:3055"]) {
    assert.equal(validateDeploymentEnv({ ...valid, AUTH_URL }).ok, false);
    assert.equal(validateDeploymentEnv({ ...valid, AUTH_URL }, { allowLocal: true }).ok, true);
  }
  assert.equal(validateDeploymentEnv({ ...valid, AUTH_URL: "http://public-host.invalid" }, { allowLocal: true }).ok, false);
});
test("V15 local preview still enforces auth and database requirements", () => {
  assert.equal(validateDeploymentEnv({ ...valid, AUTH_URL: "http://localhost:3055", AUTH_SECRET: "short" }, { allowLocal: true }).ok, false);
  assert.equal(validateDeploymentEnv({ ...valid, AUTH_TRUST_HOST: "false" }).ok, false);
  assert.equal(validateDeploymentEnv({ ...valid, NODE_ENV: "development" }).ok, false);
});
test("V15 port must fit the TCP port range", () => {
  for (const PORT of ["0", "65536", "3.5", "abc", "-1", ""]) assert.equal(validateDeploymentEnv({ ...valid, PORT }).ok, false);
  for (const PORT of ["1", "3000", "65535"]) assert.equal(validateDeploymentEnv({ ...valid, PORT }).ok, true);
});
test("V15 start wrapper refuses invalid configuration before opening a server", () => {
  const marker = "do-not-print-this-private-secret";
  const child = spawnSync(process.execPath, ["scripts/start-production.mjs", "--standalone"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: `invalid:${marker}`, AUTH_SECRET: marker, AUTH_URL: "invalid" },
    encoding: "utf8", timeout: 10_000,
  });
  assert.equal(child.status, 1);
  assert.match(child.stderr, /DATABASE_URL/);
  assert.equal(`${child.stdout}${child.stderr}`.includes(marker), false);
});
