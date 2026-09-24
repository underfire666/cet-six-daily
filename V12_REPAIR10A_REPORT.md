# V12 Repair 10A — Cloud Hydration + Guest Migration

## Commit boundary

- Before HEAD: `565ae568ca1ce1c8671a70149824635200bbfb58` (`fix: record V12 browser audit and repair confirmed UI regressions`). It was pushed to `origin/feature/v12-cloud-sync` before this repair began.
- After HEAD: the `feature/v12-cloud-sync` commit containing this report; obtain its immutable SHA with `git rev-parse HEAD`. The final task handoff records that SHA after the commit and push.
- Round 9 temporary `.db-check.cjs` and acceptance report were preserved in ignored `output/round9-artifacts/` before code changes. This report does not regenerate the Round 9 report.

## Modified files

- Mapping and report: `V12_REPAIR10A_MAPPING.md`, this file.
- Cloud pull, mapping, hydration, migration and account flow: `src/lib/sync/{pull,domain-mappers,restore,hydrate,migration,migration-server,server,adapters}.ts`, `src/lib/storage/{scoped,hydration-events}.ts`, `src/app/api/sync/{pull,migrate}/route.ts`, `src/app/me/account/page.tsx`.
- Existing domain repositories, types and mounted providers: `src/components/LearningProvider.tsx`, `src/components/{profile,dailyPlan,vocabulary,reading,listening,translation,writing,review}/*Provider.tsx`, `src/lib/{profile,dailyPlan,vocabulary,reading,listening,translation,writing,review}/*`, `src/types/{vocabulary,review}.ts`.
- Schema and tests: `prisma/schema.prisma`, `prisma/migrations/20260924120000_repair10a_review_payload/migration.sql`, `tests/v12-repair10a*.test.ts`, `tests/integration/v12-repair10a-db.test.ts`.

## Source-of-truth mapping

The pre-edit, code-derived matrix is in [V12_REPAIR10A_MAPPING.md](V12_REPAIR10A_MAPPING.md). Profile uses the V1 profile repository; XP and daily lessons use the V2 study repository; the five specialty sessions use their existing module repositories; wordbook is a flag on V3 vocabulary states; Review uses the schema-versioned V1 ReviewStore; DailyPlan and preferences share the V1 plan store; settings use the V2 study settings key; translation and writing history live in their existing module stores. The repair does not add a parallel local source of truth.

## Root causes and fixes

1. The old hydrate function wrote invented or incompatible local keys and JSON shapes. Remote rows now map into the existing scoped domain repositories, then a same-tab notification reloads mounted providers. The pull is ignored if its account is no longer active.
2. XP and completed sessions were present in PostgreSQL but missing from the stores read by V11 statistics. The mapper restores the study profile, full completed session snapshots, module progress and reward ledgers. Existing XP and statistics selectors continue to calculate the UI.
3. Wordbook rows now merge into vocabulary states with tombstone, timestamp and version metadata. Review rows become valid `schemaVersion: 1` keyed items, preserve available history and mastery, and retain a complete snapshot in the new nullable PostgreSQL `ReviewItem.payload` column.
4. Authenticated pull now includes translation and writing history. Those rows map to the existing history arrays and deduplicate on session and task IDs.
5. Remote repository writes do not call enqueue adapters. The daily-plan provider suppresses derived enqueue and reward echo caused by a remote refresh.
6. Guest detection and preview now read the current guest repositories, including XP, sessions, wordbook, Review, daily plan, changed preferences/settings, and subjective history. “稍后处理” only closes the preview. Confirm sends a stable migration ID and current guest mutations to one authenticated PostgreSQL transaction; it verifies rows before writing `MigrationRecord: completed`, then pulls and hydrates. Guest data is retained.
7. Migration retries are idempotent by `(userId, migrationId)` and `(userId, mutationId)`. A test-only failure injection rolls back the transaction; a normal production request cannot activate it.

## Regression tests

- Profile restore and same-tab refresh; XP/session restore through existing V11 selectors; Shanghai date boundary; wordbook tombstones; Review schema persistence and no mastered-state regression; authenticated translation/writing pull and local restore; queue stability and A/B/guest namespace isolation; guest preview, deferred migration, daily-plan and preference detection.
- Transaction-level idempotency, verification failure and injected rollback are covered by unit tests. A separate PostgreSQL integration test confirms real rollback, verified completion, row counts and retry deduplication using a disposable test account.

## Validation results

| Check | Result |
|---|---|
| `npm test` | Pass: 348 tests, 0 failures |
| `npx tsx --test tests/integration/v12-repair10a-db.test.ts` | Pass: 1 PostgreSQL integration test |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass; migration route included |
| `npm run content:validate` | Pass: 0 errors, 0 warnings |
| `npm run content:stats` | Pass: 59 mock content items |
| `npx prisma validate` | Pass |
| `npx prisma generate` | Pass, Prisma Client 6.19.3 |
| `npx prisma migrate deploy` | Pass: nullable Review payload migration applied to local `cet_six_v12_test` |
| `npx prisma migrate status` | Pass: database schema up to date |

## Remaining work for Repair 10B

Offline route and service-worker behavior, offline-to-online browser flow, two-device conflict behavior for XP/wordbook/Review/DailyPlan, mobile final acceptance and final V12 browser acceptance remain for later rounds. No final Browser E2E was run in Repair 10A. No merge, tag, release or V13 work was performed.
