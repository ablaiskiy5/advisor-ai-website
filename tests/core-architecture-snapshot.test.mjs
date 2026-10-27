import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const core = readFileSync(new URL('../docs/ADVISOR_AI_CORE.md', import.meta.url), 'utf8');
const state = readFileSync(new URL('../PROJECT_STATE.md', import.meta.url), 'utf8');

test('architecture snapshot identifies separately versioned production components', () => {
  assert.match(core, /Last verified: 2026-10-27/);
  assert.match(core, /advisor-ai-chat\` \*\*v28\*\*/);
  assert.match(core, /advisor-ai-organize-tasks\` \*\*v3\*\*/);
  assert.match(core, /advisor-ai-shared-tools\` \*\*v7\*\*/);
  assert.match(core, /plugin release \*\*2\.2\.0\*\*/);
  assert.match(state, /advisor-ai-chat\` \*\*v28 ACTIVE\*\*/);
});

test('architecture snapshot does not confuse copied skills with private plugin execution', () => {
  assert.match(core, /exactly equal as strings \(9,364 characters\)/);
  assert.match(core, /\*\*v28 ACTIVE\*\* \(\`verify_jwt=true\`\)/);
  assert.match(core, /v28 also adds a separate concise-answer policy/);
  assert.match(core, /not.*direct execution of the private plugin/i);
  assert.match(core, /OAuth 2\.1/);
  assert.match(core, /two independently authenticated accounts/);
});

test('security snapshot distinguishes owner policies and server-only tables', () => {
  assert.match(core, /9 public tables with RLS enabled/);
  assert.match(core, /four backend-only tables/);
  assert.match(core, /leaked-password protection is disabled/);
});
