# Workspace scenario audit — 2026-11-03

Scope: existing GitHub Pages app and its existing authenticated frontend contracts. Synthetic fixtures contain no real client/account information. A passing mock is not proof of real authenticated provider behavior.

## Findings and fixes

| Finding | Behavior after change | Evidence |
| --- | --- | --- |
| Documents and History displayed the same cases | Documents creates materials and lists only cases with an AI answer; History retains all cases/notes/unfinished requests | Catalog owner/error/stale-read regressions; browser creation/reopen/download |
| Gallery chat action actually meant external ChatGPT | Internal saved dialogue is a real link; external ChatGPT is explicitly named | Actual browser navigation, seeded saved messages, downloaded DOCX content |
| Document cases looked like investment ideas | Logical Documents label, correct return destination, no unrelated trading-budget shortcut | Workbench and shell regressions |
| Signed-out task actions looked usable but had no handlers | Disabled actions and visible login link | Found on published UI; synthetic signed-out regression |
| Initial task read failure prevented button binding | Handlers bind before initial load; Refresh retries read and restores review | Forced initial-load outage, actual Refresh click and restored cards |
| No per-task calendar selection | Google, Microsoft 365, personal Outlook and Apple ICS choice; date/time/duration; alarm in ICS | Provider URL assertions, actual ICS download and mobile fit |

## Repeatable scenario matrix

| Area | Scenario | Verification this session |
| --- | --- | --- |
| Navigation | Seven app pages; shared desktop/mobile menu, collapse, Escape, deep links, login links | Synthetic Chromium; public landing/login and section navigation in cloud browser |
| Assistant | Section routing; long chat viewport and reachable composer; selected PDF/Word/copy; disabled controls and failure recovery | Node and synthetic Chromium; no paid inference |
| Portfolios | Input draft recovery; parsing, positions, concentration, duration, snapshots, target allocation, custom stress scenarios | Node suite and stress script; synthetic draft browser scenario |
| Ideas | Company and sector intake, saved result reopening; budget example/add/remove and derived stop risk | Synthetic Chromium; live public budget controls verified |
| Markets | Event and macro-scenario intake/results; source/date uncertainty instructions | Node and synthetic Chromium; actual current-answer quality unverified |
| Academy | Lesson and exam; reply -> feedback/next question; reopen without new paid call | Node and synthetic Chromium |
| Documents | New document -> prepare -> ready gallery -> reopen -> internal chat -> download selected Word | Actual production frontend with synthetic auth/cloud; real DOCX ZIP/text checked |
| History | All cases, search, input escaping, reopen result without additional AI request | Node and synthetic Chromium |
| Tasks | Organize -> edit/exclude cards -> reload; remove local backup -> restore cloud copy; lost save acknowledgement -> reconcile without duplicate | Synthetic browser at 1440/390px; unchanged paid-call count |
| Task controls | Manual create, edit due date/description, Done/Restore, filters, reload, CSV and bulk ICS | Actual UI clicks and file downloads with synthetic cloud |
| Calendar | Google/work Outlook/personal Outlook URL contents; iPhone choice; timed UTC event and 30-minute alarm | Pure helper tests and downloaded ICS; no real event created |
| Session/error paths | Logout purge, stale owner results, task initial-read error -> Refresh, signed-out disabled actions/login CTA | Node and synthetic Chromium |
| Exports | Selected Word, real multi-page PDF desktop/mobile; presentation chunks and truncation guards | Actual DOCX/PDF files; presentation text/structure tests, not full PowerPoint visual QA |
| Bond calculator | Example, invalid zero price clears stale output/copy, example restores calculated values | Live public browser; deterministic Node tests |
| Public infrastructure | Page availability and shared mathematical MCP | PASS: 11 public pages, discovery/four-tool arithmetic/18 rejection checks, seven-page readiness/two unsigned guards; cloud UI all 8 diagnostics pass |

Commands: `node --test tests/*.test.mjs`; `node scripts/test-workspace-browser.mjs`; `node scripts/test-task-reload-browser.mjs`; `node scripts/test-chat-pdf-browser.mjs`; `node scripts/test-docx-export.mjs`; `node scripts/test-presentation-export.mjs`; `node scripts/test-portfolio-custom-stress.mjs`. Browser scripts use pinned CI dependencies, optional ADVISOR_CHROMIUM_PATH locally. 447 Node tests passed; all three synthetic browser scripts and export/stress scripts passed.

## Calendar contract and manual acceptance

This release prepares an event for the selected calendar; it does not connect an account. Save in Google/Outlook is completed by the owner. Chosen ICS reminder is encoded as VALARM; creation links cannot reliably set it, so the UI asks the owner to inspect notifications before saving. A shared ICS can be sent to a client via the phone's native share menu where available; the recipient adds it. No invitation/client message is automatically sent. Reimporting or editing the card is not background synchronization. UID stability helps identify an event but does not guarantee deduplication by every importer.

For real-device acceptance, create a synthetic task and choose a future time; save in each provider with the intended account, check local timezone, alarm and notification permissions, and confirm delivery on the phone. On iPhone check ICS open/import from the actual browser/Mail/share path. Do not describe this release as automatic delivery or reliable phone reminders until that real-device check passes. Automatic synchronization is a separate OAuth integration requiring registered provider apps, per-user consent, token protection/revocation and update/conflict handling.

## Remaining verification boundaries

No independently authenticated two-account signup/email/upload/paid-AI journey, actual provider event save, native iPhone import/notification, microphone permission/dictation, full PPTX visual rendering or model-answer quality evaluation was performed. Existing Node/browser tests cover mocked auth/cloud isolation, not live cross-account RLS proof. The terminal-based live public browser hit ERR_EMPTY_RESPONSE in this environment; cloud-browser public navigation/calculator checks worked. Backend/model/limits/RLS/security settings remain unchanged.

## Release checkpoint

Published PR #253; merge a8939599350b83f2c8f887b1fd5017104aea9562. Five applicable PR and five main code checks passed. Pages run 41632308302 succeeded. Live HTTP 200 bodies exactly match all four changed frontend/assets. Post-release cloud browser confirms disabled signed-out task actions and visible login CTA. No real AI/provider event/phone notification acceptance is implied by those deployment checks.
