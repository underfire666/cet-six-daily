# V13 Phase 2E.2 — Account / Sync / Review / Responsive Final Hardening Report

## 0. Git Preflight

- **Branch:** `feature/v13-real-content`
- **PHASE2E2_BEFORE_HEAD:** `708fe309b573c2460e0492ccbcc03f9810c2244b`
- **v12.0 tag:** `697772d9412d9d1a4253e099a001734a5230e264` (unchanged)
- **Worktree at start:** clean
- **Local == Remote at start:** YES

## 1. Bugs Found & Fixed

### Bug 1: Hydration Mismatch (root cause, not suppression)

- **Scenario:** Access QA route `/qa/paper/cet6:mock:paper-001` in production build
- **Expected:** Server and client render identical DOM
- **Actual:** SSR rendered fallback `if (!paper)` div; client rendered PaperProvider (different DOM structure)
- **Root Cause:** Paper 001 only registered inside QA route `useMemo` (client-only). SSR content registry had no Paper pack, so `resolvePaper` returned null on server.
- **Minimal Fix:**
  1. Moved `registerBuiltinPacks()` + `registerMockPaper001()` to QA route **module level** (runs on both SSR and client)
  2. Added `registerMockPaper001()` to global `registerBuiltinPacks()` (before early-return), so Paper is resolvable from Review page and other routes
  3. Removed `suppressHydrationWarning` from PaperProvider
- **Regression Test:** Existing hydration tests pass; browser verification shows no application-level hydration errors (remaining 2 are Next.js dev-only `data-inspector-id` attributes from React Inspector, absent in production build)
- **Status:** FIXED

### Bug 2: Paper Question Replay in Review / Wrongbook

- **Scenario:** Open `/review`, start review session for a Paper-originated ReviewItem
- **Expected:** Show original question text, options, user's wrong answer, correct answer, explanation, and listening transcript
- **Actual:** "原题内容已不可用 — 题目来源已不在当前内容库中"
- **Root Cause:** `replayReviewItem()` in `src/lib/review/replay.ts` only supported `reading` / `listening` / `vocabulary` sourceModule. Paper ReviewItems have `sourceModule=listening` or `reading` but `sourceActivityId=cet6:mock:paper-001` (a Paper ContentPack, not a listening material). `listeningMaterialById()` returned null.
- **Minimal Fix:**
  1. Added Paper resolution branch at top of `replayReviewItem()`: `getPaperById(item.sourceActivityId)` → `flattenPaperQuestions(paper)` → match by `question.questionId` → return `ReviewReplay` with prompt/options/correctOptionId/shortExplanation/articlePassage/transcript
  2. Fixed `PaperQuestion` property name (`questionId`, not `id`)
  3. Preserved existing reading/listening/vocabulary branches unchanged
- **Regression Test:** Existing review replay tests pass; browser E2E confirms Paper question replay works
- **Status:** FIXED

### Bug 3: XP Not Awarded for Guest Users

- **Scenario:** Complete full Paper 001 exam as Guest (not logged in)
- **Expected:** XP awarded (base 50 + accuracy bonus), stored locally
- **Actual:** `xpLedger` empty, `xpSettled=true` but no XP event created
- **Root Cause:** `enqueuePaperXpSync()` wrapped in `if (isLoggedIn && xp > 0)` in PaperProvider.submitPaper. Guest users' XP was never enqueued. `settlePaperXp()` function was defined but never called.
- **Minimal Fix:** Removed `isLoggedIn` condition → `if (xp > 0)`. Sync engine handles local settlement for guests and cloud push for logged-in users internally.
- **Regression Test:** Existing XP tests pass; code path verified. Full browser E2E with XP numerical measurement marked PARTIAL (requires fresh 57-question submission)
- **Status:** FIXED (code), XP_REAL_E2E = PARTIAL

### Bug 4: registerMockPaper001 Non-Idempotent

- **Scenario:** Run `npm run content:validate`
- **Expected:** All content packs validate without duplicate errors
- **Actual:** `Error: [content] duplicate pack id: pack-paper-cet6-mock-001`
- **Root Cause:** `registerMockPaper001()` called from multiple entry points (registerBuiltinPacks + QA route module level + content scripts) but function had no idempotency guard despite comment saying "幂等"
- **Minimal Fix:** Added `if (getContentPack(MOCK_PAPER_001_PACK_ID)) return;` at function start; imported `getContentPack` from registry
- **Regression Test:** content:validate now PASS; existing content tests pass
- **Status:** FIXED

## 2. Real Browser E2E Results

### WRONGBOOK_REAL_E2E: PASS

- **Setup:** Completed full Paper 001 (57 questions, 25% accuracy, 41 wrong)
- **localStorage `cet-daily:v1:review`:** 42 Paper ReviewItems
  - `sourceModule`: listening / reading (correct mapping)
  - `sourceActivityId`: `cet6:mock:paper-001`
  - `questionId`: format `cet6:mock:paper-001:listening:long_conversation:g1:q2` (correct)
  - `masteryStatus`: "weak"
  - `wrongCount`: 1
- **Review page UI:** Shows "错题本 42 / 今日待复习 42", list items with source, next review date, review count, favorite/remove buttons
- **Verdict:** PASS

### REVIEW_REAL_E2E: PASS

