# Section workflows

The primary actions in Ideas, Markets and Academy use local workbenches rather than redirecting immediately to chat. Opening a form has no write or paid side effect. Submit creates a confirmed owned case/message and invokes the existing `advisor-ai-chat` function. All existing AI access and quota checks still apply.

| Workflow | Input | Expected result |
| --- | --- | --- |
| Company | Company/ticker; optional horizon/goal | Conclusion, drivers, dated evidence/valuation, risks, scenarios |
| Sector | Theme; optional horizon/goal | Up to five comparable instruments, role, driver, risk, selection criteria |
| Event | Event or question | Confirmed causes, causal mechanism, impact and monitoring indicators |
| Scenario | Assumed shock; optional horizon | Three conditional scenarios; transmission to rates, FX/assets and evidence to watch |
| Lesson | Topic and level | Explanation, mechanism, worked example, common error, one self-check question |
| Exam | Topic and level; subsequent learner response | One initial question without answer; then specific feedback/score and one next question |

`assets/workspace-workbenches.js` contains the stateful client; `assets/answer-renderer.js` safely renders AI output in both Workspace and chat. Case/message acknowledgements and session epochs guard asynchronous results. Read failures after successful generation expose a read-only refresh rather than blindly consuming another paid attempt. Retries otherwise remain bounded and server-enforced.

Saved workflow cases can reopen in their original section. New-run intake is secondary when viewing saved output. Full conversation and advanced document exports remain available through an explicit chat link. Reloading or changing account does not restore private result caches from another session; stored cases/messages remain subject to the existing RLS.

This is a UI and prompt-context change. It does not prove actual model answer quality, exchange-grade prices, two-account security or live file/export behavior. Browser fixtures mock auth, writes and AI, and must remain separate from authenticated launch gates. Portfolio image/PDF upload and document generation still use the existing chat/export paths and need their own next-stage redesign.
