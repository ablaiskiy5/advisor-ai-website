## Chat-to-task transfer session isolation — PR #96 (2026-10-24)

- [PR #96](https://github.com/ablaiskiy5/advisor-ai-website/pull/96) changes the AI-chat → task-board handoff to a one-time, owner-tagged browser session payload. The receiving page checks the verified Supabase user **before** displaying the text; mismatched and legacy unscoped payloads are discarded.
- Source-chat requests that finish after sign-out, account switch or same-account re-login cannot stage private tasks. Sign-out clears pending transfer storage. Synthetic tests cover the normal path and these session boundaries.
- Frontend and tests only. No customer data, plugin release, Supabase schema/RLS, secrets, quotas or Edge Functions changed. **Release gate:** confirm PR checks, merge, main-branch checks and Pages deployment. Authenticated two-account browser verification remains outstanding.

## Portfolio report session isolation — PR #95 (2026-10-24)

- [PR #95](https://github.com/ablaiskiy5/advisor-ai-website/pull/95) clears rendered portfolio metrics, holdings, conclusions and in-memory export data when the report tab receives a sign-out or account switch. A print-specific CSS override prevents hidden reports from reappearing on paper.
- Owner-scoped case reads now discard delayed responses after session invalidation, including sign-out/re-login to the same account. Synthetic regressions cover session clearing, token refresh, account switch, late case fetch and late authentication.
- Frontend and tests only. No plugin, Supabase policy, secret, paid setting or client record changed. Authenticated two-user browser verification remains outstanding; confirm successful PR CI, merge and Pages publication before calling this live.

## Workspace case/session isolation — PR #94 (2026-10-24)

- [PR #94](https://github.com/ablaiskiy5/advisor-ai-website/pull/94) clears Workspace case lists and portfolio snapshot caches on sign-out/account switch; delayed reads, case writes and snapshot responses are ignored after session changes (including same-user re-login). Case list/delete and snapshot reads are explicitly owner-filtered in addition to existing RLS.
- Synthetic regressions exercise stale case reads, cross-account/same-account login and late saves. This is frontend/test-only; Supabase policies, backend, plugin and client records were not changed.
- Release status requires successful PR checks, merge and Pages deployment. Two-account authenticated browser testing remains outstanding.

## Task organizer AI pilot access hardening — 2026-10-24

- Found secondary paid AI entrypoint `advisor-ai-organize-tasks` did not enforce the pilot email allowlist; any confirmed Supabase account could use up to 12 task parses/24h.
- Deployed `advisor-ai-organize-tasks` **v3 ACTIVE**: after JWT identity verification, require `email_confirmed_at` and a positive service-role-only `advisor_ai_is_allowed_email` check before parsing input or recording AI usage.
- Fetched deployed source and confirmed the check. Existing 12-per-user/day quota still uses count-then-insert and is **not atomic**. An attempted quota RPC migration was blocked by tooling; no schema change for task quota was applied.
- Still outstanding: genuine two-account browser E2E, actual model response, mobile/export QA, and Supabase Auth leaked-password protection (security advisor WARN). Four server-only RLS tables intentionally have no browser policies.

# PROJECT_STATE.md — Advisor AI Workspace

**Verified:** 2026-10-24 (Asia/Almaty), from connected GitHub and Supabase. This is the canonical handoff for new chats/agents. Do not assume a feature is live merely because it is in the repository. Update this file with every release.

## Task quick-action session isolation — PR #88 (2026-10-24)

- [PR #88](https://github.com/ablaiskiy5/advisor-ai-website/pull/88) captures the authenticated owner and session epoch for task status changes and one-day postponements. Delayed Supabase success or error after sign-out, account switch, or same-account re-login cannot mutate an old task object or display stale feedback.
- Four synthetic regressions cover normal owner-scoped updates, stale success, stale error and unauthenticated calls. No customer data, Supabase schema/RLS, plugin, secrets or production functions changed.
- **Release gate:** confirm PR CI, merge, merged-main checks and Pages deployment before claiming this is live. Two-account browser E2E remains outstanding.

## AI task batch-save session isolation — PR #87 (2026-10-24)

- [PR #87](https://github.com/ablaiskiy5/advisor-ai-website/pull/87) captures the authenticated owner and session epoch before inserting AI-proposed task cards. Late successes and errors after sign-out, account switch or same-account re-login no longer clear the next session's draft, close its review, show the old session's error or refresh tasks for the wrong account.
- Four synthetic tests cover normal owner-scoped insertion, stale success, stale failure and missing authentication. No customer data, Supabase policies, plugin files or production server functions changed.
- **Release gate:** confirm all applicable PR checks, merge and main-branch checks before reporting publication. Authenticated two-user browser testing is still outstanding.

## Task editor session safety — PR #86 (2026-10-24)

- [PR #86](https://github.com/ablaiskiy5/advisor-ai-website/pull/86) captures authenticated owner and session epoch before the task editor writes to Supabase. A delayed success or error after sign-out, account switch or same-account re-login cannot close the new editor, display the previous session's error, or refresh tasks under the wrong session.
- Synthetic regression tests exercise normal save, stale success and stale error. No actual two-account browser test, production task write or private data access was performed.
- Read-only production verification: private USER plugin **2.2.0**; Supabase chat Edge Function **v27**, task organizer **v2**, shared MCP **v4**; nine public tables report RLS enabled. Four backend-only tables intentionally have no direct client policies. Security advisor still warns that leaked-password protection is disabled.
- Release evidence and merge status must be confirmed from the PR and GitHub Actions before claiming deployment.

## In-flight task AI response isolation — PR #83 (2026-10-24)

- [PR #83](https://github.com/ablaiskiy5/advisor-ai-website/pull/83) guards AI-generated task proposals and stale error messages by the authenticated user ID **and** a session epoch. A reply arriving after sign-out, account switch, or sign-out/re-login to the same account is discarded instead of repopulating private draft tasks.
- Adds synthetic regressions for the normal proposal flow, sign-out, cross-account switch, same-account re-login, and late errors. **Release status depends on successful PR CI, merge and deployment;** this is not an authenticated two-user browser test.
- Read-only component verification on 2026-10-24: private USER-scope plugin **2.2.0**, Supabase `advisor-ai-chat` **v24**, `advisor-ai-organize-tasks` **v2**, `advisor-ai-shared-tools` **v4**. Eight listed public tables have RLS enabled; this alone does not establish two-user isolation. No backend, schema, secrets or permissions changed in PR #83.

## Workspace HTML integrity — PR #78 (2026-10-24)

- [PR #78](https://github.com/ablaiskiy5/advisor-ai-website/pull/78) removes 28,835 characters of accidentally appended duplicate JavaScript/markup after the first complete `workspace.html` document. The retained inline JavaScript was syntax-checked; the original page functionality was not intentionally changed.
- Adds a regression to require exactly one complete closing document and no stray trailing source, alongside the existing Workspace syntax and portfolio math tests.
- Frontend and test only; no Supabase schema, RLS, plugin release, market data, client information or credentials changed. GitHub CI and Pages deployment are separate release gates; authenticated browser and mobile Safari tests remain outstanding.

## AI chat session isolation — PR #77 (2026-10-24)

- [PR #77](https://github.com/ablaiskiy5/advisor-ai-website/pull/77) clears private AI-chat messages, last answer/export source, drafts, pending attachments, printed report and case context when Supabase signals sign-out or a different account. Old in-flight history/attachment and AI/upload responses are ignored using a session epoch and owner check.
- Adds synthetic regression tests for state clearing and asynchronous guards. No Supabase migration, plugin release, customer data or permission change.
- **Verification boundary:** this is a code-level guard, not an authenticated two-account browser E2E test. Check PR and merged-main CI and Pages deployment before calling it released. Two-account login/attachment isolation and mobile Safari remain outstanding.

## Pilot allowlist and AI retry guard — 2026-10-24

- `advisor-ai-chat` **v27 ACTIVE**. Pilot AI access requires a verified email in private `advisor_ai_allowed_emails` (service-role-only RPC `advisor_ai_is_allowed_email`). Existing account's email seeded; new colleague emails must be explicitly added by an administrator. Signup itself remains public, but non-allowlisted users cannot invoke AI.
- `advisor_ai_request_reservations.message_id` now associates each billed request reservation with the actual owned user message. `reserve_advisor_ai_message` verifies message ownership and role and permits **up to 3 attempts per message**, counting each against per-user and global 24h limits. This retains the UI's 'retry AI answer' behavior while preventing unlimited retries of one message. The previous `reserve_advisor_ai_request` function remains deployed but the active Edge Function no longer calls it.
- SQL transaction/rollback smoke test checked three allowed attempts and fourth `retry_limit`; no permanent test reservations remain. No actual multi-account browser test or production AI response has been performed. Treat confidential client-data handling as blocked until full verification and approvals.
- GitHub PR #84 signup guidance passed both Integrated Quality Gate and Portfolio Snapshot Checks and was merged.

## Atomic AI quota release — 2026-10-24

- Supabase migration `atomic_ai_request_reservation_limits` created RLS-enabled, client-inaccessible `advisor_ai_request_reservations` and service-role-only `reserve_advisor_ai_request(uuid,integer,integer)` RPC.
- The RPC uses a transaction-scoped advisory lock, counts 24-hour reservations, and atomically reserves one slot. Effective per-user limit is the lesser of the account limit and server ceiling 30; new users auto-enroll at 10; global limit 150 reservations/24h. The reservation is **not** a dollar-cost cap; failures after reservation can consume one slot.
- Supabase `advisor-ai-chat` **v24 ACTIVE** calls the RPC after verifying the user, owned case, valid new user message and presence of API key. Previous count-then-check race removed.
- SQL transaction-and-rollback smoke test checked first reservation succeeds and second fails at user limit 1; authenticated role lacks EXECUTE on RPC. No live second-user/browser E2E, token-billing reconciliation or authenticated AI response tested. Registration of non-employee users remains possible; do not load confidential client data yet.

## Attachment authorization hardening — 2026-10-24

- Production Supabase migration `fix_attachment_message_case_ownership` applied: `advisor_ai_attachments` INSERT RLS now requires `advisor_ai_messages.case_id = advisor_ai_attachments.case_id`, not the previous tautology `m.case_id = m.case_id`.
- Post-migration `pg_policies` verification: `enforces_matching_case=true`, `has_old_bug=false`. This prevents a user attaching metadata for a message from another of their own cases; existing owner and storage path checks remain.
- Security advisor still flags disabled leaked-password protection; configure it in Auth settings. This is a policy verification, **not** an authenticated two-account E2E test.
- Release remains gated on verified signup/AI/chat/files with two dummy users, browser/mobile UX and usage-spend protection.

## Pilot readiness — 2026-10-24

- **Deployment:** Supabase `advisor-ai-chat` v22 is ACTIVE and its deployed source was re-read. Verified-email users now auto-enroll at first AI request with 10 requests per 24 hours. Existing explicitly disabled accounts remain disabled. Per-user server ceiling is 30 requests per 24 hours; global server ceiling is 150 user messages per 24 hours. These are simple count-based limits, **not** atomic concurrency-safe billing controls or a monetary spending cap.
- **Security:** Authentication is checked with Supabase Auth; case access uses the requesting user's JWT and RLS. No secret keys were added to the browser. Database security advisor still warns that leaked-password protection is disabled. Confirmed users are not equivalent to organization-vetted employees: open signup permits outside users, subject to the global request cap.
- **Remaining release blockers:** authenticated two-account E2E (signup, email verification, separate cases and attachments, sign-out, AI answer, repeat login), real PDF/DOCX/PPTX rendering, mobile Safari UX, end-to-end spend controls, and registration/organization restrictions if handling real client data.
- **Pilot decision:** Test or anonymized data only. Do not claim production-grade client-data handling until cross-account E2E, secure onboarding and review are complete. Target pilot Tuesday 2026-10-27, subject to release gates.

## FX sensitivity guard — PR #74 (2026-10-24)

- [PR #74](https://github.com/ablaiskiy5/advisor-ai-website/pull/74) changes the KZT cash FX sensitivity to **withhold percentage impact** when estimated NAV is zero or negative. For negative NAV, dividing a USD loss by a negative denominator would misleadingly display a positive percentage; for zero NAV, a null percentage previously risked a browser rendering error.
- The absolute USD change is still shown; a clear disclosure explains why percentage sensitivity is not meaningful. Positive-NAV behavior is unchanged. Synthetic tests cover positive, zero and negative NAV.
- Scope: frontend and tests only. No change to RLS, Supabase, plugin release, actual quote data, credentials or private cases. Check PR merge and CI conclusions before calling this deployed. Logged-in browser E2E remains unverified.

## Latest inspected production baseline (2026-10-24)

- GitHub `main` before PR #74: `f06ff28742478295b555eb0480f01414519a4428` (merged [PR #73](https://github.com/ablaiskiy5/advisor-ai-website/pull/73), KZT cash FX sensitivity).
- Plugin `plugin_5d899bb8d1248191861dff1b4a9295a0`: 2.2.0, private, USER scope. Shared public MCP URL configured; plugin skill is not a callable private backend.
- Supabase `xhewhzgzzonpgsjznmyl`: ACTIVE_HEALTHY; `advisor-ai-chat` v21, `advisor-ai-organize-tasks` v2, `advisor-ai-shared-tools` v4. Seven inspected public tables have RLS enabled; this does **not** prove cross-user isolation.
- Security advisor: leaked-password protection disabled (WARN); `advisor_ai_access` and `advisor_task_ai_usage` have RLS with no policy (INFO, potentially intentional for backend-only use). No database settings changed.

## Portfolio reporting releases — PR #67–#68 (2026-10-24)

- [PR #67](https://github.com/ablaiskiy5/advisor-ai-website/pull/67) merged as `63090b51bbff08e6437db7e0acb217e8e478b6ff`: instrument-name CSV escaping and formula-injection prevention with regression tests. CI passed.
- [PR #68](https://github.com/ablaiskiy5/advisor-ai-website/pull/68) merged as `33c16cb6810ea43b218dc7fb7d3eda3a31886a50`: investment report and conclusion explicitly distinguish report generation time from **unverified** asset valuation date and quote provenance. First PR CI failed due to a faulty HTML matching assertion; corrected, then all three PR workflows and merged-main workflows passed. [Pages deployment passed](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40069717607).
- These changes do **not** add real-time prices, verified quote timestamps, broker statement reconciliation or authenticated browser E2E.

## Task-board session isolation — PR #66 (2026-10-24)

- [PR #66](https://github.com/ablaiskiy5/advisor-ai-website/pull/66) clears cached task cards, unsaved draft/editor fields and export eligibility when Supabase signs out or the signed-in account changes. This prevents task information from a previous session remaining on screen in the same tab.
- Paginated reads capture the owner ID and request revision; older in-flight responses cannot repopulate tasks after sign-out, account switch or a newer refresh. Synthetic regression tests cover sign-out and deferred old-owner responses.
- Scope: static task-board frontend and synthetic tests only. No production customer records, RLS policies, backend functions, credentials or paid configuration changed. Authenticated cross-tab browser E2E is still unverified. Check actual PR CI, merge and Pages deployment status before describing this change as released.

## Task-board pagination safeguard — PR #65 (2026-10-24)

- Task loading previously stopped after 500 records, so CSV and calendar exports could silently omit older tasks. [PR #65](https://github.com/ablaiskiy5/advisor-ai-website/pull/65) introduces owner-scoped, stable 500-row pagination and full export only after every page is loaded.
- Defensive ceiling: more than 10,000 rows or a failed page blocks export rather than publishing a partial file. Synthetic regression tests cover 0, 499, 500, 501, 1,201, 10,001 rows, network errors and exports.
- This is a frontend-only change: no RLS policies, credentials, client data, paid settings, plugin release or Edge Functions are changed. Authenticated browser E2E remains unverified. Verify PR CI and deployment outcomes before claiming production success.

## Repositories and deployment surfaces

- Frontend: [`ablaiskiy5/advisor-ai-website`](https://github.com/ablaiskiy5/advisor-ai-website), public, `main`, GitHub Pages static HTML/JS.
- Separate historical MCP service: [`ablaiskiy5/advisor-ai-mcp`](https://github.com/ablaiskiy5/advisor-ai-mcp), private, FastMCP/Python, single `bond_current_yield` tool. **Do not mistake this legacy service for the four-tool production Supabase shared MCP service.**
- Supabase project `advisor-ai-workspace`: ref `xhewhzgzzonpgsjznmyl`. Connected project status: `ACTIVE_HEALTHY`.
- Supabase functions seen active on 2026-10-24: `advisor-ai-chat` **v21**, `advisor-ai-organize-tasks` **v2**, `advisor-ai-shared-tools` **v4**. The shared tools service exposes exactly four deliberately public, stateless deterministic calculators.
- ChatGPT plugin `Advisor AI | Investment Intelligence` is **not** an executable backend callable by the website. The frontend uses Supabase and a versioned copy of the plugin skill as described in [docs/ADVISOR_AI_CORE.md](docs/ADVISOR_AI_CORE.md). Plugin runtime invocation was **not** reverified during this handoff.

## Stable shipped baseline

**Previous GitHub `main` at start of this continuation:** `7bfa95ac536c048b0c84140578ea8396c27abced`, merged PR [#57](https://github.com/ablaiskiy5/advisor-ai-website/pull/57), 2026-10-24. PR #45 (real DOCX regression) was an earlier milestone, **not** the latest revision.

Relevant existing modules:
- `workspace.html`: signed-in case management, saved positions, import and portfolio snapshots.
- `ai-chat.html`: case chat, attachment handling and DOCX/PPTX/PDF export.
- `portfolio-report.html`: holdings valuation, HHI and concentration, duration risk, combined equity/yield stress, custom scenario and proposed asset-class reweighting. User-entered prices only, no verified live quotes.
- `bond-analysis.html`: bond yield/duration analyses.
- `ideas-risk-budget.html`: pooled speculative risk-budget controls.
- `tasks-board.html`: Supabase tasks, AI task proposals, CSV/iCalendar export.
- `tools-health.html`: browser-based diagnostic for the **public** four-tool MCP service.

## Recent releases — PR #58–#62

- **PR #61** merged as `15e817765a0e920e9044b199fe1d4ab5cffe44be`: DOCX real-file validation now runs before PR merge; [CI passed](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40059662891).
- **PR #62** merged as `97f993d7c7534201f189bc3d65770d9eb3f9f644`: integrated cross-module regression workflow covering all existing Node tests and presentation logic; [PR CI passed](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40059765302). This is not authenticated end-to-end browser coverage.


- **PR #59** merged to `main` as `3c44627d1bb4820f89fd80ebb69ba8c9a5ca1a87`: shared public MCP live checks now validate metadata and reject additional invalid requests; [CI passed](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40059442749).
- **PR #60** merged to `main` as `70227797cf87f8905a0039d3a58d3dffe885c005`: presentation splitter regression now covers Cyrillic, Arabic, Chinese, and dense emoji; [PR CI passed](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40059557843). These are automated unit-level checks, **not** mobile Safari or real PPTX open/render tests.
- Next: real browser E2E under a dummy account; private OAuth consent bridge; document rendering validation.

## Earlier completed release — PR #58

Merged [PR #58](https://github.com/ablaiskiy5/advisor-ai-website/pull/58) to `main` on 2026-10-24 as commit `8382efbe5de6184ed765c10487a9fc67ea2120c1`.

- Add a **deterministic, editable investment-conclusion draft** to `portfolio-report.html`, based only on parsed holdings and existing target allocation; safeguards for missing targets, missing classes, valuation provenance, concentration, duration and illustrative stress.
- Add explicit user-triggered copy and UTF-8 text export; no transmission to third parties or saved recommendation.
- Add `tests/portfolio-conclusion.test.mjs` and run through portfolio snapshot GitHub Actions workflow.
- Keep this handoff document and the README up to date.

**Release gate observed:** both portfolio workflows passed on the PR and again on merged `main` commit `8382efbe5de6` ([snapshot checks](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40058367899), [stress tests](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40058367968)). GitHub Pages publication for that commit was still pending at the time of this status update; see [deployment run](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40058367612) for its actual conclusion. Logged-in browser E2E remains unverified.

## Recent verification evidence

- GitHub Actions `Advisor AI Portfolio Stress Tests` and `Advisor AI Portfolio Snapshot Checks` passed on `7bfa95ac...` on 2026-10-24.
- GitHub Pages deployment passed on `7bfa95ac...`.
- The real, external `Advisor AI MCP Live Verification` workflow passed on `035de0df...` (PR #56) on 2026-10-24. This tests public discovery, four allowlisted tools, deterministic maths and rejection of invalid/private tool calls; it **does not** test authenticated private cases, user OAuth or AI calls to MCP.
- Supabase read-only inspection on 2026-10-24 confirmed all three listed edge functions active and RLS enabled on the seven listed public tables. It did **not** authenticate as a client or test row isolation between users.
- Supabase security advisor on 2026-10-24: **WARN** leaked-password protection disabled ([remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)); INFO two backend-only tables (`advisor_ai_access` and `advisor_task_ai_usage`) have RLS enabled with no policies ([explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)). No policy is safe against direct user access only if intentional; verify backend's service-role-only path before changing grants/RLS. No security settings were changed here.

## Ranked next engineering work

1. OAuth 2.1 user-consented bridge for **private** ChatGPT plugin ↔ Supabase cases/tasks; requires secure configured consent/login + owner-scoped JWT/RLS + audit trail. Never use service-role credentials in a public client.
2. End-to-end tests under a **test account**: authenticated file upload and full AI answer, user-scoped cases, DOCX/PPTX/PDF output, task capture, shared MCP use from model. Existing CI is not an E2E browser check.
3. Investment report to client-ready workflow: broker statement parsers, currencies, issuer/sector classification, ratings, liquidity, date-stamped sources, cash/margin/FX and reviewed recommendations. Do not hallucinate unsupported attributes.
4. Presentation exporter quality and cross-device tests, especially real mobile Safari.
5. Financial market data: source, timestamp and staleness warnings; do not treat search results as executable exchange-grade quotations.
6. Review Auth's leaked-password protection in Supabase dashboard; check security advisories regularly. Recheck background-only RLS tables rather than adding permissive policies.

## Standard workflow for every subsequent chat

1. Read `PROJECT_STATE.md`, `docs/ADVISOR_AI_CORE.md`, `README.md`; confirm current `main` HEAD and open PRs.
2. Compare file tree with requested feature, avoid duplicate tools. The ChatGPT plugin does not act as a general API for Workspace.
3. Create a small feature branch from current `main`. Run or add production-code regression tests and CI gates before merge.
4. Verify actual GitHub Actions run conclusion; do not report deployment or MCP/OAuth end-to-end as confirmed without explicit evidence.
5. Update this file: release SHA, exact checks passed, blockers and the next three priorities. Documentation-only checkpoint commits on `main` must also be recorded in Git history.
6. Do not log/upload customer identifiers, positions, tokens, access keys or screenshots into public GitHub.
