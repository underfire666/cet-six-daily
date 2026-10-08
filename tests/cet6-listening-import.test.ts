import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pack from "../src/content/imported/cet6-2022-2026-listening.json";
import manifest from "../src/content/imported/cet6-listening-manifest.json";
import { getListeningMaterials, listeningMaterialById } from "../src/content/learning";
import { getPublishableItems } from "../src/content/registry";
import { createListeningSession } from "../src/lib/listening/session";
import { emptyListeningStore, loadListeningStore, saveListeningStore } from "../src/lib/listening/storage";
import { pickDailyListening, planFor, startListening, updateListening } from "../src/lib/listening/store";
import { listeningLesson } from "../src/lib/listening/questions";
import { firstSubmissionAccuracy } from "../src/lib/lesson/session";

const DAY = "2026-10-06";
const NOW = "2026-10-06T02:00:00.000Z";
for (const item of pack.items) {
  test(`real listening ${item.id}: original clip, transcript, grading and saved progress`, () => {
    const material = listeningMaterialById(item.id)!;
    const asset = manifest.assets.find(a => a.materialId === item.id)!;
    const bytes = readFileSync(resolve("public", asset.src.slice(1)));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
    assert.equal(bytes.length, asset.sizeBytes);
    assert.ok(bytes.length > 100000 && asset.duration > 60);
    assert.equal(bytes.toString("ascii", 0, 3), "ID3");
    assert.equal(item.audio.src, asset.src);
    assert.equal(item.audio.duration, asset.duration);
    assert.ok(Math.abs(asset.end - asset.start - asset.duration) < 0.0011);
    assert.equal(asset.anchor, `lt-${item.questions[0].examNumber}`);
    assert.equal(item.questions.length, [1, 5, 12, 22].includes(item.questions[0].examNumber) ? 4 : 3);
    assert.ok(item.transcript.split(/\s+/).length > 200);
    assert.ok(!/lazynote|【答案】|【题目】|[\u3400-\u9fff]/.test(item.transcript));
    assert.equal(material.sourceType, "past_exam");
    assert.equal(item.rights.licenseStatus, "unknown");
    assert.equal(item.rights.rightsStatus, "unverified");
    let store = emptyListeningStore();
    store.sessions.audit = createListeningSession("audit", "extra", DAY, material, NOW);
    store = updateListening(store, "audit", { type: "start_question" }, NOW);
    for (const [i, question] of item.questions.entries()) {
      assert.equal(question.id, `${item.id}:q${item.questions[0].examNumber+i}`);
      assert.equal(question.options.length, 4);
      assert.ok(question.options.every(o => o.text.trim()));
      assert.ok(question.options.some(o => o.id === question.answerId));
      assert.ok(question.detailedExplanation.includes(`【答案】 ${question.answerId}`));
      assert.ok(question.prompt && question.detailedExplanation.length > 100);
      store = updateListening(store, "audit", { type: "lesson", action: { type: "select", optionId: question.answerId } }, NOW);
      store = updateListening(store, "audit", { type: "lesson", action: { type: "check" } }, NOW);
      store = updateListening(store, "audit", { type: "lesson", action: { type: "continue", today: DAY, now: NOW } }, NOW);
    }
    const session = store.sessions.audit;
    assert.equal(session.phase, "complete");
    assert.equal(session.applied, true);
    assert.equal(firstSubmissionAccuracy(session.lesson, listeningLesson(material)), 100);
    assert.ok(session.rewardXp! > 0);
  });
}

