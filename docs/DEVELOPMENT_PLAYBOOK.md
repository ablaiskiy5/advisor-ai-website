# Advisor AI — autonomous development playbook

## Product mission
Build one professional advisor workbench for Freedom Broker-style HNW/UHNW advisory workflows, not a collection of disconnected demos. Prioritize a functioning end-to-end advisor journey: sign in → open case → ingest allowed documents/positions → analyze → review recommendation → export → save history and follow-up tasks.

## Product surfaces
- **Workspace**: primary website with Supabase Auth, owner-scoped cases and persistent tasks.
- **Advisor AI plugin**: optional ChatGPT entry point sharing analytical methodology and public deterministic MCP calculators. It is **not** a callable website runtime; private case sharing needs secure OAuth and consent.
- **Academy**: explain mechanisms, counterarguments and causal macro links, then test understanding.
- **Portfolios**: allocation, issuer/sector/currency exposure, drawdowns, concentration, bond risk, scenarios and rebalance proposals.
- **Ideas / Markets**: current evidence with timestamps, thesis, catalyst, bear case, valuation, liquidity and position sizing.
- **Documents / Planning**: usable client materials, saved case history and actionable tasks.

## How to continue without asking the owner to micromanage
1. Read `PROJECT_STATE.md`, architecture docs, current `main`, open PRs and last CI/deploy outcomes.
2. **First verify the core workflow**: AI response/history, permissions, upload and export. Prefer fixing a real defect to adding another isolated page.
3. Select the highest-impact safe improvement that can be verified without client secrets or account access. Work in a branch, write a focused regression, run CI, merge only after passing.
4. Recheck deployed status and update `PROJECT_STATE.md` with exact PR, commit and evidence.
5. Repeat with the next independent improvement during the active session. The user need not approve every safe code/test change; request explicit approval for live customer actions, privileged auth/security changes or sensitive data.
6. Never represent GitHub unit checks as authenticated browser E2E or claim a plugin↔private-case bridge is complete without an actual consented login and RLS isolation test.

## Quality contract
- Separate verified facts, calculations, assumptions, scenarios and judgment. Do not invent live quotes or client holdings.
- Prefer minimal clicks, clear Russian, mobile-first accessibility, helpful defaults and reversible operations.
- Do not publish customer names, identifiers, attachments, privileged keys or account tokens.
- Never execute trades, send client messages or change access policies without explicit authorization.
- Treat releases as incomplete until CI and, where applicable, deployment are verified.

## Current gap
Existing CI covers deterministic financial math, exported DOCX structure, presentation text chunking and live **public** MCP tools. A logged-in dummy-account browser journey, real PPTX/PDF rendering, mobile Safari and plugin user-scoped OAuth remain unverified. Work on these before claiming production-grade completion.
