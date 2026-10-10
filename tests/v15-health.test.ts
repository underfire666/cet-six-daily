import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import packageJson from "../package.json";
import {
  checkDatabaseReadiness,
  createReadinessHandler,
  healthResponse,
  REQUIRED_DATABASE_TABLES,
  type ReadinessQueryClient,
} from "../src/lib/deployment/health";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function queryClient(rows: unknown, inspect?: (query: Prisma.Sql) => void): ReadinessQueryClient {
  return {
    async $queryRaw<T>(query: Prisma.Sql): Promise<T> {
      inspect?.(query);
      return rows as T;
    },
  };
}

test("liveness returns the application version with no caching or database dependency", async () => {
  const response = healthResponse();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { status: "ok", version: packageJson.version });
});

test("readiness succeeds only after a successful probe and disables caching", async () => {
  let calls = 0;
  const response = await createReadinessHandler(async () => { calls += 1; return true; })();
  assert.equal(calls, 1);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { status: "ready", version: packageJson.version });
});

test("missing schema yields unavailable, not a successful empty-database check", async () => {
  const response = await createReadinessHandler(async () => false)();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { status: "unavailable", version: packageJson.version });
});

test("database exceptions reveal no URL, credentials, user data, or stack trace", async () => {
  const response = await createReadinessHandler(async () => {
    throw new Error("postgres://admin:secret@internal/users user@example.test");
  })();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "unavailable", version: packageJson.version });
});

test("a synchronous probe failure also produces only the public unavailable response", async () => {
  const response = await createReadinessHandler(() => { throw new Error("private failure"); })();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "unavailable", version: packageJson.version });
});

test("a stalled probe returns 503 within its response budget", async () => {
  const probe = deferred<boolean>();
  const handler = createReadinessHandler(() => probe.promise, { timeoutMs: 15 });
  const response = await handler();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "unavailable", version: packageJson.version });
  probe.resolve(true);
});

test("concurrent requests share one database probe", async () => {
  const probe = deferred<boolean>();
  let calls = 0;
  const handler = createReadinessHandler(() => { calls += 1; return probe.promise; });
  const first = handler();
  const second = handler();
  await Promise.resolve();
  assert.equal(calls, 1);
  probe.resolve(true);
  const responses = await Promise.all([first, second]);
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
});

test("timed-out probes remain shared, so repeated requests cannot accumulate stuck queries", async () => {
  const probe = deferred<boolean>();
  let calls = 0;
  const handler = createReadinessHandler(() => { calls += 1; return probe.promise; }, { timeoutMs: 10 });
  assert.equal((await handler()).status, 503);
  assert.equal((await handler()).status, 503);
  assert.equal(calls, 1);
  // This late rejection is handled even though both public requests have ended.
  probe.reject(new Error("delayed secret"));
  await new Promise<void>((resolve) => setImmediate(resolve));
});

test("a settled probe is not cached and the following request checks the database again", async () => {
  let calls = 0;
  const handler = createReadinessHandler(async () => { calls += 1; return calls === 1; });
  assert.equal((await handler()).status, 200);
  assert.equal((await handler()).status, 503);
  assert.equal(calls, 2);
});

test("a database error can recover on a subsequent request", async () => {
  let calls = 0;
  const handler = createReadinessHandler(async () => {
    calls += 1;
    if (calls === 1) throw new Error("temporary connection failure");
    return true;
  });
  assert.equal((await handler()).status, 503);
  assert.equal((await handler()).status, 200);
});

test("the production schema probe checks connectivity and all required tables without reading user rows", async () => {
  let calls = 0;
  const ready = await checkDatabaseReadiness(queryClient([{ connected: 1, schema_ready: true }], (query) => {
    calls += 1;
    assert.match(query.text, /SELECT 1 AS connected/);
    assert.match(query.text, /to_regclass/);
    assert.match(query.text, /current_schema\(\)/);
    assert.doesNotMatch(query.text, /INSERT|UPDATE|DELETE|passwordHash|email/i);
    assert.deepEqual(query.values, [...REQUIRED_DATABASE_TABLES]);
    for (const table of ["User", "PrivatePaper", "PrivateReviewProgress", "ReviewItem"] as const) {
      assert.ok(query.values.includes(table));
    }
  }));
  assert.equal(calls, 1);
  assert.equal(ready, true);
});

test("an unmigrated or partly migrated schema fails the production probe", async () => {
  assert.equal(await checkDatabaseReadiness(queryClient([{ connected: 1, schema_ready: false }])), false);
});

test("empty or malformed database results cannot accidentally report readiness", async () => {
  for (const rows of [[], [{ connected: 0, schema_ready: true }], [{ connected: 1 }], [{ connected: 1, schema_ready: "true" }]]) {
    assert.equal(await checkDatabaseReadiness(queryClient(rows)), false);
  }
});

test("production query errors become the same minimal 503 response", async () => {
  const client: ReadinessQueryClient = {
    async $queryRaw<T>(): Promise<T> { throw new Error("host credential database failure"); },
  };
  const response = await createReadinessHandler(() => checkDatabaseReadiness(client))();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "unavailable", version: packageJson.version });
});
