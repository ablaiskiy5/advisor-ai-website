# Advisor AI — unified architecture and status

Last verified: 2026-10-23. This is an engineering status file, not a claim of successful end-to-end user testing.

## Production components

- **ChatGPT Plugin**: existing private `Advisor AI | Investment Intelligence`, release **2.2.0**. The plugin package contains its comprehensive 2.1 skill, retained academy/source files, and a remote `.mcp.json` connection to the shared mathematical tools.
- **Workspace frontend**: GitHub Pages `workspace.html`, `ai-chat.html`, `tasks-board.html`, `bond-analysis.html`, and `portfolio-report.html`.
- **Workspace AI backend**: Supabase Edge Function `advisor-ai-chat` **v15**, accessed through the user's authenticated case with RLS. Uses the **actual text of the plugin's skill** as the analytical baseline, plus Academy and legacy reference material, web-search on relevant financial requests, and a shared MCP endpoint.
- **Common MCP tools**: Supabase Edge Function `advisor-ai-shared-tools` **v4**, stateless HTTP JSON-RPC with legacy `initialize` and modern `server/discover` for four public deterministic tools: `bond_current_yield`, `portfolio_concentration`, `trade_risk_budget`, `bond_duration_shock`.
- **Tasks**: `tasks-board.html`, authenticated Supabase `advisor_tasks` with RLS, `advisor-ai-organize-tasks` with capped AI proposals.
- **Files**: private `advisor-chat-attachments` bucket with owner restrictions; screenshot/PDF analysis via `advisor-ai-chat`.

## Shared means what exactly?

**Implemented:** shared analytical method, shared mathematical service URL and tool catalogue. Workspace reads the plugin skill content copied into its deployed server code at its published release. The plugin package configures the same remote mathematical MCP server. No user-client credentials are exposed by these public deterministic tools.

**Not yet implemented:** ChatGPT Plugin conversations do not automatically share the Workspace user's Supabase identity, case history, task board or customer files. The platform plugin object is **not an API endpoint** that a GitHub Pages app can directly invoke. Private-data integration requires OAuth 2.1 authorization and user consent using Supabase Auth's OAuth Server plus RLS-scoped MCP handlers. Do not implement cross-account access using anonymous endpoints or service-role keys in the browser.

**Not end-to-end verified:** Chrome/mobile file upload and response completion, actual PPTX/PDF generation in a user browser, whether the plugin runtime has refreshed the newly added MCP server after release, and the quality/availability of live web-search answers through the model API. Unit/syntax checks and publication are not a replacement for these tests.

## Product use

- **Portfolios**: upload permitted anonymized screenshots/PDF and use the portfolio workflow. For deterministic holdings calculations use the portfolio editor and report.
- **Investment ideas**: use current-source research, risk budget, event calendar, liquidity and catalyst checks. Budget applies **across the whole speculative pool**, not per idea.
- **Academy**: causal explanations, calculations, oral assessments, saved plugin curriculum reference.
- **Markets**: web-grounded macro/central banks, UST, USD, equities, gold, oil, KZT and scenario analysis.
- **Tasks**: dump text to AI, review proposed cards, track daily focus and due items.
- **Documents**: chat provides downloadable PDF, Word-compatible `.doc`, and PowerPoint `.pptx`; verify output before sending to clients.

## Engineering work remaining — ranked

1. **User-level OAuth bridge**: enable Supabase OAuth 2.1 Server securely, configure a consent screen, protected-resource metadata, user-scoped JWT validation and audited RLS tools for listing/creating tasks and reading cases. **Requires project-level auth configuration; do not claim complete until an actual OAuth login succeeds.**
2. **Full integration tests** under a consented test account (no real client data): file upload to final AI answer, PDF/PPTX downloads, task ingestion, plugin MCP handshake and private RLS isolation.
3. **Market-data reliability**: quote timestamp, provider, stale-cache handling, source citation and earnings/corporate events. Web search is not equivalent to a guaranteed exchange-grade price feed.
4. **Advanced portfolio parsing**: broker-specific statement import, instrument classification, currencies, credit ratings, maturity schedules, total-return history and usable before/after recommendations.
5. **Simplicity and polish**: keyboard shortcuts, accessible controls, daily dashboard, mobile testing, inline task editing and undo/audit.
6. **Skill synchronization**: when updating plugin instructions, verify all referenced resources and resync the Workspace Edge Function. The copy in the deployed function is versioned and does **not auto-update** on plugin release.

## Safety and verification contract

- Preserve private user/customer data, RLS, quotas and existing historical messages.
- Never expose Supabase service-role keys, paid API secrets, client account identifiers or confidential holdings in static GitHub Pages files.
- Do not execute transactions, submit orders, email clients or schedule external events without explicit approval.
- Run syntax and math checks before release; use PRs and cite actual merge commits.
- Verify live integrations with authenticated requests before describing them as working.
