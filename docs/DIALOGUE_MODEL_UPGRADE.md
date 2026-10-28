# Dialogue model and search upgrade — 2026-10-28

User authorized stronger dialogue/search and immediate release. The chat-only policy selects `gpt-6-astra`, low reasoning (preserving the prior effective effort), 8,000 output tokens including reasoning, and six hosted tool calls per response. `ADVISOR_CHAT_MODEL` is a dedicated server override; the old shared `OPENAI_MODEL` no longer silently controls chat. Task organizer remains unchanged. Existing chat request reservations, JWT, ownership, RLS and history remain unchanged.

Search is available to every dialogue, with high context and live external access. Research/markets and current-data questions explicitly require source checking in instructions; tool choice remains automatic so calculation tools can still run. This is an instruction, not a guarantee of successful search. Only completed web-search calls count; current-data answers without one retain a visible warning. Prompts prefer dated primary sources, separate facts/scenarios and prohibit sending client details into web queries. This is not an exchange data feed.

A model-specific unavailable/access error allows one retry on the existing `gpt-5-mini` reserve. Saved answers disclose that reserve and response metadata identifies the actual model. Billing/auth/rate-limit/network errors never trigger this retry. Existing tool-specific degradation remains visible. No stronger-model quality or account availability claim is justified by mocked tests.

OpenAI official documentation inspected:
- https://developers.openai.com/api/docs/models
- https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra
- https://developers.openai.com/api/docs/guides/tools-web-search

Published Astra pricing at inspection: $10/M input and $50/M output tokens. Example 10k input + 2k output is $0.20 before search; output includes reasoning tokens. Request quotas are not dollar caps. Actual account model availability and usage billing remain to be verified with an authenticated live dialogue.

## Deployment reproducibility

`supabase/functions/advisor-ai-chat/dialogue-policy.mjs` is the public tested module. `scripts/upgrade-dialogue-backend.mjs` transforms an authorized local v28 source export with exact single-occurrence guards. The complete deployed baseline contains private plugin reference material and is deliberately not committed. Deploy transformed `index.ts` plus this module with JWT verification enabled. Roll back using the saved v28 export if deployment verification fails.

Local validation: 409 Node regressions passed; portfolio stress and 60 presentation cases plus two guards passed. Focused tests cover the production policy, unavailable-model retry, no retry for billing/rate/auth failures, preserved request data and completed-search counting. Full real-account output quality and end-to-end search remain unverified.

## Release verification

PR #232 merged as d48c893199fa6e7750672fe939131966f9791ea0; PR/main integrated checks and Pages run 40685305358 passed. Chat v29 ACTIVE, JWT true, both deployed files match reviewed contents exactly. Actual transformed handler passes synthetic end-to-end save and unavailable-model reserve paths; public live metadata GET=200 and unsigned POST=401. No paid inference was made for these checks.

The follow-up metadata probe performs only GET /v1/models/{configured_model}, caches a single pending/result check per isolate for five minutes and returns only model name and true/false/null availability. No key, account identity, model catalogue or raw provider errors are returned. It uses no paid inference. API listing availability does not establish successful inference or web-search quality.

PR #233 merged as f75185c9cd359edaef83bb96a72399855a1f2130. Chat v30 ACTIVE, JWT verification true; both deployed files exactly match reviewed sources. Public opt-in model probe returned HTTP 200 with configured_model=gpt-6-astra and model_available=true. Provider metadata access is therefore verified; no paid generation or actual answer/search quality was tested. 410 local Node tests and PR/main integrated checks passed (main run 40685728770); Pages deployment 40685728137 succeeded.
