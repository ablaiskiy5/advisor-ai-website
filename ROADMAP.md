# Advisor AI — living roadmap

This roadmap tracks priorities rather than asserting completion. Cross-check the latest `PROJECT_STATE.md`, merged PRs and CI before work; update this file as work is verified.

## P0 — Verify the product end to end
- [ ] Run independently authenticated, two-account browser smoke tests of registration, login, account isolation, private AI chat, portfolio and attachment analysis, task organizer approval, exports, and mobile navigation. Use synthetic data only.
- [ ] Confirm deployed site and Supabase Edge Function behavior separately from GitHub CI; record errors, evidence, dates, and remediation.
- [ ] Resolve any open security/auth/rate-limit issues and obtain required corporate security/compliance review **before** treating the product as approved for confidential client information.
- [ ] Review elevated non-RLS SQL table privileges flagged by the read-only user-facing audit; assess reachability and application dependencies before any approved privilege changes.
- [ ] Validate the recently changed light chat, case navigation, AI short-response quality and source links with real user flows.

## P1 — Advisor workflows and usability
- [x] Shared navigation/history/document hubs published in PR #226; PR/main CI, Pages and public browser navigation verified (see PROJECT_STATE.md).
- [x] Owner-scoped input drafts and unsaved attachment/proposal warnings published in PR #226; synthetic browser/session coverage passed. Real two-user checks remain P0.
- [ ] Refine portfolio ingestion, concentration/risk/rebalance outputs, explainable assumptions and market-data provenance.
- [ ] Make portfolio, ideas, market scenarios, education and tasks each have their own frictionless first action; eliminate unnecessary fields and dead ends.
- [ ] Check AI brain-dump task grouping and priority proposal, user confirmation, long-text handling and account-scoped persistence.
- [ ] Test document/presentation export rendering, structure and readability using non-client fixtures.

## P2 — Platform and plugin alignment
- [ ] Verify actual integration boundaries among public MCP calculation tools, private Supabase AI functions, and the existing Advisor AI plugin; do not describe shared plugin instructions as a callable private backend.
- [ ] Review paid-AI limits, concurrency, auditability and cost protection with safe migrations and tests where needed.
- [ ] Improve product onboarding and colleague documentation, then repeat mobile/device and accessibility regression checks.

## Working protocol
1. Read `AGENTS.md` and `PROJECT_STATE.md` each session.
2. Pick one small verifiable work item from this roadmap or a clearly documented production defect.
3. Implement using a branch/PR and preserve privacy/security rules.
4. Log verifiable results and blockers in `PROJECT_STATE.md`; check off a roadmap item only after its acceptance criteria pass.

ChatGPT Projects may group conversations, but **do not remove single-conversation length limits**. GitHub remains the durable source of technical truth.
