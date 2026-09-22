import test from "node:test";
import assert from "node:assert/strict";
import { registerBuiltinPacks } from "../src/content/packs";
import { getActiveItems, getContentPack, getItems, registerContentPack, resetRegistry } from "../src/content/registry";
import { readingRepository, vocabularyRepository, listeningRepository } from "../src/content/repositories";
import { selectContent } from "../src/content/selector";
import { validatePack, validateAll } from "../src/content/validator";
import { pickDailyArticles, startReading, planFor } from "../src/lib/reading/store";
import { emptyReadingStore, loadReadingStore } from "../src/lib/reading/storage";
import { vocabularyQuestion } from "../src/lib/vocabulary/questions";
import { readingWordById, translationTaskById, writingTaskById } from "../src/content/learning";
import { planFor as vocabPlanFor } from "../src/lib/vocabulary/store";
import { emptyVocabularyStore } from "../src/lib/vocabulary/storage";
import { pickDailyListening } from "../src/lib/listening/store";
import { pickDailyTranslation } from "../src/lib/translation/store";
import { pickDailyWriting } from "../src/lib/writing/store";
import type { ContentPack } from "../src/content/types";
import type { ReadingArticle } from "../src/types/reading";
import type { Word } from "../src/types/vocabulary";
const day="2026-09-21";
function setup() { resetRegistry();registerBuiltinPacks();return structuredClone(getContentPack("pack-reading-mock")!); }

