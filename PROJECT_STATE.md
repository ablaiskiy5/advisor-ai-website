# PROJECT_STATE.md — Advisor AI Workspace

**Verified:** 2026-10-24 (Asia/Almaty), from connected GitHub and Supabase. This is the canonical handoff for new chats/agents. Do not assume a feature is live merely because it is in the repository. Update this file with every release.

## Repositories and deployment surfaces

- Frontend: [`ablaiskiy5/advisor-ai-website`](https://github.com/ablaiskiy5/advisor-ai-website), public, `main`, GitHub Pages static HTML/JS.
- Separate historical MCP service: [`ablaiskiy5/advisor-ai-mcp`](https://github.com/ablaiskiy5/advisor-ai-mcp), private, FastMCP/Python, single `bond_current_yield` tool. **Do not mistake this legacy service for the four-tool production Supabase shared MCP service.**
- Supabase project `advisor-ai-workspace`: ref `xhewhzgzzonpgsjznmyl`. Connected project status: `ACTIVE_HEALTHY`.
- Supabase functions seen active on 2026-10-24: `advisor-ai-chat` **v21**, `advisor-ai-organize-tasks` **v2**, `advisor-ai-shared-tools` **v4**. The shared tools service exposes exactly four deliberately public, stateless deterministic calculators.
- ChatGPT plugin `Advisor AI | Investment Intelligence` is **not** an executable backend callable by the website. The frontend uses Supabase and a versioned copy of the plugin skill as described in [docs/ADVISOR_AI_CORE.md](docs/ADVISOR_AI_CORE.md). Plugin runtime invocation was **not** reverified during this handoff.

## Stable shipped baseline

**GitHub `main` at start of this continuation:** `7bfa95ac536c048b0c84140578ea8396c27abced`, merged PR [#57](https://github.com/ablaiskiy5/advisor-ai-website/pull/57), 2026-10-24. PR #45 (real DOCX regression) was an earlier milestone, **not** the latest revision.

Relevant existing modules:
- `workspace.html`: signed-in case management, saved positions, import and portfolio snapshots.
- `ai-chat.html`: case chat, attachment handling and DOCX/PPTX/PDF export.
- `portfolio-report.html`: holdings valuation, HHI and concentration, duration risk, combined equity/yield stress, custom scenario and proposed asset-class reweighting. User-entered prices only, no verified live quotes.
- `bond-analysis.html`: bond yield/duration analyses.
- `ideas-risk-budget.html`: pooled speculative risk-budget controls.
- `tasks-board.html`: Supabase tasks, AI task proposals, CSV/iCalendar export.
- `tools-health.html`: browser-based diagnostic for the **public** four-tool MCP service.

## Release currently being implemented

Branch `feat/portfolio-conclusion-and-project-state-20261024` based on PR #57.

- Add a **deterministic, editable investment-conclusion draft** to `portfolio-report.html`, based only on parsed holdings and existing target allocation; safeguards for missing targets, missing classes, valuation provenance, concentration, duration and illustrative stress.
- Add explicit user-triggered copy and UTF-8 text export; no transmission to third parties or saved recommendation.
- Add `tests/portfolio-conclusion.test.mjs` and run through portfolio snapshot GitHub Actions workflow.
- Keep this handoff document and the README up to date.

**Release gate:** observe successful tests on the PR, then merge. Do not write 'shipped to main' until GitHub confirms the merge.

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
5. Update this file: release SHA, exact checks passed, blockers and the next three priorities.
6. Do not log/upload customer identifiers, positions, tokens, access keys or screenshots into public GitHub.