- **Action:** Start review session from Wrongbook
- **Paper question display:**
  - Source: "听力 · CET6 Original Mock Paper 001 (Project-authored, Full)"
  - Question: "What is the main topic of the lecture?"
  - Options a/b/c/d with full text
  - "你的作答" marked on wrong option (a)
  - "正确答案" marked on correct option (b)
  - Explanation: "The lecture examines the rise of rooftop farming..."
  - "查看听力原文" expandable button available
- **No "原题内容已不可用" error**
- **Verdict:** PASS

### REVIEW_DEDUPE: PASS

- **Before refresh:** 42 ReviewItems
- **After refresh (navigate away + back):** 42 ReviewItems (no duplicates)
- **Verdict:** PASS

### RESULT_STORAGE: PASS

- **Stored session result:**
  - `overallAccuracy`: 25
  - `wrongCount`: 41
  - `totalQuestions`: 57
  - `answeredQuestions`: 57
  - `listeningAccuracy`, `readingAccuracy`: present
  - `writingStatus`: "submitted"
  - `translationStatus`: "submitted"
  - `xpSettled`: true
  - `reviewSettled`: true
- **Verdict:** PASS (earlier "empty result" was false alarm — checking wrong property names)

### XP_REAL_E2E: PARTIAL

- **Code fix:** Removed `isLoggedIn` guard, XP now enqueued for all users
- **Existing session:** Has `xpSettled=true` from pre-fix submission (no XP awarded — idempotency marker prevents re-settlement)
- **Full browser E2E with XP numerical measurement:** NOT COMPLETED (requires fresh 57-question submission after fix)
- **Verdict:** PARTIAL (code fix verified, full measurement pending)

### HYDRATION_MISMATCH: NONE (application-level)

- **Production build:** No hydration errors
- **Dev mode:** 2 remaining errors are Next.js dev-only `data-inspector-id` attributes (React Inspector), not application code
- **Verdict:** PASS

## 3. NOT VERIFIED (requires authenticated accounts + multi-browser setup)

| Item | Status | Reason |
|------|--------|--------|
| Guest→Account Migration | NOT VERIFIED | Requires account registration + migration preview E2E |
| User A/B Isolation | NOT VERIFIED | Requires two separate authenticated accounts |
| Server Authorization / IDOR | NOT VERIFIED | Requires API inspection with authenticated sessions |
| Multi-device Sync | NOT VERIFIED | Requires two isolated browser contexts |
| Conflict Merge (LWW / completed-wins) | NOT VERIFIED | Requires two devices with stale state |
| Viewport Matrix (375/390/430/1440) | NOT VERIFIED | Requires responsive layout testing |
| Accessibility Basic | NOT VERIFIED | Requires axe-core or manual a11y audit |
| V4–V11 Regression (short) | NOT VERIFIED | Requires full module smoke test |

## 4. Gates Results

| Gate | Result |
|------|--------|
| `npm test` | PASS (0 failures) |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (0 errors, 0 warnings) |
| `npm run build` | PASS |
| `npm run content:validate` | PASS |
| `npm run content:stats` | PASS (8 sections, 20 groups, 67 questions) |
| `npm run content:rights` | PASS (production pool empty) |

## 5. Files Modified (Phase 2E.2)

1. `src/app/qa/paper/[paperId]/page.tsx` — Module-level paper registration; removed suppressHydrationWarning
2. `src/content/packs.ts` — Global Paper 001 registration in registerBuiltinPacks (before early-return)
3. `src/lib/review/replay.ts` — Paper question resolution branch; fixed PaperQuestion property name
4. `src/components/paper/PaperProvider.tsx` — Removed isLoggedIn guard for XP sync
5. `src/content/papers/cet6-mock-paper-001.ts` — Idempotency guard for registerMockPaper001

## 6. Constraints Compliance

- **No src/ product code changes outside minimal fixes:** YES (all changes are bug fixes)
- **No Prisma changes:** YES
- **No package.json / lockfile changes:** YES
- **No new migration:** YES
- **No v12.0 tag modification:** YES
- **No merge main:** YES
- **No V13 start:** YES (still Phase 2E.2)
- **Paper 001 remains staging:** YES
- **PRODUCTION_POOL_CONTAINS_PAPER001:** NO
- **No real past papers imported:** YES
- **No real CET6 audio committed:** YES (audio is project-authored TTS)

## 7. Known Limitations

1. **XP_REAL_E2E = PARTIAL:** Code fix applied, but full browser E2E with XP numerical measurement not completed in this phase
2. **Auth/multi-device scenarios NOT VERIFIED:** Guest→Account migration, User A/B isolation, server authorization, multi-device sync, conflict merge all require authenticated account setup not performed in this phase
3. **Viewport/accessibility NOT VERIFIED:** Responsive layout and a11y checks deferred
4. **Existing pre-fix session has no XP:** The completed Paper session from earlier E2E has `xpSettled=true` but no XP (because the bug existed at submission time). New submissions after fix will correctly award XP.

## 8. Summary

| Category | Count |
|----------|-------|
| Bugs Fixed | 4 |
| Real Browser E2E PASS | 4 (Wrongbook, Review Replay, Review Dedupe, Result Storage) |
| Real Browser E2E PARTIAL | 1 (XP) |
| NOT VERIFIED | 8 (auth/multi-device/viewport/a11y/regression) |
| Gates PASS | 7/7 |
| Product Code Changed | YES (minimal bug fixes only) |
| Paper 001 Status | staging |
| V13 Phase 2E.2 Status | BUG FIXES COMPLETE, FULL ACCEPTANCE PENDING AUTH/MULTI-DEVICE VERIFICATION |
