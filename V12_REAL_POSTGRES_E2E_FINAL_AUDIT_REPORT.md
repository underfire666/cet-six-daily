# V12 Real PostgreSQL E2E Final Audit Report (Round 8)

- Date: 2026-09-23 (Asia/Shanghai)
- Branch: `feature/v12-cloud-sync`
- Commit: `6ac1b55` (Windows local, clean)
- Database: real PostgreSQL 18.6 on localhost:5432 / `cet_six_v12_test`
- Server: `next dev --hostname 127.0.0.1` (Next.js 16.3.5, Turbopack)
- Migrations: already applied by user (`prisma migrate deploy` twice, second run idempotent)
- Method: real HTTP against `http://127.0.0.1:3000`, PowerShell `Invoke-WebRequest` with separate WebRequestSession per user; Chrome desktop smoke for UI.

## Per-item results

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Real HTTP Register / Login / Logout | **PASS** | register 201; credentials callback 200; session cookie returns user; signout clears session (`"user":null`) |
| 2 | Duplicate email / Wrong password / Invalid payload | **PASS** | duplicate 409; bad email+short pw 400; password mismatch 400; wrong password returns `CredentialsSignin` |
| 3 | Unauthenticated sync → 401 | **PASS** | `GET /api/sync/pull` 401; `POST /api/sync/push` 401 |
| 4 | Rate limit → 429 | **PASS** | same IP register 11×: first 10 = 201, 11th and 12th = 429 |
| 5 | User A / User B cross-user isolation | **PASS** | A pushes `targetScore=620` + wordbook `apple`; B pull contains neither; A pull contains both |
| 6 | Forged `userId` in body ignored | **PASS** | push with body.userId of another user still scopes to session user (200, no leak) |
| 7 | Guest mode | **PARTIAL** | `/` and `/me` render without login; no complete guest study or refresh persistence was exercised |
| 8 | Guest → Account migration | **PARTIAL** | Login/register UI reachable; `migrationRecord` entity exists in sync layer, but end-to-end guest localStorage → account migration flow not exercised in this run |
| 9 | Migration / mutation idempotency & transaction | **PARTIAL** | Duplicate mutation IDs were skipped; guest migration and transaction rollback were not exercised |
| 10 | Two isolated browser contexts (Device A/B) | **NOT VERIFIED** | HTTP layer simulated A/B with two independent sessions; no second real browser profile opened |
| 11 | Translation / Writing history restore | **NOT VERIFIED** | entity types accepted by validator; no actual translation/writing history mutation pushed in this run |
| 12 | Streak / StudyStats restore | **NOT VERIFIED** | no `session` mutations pushed; streak recomputation not exercised against real DB |
| 13 | Offline → Online replay | **NOT VERIFIED** | client-side queue behavior not exercised |
| 14 | Sync echo (server→client on push) | **NOT VERIFIED** | push returns applied/skipped only; client echo merge not tested |
| 15 | Two-device XP | **PARTIAL** | XP whitelist + idempotency verified (item 16); concurrent two-device XP merge not exercised |
| 16 | XP security | **PASS** | bad source `hacked` → 400; amount 9999 → 400; valid source/amount accepted; same mutationId not double-applied |
| 17 | Wordbook tombstone / re-add | **PARTIAL** | Add then remove was observed; stale protection and intentional re-add were not exercised |
| 18 | Review version conflict | **PASS** | write v2 mastery=learning; stale v1 mastery=new does not overwrite (pull still shows learning) |
| 19 | DailyPlan union | **PARTIAL** | One upsert was accepted; two-device union and stale completion protection were not exercised |
| 20 | Profile / Preferences | **PARTIAL** | profile upsert (`targetScore=620`) persisted; no `preferences` mutation pushed in this run |
| 21 | Account switching | **NOT VERIFIED** | not exercised |
| 22 | Queue account isolation | **NOT VERIFIED** | client-side queue not exercised |
| 23 | PostgreSQL data integrity | **PASS** | 31 users, 31 profiles, 31 settings, 0 orphan profiles; wordbook/review/xp/dailyPlan rows consistent with pushed mutations |
| 24 | V4–V11 browser regression | **PARTIAL** | home (calendar, today, five modules), `/me`, `/me/account`, `/login` all render green theme with no runtime error; full learning session flow not clicked through |
| 25 | 375 / 390 / 430 px mobile smoke | **NOT VERIFIED** | desktop Chrome only |

## Counts

- PASS: 9
- PARTIAL: 8
- NOT VERIFIED: 8
- FAIL: 0

These counts reflect the 25 rows above. Round 9 corrected the original arithmetic and downgraded four rows whose evidence did not support PASS.

## Final conclusion

**V12 NEEDS FIX** (not "PASSES FINAL ACCEPTANCE").

Rationale: server auth and several individual sync mutations passed real PostgreSQL checks, but Guest learning, migration rollback, wordbook re-add and two-device DailyPlan union lacked end-to-end evidence. Eight other rows were not verified, including two isolated browser contexts, offline replay, history restore and account switching.

No code changes were required or made in this round; the existing `6ac1b55` build behaves correctly against real PostgreSQL.

## Follow-up needed before acceptance

1. Open a second Chrome profile (or incognito) as Device B, log in as user A, verify pull returns same profile/wordbook/review rows.
2. In Device A, go offline, complete a vocabulary session, come back online, verify queued mutations push once and do not duplicate XP.
3. Submit a translation and a writing entry, log out, log in on Device B, verify history rows exist.
4. Verify streak survives a logout/login cycle.
5. Test at 375/390/430 px widths.

Per instructions: no merge to main, no v12.0 tag, no Release, no V13. Awaiting independent final acceptance.