test("listening inventory: 19 distinct recordings, 133 clips and 475 unique questions across 33 papers", () => {
  assert.equal(manifest.listeningEnabled, true);
  assert.equal(manifest.papers, 19);
  assert.equal(manifest.documents.length, 33);
  assert.equal(pack.items.length, 133);
  assert.equal(manifest.assets.length, 133);
  assert.equal(new Set(manifest.assets.map(a => a.src)).size, 133);
  const questions = pack.items.flatMap(m => m.questions);
  assert.equal(questions.length, 475);
  assert.equal(new Set(questions.map(q => q.id)).size, 475);
  for (const document of manifest.documents) {
    assert.equal(document.materialIds.length, 7);
    const materials = document.materialIds.map(id => listeningMaterialById(id)!);
    assert.ok(materials.every(Boolean));
    assert.deepEqual(materials.flatMap(m => m.questions.map(q => Number(q.id.split(":q")[1]))), Array.from({length:25}, (_, i) => i+1));
  }
  assert.equal(getListeningMaterials().filter(m => m.sourceType === "mock").length, 7);
  for (const identity of ["2024-06-3", "2024-12-3", "2025-06-3"])
    assert.equal(manifest.documents.find(d => d.document === identity)?.listeningDocument, identity.slice(0,-1)+"2");
  assert.ok(!getPublishableItems<{ id: string }>("listening").some(m => m.id.startsWith("cet6:")));
});

test("new daily and extra listening select original recordings deterministically without replacing old Mock plans", () => {
  for (const day of [DAY, "2026-10-07", "2027-01-01"]) {
    const ids = pickDailyListening(day);
    assert.equal(ids.length, 3);
    assert.equal(new Set(ids).size, 3);
    assert.deepEqual(ids, pickDailyListening(day));
    assert.ok(ids.every(id => listeningMaterialById(id)?.sourceType === "past_exam"));
  }
  const mock = getListeningMaterials().find(m => m.sourceType === "mock")!;
  const store = emptyListeningStore();
  store.daily[DAY] = {date:DAY,materialIds:[mock.id],completedMaterialIds:[]};
  store.sessions.legacy = createListeningSession("legacy", "daily", DAY, mock, NOW);
  assert.deepEqual(planFor(store, DAY).materialIds, [mock.id]);
  assert.equal(startListening(store, "daily", DAY, NOW, "new").id, "legacy");
  store.sessions.legacy.phase = "complete";
  store.daily[DAY].completedMaterialIds = [mock.id];
  const extra = startListening(store, "extra", DAY, NOW, "extra");
  assert.equal(listeningMaterialById(extra.store.sessions.extra.materialId)?.sourceType, "past_exam");
});

test("real listening survives storage reload with rate, transcript flag, answers and XP; duplicate submission does not reward twice", () => {
  let store = startListening(emptyListeningStore(), "daily", DAY, NOW, "saved").store;
  store = updateListening(store, "saved", { type: "set_rate", rate: 0.8 }, NOW);
  store = updateListening(store, "saved", { type: "view_transcript" }, NOW);
  store = updateListening(store, "saved", { type: "record_play" }, NOW);
  store = updateListening(store, "saved", { type: "start_question" }, NOW);
  const material = listeningMaterialById(store.sessions.saved.materialId)!;
  store = updateListening(store, "saved", {type:"lesson",action:{type:"select",optionId:material.questions[0].answerId}}, NOW);
  const data = new Map<string,string>();
  const storage = {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);},key:(i:number)=>[...data.keys()][i]??null,get length(){return data.size;}};
  saveListeningStore(storage, store);
  const restored = loadListeningStore(storage).store;
  assert.deepEqual(restored, store);
  assert.equal(restored.sessions.saved.rate, 0.8);
  for (const question of material.questions) {
    store = updateListening(store,"saved",{type:"lesson",action:{type:"select",optionId:question.answerId}},NOW);
    store = updateListening(store,"saved",{type:"lesson",action:{type:"check"}},NOW);
    store = updateListening(store,"saved",{type:"lesson",action:{type:"continue",today:DAY,now:NOW}},NOW);
  }
  assert.equal(store.sessions.saved.applied, true);
  const repeated = updateListening(store,"saved",{type:"lesson",action:{type:"continue",today:DAY,now:NOW}},NOW);
  assert.deepEqual(repeated.xpLedger,store.xpLedger);
  saveListeningStore(storage,store);
  assert.deepEqual(loadListeningStore(storage).store,store);
});
