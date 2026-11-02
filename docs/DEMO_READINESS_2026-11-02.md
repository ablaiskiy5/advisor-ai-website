# Advisor AI — demo audit and runbook
Date: 2026-11-02. Audience: management demo on Friday 2026-11-06.

## Grounding and status definitions
- **STATIC** — button, route, and handler exist in the current `main` source; this does not establish runtime success.
- **SYNTHETIC** — current project automated Node/Chromium regression exercises a mocked scenario.
- **LIVE-METADATA** — current Supabase management API confirms health/function publication, not successful paid inference.
- **REAL-USER PENDING** — requires an authorized test account and human-visible browser. Not appropriate to claim passed.
- **SECURITY REVIEW PENDING** — company approval and two-account authorization testing are not complete.

No company client data, privileged credentials, or paid AI requests are needed for this checklist.

## Click-through checklist

| Surface | Main interactive actions in source | Coverage / demo result |
|---|---|---|
| Public home | Sign in/register, Privacy, Terms, Support | STATIC; check real public URLs |
| Global navigation | 10 section routes; desktop collapse; mobile open/close; Escape; focus/active section | SYNTHETIC Chromium at 1440/768/390/320, plus long chat widths |
| Workspace home | Route to Portfolio, Ideas, Academy, Markets, Tasks; recent cases | STATIC + SYNTHETIC routes; logged-in real-user data pending |
| Account / Settings | Registration, email confirmation, login, password reset, signout, session persistence | SYNTHETIC responses; REAL-USER PENDING signup/email/account switching |
| Portfolios (workspace) | Manual case, CSV/TSV upload, sample CSV, calculate allocations, save holdings, snapshots, version history, open report | Financial math tests and synthetic ownership; REAL-USER PENDING actual import/save and file permissions |
| Portfolio report | NAV, concentration/HHI, FX, bond duration, stress and custom scenario, rebalance; Print/PDF, CSV, copy/TXT conclusion | Deterministic Node tests; PDF end-user content review pending |
| Company / Sector | Enter ticker/theme, run in-section AI, read/save/reopen, copy/TXT, jump to chat | SYNTHETIC success/error/re-read tests; REAL-USER PENDING source/date/quality |
| Markets / Macro | Market event explanation, scenario map, save/reopen and source checks | SYNTHETIC navigation; REAL-USER PENDING live search and citations |
| Academy | Lesson by topic/level; oral exam one question at a time, grade and next question | SYNTHETIC one-question iteration; REAL-USER PENDING factual quality |
| AI Chat | Attach file, dictate, send, retry, refresh, recover saved answer, jump to answer/composer | SYNTHETIC upload/recovery/session tests; REAL-USER PENDING uploaded PDF/image, paid generation, mobile Safari |
| AI Chat exports | Per-answer PDF/Word/copy; copy for WhatsApp/Telegram; TXT; PPTX; DOC; print | Node regression + Chromium synthetic selected-answer + real synthetic PDF/DOCX downloads; actual user case formats pending |
| Tasks board | Brain dump text/voice, AI organize, proposal review/edit/discard, select/save, manual task, 3-status board, search/filters, .ics/.csv export, refresh | SYNTHETIC review/owner tests; REAL-USER PENDING real organizer response and write |
| Bond calculator | Calculate, fill example, copy, YTM/duration/sensitivity | Node regression; public mathematical MCP separate live checks |
| Ideas risk budget | Add/edit position, example, % allocation/limits, copy, Print/PDF | Node budget tests; does not place trades |
| Tool diagnostics | Initialize public MCP, discover/list, calculate four tools, invalid-input rejection | Public MCP service v7 ACTIVE, prior live external checks; UI button on real user's browser pending |
| History / Documents | Reopen saved cases, open AI chat, export selected result | SYNTHETIC navigation/session; not a separate document repository |

## Minimum real-user walkthrough before Friday
1. In an incognito browser register a dedicated test user, confirm email, login, logout, reset password; verify navigation and history.
2. In a different browser profile register a second dedicated test user and verify A cannot see B's cases, messages, files and tasks; test denial for a known inaccessible case ID, not real client data.
3. Under user A enter a **synthetic** portfolio of three instruments and one bond; save a snapshot, reopen it, run concentration/stress, download CSV/PDF and inspect first + last page.
4. Run one small paid chat query using generic tickers and current public sources: verify real answer saved, cited dated sources, model label and no false data; then reload and export an earlier answer.
5. Add a fictional PDF and one image (no personal data) and verify upload and conclusion, including failure/refresh path, without duplicate billing.
6. Paste 7 unstructured fictional tasks, use AI grouping, edit proposal, save selected cards, export .ics/.csv, reload and verify statuses.
7. Use the Academy oral exam on duration, answer incorrectly and check specific corrective feedback and the next question.
8. On mobile Safari check viewport, readable chat, keyboard/composer, attachments and PDF download. If not possible, leave as unverified.

## Known limitations and required disclosure
- Public HTML / source-code inspection is not a human-authenticated browser click-through. The current tool environment cannot log in or click production UI in a real user account; do not represent the actions above as performed.
- Main site and API cannot be reached from all external environments; the new dedicated GitHub Actions public smoke tests independently check published Pages/assets and unsigned requests.
- Supabase management reports the project ACTIVE_HEALTHY; Edge Functions chat v32, organizer v4, shared tools v7 ACTIVE. That is **metadata**, not end-to-end evidence.
- Real-person multi-user account isolation, private attachment authorization, paid GPT responses, current source-search quality, mobile Safari, and enterprise compliance remain release gates.
- Supabase security advisor warns leaked-password protection is disabled. Four RLS-enabled backend tables intentionally have no browser policies; their privilege paths require review, not blind policy creation. 
- Until security clearance, use anonymized/synthetic portfolios only; do not upload actual confidential customer material.

## Management demonstration script
1. 60s: "Advisor AI is a workflow system for analysts/advisors, not a ChatGPT skin; one entry point for analysis → decision proposal → client-ready export → follow-up".
2. 90s: Homepage → Portfolio → sample positions/CSV → concentration and +100 bp bond shock.
3. 90s: Ideas → company/sector → dated-source summary and uncertainty disclosures.
4. 90s: Tasks → paste fictional chaos → grouped proposed tasks → user review and approval.
5. 60s: Academy → one oral question and a corrective answer.
6. 60s: Chat → saved answer history, exact selected-reply Word/PDF export.
7. 30s: Architecture boundary, privacy, explicit pilot verification gates.

## Claim discipline
Never promise instant market data or cross-service user history unless a verified integration exists. Separate mathematical deterministic tools from LLM reasoning. Describe the website as a personal Workspace backed by Supabase; the existing ChatGPT plugin shares methodology and public calculators but **does not** automatically share private user cases.
