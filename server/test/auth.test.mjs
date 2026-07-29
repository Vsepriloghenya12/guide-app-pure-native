// Smoke tests for auth gating and the login rate limit.
// Runs the real server as a child process in file-store mode (no DATABASE_URL)
// on an ephemeral port — zero external dependencies, works in CI.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 18923;
const BASE = `http://127.0.0.1:${PORT}`;
const OWNER_PASSWORD = 'test-owner-password';

let child;

async function waitForReady(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/bootstrap`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('server did not become ready in time');
}

before(async () => {
  child = spawn(process.execPath, ['src/index.js'], {
    cwd: serverDir,
    env: {
      ...process.env,
      PORT: String(PORT),
      OWNER_PASSWORD,
      // force file-store mode and keep the prod fail-hard path inert
      DATABASE_URL: '',
      RAILWAY_ENVIRONMENT: '',
      NODE_ENV: 'test'
    },
    stdio: 'ignore'
  });
  await waitForReady();
});

after(() => {
  if (child) child.kill('SIGKILL');
});

test('public bootstrap responds 200', async () => {
  const res = await fetch(`${BASE}/api/bootstrap`);
  assert.equal(res.status, 200);
});

test('owner endpoints are gated without a session cookie', async () => {
  for (const route of ['/api/owner/bootstrap', '/api/owner/support-content']) {
    const res = await fetch(`${BASE}${route}`);
    assert.equal(res.status, 401, `${route} must be 401 without auth`);
  }
});

test('wrong password is rejected, correct password sets a session cookie', async () => {
  const bad = await fetch(`${BASE}/api/owner/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'nope' })
  });
  assert.equal(bad.status, 401);

  const good = await fetch(`${BASE}/api/owner/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: OWNER_PASSWORD })
  });
  assert.equal(good.status, 200);
  const cookie = good.headers.get('set-cookie') || '';
  assert.ok(cookie.length > 0, 'login must set a session cookie');

  const gated = await fetch(`${BASE}/api/owner/bootstrap`, {
    headers: { cookie: cookie.split(';')[0] }
  });
  assert.equal(gated.status, 200, 'session cookie must open owner routes');
});

test('login rate limit returns 429 after repeated failures', async () => {
  let sawTooMany = false;
  for (let i = 0; i < 12; i += 1) {
    const res = await fetch(`${BASE}/api/owner/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: `wrong-${i}` })
    });
    if (res.status === 429) {
      sawTooMany = true;
      break;
    }
    assert.equal(res.status, 401);
  }
  assert.ok(sawTooMany, 'rate limiter must kick in with 429');
});
