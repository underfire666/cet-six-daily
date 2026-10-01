import test from "node:test";
import assert from "node:assert/strict";
import { validatePrivateDraft } from "../src/content/private-paper-validation";
import { PRIVATE_BODY_LIMIT, readPrivateBody, privateErrorResponse, privateRequest } from "../src/lib/private-papers/http";
import { PrivatePaperStoreError, derivePrivateOwnerNamespace } from "../src/content/private-paper-store";
const draft = (sections: unknown = []) => ({ schemaVersion: "1.0.0", isPartial: true, sections });
const question = () => ({ questionId: "q", order: 0, type: "choice", prompt: "Question", options: [{ id: "A", text: "Answer" }], answerId: "A" });
function paper(q: Record<string, unknown> = question()) { return { schemaVersion: "1.0.0", sections: [{ sectionId: "s", order: 0, type: "reading", groups: [{ groupId: "g", order: 0, type: "careful_reading", questions: [q] }] }] }; }
test("private drafts accept incomplete arrays without official-paper counts", () => { assert.deepEqual(validatePrivateDraft(draft()), []); assert.deepEqual(validatePrivateDraft(paper()), []); });
for (const sections of [null, {}, "bad", [null], [{ sectionId: "s", order: 0, type: "reading", groups: {} }]]) {
  test(`reject malformed sections ${JSON.stringify(sections)}`, () => assert.ok(validatePrivateDraft(draft(sections)).length));
}
for (const patch of [{ options: {} }, { options: [{ id: "A", text: "a" }, { id: "A", text: "b" }] }, { answerId: "B" }, { answerKey: [] }, { order: -1 }, { explanation: {} }]) {
  test(`reject malformed question ${JSON.stringify(patch)}`, () => assert.ok(validatePrivateDraft(paper({ ...question(), ...patch })).length));
}
test("reject unsupported schema and duplicate question ids", () => {
  assert.ok(validatePrivateDraft({ ...draft(), schemaVersion: "99" }).length);
  const p = paper(); p.sections[0].groups[0].questions.push(question()); assert.ok(validatePrivateDraft(p).length);
});
test("validate assets and question references", () => {
  const p = draft([{ sectionId: "s", order: 0, type: "listening", groups: [{ groupId: "g", order: 0, type: "lecture", assetIds: ["missing"], questionRefs: [{ contentId: 5, order: 0 }] }] }]);
  assert.ok(validatePrivateDraft(p).length >= 2);
});
test("opaque owner namespace is full, stable and separated", () => {
  const a = derivePrivateOwnerNamespace("owner-a"); assert.match(a, /^[a-f0-9]{64}$/); assert.equal(a, derivePrivateOwnerNamespace("owner-a")); assert.notEqual(a, derivePrivateOwnerNamespace("owner-b")); assert.ok(!a.includes("owner-a"));
});
function request(body: string, headers?: Record<string, string>) { return new Request("http://localhost/api/private-papers", { method: "POST", body, headers }); }
test("body parser rejects invalid JSON and nonobject JSON", async () => { for (const body of ["{", "null", "[]", "42"]) await assert.rejects(readPrivateBody(request(body)), { status: 400 }); });
test("body size counts UTF-8 bytes", async () => { await assert.rejects(readPrivateBody(request(JSON.stringify({ title: "中".repeat(PRIVATE_BODY_LIMIT / 2) }))), { status: 413 }); });
for (const headers of [undefined, { "content-length": "1" }, { "content-length": String(PRIVATE_BODY_LIMIT + 1) }]) {
  test(`oversized body rejected with headers ${JSON.stringify(headers)}`, async () => { await assert.rejects(readPrivateBody(request(" ".repeat(PRIVATE_BODY_LIMIT + 1), headers)), { status: 413 }); });
}
test("chunked body limit cancels before consuming remainder", async () => {
  let cancelled = false, reads = 0;
  const stream = new ReadableStream<Uint8Array>({ pull(c) { reads++; c.enqueue(new Uint8Array(65536)); }, cancel() { cancelled = true; } });
  const req = new Request("http://localhost", { method: "PUT", body: stream, duplex: "half" } as RequestInit);
  await assert.rejects(readPrivateBody(req), { status: 413 }); assert.ok(cancelled); assert.ok(reads <= 19);
});
test("body exactly at byte limit accepted", async () => { const body = '{"x":"' + "a".repeat(PRIVATE_BODY_LIMIT - 8) + '"}'; assert.equal(Buffer.byteLength(body), PRIVATE_BODY_LIMIT); assert.ok(await readPrivateBody(request(body))); });
test("all storage error status codes remain distinct", () => { for (const [code, status] of Object.entries({ UNAUTHORIZED: 401, NOT_FOUND: 404, VALIDATION_ERROR: 422, DUPLICATE_ID: 409, INTERNAL_ERROR: 500 })) assert.equal(privateErrorResponse(new PrivatePaperStoreError(code as PrivatePaperStoreError["code"], "test")).status, status); });
test("missing session blocks parsing and owner comes from session", async () => {
  let calls = 0;
  assert.equal((await privateRequest(async () => null, async () => { calls++; return Response.json({}); })).status, 401); assert.equal(calls, 0);
  const r = await privateRequest(async () => ({ user: { id: "server-owner" } }), async owner => Response.json({ owner })); assert.deepEqual(await r.json(), { owner: "server-owner" });
});
test("auth and route parameter failures become 500", async () => { assert.equal((await privateRequest(async () => { throw Error("session failure"); }, async () => Response.json({}))).status, 500); assert.equal((await privateRequest(async () => ({ user: { id: "a" } }), async () => { throw Error("params failure"); })).status, 500); });
