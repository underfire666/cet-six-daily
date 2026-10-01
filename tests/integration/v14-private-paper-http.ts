/** Run against a local production server: npx tsx tests/integration/v14-private-paper-http.ts */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/db/prisma";
const base = process.env.PRIVATE_TEST_URL ?? "http://127.0.0.1:3015";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "local server only");
const users: string[] = [], results: string[] = [];
function client() {
  const cookies = new Map<string, string>();
  return async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers); headers.set("cookie", [...cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    const r = await fetch(base + path, { ...init, headers, redirect: "manual" }).catch(error => { throw new Error(`${init.method ?? "GET"} ${path}: ${error.cause?.code ?? error.message}`); });
    for (const cookie of r.headers.getSetCookie()) { const pair = cookie.split(";")[0], i = pair.indexOf("="); cookies.set(pair.slice(0, i), pair.slice(i + 1)); }
    return r;
  };
}
async function login() {
  const email = `private-http-${randomUUID()}@example.invalid`, password = randomUUID();
  const user = await prisma.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 4) } }); users.push(user.id);
  const call = client(), csrf = await (await call("/api/auth/csrf")).json();
  await call("/api/auth/callback/credentials", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, callbackUrl: base }) });
  const session = await (await call("/api/auth/session")).json(); assert.equal(session.user?.id, user.id, "real session login");
  return { call, user };
}
function json(body: unknown): RequestInit { return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }; }
function status(response: Response, expected: number, label: string) { assert.equal(response.status, expected, label); results.push(`${label}: ${expected}`); }
async function main() {
  try {
    const anonymous = client();
    for (const [path, method] of [["/api/private-papers", "GET"], ["/api/private-papers", "POST"], ["/api/private-papers/private:x:y", "GET"], ["/api/private-papers/private:x:y", "PUT"], ["/api/private-papers/private:x:y", "DELETE"]]) status(await anonymous(path, { method }), 401, `anonymous ${method}`);
    const a = await login(), b = await login();
    for (const localPaperId of ["paper%", "paper%25", "中文卷", "with space"]) {
      const r = await a.call("/api/private-papers", json({ localPaperId, title: "HTTP draft", ownerId: b.user.id, content: { schemaVersion: "1.0.0", sections: [], ownerId: b.user.id }, rightsAcknowledgement: { acknowledged: true, statementVersion: "1.0", acknowledgedAt: "forged" } }));
      status(r, 201, `create ${localPaperId}`); const p = await r.json(); const path = `/api/private-papers/${encodeURIComponent(p.paperId)}`;
      const get = await a.call(path); status(get, 200, `read ${localPaperId}`); const stored = (await get.json()).paper;
      assert.equal(stored.content.ownerId, a.user.id); assert.ok(!p.paperId.includes(a.user.id)); assert.ok(Number.isFinite(Date.parse(stored.content.rightsAcknowledgement.acknowledgedAt)));
      for (const method of ["GET", "PUT", "DELETE"]) status(await b.call(path, { ...json({ title: "forged" }), method, body: method === "PUT" ? JSON.stringify({ title: "forged" }) : undefined }), 404, `other owner ${method}`);
      status(await a.call(path, { ...json({ content: { title: "Updated" } }), method: "PUT" }), 200, `update ${localPaperId}`);
      const updated = (await (await a.call(path)).json()).paper; assert.equal(updated.title, "Updated"); assert.equal(updated.content.title, "Updated");
      status(await a.call(path, { method: "DELETE" }), 200, `delete ${localPaperId}`);
      status(await a.call(path), 404, "deleted record");
    }
    status(await a.call("/api/private-papers", { method: "POST", body: "{" }), 400, "invalid JSON");
    status(await a.call("/api/private-papers", json([])), 400, "array body");
    for (const method of ["POST", "PUT"]) {
      const path = method === "POST" ? "/api/private-papers" : "/api/private-papers/private:x:y";
      status(await a.call(path, { method, body: " ".repeat(1048577) }), 413, `oversize ${method}`);
      let remaining = 18;
      const body = new ReadableStream<Uint8Array>({ pull(c) { if (remaining-- > 0) c.enqueue(new Uint8Array(65536).fill(32)); else c.close(); } });
      status(await a.call(path, { method, body, duplex: "half" } as RequestInit), 413, `chunked oversize ${method}`);
    }
    status(await a.call("/api/private-papers", json({ localPaperId: "invalid", title: "bad", content: { schemaVersion: 1, sections: "bad" }, rightsAcknowledgement: { acknowledged: true, statementVersion: "1.0" } })), 422, "malformed structure");
    console.log(JSON.stringify({ result: "PASS", checks: results.length, results }, null, 2));
  } finally {
    for (const id of users) await prisma.user.delete({ where: { id } });
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "HTTP acceptance failed"); process.exitCode = 1; });
