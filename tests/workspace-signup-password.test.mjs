import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Run the actual browser authentication handler with synthetic credentials.
// This is a frontend validation test, not a Supabase Auth policy or RLS test.
const html = readFileSync(new URL('../workspace.html', import.meta.url), 'utf8');
const start = html.indexOf('async function authenticate(mode)');
const end = html.indexOf('async function forgotPassword()', start);
assert.ok(start >= 0 && end > start, 'Production authentication handler exists');
const source = html.slice(start, end);

function harness(password) {
  const calls = [], messages = [];
  const cloud = { auth: {
    async signUp({ email, password: submitted }) {
      calls.push({ mode: 'signup', email, length: submitted.length });
      return { data: { session: null }, error: null };
    },
    async signInWithPassword({ email, password: submitted }) {
      calls.push({ mode: 'login', email, length: submitted.length });
      return { data: { session: null }, error: null };
    }
  } };
  const context = {
    cloud,
    document: { getElementById: id => ({
      value: id === 'login-email' ? 'synthetic@example.com' : password
    }) },
    toast: message => messages.push(message)
  };
  const authenticate = runInNewContext(source + '\nauthenticate', context);
  return { authenticate, calls, messages };
}

test('new registration rejects seven-character passwords before any auth request', async () => {
  const h = harness('1234567');
  await h.authenticate('signup');
  assert.equal(h.calls.length, 0);
  assert.match(h.messages.at(-1), /регистрации.*минимум 8 символов/);
});

test('new registration accepts eight characters for submission', async () => {
  const h = harness('12345678');
  await h.authenticate('signup');
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].mode, 'signup');
  assert.equal(h.calls[0].length, 8);
});

test('existing six-character passwords can still be used to sign in', async () => {
  const h = harness('123456');
  await h.authenticate('login');
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].mode, 'login');
  const tooShort = harness('12345');
  await tooShort.authenticate('login');
  assert.equal(tooShort.calls.length, 0);
});

test('registration guidance and password recovery consistently require eight characters', () => {
  assert.match(html, /Для регистрации введи личный email и пароль \(не менее 8 символов\)/);
  assert.match(html, /async function updatePassword\(\)[\s\S]*?if\(password\.length<8\)/);
});
