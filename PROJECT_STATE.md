## Anonymous private-resource read boundary smoke (read-only) — 2026-10-28

- [PR #206](https://github.com/ablaiskiy5/advisor-ai-website/pull/206) was squash-merged to `main` as [1d580c9](https://github.com/ablaiskiy5/advisor-ai-website/commit/1d580c937106f5209119c957f3ab5d6787524609). Extended the existing `scripts/smoke-owner-rls-readonly.sql` and Node contract regression to cover the anonymous role. No browser behavior, Auth/RLS grants or policies, schema, private data, plugin, Edge Functions, quotas or credentials changed.
- Live read-only Supabase SQL: with `SET LOCAL ROLE anon`, `auth.uid() IS NULL`, **all five private user-facing tables have no anonymous SELECT grant** (`PASS`), and **zero rows are visible** in the private `advisor-chat-attachments` bucket under anonymous RLS (`PASS`). A direct anonymous SELECT on `workspace_items` was denied by PostgreSQL, as expected. All checks used `BEGIN READ ONLY` / `ROLLBACK`, returned no client records or object paths, and made no database changes.
- PR-head [Integrated Quality Gate](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40576189351) and merged-main [Integrated Quality Gate](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40576299290) passed. Merged-code [GitHub Pages build/deployment](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40576298210) completed successfully. This is SQL/test-only and does **not** prove authenticated browser or client-side behavior.
- Read-only runtime checks: private plugin **2.2.0**, Supabase `ACTIVE_HEALTHY`, chat **v28 ACTIVE**, tasks **v3 ACTIVE**, shared MCP **v7 ACTIVE**, and RLS enabled on **9/9** public tables. Supabase security advisor still reports leaked-password protection disabled; four backend-only RLS tables intentionally have no browser policies.
- **Remaining P0 / next:** independently authenticated, consented **two-user browser** QA with synthetic cases/tasks and PDF/image uploads; verify owner-positive reads, cross-owner denials, storage signed URLs, retry/reload with blocked `sessionStorage`, live AI responses and mobile UX. This anonymous smoke does not validate writes, OAuth, signed URLs or owner-positive access. Do not use confidential client data before required security/compliance review. `ROADMAP.md` remains open.

## Synthetic-owner RLS visibility smoke (read-only) — 2026-10-28

- [PR #204](https://github.com/ablaiskiy5/advisor-ai-website/pull/204) was squash-merged into `main` as [624299b](https://github.com/ablaiskiy5/advisor-ai-website/commit/624299ba1b17909585dac6a54ef8e68e8210cf28). Added `scripts/smoke-owner-rls-readonly.sql` and a Node regression guarding its read-only, owner-scoped coverage. No application runtime behavior, user data, policies, grants, plugin, Edge Functions, credentials, quotas, trades or outbound messages changed.
- Verified against the live Supabase database using **two synthetic UUIDs not present in `auth.users`** (registration count 0): each transaction switched to `authenticated` with its own `auth.uid()` claim, ran `BEGIN READ ONLY` and `ROLLBACK`, and returned `PASS` with **0 visible rows** for each of the five owner-scoped tables and private attachment storage. This tests SELECT visibility for non-owners; it is **not** a two-account browser session test, proof of owner-positive reads, write isolation or signed-URL security.
- PR-head [Integrated Quality Gate](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40567523755) and merged-main [Integrated Quality Gate](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40567612691) passed; merged-main Node suite reported **318/318 passed**, including the two new SQL-contract regressions, plus existing portfolio math, presentation and syntax checks.
- GitHub Pages [build/deployment](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40567627699) completed **successfully** for merged code. This SQL/test-only change does not affect published browser code; deployment success is not authenticated browser QA.
- Read-only integration snapshot: private plugin **2.2.0**, Supabase `ACTIVE_HEALTHY`, `advisor-ai-chat` **v28 ACTIVE**, `advisor-ai-organize-tasks` **v3 ACTIVE**, `advisor-ai-shared-tools` **v7 ACTIVE**, and RLS enabled on **9/9** public tables. Existing security advisor warning: leaked-password protection disabled; four backend-only RLS tables intentionally have no browser policies.
- **Remaining P0 / next:** independently authenticated, consented **two-user browser** QA with synthetic tasks, cases and PDF/image uploads; verify owner-positive reads, cross-owner denials, storage signed URLs, retry/reload with `sessionStorage` disabled, real AI response and mobile navigation. Do not use confidential client data until required security/compliance approval. `ROADMAP.md` remains open because these acceptance criteria are not met.

## AI-chat history refreshes ignore stale overlapping responses — 2026-10-27

- Confirmed source-level race: two `history()` calls in the same authenticated session could finish out of order. Session-epoch checks protected sign-out but not overlapping requests; a late message or attachment-metadata response could replace newer history, status and retry UI.
- [PR #202](https://github.com/ablaiskiy5/advisor-ai-website/pull/202), squash-merged as [35d0baa](https://github.com/ablaiskiy5/advisor-ai-website/commit/35d0baa6d72fb42f03f24bbb2071ba5da86b582f), adds a monotonically increasing history request sequence. Superseded results are ignored after both async query boundaries, and sign-out invalidates outstanding history requests. No client records, attachment objects, Auth, RLS, Edge Functions, plugin release, API quotas or paid calls changed.
- Two production-source synthetic Node VM regressions simulate an old message query returning after a newer refresh and a stale attachment-metadata failure after newer success. Final PR-head checks passed: [integration](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40559556388), [DOCX](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40559556122), [presentation](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40559555792). Merged-main checks passed: [integration](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40559630802), [DOCX](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40559630837), [presentation](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40559630762). The merged-code [GitHub Pages build/deployment](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40559630478) completed successfully. This does not establish logged-in browser behavior.
- Read-only Supabase verification: project `ACTIVE_HEALTHY`; `advisor-ai-chat` v28, `advisor-ai-organize-tasks` v3, shared MCP v7 all ACTIVE; RLS enabled on all **9/9** public tables. Owned private plugin release remains **2.2.0**. Security advisor still warns that leaked-password protection is disabled; four backend-only RLS tables intentionally have no browser policies.
- **Remaining / next:** independently authenticated two-account synthetic browser tests for file upload/reload/retry, cross-owner storage isolation and browser restart with `sessionStorage` disabled. The in-memory incomplete-upload marker is not durable across full reload when storage is unavailable. No live confidential client data until required review. CI is not authenticated browser QA.

## AI retry fails closed when attachment history cannot be verified — 2026-10-27

- Confirmed defect in `ai-chat.html`: if the authenticated attachment-metadata query failed, history still exposed the AI retry control and `requestAI()` could invoke a paid model call without verifying which files were linked. This is not proof that any user data was exposed, but it risks incomplete file-based analysis.
- [PR #200](https://github.com/ablaiskiy5/advisor-ai-website/pull/200) makes the client reject AI invocation until the current case's message and attachment history load successfully. The retry control is hidden on metadata failure and reappears after a successful refresh. The verification flag resets before history fetch and on sign-out. No stored messages, attachments or policies are changed.
- Production-source synthetic Node VM regressions cover attachment-metadata failure, message-history failure, zero paid AI invocations, stale retry hiding and successful recovery. The inline JavaScript parsed successfully. Final PR-head checks passed: [Integrated Quality Gate](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40550311915), [DOCX](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40550312069), [presentation](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40550312247). PR #200 was squash-merged to `main` as [90f9155](https://github.com/ablaiskiy5/advisor-ai-website/commit/90f9155b0674c63478156f0b83e3c9d6a0132a23); merged-main [integration](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40550379028), [DOCX](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40550379207), [presentation](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40550379118) and [GitHub Pages deployment](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40550377679) all completed successfully. These are automated checks, not authenticated two-account E2E.
- Read-only runtime audit this run: owned private plugin release **2.2.0**; Supabase project `ACTIVE_HEALTHY`, `advisor-ai-chat` v28, task organizer v3, shared MCP v7. All **9** public tables still have RLS enabled. Security advisors continue to warn about leaked-password protection being disabled; four backend-only RLS tables have no browser policies by design. No schema, grants, quotas, credentials, customer records, plugin release, server functions, trades or messages changed.
- Previous blocked canonical documentation [PR #199](https://github.com/ablaiskiy5/advisor-ai-website/pull/199) was successfully squash-merged as [147ad58](https://github.com/ablaiskiy5/advisor-ai-website/commit/147ad588f841e2ce920eec44b124768fbf7f8612), resolving the transient GitHub merge lock.
- **Remaining / next:** independently authenticated two-account browser file upload/reload/retry, storage-owner isolation and full browser-restart tests with synthetic accounts. If `sessionStorage` is blocked across reload, the earlier incomplete-upload marker is still not durable. A successful CI/Pages run is not confidential client-data approval.

## Incomplete-upload retry protected when browser storage is blocked — 2026-10-27

- Confirmed limitation: with `sessionStorage` disabled by browser privacy settings, the saved incomplete-upload UUID marker was lost. A same-page history refresh could then expose the paid AI retry for a message with missing PDF/image attachments.
- [PR #198](https://github.com/ablaiskiy5/advisor-ai-website/pull/198) adds a per-page in-memory fallback containing only the incomplete message UUID, keyed by authenticated owner and case. The latest in-memory marker wins if browser storage writes fail; it is cleared on session reset or when the incomplete message is superseded. Ordinary `sessionStorage` reload protection remains. Merged to `main` as [3c5e7c7](https://github.com/ablaiskiy5/advisor-ai-website/commit/3c5e7c789338773f4ad2ea40771bd80318833604).
- Synthetic production-source Node VM regression now checks disabled storage, owner/case separation, zero paid AI calls, marker cleanup and sign-out. Initial PR CI failed because the isolated sign-out test harness did not supply the new Map; fixed before merge. Final PR-head [integration](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40539169188), [DOCX](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40539168856) and [presentation](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40539169123) checks all passed. Merged-main [integration](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40539244311), [DOCX](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40539244299) and [presentation](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40539244260) checks passed. GitHub Pages [build and deployment](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40539243341) completed successfully after the code merge. This is not authenticated browser QA.
- Read-only Supabase audit on 2026-10-27: **10** storage objects in the private attachment bucket, **10** attachment metadata rows and **0** storage objects without metadata, comparing `storage.objects.name` to `advisor_ai_attachments.object_path`. No object paths, file contents or user identities were retrieved; no objects were deleted. Existing storage RLS includes owner-scoped SELECT/INSERT/DELETE policies.
- Scope: static chat UI and synthetic tests only. No client data, keys, plugin, backend, schema/RLS, quotas, paid requests, trades or outbound messages changed.
- **Remaining blocker / next:** if browser storage is unavailable, a full page reload still loses the in-memory marker. Complete independent two-account authenticated browser upload/reload/retry and storage-owner isolation QA using consented synthetic accounts; then consider a durable owner-scoped incomplete-upload state only if justified. GitHub CI is not authenticated browser E2E.

## Incomplete attachment retry remains blocked after page reload — 2026-10-27

- Confirmed defect: after an attachment upload partially failed, the retry control was hidden only in memory. Reloading the chat reconstructed it from the last saved user message and could offer a paid AI retry without the missing PDFs/images.
- [PR #196](https://github.com/ablaiskiy5/advisor-ai-website/pull/196) adds a tab-scoped, owner-and-case-keyed marker containing **only the saved message UUID**. History reload hides the unsafe retry and explains that missing attachments must be sent in a new message; `requestAI()` also refuses to invoke the paid backend for that incomplete latest message. A newer user message clears the old marker. No message text, attachment names or file bytes are stored in the marker.
- Synthetic production-function Node VM tests cover reload, owner/case separation, stale-marker cleanup, unavailable session storage, and the actual send-path marker; final PR-head checks passed: [Integrated Quality Gate](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40530178146), [DOCX](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40530178108), [presentation](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40530178114). Merged to `main` as [9f3c2b4](https://github.com/ablaiskiy5/advisor-ai-website/commit/9f3c2b491b197dd3d1d0f3c4d6c5c6f150b8561f). Merged-main checks passed: [Integrated Quality Gate](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40530364157), [DOCX](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40530364170), [presentation](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40530363898). [GitHub Pages build/deployment](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40530360611) completed successfully. CI and Pages do not establish authenticated browser E2E.
- Scope: static chat frontend and synthetic tests only. No live user accounts, client data, secrets, plugin release, Supabase schema/RLS/functions, quotas, trades or messages changed.
- Limitations: sessionStorage may be unavailable, and the marker is per tab rather than a durable server-side upload status; cross-tab, browser-restart and independently authenticated two-account E2E remain unverified. **Next:** two-account synthetic browser upload/reload/retry and storage-owner isolation, read-only orphaned-object inspection, then evaluate a durable user-scoped incomplete-upload state only if justified.

## Chat partial-upload retry queue avoids duplicate files — 2026-10-27

- Confirmed defect: after the first file was successfully linked but a later PDF/image upload or metadata insert failed, `ai-chat.html` retained **all** originally selected files in the pending queue. Resending missing attachments could upload already-linked files again and duplicate the original saved question.
- [PR #194](https://github.com/ablaiskiy5/advisor-ai-website/pull/194), squash-merged to `main` as [cd7c06a](https://github.com/ablaiskiy5/advisor-ai-website/commit/cd7c06a644bbe73a6978f241d0ac1047d580cfe8): retain only not-yet-linked files after a partial failure; clear the already-saved question, hide immediate AI retry while files are missing, and refresh removable attachment chips after unlocking controls. The user is instructed to send the remaining queued files in a **new** message before analysis.
- Synthetic Node VM regressions execute the production `send()` path for first upload failure, partial upload, metadata failure, successful upload, history refresh failure and resending only the missing file. First PR CI failed on a cross-realm test assertion (identical array values with different VM prototypes); fixed before merge. Final PR-head [integration](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40520874231), [DOCX](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40520874236) and [presentation](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40520874234) checks all passed. Merged-main [integration](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40520980028) passed **308/308** Node tests; [DOCX](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40520980261), [presentation](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40520980553) and [GitHub Pages deployment](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40520977711) completed successfully.
- Scope: static chat UX and synthetic tests only. No real files, private user data, storage objects, plugin release, Supabase schema/RLS/functions, secrets, paid quotas, trades or outbound messages changed. GitHub CI/Pages are **not** authenticated browser E2E.
- Remaining: retry may reappear after a page reload for a partially saved message because the upload failure has no durable message status; storage objects whose metadata insert failed can remain orphaned. **Next:** independently authenticated synthetic two-account upload/reload/retry and storage-owner isolation QA, read-only orphan inspection; only then consider a safe persisted incomplete-upload marker/cleanup strategy. Corporate security approval remains required for confidential client data.

## Chat attachment recovery is explicit about partial uploads — 2026-10-27

- Confirmed defect in `ai-chat.html`: if a user message was saved but an image/PDF upload or its metadata insert failed, the interface suggested `Повторить ответ AI`. That operation does not reupload missing attachments and could lead to an incomplete portfolio/file analysis.
- [PR #192](https://github.com/ablaiskiy5/advisor-ai-website/pull/192), merged into `main` as [1c2a21b](https://github.com/ablaiskiy5/advisor-ai-website/commit/1c2a21b151214cb82a4118b6e046601dfb5ee246), changes only chat failure guidance: counts attachments confirmed linked to the message; on partial failure tells the user exactly how many linked and to send missing files in a new message **before** asking AI to analyze. If all attachments were linked and only history refresh failed, ordinary AI retry remains available.
- Five synthetic Node VM regressions cover failed first upload, partial upload, metadata failure, completed upload with failed history refresh, and successful upload/AI path. The first PR CI attempt failed because the new test harness omitted the existing `voiceRecognition` variable; corrected on branch. Final PR-head checks passed: [Integrated Quality Gate](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40511350147), [presentation checks](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40511350200), [DOCX validation](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40511350126). Merged-main [integration](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40511410773), [presentation](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40511411037), [DOCX](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40511411090) and [GitHub Pages deployment](https://github.com/ablaiskiy5/advisor-ai-website/actions/runs/40511410213) all completed successfully. These are automated checks, not authenticated browser E2E.
- Scope: static browser feedback and synthetic tests only. No real attachments, client data, plugin release, Supabase schema/RLS/functions, secrets, quotas, trades or outbound messages changed. RLS remains enabled on all nine public tables; independent two-account authenticated E2E remains outstanding.
- Next: test upload/partial-failure/retry in two independently authenticated synthetic browser accounts, verify attachment/storage owner isolation, and inspect possible orphaned storage objects read-only before considering any cleanup. No live client data until compliance approval.

## Scenario-first Workspace, light UI and concise AI responses — 2026-10-27

- User/colleague feedback: black-on-dark dense chat unreadable, excessive generic AI prose, universal create-case-then-fill-form flow across every section, cluttered buttons and unattractive/inconsistent visual styling.
- Frontend delivered and merged: **#173** light safe Markdown answer rendering with semantic headings/lists/tables; **#174** light Workspace homepage and section-specific one-click flows; **#175** brain-dump-first light task board; **#176** unified light report/calculator/diagnostics themes with print overrides; **#177** collapsed secondary chat export/context/diagnostics controls, readable signup guidance. All associated PR quality checks passed before merges.
- New Workspace flows automatically create an owned private case (existing `workspace_items` RLS and `persist` unchanged) and open the appropriate work area. Portfolio: upload image/PDF via existing chat attachment UI, or open numeric holdings editor directly. Ideas: single-company research vs sector search. Academy: explain topic vs oral exam. Markets: event analysis vs macro scenarios. Manual creation remains possible, settings/prompt/optional external ChatGPT connection are collapsed.
- Server updated in place: `advisor-ai-chat` **v28 ACTIVE**, `verify_jwt=true`. Appends scenario-specific short-answer policy after shared Advisor AI methodology: answer-first, useful 2–4 short blocks, at most one necessary question, default approximately 160–300 Russian words, no boilerplate. Explicit deep analyses/documents remain full length. It does not alter shared private plugin skills, paid credentials, quotas, allowlist, message storage, user ownership or tools.
- IMPORTANT: Chat UI and section actions were regression-tested in CI; site build and GitHub Pages deployment are separate checks. A real logged-in colleague should verify **new** AI responses after v28, case creation/navigation, uploads, task proposals and exports, plus mobile layout. Saved old answers are unchanged. Do not claim the new UX has been visually browser-QA verified or is approved for confidential client data.
- Pending: independently authenticated two-account full browser QA and corporate security/compliance approval where needed. The backend task-organizer usage limit remains non-atomic under concurrent requests and Supabase leaked-password protection warning remains until dashboard setting is enabled.

## Pilot AI activation 42501 fix — 2026-10-27

- User screenshot: `Ответ не получен: Не удалось активировать AI-доступ` during initial AI answer; question and image attachment remained stored.
- Supabase function logs show `AI enrollment error {"code":"42501"}` and Postgres reports `permission denied for table advisor_ai_access` for the server-side upsert.
- Root cause: `service_role` had SELECT on `advisor_ai_access` but not INSERT. The Edge Function `advisor-ai-chat` **v27** expects to insert a row upon first request by a confirmed allowlisted account; it refused before reserving a paid AI attempt.
- Applied one narrow database migration: `GRANT INSERT ON TABLE public.advisor_ai_access TO service_role;`. Verified `service_role` SELECT+INSERT but no UPDATE/DELETE, and `anon`/`authenticated` still have **no** table privileges. RLS stays enabled; no pilot email allowlist rules, AI quotas or secrets changed.
- Transaction-rolled-back SQL smoke test acting as `service_role` successfully inserted an access record for a uniquely selected confirmed allowlisted account, then rolled back.
- Activated the single confirmed allowlisted account registered on 27 October that lacked a row; post-write query confirmed **2** enabled access rows and **0** pending allowlisted confirmed accounts. No personal identifiers recorded in this log.
- Github migration snapshot: `supabase/migrations/20261027_grant_service_role_ai_access_enrollment_insert.sql`.
- **Still unverified:** a real user click on `Повторить ответ AI` succeeding end-to-end through OpenAI. A user should retry the already-saved question, not reupload attachments or repeatedly register.

## Pilot onboarding and AI task workflow — 2026-10-27

- User-reported screenshots exposed confusing registration, hard-to-find Workspace return links, and AI task/portfolio 403 denials on a newly registered confirmed account.
- Merged **#166** (registration-first explanations and prominent Workspace links), **#167** (Russian-language Supabase auth 429 / retry guidance), **#168** (AI-generated task proposals grouped by sphere and priority with a count summary and approval preserved), and **#169** (persistent left-side Workspace link in six standalone work areas; mobile sticky header; hidden on print). Associated PR CI gates passed prior to merge.
- Live Supabase account audit showed exactly **2 registered confirmed users**, of whom **1** was initially allowlisted; exactly **1** confirmed account was created on Oct 27 and missing pilot AI access. Inserted precisely that sole eligible recently registered account into `advisor_ai_allowed_emails` using a uniqueness-guarded query. Follow-up count confirmed **2 allowlisted / 2 confirmed accounts**. No bulk grant, no global-open access, no quotas or client data changed. Identity of the new user must be confirmed with the inviting colleague; no authenticated live AI invocation was performed.
- Deployed `advisor-ai-organize-tasks` **v3** already returns area/priority/due_date/description in structured output; the front end previously displayed a flat editable review. The new grouped review makes classification apparent but does **not** bypass the API allowlist or confirm model output quality.
- Outstanding launch gates: two real browsers/sessions independently verify signup and cross-user isolation, actual paid AI chat + organizer response, file uploads, exports and mobile navigation. Enable leaked-password protection in Supabase dashboard. Never describe the pilot as compliance-approved for confidential client records without independent checks.

## Verified core synchronization — 2026-10-27

- Rechecked the owned private plugin release **2.2.0** `skills/instructions/SKILL.md` against the deployed `advisor-ai-chat` **v28 ACTIVE** embedded `pluginSkillInstructions`: exact string match (9,364 characters). The v28 server also has a separate concise-answer policy; this is shared instructional content, **not** direct access to the private plugin or to client cases.
- Read-only Supabase inspection: `advisor-ai-shared-tools` **v7 ACTIVE**, `advisor-ai-organize-tasks` **v3 ACTIVE**, project `ACTIVE_HEALTHY`, RLS enabled on all nine public tables. Four backend-only tables intentionally have no browser policies. Auth leaked-password protection remains disabled (WARN).
- Refreshed [architecture snapshot](docs/ADVISOR_AI_CORE.md) and added a documentation regression check. No plugin or backend deployment, client data, secrets, grants, RLS, quotas, paid settings, trades or messages were changed. Authenticated two-account E2E and direct ChatGPT plugin MCP invocation remain unverified.

## Bond analytics: finite DV01 and convexity — 2026-10-26

- Fixed intermediate overflow in the browser bond calculator: DV01 now scales modified duration before multiplying by price, and convexity accumulates price-normalized discounted cash flows. Previously large but finite synthetic bond inputs could yield `Infinity` even when the mathematically correct results were finite.
- Added regression cases for normal price curvature, very large finite par values, and premium bonds with analytic zero-coupon convexity. Non-finite derived results now fail closed instead of being shown or copied.
- Scope: public bond-analysis frontend, synthetic tests and documentation. No market feeds, client data, private plugin, Supabase schema/RLS/functions, credentials, tariffs, trading or messaging changed. Authenticated two-account browser E2E remains outstanding.

## Risk-budget percentage limits remain finite — 2026-10-26

- Corrected the browser risk-budget calculator to multiply portfolio value by the fractional percentage, rather than multiplying by 10–100 before division. The old intermediate step could overflow to `Infinity` even when the mathematically correct allocation and stop-loss limits were finite.
- Added regression checks for very large finite portfolio values, the maximum finite JavaScript number, and a subnormal value; ordinary budget/risk tests remain in the same suite. No real portfolio or market-data input was used.
- Scope: public static risk-budget frontend, synthetic tests and this note. No plugin release, Supabase tables/RLS/functions, user data, secrets, quotas, tariffs, trades or messages changed. Authenticated two-account browser E2E is still outstanding.

## Risk budget live position metrics — 2026-10-26

- The speculative risk-budget table now refreshes each position's portfolio percentage and stop-loss USD immediately when amount or stop changes. Previously the aggregate risk summary updated while the row-level derived columns retained their old values until a full table redraw.
- Derived cells now use the same validated `compute()` output as the summary; invalid inputs clear stale per-position metrics and disable copy/print. Synthetic DOM regressions cover amount, stop, missing stop and invalid portfolio values.
- Scope: static risk-budget frontend, synthetic tests and documentation only. No private portfolios, plugin release, Supabase database/RLS/functions, market data, secrets, quotas, tariffs, trades or messages changed. Authenticated browser E2E remains unverified.

## Task CSV export: invisible formula prefixes — 2026-10-26

- Task CSV export now treats zero-width spaces/joiners and word joiners before spreadsheet formula operators as unsafe prefixes and forces text interpretation with the existing leading apostrophe. Previously values such as U+200B followed by `=1+1` bypassed the guard.
- Synthetic regression tests exercise these invisible prefixes, mixed padding and ordinary Unicode text. This is a static task-board frontend/test change; no private task data, Supabase schema/RLS/functions, plugin files, credentials, tariffs, trades or messages changed.
- Authenticated two-account browser E2E and real spreadsheet-import behavior remain unverified. CI and GitHub Pages publication are separate release gates.

## Manual portfolio input: ambiguous comma-grouped numbers — 2026-10-26

- Manual portfolio positions now reject ambiguous comma-grouped numbers such as `1,000` in quantity, price or bond duration, matching the existing CSV import safety rule. This prevents a pasted 1000-unit holding from silently becoming 1 unit.
- Synthetic regressions verify rejection and preserve valid decimal commas (`1,5`, `0,125`), ungrouped thousands, and portfolio arithmetic. Static frontend and tests only; no customer data, plugin, database/RLS, server functions, keys, quotas, trades or messages changed.
- Authenticated two-account browser E2E remains unverified.

## Ambiguous comma-grouped portfolio CSV values — 2026-10-26

- Broker CSV/TSV imports now reject ambiguous numbers such as `"1,000"` in quantity, price or bond duration, rather than interpreting them as decimal `1.000` and potentially misvaluing holdings. The error names the source row and field and asks for ungrouped thousands or dot decimals.
- Synthetic regressions cover ambiguous quoted and semicolon-delimited values, accepted ordinary decimal commas and plain thousands, plus production parser syntax/math. Manual holdings entry is unchanged.
- Static Workspace frontend, tests and documentation only. No client records, plugin, RLS, Supabase functions, paid settings, secrets, trades or messages touched. Merge only after GitHub Actions CI succeeds; authenticated two-account E2E remains outstanding.

## Strict quoted portfolio CSV fields — 2026-10-26

- Portfolio CSV/TSV import now rejects malformed quoted values (for example `"10"0` in a price field) instead of silently joining fragments into a different number. Valid quoted fields, commas inside optional metadata, escaped double quotes, and whitespace after closing quotes remain supported.
- A synthetic Node regression suite checks valid and malformed rows and production inline JavaScript syntax. This is static frontend/test-only; no market data, customer records, plugin, OAuth, Supabase database/RLS/functions, paid settings, secrets, trades or messages changed.
- Release gate: PR CI, merge, merged-main checks and Pages publication. Authenticated two-account browser E2E remains outstanding.

## Ambiguous portfolio CSV headers — 2026-10-26

- Headered portfolio CSV/TSV imports now reject duplicate recognized columns (for example, two Price columns, or Qty and Quantity together). Previously the importer silently selected the first match, which could value a security using the wrong source field.
- Regression tests exercise duplicated price, quantity, type and duration headers, plus a valid CSV with optional quoted metadata. The existing parser, financial calculations, authentication and owner-scoped save paths are unchanged.
- Scope: static Workspace frontend, synthetic tests and documentation only. No private holdings, plugin files, Supabase database/RLS/functions, secrets, paid quotas, trades or messages changed. Release requires PR CI, merge and deployed Pages verification. Two-account authenticated browser E2E remains unverified.

## Headered portfolio CSV row-width validation — 2026-10-25

- The Workspace CSV/TSV holdings importer now rejects data rows whose field count differs from the recognized header. Previously extra fields were silently ignored, potentially concealing a malformed broker export; missing fields could be misaligned. The error identifies the source line and asks the user to check separators and quoting.
- Synthetic regression tests exercise both extra and missing fields, valid optional metadata with a quoted comma, and semicolon-delimited CSV. Existing portfolio math, price validation and owner/session guards remain unchanged.
- Scope: static frontend, tests and documentation only. No private client data, Supabase schema/RLS/functions, plugin release, keys, paid quotas, trades or messages changed. Merge requires successful PR CI; browser two-account E2E remains unverified.

## Extended RLS and shared MCP review — 2026-10-25

- Inspected live policies for `advisor_tasks`, `portfolio_snapshots`, `advisor_ai_attachments`, and `storage.objects` in the `advisor-chat-attachments` bucket. Owner predicates exist for reads/writes; attachment INSERT also checks owner case and matching user message.
- Rolled-back authenticated-role SQL probe using an unrelated synthetic JWT subject returned zero foreign rows for all three tables. Counts at time of probe: tasks **0**, portfolio snapshots **0**, attachments **6**. Consequently task/snapshot zero-row probes are **vacuous**, not evidence of working cross-user isolation with actual rows. Attachment check covered existing rows. No records were changed.
- Reviewed deployed `advisor-ai-shared-tools` Edge Function **v4 ACTIVE**. It exposes four public deterministic calculators and contains no OpenAI call or personal-data query; it is not an alternate paid-AI path. Public MCP endpoint remains intentionally unauthenticated and must never be extended with client-data access without new authorization.
- Still required before confidential client pilot: two independently authenticated browser accounts, storage signed-URL tests, real task/snapshot ownership checks, AI response, file export, mobile QA and auth leaked-password protection setting.

## Database RLS isolation smoke checks — 2026-10-25

- Ran six synthetic, transaction-rolled-back SQL checks against deployed Supabase RLS with the `authenticated` role and explicit owner vs. unrelated `request.jwt.claim.sub`. Used an existing account UUID as the owner, but no real case/message content; inserted only synthetic test case and chat message inside transactions.
- PASS: owner reads own workspace case; unrelated identity cannot read case; unrelated identity cannot read chat; unrelated identity cannot UPDATE case; unrelated identity cannot DELETE case; owner reads own chat.
- Both SQL transactions ended with `ROLLBACK`; no test case/message persisted.
- These are **database-level RLS smoke checks**, not independent signed-in browser users or a complete authorization audit. Outstanding: real two-user authenticated E2E, attachment/storage RLS, task and portfolio snapshot ownership, actual AI response, file exports and mobile-device QA. Do not use confidential client data for pilot until approved.

## AI task review warns about the 30-card limit — 2026-10-25

- The deployed task organizer v3 requests a maximum of 30 task proposals (`maxItems: 30`), while the browser also displays at most 30. Previously neither the input guidance nor review screen made that limit clear; a long brain dump could appear fully processed even if some tasks were omitted.
- The task-board guidance now explicitly discloses the 30-card limit and asks users to reconcile proposals with the source. The review warning distinguishes a normal short batch, exactly 30 (possible omissions), and an unexpected response above 30 (only first 30 displayed). Synthetic regressions cover 2, 30 and 31 proposals.
- Static frontend, tests and documentation only. No task records, server quotas, client data, plugin files, Supabase functions, RLS, credentials, tariffs or messages changed. Authenticated two-account browser E2E remains outstanding; PR checks, merge and Pages deployment are separate release gates.

## Task-board mobile controls and accessible feedback — 2026-10-25

- At narrow phone widths (≤480px), task action, filter and toolbar buttons have a minimum 44px touch height; section headers can wrap instead of crowding actions off-screen. Keyboard users get a visible focus ring.
- Task organizer, AI review and manual editor feedback are exposed through polite screen-reader status announcements. The same user-visible messages and underlying task logic remain unchanged.
- Synthetic regression in `tests/task-dates.test.mjs` checks the production CSS and status attributes. This is static frontend-only: no private tasks, database/RLS, plugin, Edge Functions, credentials, quotas, tariffs or client data changed. Real-device mobile/browser and two-account authenticated E2E remain unverified.
- Release gate: PR CI, merge, merged-main checks and Pages publication must pass before calling it deployed.

## MCP initialization compatibility check — 2026-10-25

- Browser MCP health diagnostic now rejects an `initialize` response if the negotiated protocol differs from `2025-06-18` or if `capabilities.tools` is absent/malformed, rather than reporting the initialization as healthy based only on the server name. The deployed shared MCP v4 was inspected read-only and returns the expected protocol and tools capability.
- Two synthetic regressions cover mismatched protocol and missing tools capability. This is frontend diagnostics and tests only: no client data, OAuth, plugin release, Supabase function/RLS, secrets, paid settings, or trading operations change. PR CI, merged-main checks, and Pages publication are required to call it released.

## Task export filenames use Almaty calendar day — 2026-10-25

- Task CSV and calendar (.ics) downloads now label their filenames using the existing `almatyToday()` helper rather than the UTC date. Between 00:00 and 04:59 in Almaty, the previous implementation could put yesterday's date in the filename despite exporting today's data.
- An offline regression freezes time at 2026-10-24 20:30 UTC (2026-10-25 01:30 in Almaty) and checks **both actual export functions**. The export payload, owner-scoped task list, ICS/CSV escaping, authentication, server functions and database/RLS remain unchanged.
- Release requires passing PR CI, merge, merged-main checks and Pages deployment; authenticated two-account browser testing remains outstanding.

## Chat-to-task transfer length safety — 2026-10-25

- A chat-to-task handoff longer than the task AI parser's 10,000-character limit previously truncated the transferred draft silently. The receiver now retains the **entire** owner-scoped text and explicitly tells the user to split it; the organizer rejects over-limit input **before** invoking the paid AI endpoint.
- Synthetic tests verify the original text survives, the warning appears and no AI call is made for oversized input. Existing owner checks and one-time handoff cleanup remain unchanged.
- Scope: task-board frontend and synthetic tests only. No plugin release, database records, RLS policies, server functions, quotas, tariffs, secrets or client data changed. Release requires PR CI, merge and merged-main Pages verification; authenticated two-account browser E2E remains outstanding.

## AI task draft description review — PR #110 (2026-10-25)

- [PR #110](https://github.com/ablaiskiy5/advisor-ai-website/pull/110) exposes AI-proposed task descriptions as editable, HTML-escaped text before the user confirms saving. Previously the proposed description was hidden and persisted unchanged.
- Task batch save now persists the reviewed description and rejects values longer than 3,000 characters. Synthetic Node tests cover HTML escaping, edits and invalid length; the owner-scoped insert remains unchanged.
- Scope: static task-board UI, synthetic tests and this handoff note. No private tasks, Supabase RLS/schema, plugin, Edge Functions, credentials or paid settings changed. **Release gate:** verify PR CI, merge, merged-main checks and Pages publication. Authenticated two-account browser E2E remains outstanding.

## Task overdue rescheduling — PR #107 (2026-10-25)

- [PR #107](https://github.com/ablaiskiy5/advisor-ai-website/pull/107) changes the task-board quick action so overdue, due-today and undated tasks move to **tomorrow** in Almaty time. Future-dated tasks still move forward exactly one calendar day. The button labels reflect these distinct actions.
- Regression coverage includes overdue, today, undated, future and year-boundary dates, and checks the production button calls the helper. Static frontend/test change only; no private tasks, Supabase schema/RLS, plugin, Edge Functions, credentials, tariffs or messages changed.
- **Release gate:** check PR CI, merge, merged-main checks and GitHub Pages publication. Authenticated two-user browser E2E remains outstanding.

## Portfolio file import session isolation — PR #99 (2026-10-25)

- [PR #99](https://github.com/ablaiskiy5/advisor-ai-website/pull/99) guards the asynchronous portfolio CSV/text file importer against account switch, sign-out/re-login and navigation to a different case while `file.text()` is pending. Old results, errors and file-picker cleanup cannot modify the next editor.
- Six synthetic Node regressions exercise ordinary import, cross-account and same-account session changes, case navigation, delayed errors, and invalid/oversized files. This does **not** establish authenticated two-account browser E2E.
- Scope: frontend and tests only. No private cases, plugin, Supabase database/RLS, Edge Functions, market prices, credentials or tariffs changed. **Release gate:** verify PR checks, merge, merged-main checks and Pages publication before reporting release.

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
