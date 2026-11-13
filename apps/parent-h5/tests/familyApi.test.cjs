const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/services/familyApi.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;

function load(options = {}) {
  const calls = [];
  const exports = {};
  const supabase = options.unconfigured ? null : {
    auth: {
      async getSession() {
        calls.push(['getSession']);
        return options.sessionResult || { data: { session: { access_token: 'tok-123' } }, error: null };
      },
      async signOut(arg) {
        calls.push(['signOut', arg]);
        if (options.signOutDelay) await new Promise(r => setTimeout(r, options.signOutDelay));
        if (options.signOutFails) throw new Error('signOut failed');
        return { error: null };
      },
    },
  };
  const fetch = async (url, init) => {
    calls.push(['fetch', url, init]);
    if (options.fetchStatus === 401) {
      return { ok: false, status: 401, async json() { return { error: 'Invalid or expired login' }; } };
    }
    if (options.fetchStatus) {
      return { ok: false, status: options.fetchStatus, async json() { return { error: options.fetchError || 'bad' }; } };
    }
    return { ok: true, status: 200, async json() { return { ok: true }; } };
  };

  vm.runInNewContext(compiled, {
    exports,
    fetch,
    AbortSignal,
    Promise,
    require(name) {
      if (name === './supabase') return { supabase };
      throw new Error(`Unexpected require: ${name}`);
    },
  });

  return { ...exports, calls };
}

test('401 response clears local session and throws FamilyApiError(401)', async () => {
  const h = load({ fetchStatus: 401 });
  await assert.rejects(
    () => h.familyApi('/api/v1/family/bootstrap', { method: 'POST' }),
    err => err instanceof h.FamilyApiError && err.status === 401 && err.message === '登录已过期，请重新登录',
  );
  const signOutCalls = h.calls.filter(c => c[0] === 'signOut');
  assert.equal(signOutCalls.length, 1);
  assert.equal(signOutCalls[0][1]?.scope, 'local');
});

test('missing or errored session clears local session and throws FamilyApiError(401)', async () => {
  for (const sessionResult of [
    { data: { session: null }, error: null },
    { data: { session: null }, error: new Error('broken') },
  ]) {
    const h = load({ sessionResult });
    await assert.rejects(
      () => h.familyApi('/api/v1/family/tasks'),
      err => err instanceof h.FamilyApiError && err.status === 401 && err.message === '登录已过期，请重新登录',
    );
    assert.deepEqual(h.calls.map(c => c[0]), ['getSession', 'signOut']);
  }
});

test('concurrent 401 responses deduplicate local signOut', async () => {
  const h = load({ fetchStatus: 401, signOutDelay: 10 });
  const results = await Promise.allSettled([
    h.familyApi('/api/v1/family/children'),
    h.familyApi('/api/v1/devices'),
  ]);
  assert.equal(results.every(r => r.status === 'rejected' && r.reason.status === 401), true);
  assert.equal(h.calls.filter(c => c[0] === 'signOut').length, 1);
});

test('non-401 errors do not clear local session', async () => {
  for (const status of [400, 404, 409, 500]) {
    const h = load({ fetchStatus: status });
    await assert.rejects(
      () => h.familyApi('/api/v1/family/tasks'),
      err => err instanceof h.FamilyApiError && err.status === status,
    );
    assert.equal(h.calls.some(c => c[0] === 'signOut'), false);
  }
});
