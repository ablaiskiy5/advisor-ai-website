# Workspace UX release validation — 28 October 2026

Local branch `ux/shared-workspace-navigation`, integrated with `main` through `ee13b71` / PR #225. **Not pushed, not deployed.** Local UI tests use synthetic records and intercept all external requests; no real accounts, client records, paid AI, invitations or database writes were used.

## Scope and evidence

| Scenario | Status | Evidence / boundary |
| --- | --- | --- |
| Shared menu across Workspace, chat, tasks, portfolio report, bond and risk calculators, tools health | PASS | Chromium on production HTML, 1440/768/390/320px; ten links on every page |
| Desktop collapse, mobile open/close, Escape, active item, focus behavior, print | PASS | Browser assertions, shared CSS, desktop/mobile screenshots inspected |
| Section URL, History, Documents entry, selecting saved cases | PASS | Real browser DOM interactions with synthetic owned-case responses |
| AI question, task brain dump, portfolio input survives navigation | PASS | Browser round trips and Node owner/scope isolation tests |
| Draft cleanup, storage failure, oversized input, expiry, save-vs-edit race | PASS | Node regressions plus browser logout purge; raw private files/passwords never stored |
| Registration instructions, confirmation response and login errors | PASS | Mock Auth responses in Chromium; persistent inline feedback; network/error handler tests |
| Actual signup, delivered confirmation email, reset email, independent real login | NOT TESTED | No dedicated authorized test-account session available in this run |
| Automatic AI access for a new permitted colleague | NOT TESTED | Existing pilot allowlist/enrollment unchanged; signup alone does not authorize AI |
| Broad link-only onboarding for all colleagues | BLOCKED | Existing allowlist requires authorized email enrollment; no access-policy change made |
| Screenshot/PDF upload and real completed AI response | NOT TESTED | Existing attachment tests passed, but no authenticated live upload/AI call |
| Task extraction/grouping and approval | NOT TESTED | Existing synthetic tests passed; live organizer output and task writes not exercised |
| Per-task required-data hints and brief/detailed UI | PASS | Production guidance tests and browser covered-call hint; model answer quality not measured |
| Portfolio financial calculations | PASS | Existing Node suites and portfolio custom-stress checks |
| DOCX file structure and presentation text splitting | PASS | Real DOCX ZIP/headings/table/escaping; 60 chunk cases, 2 truncation guards |
| Actual Word/PDF/PPTX visual output and browser downloads | NOT TESTED | No visual validation in Word/PowerPoint/PDF viewer in this run |
| Real two-user server/storage isolation | NOT TESTED | Client draft isolation is not proof of RLS, signed-URL or owner-positive access |
| Safari/iOS real device | NOT TESTED | Responsive Chromium widths only |
| PR, remote CI and Pages deployment of this branch | NOT TESTED | Publication explicitly authorized by owner on 28 October; awaiting remote checks |

## Reproduce

Use Node 22 or newer. Browser test dependency is pinned in `.github/workflows/workspace-browser.yml`.

```sh
node --test tests/*.test.mjs
node scripts/test-portfolio-custom-stress.mjs
node scripts/test-presentation-export.mjs
node scripts/test-docx-export.mjs
node scripts/test-workspace-browser.mjs
```

DOCX test requires `docx` (the production exporter uses 9.5.1). Browser test requires `playwright@1.56.1` and Chromium. Optional `ADVISOR_CHROMIUM_PATH` points to an installed executable; `ADVISOR_QA_DIR` writes synthetic screenshots outside the repository. Local execution used Chromium 138; CI installs Playwright's matching browser. The new CI workflow has not run remotely yet.

## Implementation boundaries

- `assets/workspace-shell.js/.css` progressively enhance the seven existing HTML pages. Legacy navigation remains if the shared script fails.
- `assets/workspace-drafts.js` stores only explicitly bound input fields in this tab's session storage, scoped to authenticated owner and case. It is not a cloud draft sync. Task proposal/editor cards and file bytes are not restored; leaving warns instead.
- History lists existing cases; Documents opens their conversations and current exporters. Neither is a new standalone file repository.
- Assistant is currently a direction picker. A free-text home router, a full document library and automated colleague invitations remain future work.
- No plugin release, backend deployment, SQL privilege, quota, secret or live account setting was changed.

## Release next step

The owner explicitly authorized branch publication on 28 October. Fetch/reconcile current main, rerun validations, open PR, observe required checks and review policy, then merge and verify Pages. Keep authenticated launch gates open until they actually pass.
