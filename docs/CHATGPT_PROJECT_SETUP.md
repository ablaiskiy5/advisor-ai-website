# ChatGPT project setup (manual UI boundary)

Suggested ChatGPT Project name: **Advisor AI | Development HQ**.

ChatGPT Projects provide grouped chats, instructions and project files; they do not eliminate per-chat context limits. Creation, configuration and moving chats in the user's ChatGPT UI cannot be done from this repository or from GitHub tools.

Once created, the user may move relevant Advisor AI development conversations into the project and set project instructions:

> This project develops the existing Advisor AI | Investment Intelligence and Advisor AI Workspace, without recreating the plugin. At the start of each coding task, read https://github.com/ablaiskiy5/advisor-ai-website — particularly AGENTS.md, PROJECT_STATE.md, ROADMAP.md, docs/DEVELOPMENT_PLAYBOOK.md and docs/ADVISOR_AI_CORE.md. Inspect recent main-branch commits, PRs and CI. Continue the highest-priority verifiable unfinished task; preserve data privacy, costs and security. At the end record verified changes and blockers in PROJECT_STATE.md. Do not ask for requirements already stored in these documents.

For a fresh chat, a short request suffices: "Продолжай разработку Advisor AI с текущего состояния GitHub. Выполни следующую приоритетную безопасную задачу, проверь результат и обнови PROJECT_STATE.md."

Automations operate separately from a ChatGPT Project; an existing hourly development automation should likewise read these repository files every run.