test("content initialization supports explicit registration, repeat access and resets",()=>{
  setup();assert.equal(vocabularyRepository.all().length,30);
  registerBuiltinPacks();assert.equal(vocabularyRepository.all().length,30);
  resetRegistry();assert.equal(vocabularyRepository.all().length,30);
});
test("draft and archived content stay out of new plans while historical lookup remains available",()=>{
  const pack=setup();pack.id="lifecycle";
  const template=pack.items[0] as object;
  pack.items=[{...template,id:"v10-draft",status:"draft"},{...template,id:"v10-old",status:"deprecated"},{...template,id:"v10-new",status:"active"}];
  registerContentPack(pack);
  const ids=pickDailyArticles(day,100);
  assert.ok(ids.includes("v10-new"));assert.ok(!ids.includes("v10-draft"));assert.ok(!ids.includes("v10-old"));
  assert.ok(readingRepository.getById("v10-old"));
  assert.equal(getActiveItems("reading","production").length,0);
});
test("a persisted plan can resume an archived article and survive storage validation",()=>{
  const pack=setup();pack.id="archive";pack.items=[{...pack.items[0] as object,id:"old-article",status:"deprecated"}];registerContentPack(pack);
  const store=emptyReadingStore();store.daily[day]={date:day,articleIds:["old-article"],completedArticleIds:[]};
  const started=startReading(store,"daily",day,day+"T00:00:00Z","old-session");
  assert.equal(started.id,"old-session");
  const loaded=loadReadingStore({length:1,key:()=>null,getItem:()=>JSON.stringify(started.store),setItem:()=>{},removeItem:()=>{}});
  assert.equal(loaded.store.sessions["old-session"].articleId,"old-article");
  assert.deepEqual(planFor(loaded.store,day).articleIds,["old-article"]);
});
test("selection backfills only when allowed, deduplicates IDs and is independent of input order",()=>{
  const pool=[{id:"a"},{id:"b"},{id:"c"},{id:"a"}];
  const opts={pool,seed:"x",limit:3,idOf:(x:{id:string})=>x.id,excludeIds:new Set(["a","b"])};
  assert.deepEqual(selectContent(opts).items,[{id:"c"}]);
  const repeated=selectContent({...opts,allowRepeat:true});
  assert.equal(repeated.items[0].id,"c");assert.equal(new Set(repeated.items.map(x=>x.id)).size,3);
  assert.equal(repeated.fallbackReason,"recent_repeated");
  assert.deepEqual(selectContent({...opts,allowRepeat:true,pool:[...pool].reverse()}),repeated);
  assert.throws(()=>selectContent({...opts,limit:-1}),RangeError);
  assert.equal(selectContent({...opts,pool:[],allowRepeat:true}).items.length,0);
});
test("validator reports malformed JSON without throwing and rejects missing questions/options",()=>{
  const pack=setup();
  const original=pack.items[0] as Record<string,unknown>;
  for(const item of [null,42,{...original,questions:[]},{...original,questions:[null]},{...original,questions:[{id:"q",options:[null]}]}]) {
    assert.ok(validatePack({...pack,items:[item]}).some(i=>i.level==="error"));
    assert.ok(validateAll([{...pack,items:[item]}]).errors.length);
  }
});
test("strict registration blocks invalid packs; production isolates bad items and keeps the valid one",()=>{
  const pack=setup();pack.id="mixed";pack.items=[null,{...pack.items[0] as object,id:"valid-import"}];
  assert.throws(()=>registerContentPack(pack),/missing id/);
  const previous=console.error;console.error=()=>{};
  try {registerContentPack(pack,{strict:false});}finally{console.error=previous;}
  assert.equal(getContentPack("mixed")!.items.length,1);
  assert.ok(readingRepository.getById("valid-import"));
});
test("duplicate IDs across packs are blocked and question option IDs must be unique",()=>{
  const pack=setup();pack.id="duplicate";assert.throws(()=>registerContentPack(pack),/duplicate id across packs/);
  const article=structuredClone(pack.items[0]) as ReadingArticle;
  article.questions[0].options[1].id=article.questions[0].options[0].id;
  assert.ok(validatePack({...pack,items:[article]}).some(i=>i.message.includes("duplicate option")));
});
test("new vocabulary can generate questions without a hardcoded Mock exercise",()=>{
  setup();const pack=structuredClone(getContentPack("pack-vocabulary-mock")!) as ContentPack<Word>;
  pack.id="new-words";pack.items=[{...pack.items[0],id:"word_prototype",word:"prototype",example:"This prototype works well.",meaning:"原型"}];
  registerContentPack(pack);
  const word=vocabularyRepository.getById("word_prototype")!;
  for(const kind of ["en_to_zh","zh_to_en","sentence_blank"] as const){
    const q=vocabularyQuestion(word,vocabularyRepository.all(),kind);
    assert.equal(q.options.length,4);assert.ok(q.options.some(x=>x.id===q.answerId));
    if(q.type==="fill_blank")assert.ok(q.sentence?.includes("_____"));
  }
});
test("reading lookup words from new packs remain available for saved wordbooks",()=>{
  const pack=setup();pack.id="lookup";
  const article=pack.items[0] as ReadingArticle;
  const entry=Object.values(article.vocabulary)[0];
  pack.items=[{...article,id:"lookup-article",vocabulary:{prototype:{...entry,word:"prototype"}}}];registerContentPack(pack);
  assert.equal(readingWordById("rw_prototype")?.word,"prototype");
  assert.ok(getItems("reading").length>6);
});
test("DailyPlan layering: every specialty picks concrete content through the Content Layer",()=>{
  setup();
  // V8 PlanGenerator 决定模块/数量；专项真正启动时经 ContentSelector + Repository 取具体内容。
  // 五个专项的 pick/plan 函数都以 Content Layer 为唯一内容来源：全部 ID 都能在 Repository 中解析。
  const picks: Record<string, string[]> = {
    vocabulary: vocabPlanFor(emptyVocabularyStore(), day).wordIds,
    reading: pickDailyArticles(day),
    listening: pickDailyListening(day),
    translation: pickDailyTranslation(day),
    writing: pickDailyWriting(day),
  };
  for (const [module, ids] of Object.entries(picks)) {
    assert.ok(ids.length > 0, `${module} plan is empty`);
    for (const id of ids) {
      const resolved =
        vocabularyRepository.getById(id) ??
        readingRepository.getById(id) ??
        listeningRepository.getById(id) ??
        translationTaskById(id) ??
        writingTaskById(id);
      assert.ok(resolved, `${module} plan id ${id} is not resolvable via Content Repository`);
    }
  }
  // 同一天刷新：reading 的确定性选择产出同一批（不重新抽取）
  assert.deepEqual(pickDailyArticles(day), pickDailyArticles(day));
});
