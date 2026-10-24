# Advisor AI Workspace

Investment-advisor workbench built as a static GitHub Pages frontend with Supabase Auth, RLS-protected cases, portfolio analytics, private AI chat, task organization and document exports.

**For the next developer/ChatGPT conversation start with [PROJECT_STATE.md](PROJECT_STATE.md).** It tracks the verified main branch, production architecture, CI results, security warnings and next implementation steps. Detailed architectural constraints: [docs/ADVISOR_AI_CORE.md](docs/ADVISOR_AI_CORE.md).

## Pages

| Page | Purpose |
| --- | --- |
| [workspace.html](workspace.html) | Signed-in case dashboard, portfolio imports and snapshots |
| [ai-chat.html](ai-chat.html) | AI dialogue, file analysis and export |
| [portfolio-report.html](portfolio-report.html) | Concentration, duration, rebalancing and stress scenarios |
| [bond-analysis.html](bond-analysis.html) | Bond arithmetic |
| [ideas-risk-budget.html](ideas-risk-budget.html) | Shared speculative capital-budget controls |
| [tasks-board.html](tasks-board.html) | Owner-scoped tasks and calendar/CSV export |
| [tools-health.html](tools-health.html) | Read-only browser diagnostic of public mathematical MCP tools |

## Quick validation (Node.js 22)

```sh
node --test tests/portfolio-report.test.mjs tests/portfolio-conclusion.test.mjs tests/portfolio-snapshots.test.mjs
node --test tests/bond-analysis.test.mjs tests/risk-budget.test.mjs tests/task-dates.test.mjs
node scripts/test-portfolio-custom-stress.mjs
node scripts/test-presentation-export.mjs
node scripts/test-docx-export.mjs
# Live external public endpoint only; not a test of private user data:
node scripts/smoke-shared-mcp.mjs
```

Path-scoped GitHub Actions workflows run regression suites on affected pull requests and `main`. Confirm the actual run's result before describing a feature as tested or released.

## Security and data provenance

- Do not place client information, access keys, authorization tokens, private portfolio snapshots or privileged credentials in this public repository.
- Browser math uses user-entered prices; it is **not** verified real-time market data, advice, an automated order system or a broker reconciliation.
- ChatGPT plugin instructions are a shared skill baseline, **not** a directly callable backend engine. The shared public MCP service is a limited four-tool stateless calculation service; private data requires user-scoped OAuth, authorization and RLS.
- Only release via reviewed PRs with passing tests. No automatic trading or outbound customer messages.

## Next tasks

See [PROJECT_STATE.md](PROJECT_STATE.md). Highest priority: authenticated end-to-end integration tests under a dedicated dummy account, robust data provenance and safe private user-level integrations.
