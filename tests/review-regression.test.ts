import test from "node:test";
import assert from "node:assert/strict";
import { recordWrong, applyReviewResult, createReviewSession, getDueReviews, selectDailyReviews, selectManualReviews, finishReviewSession } from "../src/lib/review/scheduler";
import { emptyReviewStore, completeReview, loadReviewStore, saveReviewStore } from "../src/lib/review/store";
import { calculateNextReviewDate } from "../src/lib/review/config";

const day = "2026-09-21";
function fixture() {
  const store = emptyReviewStore();
  store.items = recordWrong({}, "reading", "a", "q", day, "wrong");
  const item = Object.values(store.items)[0];
  const session = createReviewSession([item], day, "manual", "manual");
  session.answers[item.id] = { correct: true, result: "review_correct" };
  session.currentIndex = 1;
  store.sessions[session.id] = session;
  return { store, item, session };
}
function storage(raw: string): Storage {
  return { length: 1, clear: () => { raw = ""; }, key: () => "cet-daily:v1:review", getItem: () => raw, setItem: (_, value) => { raw = value; }, removeItem: () => { raw = ""; } };
}

test("review ISO timestamps use Shanghai midnight and valid calendar arithmetic", () => {
  assert.equal(calculateNextReviewDate("weak", "wrong", 0, "2026-09-21T16:01:00Z"), "2026-09-23");
  assert.equal(calculateNextReviewDate("weak", "wrong", 0, "2028-02-28"), "2028-02-29");
  assert.equal(calculateNextReviewDate("weak", "wrong", 0, "2026-12-31"), "2027-01-01");
  assert.throws(() => calculateNextReviewDate("weak", "wrong", 0, "2026-02-30"), RangeError);
  assert.equal(Object.values(recordWrong({}, "reading", "a", "q", "2026-09-21T16:01:00Z", "wrong"))[0].nextReviewAt, "2026-09-23");
});

test("overdue ordering has no dependence on prior calls or insertion order; mastered items remain reviewable", () => {
  const { item } = fixture();
  const items = { b: { ...item, id: "b", nextReviewAt: day }, a: { ...item, id: "a", nextReviewAt: "2026-09-19" }, c: { ...item, id: "c", masteryStatus: "mastered" as const, nextReviewAt: day } };
  assert.deepEqual(getDueReviews(items, day).map(i=>i.id), ["a", "b", "c"]);
  selectDailyReviews(items, "2030-01-01", "light");
  assert.deepEqual(selectManualReviews(items, "due", day).map(i=>i.id), ["a", "b", "c"]);
});

test("completed review is atomic, persists, and cannot reapply mastery or XP on refresh", () => {
  const { store, item, session } = fixture();
  const done = completeReview(store, session.id, "2026-09-21T16:01:00Z");
  assert.equal(done.sessions[session.id].rewardXp, 2);
  assert.equal(done.xpLedger[`review:2026-09-22:${item.id}`], 2);
  const mem = storage("");
  assert.ok(saveReviewStore(mem, done));
  const loaded = loadReviewStore(mem).store;
  assert.strictEqual(completeReview(loaded, session.id, "2026-09-22T10:00:00Z"), loaded);
  assert.equal(loaded.items[item.id].reviewCount, 2);
});

test("same-day new manual session earns no duplicate XP, next day can earn again", () => {
  const { store, item, session } = fixture();
  let next = completeReview(store, session.id, day);
  const another = createReviewSession([next.items[item.id]], day, "manual", "manual");
  another.currentIndex=1;
  another.answers[item.id]={correct:true,result:"review_correct"};
  next.sessions[another.id]=another;
  next=completeReview(next,another.id,day);
  assert.equal(next.sessions[another.id].rewardXp,0);
  const tomorrow={...another,id:"tomorrow",applied:false,completedAt:undefined,rewardXp:0};
  next.sessions[tomorrow.id]=tomorrow;
  assert.equal(completeReview(next,tomorrow.id,"2026-09-22").sessions.tomorrow.rewardXp,2);
});

test("incomplete sessions and foreign answers cannot settle or alter unrelated items", () => {
  const { store, session }=fixture();
  session.currentIndex=0;
  assert.strictEqual(completeReview(store,session.id,day),store);
  session.currentIndex=1;
  session.answers.foreign={correct:true,result:"review_correct"};
  assert.strictEqual(completeReview(store,session.id,day),store);
});

test("same-millisecond sessions have unique IDs, deduplicate questions and start with zero XP", () => {
  const {item}=fixture();
  const sessions=Array.from({length:100},()=>createReviewSession([item,item],day,"manual","manual"));
  assert.equal(new Set(sessions.map(s=>s.id)).size,100);
  assert.equal(sessions[0].itemIds.length,1);
  assert.equal(sessions[0].rewardXp,0);
});

test("long manual batches respect the 20 XP session cap", () => {
  const {item}=fixture();
  const items=Object.fromEntries(Array.from({length:12},(_,i)=>[String(i),{...item,id:String(i)}]));
  const session=createReviewSession(Object.values(items),day,"manual","manual");
  session.currentIndex=12;
  session.answers=Object.fromEntries(session.itemIds.map(id=>[id,{correct:true,result:"review_correct" as const}]));
  assert.equal(finishReviewSession(items,session,day).session.rewardXp,20);
});

test("second tries cannot produce mastery; correct review intervals grow 3/7/14/30 days", () => {
  const {store,item}=fixture();
  store.items[item.id].correctStreak=4;
  const result=recordWrong(store.items,"reading","a","q",day,"second_try_correct")[item.id];
  assert.equal(result.masteryStatus,"reviewing");
  assert.equal(result.correctStreak,0);
  assert.deepEqual([1,2,3,4].map(n=>calculateNextReviewDate("reviewing","review_correct",n,day)),["2026-09-24","2026-09-28","2026-10-05","2026-10-21"]);
});

test("end-of-day retest runs once per Shanghai date and removed items stay untouched", () => {
  const {store,item}=fixture();
  const once=applyReviewResult(store.items,item.id,false,"2026-09-21T16:00:00Z","end_of_day");
  assert.strictEqual(applyReviewResult(once,item.id,true,"2026-09-22T10:00:00Z","end_of_day"),once);
  assert.notStrictEqual(applyReviewResult(once,item.id,true,"2026-09-22T16:00:00Z","end_of_day"),once);
  once[item.id].removed=true;
  assert.strictEqual(applyReviewResult(once,item.id,true,day,"manual"),once);
});

test("corrupt dates, histories, session indices and foreign IDs are isolated without losing valid records", () => {
  const {store,item,session}=fixture();
  const invalid = [ {...item,nextReviewAt:"2026-02-30"}, {...item,history:[null]}, {...item,wrongCount:-1} ];
  for(const bad of invalid){
    const raw={...store,items:{...store.items,bad:{...bad,id:"bad"}},sessions:{...store.sessions,bad:{...session,id:"bad",currentIndex:99}}};
    const loaded=loadReviewStore(storage(JSON.stringify(raw)));
    assert.deepEqual(loaded.store.items[item.id],item);
    assert.equal(loaded.store.items.bad,undefined);
    assert.equal(loaded.store.sessions.bad,undefined);
    assert.ok(loaded.issue);
  }
  const broken={...store,sessions:{[session.id]:{...session,answers:{foreign:{correct:true,result:"review_correct"}}}}};
  assert.equal(Object.keys(loadReviewStore(storage(JSON.stringify(broken))).store.sessions).length,0);
  assert.ok(loadReviewStore(undefined).issue);
});
