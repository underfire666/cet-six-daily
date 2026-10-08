/**
 * V14 Phase 1E.2: Private Wrongbook Review Progress Cloud Sync tests.
 * Real Prisma with isolated random users. No DB mocking.
 * Covers: startPrivateReviewBatch, readPrivateReviewProgressSnapshot,
 * savePrivateReviewProgress, submitPrivateReviewProgress, CAS revision,
 * batch mismatch, content changed, cross-owner isolation, validation.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrivateReviewController } from "../src/lib/private-papers/review-controller";
import { parseReviewSnapshot, reconcileReview } from "../src/lib/private-papers/review-sync";
import { parsePrivateReviewStart, type PrivateReviewSession } from "../src/lib/private-papers/review";
import { listPrivateWrongItems, countPrivateWrongItemViews } from "../src/content/private-wrong-item-store";
import { prisma } from "../src/lib/db/prisma";
import { computePrivateContentHash } from "../src/lib/private-papers/readiness";
import { createPrivatePaper, updatePrivatePaper } from "../src/content/private-paper-store";
import { putPrivatePaperProgress as writeProgress } from "../src/content/private-paper-progress-store";
import {
  startPrivateReviewBatch,
  readPrivateReviewProgressSnapshot,
  savePrivateReviewProgress,
  submitPrivateReviewProgress,
  PrivateReviewProgressStoreError,
} from "../src/content/private-review-progress-store";

async function createTestUser(prefix: string) {
  const id = randomUUID();
  return prisma.user.create({ data: { email: `${prefix}-${id}@example.invalid`, passwordHash: "test-only" } });
}

function makeRightsAck() {
  return { acknowledged: true, acknowledgedAt: new Date().toISOString(), statementVersion: "1.0" };
}

function makeReadyContent(questionCount = 3): Record<string, unknown> {
  const questions = [];
  for (let i = 0; i < questionCount; i++) {
    questions.push({
      questionId: `q${i + 1}`, order: i, prompt: `Question ${i + 1}?`, type: "choice",
      options: [{ id: "A", text: "Opt A" }, { id: "B", text: "Opt B" }, { id: "C", text: "Opt C" }, { id: "D", text: "Opt D" }],
      answerId: "A", shortExplanation: `Explanation ${i + 1}`,
    });
  }
  return {
    schemaVersion: 1, isPartial: false,
    sections: [{
      sectionId: "reading-1", type: "reading", order: 0,
      groups: [{ groupId: "careful-1", type: "careful_reading", order: 0, passage: "Test passage.", questions }],
    }],
  };
}

async function createReadyPaper(userId: string, localId: string, content: Record<string, unknown>) {
  return createPrivatePaper(userId, { localPaperId: localId, title: "Test", content, rightsAcknowledgement: makeRightsAck() });
}

async function submitAllWrong(userId: string, paperId: string, content: Record<string, unknown>, count: number) {
  const answers: Record<string, string> = {};
  for (let i = 0; i < count; i++) answers[String(i)] = "B";
  return writeProgress(userId, paperId, {
    progressVersion: 1, mutationId: randomUUID(), contentHash: computePrivateContentHash(content),
    baseRevision: 0, attemptId: randomUUID(), answers, currentIndex: count - 1, submitted: true,
  });
}

async function cleanupUser(userId: string) {
  await prisma.privateReviewProgress.deleteMany({ where: { userId } });
  await prisma.privateWrongItem.deleteMany({ where: { userId } });
  await prisma.privatePaperProgress.deleteMany({ where: { userId } });
  await prisma.privatePaper.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

// ─── startPrivateReviewBatch ─────────────────────────────────────────

test("review-progress: startPrivateReviewBatch creates and persists batch", async () => {
  const user = await createTestUser("rp1");
  try {
    const content = makeReadyContent(4);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 4);

    const batch = await startPrivateReviewBatch(user.id, paper.paperId, 5);
    assert.equal(batch.questions.length, 4);
    assert.ok(batch.reviewBatchId.startsWith("rb_"));
    assert.equal(batch.contentHash, computePrivateContentHash(content));
    assert.equal(batch.submitted, false);
    assert.equal(batch.revision, 1);
    assert.equal(batch.currentIndex, 0);
    for (const q of batch.questions) {
      assert.equal(batch.answers[q.questionId], null);
    }

    // Verify persisted in DB
    const row = await prisma.privateReviewProgress.findUnique({ where: { userId_paperId: { userId: user.id, paperId: paper.paperId } } });
    assert.ok(row);
    assert.equal(row!.reviewBatchId, batch.reviewBatchId);
    assert.equal(row!.revision, 1);
    assert.equal(row!.submitted, false);
  } finally { await cleanupUser(user.id); }
});

async function fixture() {
  const user = await createTestUser("e2fix"), content = makeReadyContent(3);
  const paper = await createReadyPaper(user.id, "fix", content);
  await submitAllWrong(user.id, paper.paperId, content, 3);
  return { user, paper, content };
}
type Intercept = (path: string, body: Record<string, unknown>, run: () => Promise<Response>) => Promise<Response>;
function client(owner: string, paperId: string, local: { session: PrivateReviewSession | null } = { session: null }) {
  let intercept: Intercept = (_path,_body,run) => run();
  const controllers: PrivateReviewController[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    const path = String(url).split("/wrong-items")[1];
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string,unknown> : {};
    return intercept(path, body, async () => {
      try {
        if (path === "") { const items=await listPrivateWrongItems(owner,paperId); return Response.json({ownerId:owner,items,counts:countPrivateWrongItemViews(items)}); }
        if (path === "/review/progress") return Response.json({ownerId:owner,paperId,...await readPrivateReviewProgressSnapshot(owner,paperId)});
        if (path === "/review/start") return Response.json({ownerId:owner,...await startPrivateReviewBatch(owner,paperId,5,body.resume)});
        if (path === "/review/progress/save") return Response.json({ownerId:owner,paperId,...await savePrivateReviewProgress(owner,paperId,body)});
        if (path === "/review/grade") return Response.json({ownerId:owner,...await submitPrivateReviewProgress(owner,paperId,body)});
        throw new Error("unexpected endpoint");
      } catch(e) { const error=e as PrivateReviewProgressStoreError; return Response.json({code:error.code,error:error.message},{status: error.code==="CONFLICT"||error.code==="BATCH_MISMATCH"||error.code==="CONTENT_CHANGED"?409:422}); }
    });
  };
  const create = () => {
    const c=new PrivateReviewController(owner,paperId,{fetch:fetcher,isCurrent:()=>true,onState:()=>{},readLocal:()=>({session:structuredClone(local.session),warning:null}),writeLocal:s=>{local.session=structuredClone(s);},clearLocal:()=>{local.session=null;}});
    controllers.push(c); return c;
  };
  return { create, local, intercept: (fn:Intercept)=>{intercept=fn;}, cleanup:()=>controllers.forEach(c=>c.dispose()) };
}
function deferred() { let release!:()=>void; const promise=new Promise<void>(resolve=>{release=resolve;}); return {promise,release}; }
function answer(c:PrivateReviewController,qid:string,option="A") { c.edit(s=>({...s,answers:{...s.answers,[qid]:option}})); }

test("review sync: parsed start retains and validates server revision", () => {
  const raw={ownerId:"owner",reviewBatchId:"rb_test",contentHash:"hash",revision:7,questions:[{questionId:"q",prompt:"Question",options:[{id:"A",text:"A"},{id:"B",text:"B"}]}]};
  assert.equal(parsePrivateReviewStart(raw,"owner").revision,7);
  for(const revision of [0,-1,1.2,"1",Number.MAX_SAFE_INTEGER]) assert.throws(()=>parsePrivateReviewStart({...raw,revision},"owner"));
});

test("review sync: malformed answers and positions cannot alter persisted answers", async () => {
  const {user,paper}=await fixture();
  try {
    const batch=await startPrivateReviewBatch(user.id,paper.paperId,5);
    const saved=await savePrivateReviewProgress(user.id,paper.paperId,{...batch,baseRevision:batch.revision,answers:{q1:"A"},currentIndex:1});
    const before=await readPrivateReviewProgressSnapshot(user.id,paper.paperId);
    for(const patch of [{answers:[]},{answers:null},{answers:{q1:7}},{answers:{q1:"UNKNOWN"}},{answers:{foreign:"A"}},{currentIndex:-1},{currentIndex:1.5},{currentIndex:3},{currentIndex:undefined},{baseRevision:Number.MAX_SAFE_INTEGER}]) {
      await assert.rejects(()=>savePrivateReviewProgress(user.id,paper.paperId,{...batch,baseRevision:saved.revision,answers:{q1:"A"},currentIndex:1,...patch}));
      assert.deepEqual(await readPrivateReviewProgressSnapshot(user.id,paper.paperId),before);
    }
  } finally { await cleanupUser(user.id); }
});

test("review sync: identical submission retries return the same cloud result without writes", async () => {
  const {user,paper}=await fixture();
  try {
    const batch=await startPrivateReviewBatch(user.id,paper.paperId,5);
    const input={...batch,baseRevision:batch.revision,answers:{q1:"A"}};
    const first=await submitPrivateReviewProgress(user.id,paper.paperId,input);
    assert.deepEqual(await submitPrivateReviewProgress(user.id,paper.paperId,input),first);
    assert.deepEqual(await submitPrivateReviewProgress(user.id,paper.paperId,{...input,baseRevision:first.revision}),first);
    await assert.rejects(()=>submitPrivateReviewProgress(user.id,paper.paperId,{...input,baseRevision:first.revision,answers:{q1:"B"}}));
    const parsed=parseReviewSnapshot({ownerId:user.id,paperId:paper.paperId,...await readPrivateReviewProgressSnapshot(user.id,paper.paperId)},user.id,paper.paperId);
    assert.equal(parsed.progress?.result?.correct,1);
    assert.equal(parsed.progress?.result?.contentHash,batch.contentHash);
  } finally { await cleanupUser(user.id); }
});

test("review sync: removed questions invalidate reads and block saves and submissions", async () => {
  const {user,paper}=await fixture();
  try {
    const batch=await startPrivateReviewBatch(user.id,paper.paperId,5);
    await prisma.privateWrongItem.updateMany({where:{userId:user.id,paperId:paper.paperId,questionId:"q1"},data:{removedAt:new Date()}});
    assert.equal((await readPrivateReviewProgressSnapshot(user.id,paper.paperId)).invalidated,true);
    await assert.rejects(()=>savePrivateReviewProgress(user.id,paper.paperId,{...batch,baseRevision:batch.revision,currentIndex:0,answers:{}}));
    await assert.rejects(()=>submitPrivateReviewProgress(user.id,paper.paperId,{...batch,baseRevision:batch.revision,answers:{}}));
  } finally { await cleanupUser(user.id); }
});

test("review sync: corrupt persisted batches are invalidated without deletion or repair writes", async () => {
  const {user,paper}=await fixture();
  try {
    await startPrivateReviewBatch(user.id,paper.paperId,5);
    for(const data of [{questionIds:[]},{questionIds:["q1","q1"]},{questionIds:["q1"],answers:{q1:"INVALID"}}]) {
      const before=await prisma.privateReviewProgress.update({where:{userId_paperId:{userId:user.id,paperId:paper.paperId}},data});
      assert.equal((await readPrivateReviewProgressSnapshot(user.id,paper.paperId)).invalidated,true);
      assert.deepEqual(await prisma.privateReviewProgress.findUnique({where:{id:before.id}}),before);
    }
  } finally { await cleanupUser(user.id); }
});

test("review sync: concurrent starts and CAS saves serialize without deadlock", async () => {
  const {user,paper}=await fixture();
  try {
    const batches=await Promise.all([startPrivateReviewBatch(user.id,paper.paperId,5),startPrivateReviewBatch(user.id,paper.paperId,5)]);
    assert.deepEqual(batches.map(b=>b.revision).sort(),[1,2]);
    const batch=batches.find(b=>b.revision===2)!;
    const results=await Promise.allSettled(["A","B"].map(value=>savePrivateReviewProgress(user.id,paper.paperId,{...batch,baseRevision:2,currentIndex:0,answers:{q1:value}})));
    assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
    assert.equal((await readPrivateReviewProgressSnapshot(user.id,paper.paperId)).revision,3);
  } finally { await cleanupUser(user.id); }
});

test("review sync: resume validates owner-scoped active questions, content and CAS", async () => {
  const {user,paper}=await fixture();
  try {
    const batch=await startPrivateReviewBatch(user.id,paper.paperId,5);
    const resume={baseRevision:batch.revision,contentHash:batch.contentHash,questionIds:["q3","q1"]};
    for(const bad of [{...resume,baseRevision:0},{...resume,questionIds:["foreign"]},{...resume,questionIds:["q1","q1"]},{...resume,contentHash:"wrong"}]) await assert.rejects(()=>startPrivateReviewBatch(user.id,paper.paperId,5,bad));
    const next=await startPrivateReviewBatch(user.id,paper.paperId,5,resume);
    assert.deepEqual(next.questions.map(q=>q.questionId),["q3","q1"]);
    assert.equal(next.revision,2);
  } finally { await cleanupUser(user.id); }
});

test("review sync controller: repeated start uses actual revision and saves normally", async () => {
  const {user,paper}=await fixture(), h=client(user.id,paper.paperId), c=h.create();
  try { await c.start(); await c.start(); assert.equal(c.state.session?.syncRevision,2); answer(c,"q1"); assert.equal(await c.flush(),true); assert.equal(c.state.syncStatus,"saved"); }
  finally { h.cleanup(); await cleanupUser(user.id); }
});

test("review sync controller: slow save serializes later edits and preserves latest answers and index", async () => {
  const {user,paper}=await fixture(), h=client(user.id,paper.paperId), c=h.create();
  try {
    await c.start(); const entered=deferred(), release=deferred(); let calls=0,inflight=0,max=0;
    h.intercept(async(path,_body,run)=>{if(path!=="/review/progress/save")return run();calls++;inflight++;max=Math.max(max,inflight);const r=await run();if(calls===1){entered.release();await release.promise;}inflight--;return r;});
    answer(c,"q1");const save=c.flush();await entered.promise;
    answer(c,"q2","B");c.edit(s=>({...s,currentIndex:2}));release.release();await save;
    assert.equal(max,1);assert.equal(calls,2);assert.equal(c.state.session?.answers.q2,"B");assert.equal(c.state.session?.currentIndex,2);
    assert.deepEqual((await readPrivateReviewProgressSnapshot(user.id,paper.paperId)).progress?.answers,c.state.session?.answers);
    assert.equal(h.local.session?.syncDirty,false);
  } finally { h.cleanup(); await cleanupUser(user.id); }
});

test("review sync controller: dirty local draft restores across reload before debounce fires", async () => {
  const {user,paper}=await fixture(), h=client(user.id,paper.paperId), a=h.create();
  try {
    await a.start();answer(a,"q2","B");a.dispose();const b=h.create();await b.load();await b.flush();
    assert.equal(b.state.session?.answers.q2,"B");assert.equal(b.state.syncStatus,"saved");
    assert.equal((await readPrivateReviewProgressSnapshot(user.id,paper.paperId)).progress?.answers.q2,"B");
  } finally { h.cleanup(); await cleanupUser(user.id); }
});

test("review sync controller: submitted results reload with GET only, never re-submit", async () => {
  const {user,paper}=await fixture(), h=client(user.id,paper.paperId), a=h.create();
  try {
    await a.start();answer(a,"q1");assert.equal(await a.submit(),true);a.dispose();let gradeCalls=0;
    h.intercept(async(path,_body,run)=>{if(path==="/review/grade")gradeCalls++;return run();});
    const b=h.create();await b.load();assert.equal(b.state.status,"submitted");assert.equal(b.state.session?.result?.correct,1);assert.equal(gradeCalls,0);
  } finally { h.cleanup(); await cleanupUser(user.id); }
});

test("review sync controller: submission waits for an in-flight save and keeps the final answers", async () => {
  const {user,paper}=await fixture(), h=client(user.id,paper.paperId), c=h.create();
  try {
    await c.start();const entered=deferred(),release=deferred();let gradeCalls=0;
    h.intercept(async(path,_body,run)=>{if(path==="/review/grade")gradeCalls++;const r=await run();if(path==="/review/progress/save"){entered.release();await release.promise;}return r;});
    answer(c,"q1");const save=c.flush();await entered.promise;answer(c,"q2");const submit=c.submit();assert.equal(gradeCalls,0);release.release();await save;assert.equal(await submit,true);assert.equal(c.state.session?.result?.correct,2);
  } finally { h.cleanup(); await cleanupUser(user.id); }
});

test("review sync controller: save failure retains dirty local draft and online recheck retries it", async () => {
  const {user,paper}=await fixture(), h=client(user.id,paper.paperId), c=h.create();
  try {
    await c.start();h.intercept(async(path,_body,run)=>{if(path==="/review/progress/save")throw new Error("offline");return run();});
    answer(c,"q1");assert.equal(await c.flush(),false);assert.equal(h.local.session?.syncDirty,true);assert.equal(c.state.syncStatus,"error");
    h.intercept((_path,_body,run)=>run());await c.load();await c.flush();assert.equal(c.state.syncStatus,"saved");assert.equal(c.state.session?.answers.q1,"A");
  } finally { h.cleanup(); await cleanupUser(user.id); }
});

test("review sync controller: failed cloud reads cannot masquerade as absent or synced progress", async () => {
  const {user,paper}=await fixture(), h=client(user.id,paper.paperId), c=h.create();
  try {
    await c.start();answer(c,"q1");const before=structuredClone(h.local.session);
    h.intercept(async(path,_body,run)=>path==="/review/progress"?Response.json({error:"unavailable"},{status:500}):run());
    await c.load();assert.equal(c.state.status,"error");assert.equal(c.state.syncStatus,"error");assert.deepEqual(h.local.session,before);
  } finally { h.cleanup(); await cleanupUser(user.id); }
});

test("review sync controller: conflicting drafts need explicit cloud or local choice", async () => {
  const {user,paper}=await fixture(), h=client(user.id,paper.paperId), c=h.create();
  try {
    await c.start();answer(c,"q1");const batch=(await readPrivateReviewProgressSnapshot(user.id,paper.paperId)).progress!;
    await savePrivateReviewProgress(user.id,paper.paperId,{...batch,baseRevision:batch.revision,answers:{q2:"B"},currentIndex:1});
    await c.load();assert.equal(c.state.syncStatus,"conflict");assert.equal(c.state.session?.answers.q1,"A");
    await c.load("local");await c.flush();assert.equal(c.state.syncStatus,"saved");assert.equal((await readPrivateReviewProgressSnapshot(user.id,paper.paperId)).progress?.answers.q1,"A");
    answer(c,"q3");const newer=(await readPrivateReviewProgressSnapshot(user.id,paper.paperId)).progress!;
    await savePrivateReviewProgress(user.id,paper.paperId,{...newer,baseRevision:newer.revision,answers:{q2:"A"},currentIndex:0});
    await c.load();assert.equal(c.state.syncStatus,"conflict");await c.load("cloud");assert.equal(c.state.session?.answers.q2,"A");assert.equal(c.state.session?.answers.q3,null);
  } finally { h.cleanup(); await cleanupUser(user.id); }
});

test("review sync controller: cloud submitted conflict retains local answers in a new guarded batch", async () => {
  const {user,paper}=await fixture(), h=client(user.id,paper.paperId), c=h.create();
  try {
    await c.start();answer(c,"q1");const batch=(await readPrivateReviewProgressSnapshot(user.id,paper.paperId)).progress!;
    await submitPrivateReviewProgress(user.id,paper.paperId,{...batch,baseRevision:batch.revision,answers:{q2:"A"}});
    await c.load();assert.equal(c.state.syncStatus,"conflict");await c.load("local");await c.flush();
    assert.notEqual(c.state.session?.reviewBatchId,batch.reviewBatchId);assert.equal(c.state.session?.submitted,false);assert.equal(c.state.session?.answers.q1,"A");
    assert.equal(c.state.syncStatus,"saved");
  } finally { h.cleanup(); await cleanupUser(user.id); }
});

test("review sync controller: disposed account scope ignores delayed save response and storage writes", async () => {
  const {user,paper}=await fixture(), h=client(user.id,paper.paperId), c=h.create();
  try {
    await c.start();const entered=deferred(),release=deferred();
    h.intercept(async(path,_body,run)=>{const r=await run();if(path==="/review/progress/save"){entered.release();await release.promise;}return r;});
    answer(c,"q1");const save=c.flush();await entered.promise;c.dispose();const local=structuredClone(h.local.session);release.release();await save;
    assert.deepEqual(h.local.session,local);assert.equal(h.local.session?.syncDirty,true);
  } finally { h.cleanup(); await cleanupUser(user.id); }
});

test("review sync: bad-owner reads and malformed result statistics are rejected", async () => {
  const {user,paper}=await fixture();
  try {
    const batch=await startPrivateReviewBatch(user.id,paper.paperId,5);
    const submitted=await submitPrivateReviewProgress(user.id,paper.paperId,{...batch,baseRevision:batch.revision,answers:{q1:"A"}});
    const raw={ownerId:user.id,paperId:paper.paperId,progress:submitted,revision:submitted.revision,invalidated:false};
    assert.throws(()=>parseReviewSnapshot({...raw,ownerId:"other"},user.id,paper.paperId));
    assert.throws(()=>parseReviewSnapshot({...raw,progress:{...submitted,result:{...submitted.result,correct:99}}},user.id,paper.paperId));
    const cloud=parseReviewSnapshot(raw,user.id,paper.paperId);
    assert.equal(reconcileReview({...cloud.progress!,syncDirty:true,answers:{q1:"B",q2:null,q3:null}},cloud),"conflict");
  } finally { await cleanupUser(user.id); }
});

test("review-progress: startPrivateReviewBatch replaces existing batch and increments revision", async () => {
  const user = await createTestUser("rp2");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);

    const first = await startPrivateReviewBatch(user.id, paper.paperId, 5);
    assert.equal(first.revision, 1);

    const second = await startPrivateReviewBatch(user.id, paper.paperId, 5);
    assert.equal(second.revision, 2);
    assert.notEqual(second.reviewBatchId, first.reviewBatchId);

    const row = await prisma.privateReviewProgress.findUnique({ where: { userId_paperId: { userId: user.id, paperId: paper.paperId } } });
    assert.ok(row);
    assert.equal(row!.revision, 2);
  } finally { await cleanupUser(user.id); }
});

// ─── readPrivateReviewProgressSnapshot ────────────────────────────────

test("review-progress: readPrivateReviewProgressSnapshot returns persisted progress", async () => {
  const user = await createTestUser("rp3");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);
    await startPrivateReviewBatch(user.id, paper.paperId, 5);

    const snapshot = await readPrivateReviewProgressSnapshot(user.id, paper.paperId);
    assert.ok(snapshot.progress);
    assert.equal(snapshot.progress.questions.length, 3);
    assert.equal(snapshot.revision, 1);
    assert.equal(snapshot.invalidated, false);
  } finally { await cleanupUser(user.id); }
});

test("review-progress: readPrivateReviewProgressSnapshot returns null when no batch", async () => {
  const user = await createTestUser("rp4");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);

    const snapshot = await readPrivateReviewProgressSnapshot(user.id, paper.paperId);
    assert.equal(snapshot.progress, null);
    assert.equal(snapshot.revision, 0);
    assert.equal(snapshot.invalidated, false);
  } finally { await cleanupUser(user.id); }
});

test("review-progress: readPrivateReviewProgressSnapshot invalidated when content changes", async () => {
  const user = await createTestUser("rp5");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);
    await startPrivateReviewBatch(user.id, paper.paperId, 5);

    // Update content (change a question prompt to change content hash)
    const newContent: Record<string, unknown> = {
      schemaVersion: 1, isPartial: false,
      sections: [{
        sectionId: "reading-1", type: "reading", order: 0,
        groups: [{ groupId: "careful-1", type: "careful_reading", order: 0, passage: "Test passage.", questions: [
          { questionId: "q1", order: 0, prompt: "CHANGED Question 1?", type: "choice", options: [{ id: "A", text: "Opt A" }, { id: "B", text: "Opt B" }, { id: "C", text: "Opt C" }, { id: "D", text: "Opt D" }], answerId: "A", shortExplanation: "Explanation 1" },
          { questionId: "q2", order: 1, prompt: "Question 2?", type: "choice", options: [{ id: "A", text: "Opt A" }, { id: "B", text: "Opt B" }, { id: "C", text: "Opt C" }, { id: "D", text: "Opt D" }], answerId: "A", shortExplanation: "Explanation 2" },
          { questionId: "q3", order: 2, prompt: "Question 3?", type: "choice", options: [{ id: "A", text: "Opt A" }, { id: "B", text: "Opt B" }, { id: "C", text: "Opt C" }, { id: "D", text: "Opt D" }], answerId: "A", shortExplanation: "Explanation 3" },
        ] }],
      }],
    };
    await updatePrivatePaper(user.id, paper.paperId, { content: newContent, rightsAcknowledgement: makeRightsAck() });

    const snapshot = await readPrivateReviewProgressSnapshot(user.id, paper.paperId);
    assert.equal(snapshot.progress, null);
    assert.equal(snapshot.invalidated, true);
    assert.equal(snapshot.invalidReason, "content version changed");
  } finally { await cleanupUser(user.id); }
});

// ─── savePrivateReviewProgress ────────────────────────────────────────

test("review-progress: savePrivateReviewProgress saves answers and currentIndex", async () => {
  const user = await createTestUser("rp6");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);
    const batch = await startPrivateReviewBatch(user.id, paper.paperId, 5);

    const qid = batch.questions[0].questionId;
    const result = await savePrivateReviewProgress(user.id, paper.paperId, {
      reviewBatchId: batch.reviewBatchId,
      contentHash: batch.contentHash,
      answers: { [qid]: "A" },
      currentIndex: 1,
      baseRevision: batch.revision,
    });
    assert.equal(result.revision, 2);

    const snapshot = await readPrivateReviewProgressSnapshot(user.id, paper.paperId);
    assert.ok(snapshot.progress);
    assert.equal(snapshot.progress!.answers[qid], "A");
    assert.equal(snapshot.progress!.currentIndex, 1);
    assert.equal(snapshot.progress!.submitted, false);
  } finally { await cleanupUser(user.id); }
});

test("review-progress: savePrivateReviewProgress rejects stale revision (CAS conflict)", async () => {
  const user = await createTestUser("rp7");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);
    const batch = await startPrivateReviewBatch(user.id, paper.paperId, 5);

    // First save succeeds (revision 1 -> 2)
    await savePrivateReviewProgress(user.id, paper.paperId, {
      reviewBatchId: batch.reviewBatchId, contentHash: batch.contentHash,
      answers: {}, currentIndex: 0, baseRevision: 1,
    });

    // Second save with stale baseRevision=1 should fail
    await assert.rejects(
      () => savePrivateReviewProgress(user.id, paper.paperId, {
        reviewBatchId: batch.reviewBatchId, contentHash: batch.contentHash,
        answers: {}, currentIndex: 1, baseRevision: 1,
      }),
      (err: PrivateReviewProgressStoreError) => err.code === "CONFLICT",
    );
  } finally { await cleanupUser(user.id); }
});

test("review-progress: savePrivateReviewProgress rejects batch mismatch", async () => {
  const user = await createTestUser("rp8");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);
    const batch = await startPrivateReviewBatch(user.id, paper.paperId, 5);

    await assert.rejects(
      () => savePrivateReviewProgress(user.id, paper.paperId, {
        reviewBatchId: "rb_wrong_batch", contentHash: batch.contentHash,
        answers: {}, currentIndex: 0, baseRevision: 1,
      }),
      (err: PrivateReviewProgressStoreError) => err.code === "BATCH_MISMATCH",
    );
  } finally { await cleanupUser(user.id); }
});

test("review-progress: savePrivateReviewProgress rejects when already submitted", async () => {
  const user = await createTestUser("rp9");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);
    const batch = await startPrivateReviewBatch(user.id, paper.paperId, 5);

    // Submit first
    await submitPrivateReviewProgress(user.id, paper.paperId, {
      reviewBatchId: batch.reviewBatchId, contentHash: batch.contentHash,
      answers: {}, baseRevision: 1,
    });

    // Then try to save - should reject
    await assert.rejects(
      () => savePrivateReviewProgress(user.id, paper.paperId, {
        reviewBatchId: batch.reviewBatchId, contentHash: batch.contentHash,
        answers: {}, currentIndex: 0, baseRevision: 2,
      }),
      (err: PrivateReviewProgressStoreError) => err.code === "CONFLICT",
    );
  } finally { await cleanupUser(user.id); }
});

// ─── submitPrivateReviewProgress ──────────────────────────────────────

test("review-progress: submitPrivateReviewProgress grades and persists result", async () => {
  const user = await createTestUser("rp10");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);
    const batch = await startPrivateReviewBatch(user.id, paper.paperId, 5);

    // Answer first question correctly (correct is A)
    const qid = batch.questions[0].questionId;
    const submitted = await submitPrivateReviewProgress(user.id, paper.paperId, {
      reviewBatchId: batch.reviewBatchId, contentHash: batch.contentHash,
      answers: { [qid]: "A" }, baseRevision: 1,
    });

    assert.equal(submitted.submitted, true);
    assert.equal(submitted.revision, 2);
    assert.ok(submitted.result);
    assert.equal(submitted.result.total, 3);
    assert.equal(submitted.result.correct, 1);
    assert.equal(submitted.result.unanswered, 2);

    const row = await prisma.privateReviewProgress.findUnique({ where: { userId_paperId: { userId: user.id, paperId: paper.paperId } } });
    assert.ok(row);
    assert.equal(row!.submitted, true);
    assert.ok(row!.result);
  } finally { await cleanupUser(user.id); }
});

test("review-progress: submitPrivateReviewProgress rejects stale revision", async () => {
  const user = await createTestUser("rp11");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);
    const batch = await startPrivateReviewBatch(user.id, paper.paperId, 5);

    // Save first (revision 1 -> 2)
    await savePrivateReviewProgress(user.id, paper.paperId, {
      reviewBatchId: batch.reviewBatchId, contentHash: batch.contentHash,
      answers: {}, currentIndex: 0, baseRevision: 1,
    });

    // Submit with stale baseRevision=1 should fail
    await assert.rejects(
      () => submitPrivateReviewProgress(user.id, paper.paperId, {
        reviewBatchId: batch.reviewBatchId, contentHash: batch.contentHash,
        answers: {}, baseRevision: 1,
      }),
      (err: PrivateReviewProgressStoreError) => err.code === "CONFLICT",
    );
  } finally { await cleanupUser(user.id); }
});

// ─── Cross-owner isolation ────────────────────────────────────────────

test("review-progress: cross-owner isolation - user B cannot read user A progress", async () => {
  const userA = await createTestUser("rpA");
  const userB = await createTestUser("rpB");
  try {
    const content = makeReadyContent(3);
    const paperA = await createReadyPaper(userA.id, "l1", content);
    await submitAllWrong(userA.id, paperA.paperId, content, 3);
    await startPrivateReviewBatch(userA.id, paperA.paperId, 5);

    // User B tries to read user A's paper - should get NOT_FOUND
    await assert.rejects(
      () => readPrivateReviewProgressSnapshot(userB.id, paperA.paperId),
      (err: PrivateReviewProgressStoreError) => err.code === "NOT_FOUND",
    );
  } finally {
    await cleanupUser(userA.id);
    await cleanupUser(userB.id);
  }
});

// ─── Validation ────────────────────────────────────────────────────────

test("review-progress: startPrivateReviewBatch rejects invalid limit", async () => {
  const user = await createTestUser("rp12");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);

    await assert.rejects(
      () => startPrivateReviewBatch(user.id, paper.paperId, 0),
      (err: PrivateReviewProgressStoreError) => err.code === "VALIDATION_ERROR",
    );
    await assert.rejects(
      () => startPrivateReviewBatch(user.id, paper.paperId, 6),
      (err: PrivateReviewProgressStoreError) => err.code === "VALIDATION_ERROR",
    );
  } finally { await cleanupUser(user.id); }
});

test("review-progress: savePrivateReviewProgress validates required fields", async () => {
  const user = await createTestUser("rp13");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);
    const batch = await startPrivateReviewBatch(user.id, paper.paperId, 5);

    await assert.rejects(
      () => savePrivateReviewProgress(user.id, paper.paperId, {}),
      (err: PrivateReviewProgressStoreError) => err.code === "VALIDATION_ERROR",
    );
    await assert.rejects(
      () => savePrivateReviewProgress(user.id, paper.paperId, { reviewBatchId: batch.reviewBatchId, contentHash: batch.contentHash, baseRevision: -1 }),
      (err: PrivateReviewProgressStoreError) => err.code === "VALIDATION_ERROR",
    );
  } finally { await cleanupUser(user.id); }
});

// ─── No side effects on wrong items / progress / XP ───────────────────

test("review-progress: review operations do not modify wrong items or paper progress", async () => {
  const user = await createTestUser("rp14");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);

    const wrongBefore = await prisma.privateWrongItem.count({ where: { userId: user.id, paperId: paper.paperId } });
    const progressBefore = await prisma.privatePaperProgress.findUnique({ where: { userId_paperId: { userId: user.id, paperId: paper.paperId } } });

    const batch = await startPrivateReviewBatch(user.id, paper.paperId, 5);
    await savePrivateReviewProgress(user.id, paper.paperId, {
      reviewBatchId: batch.reviewBatchId, contentHash: batch.contentHash,
      answers: { [batch.questions[0].questionId]: "A" }, currentIndex: 1, baseRevision: 1,
    });
    await submitPrivateReviewProgress(user.id, paper.paperId, {
      reviewBatchId: batch.reviewBatchId, contentHash: batch.contentHash,
      answers: { [batch.questions[0].questionId]: "A" }, baseRevision: 2,
    });

    const wrongAfter = await prisma.privateWrongItem.count({ where: { userId: user.id, paperId: paper.paperId } });
    const progressAfter = await prisma.privatePaperProgress.findUnique({ where: { userId_paperId: { userId: user.id, paperId: paper.paperId } } });

    assert.equal(wrongAfter, wrongBefore);
    assert.ok(progressBefore);
    assert.ok(progressAfter);
    assert.equal(progressAfter!.submitted, progressBefore!.submitted);
    assert.deepEqual(progressAfter!.answers, progressBefore!.answers);
  } finally { await cleanupUser(user.id); }
});
