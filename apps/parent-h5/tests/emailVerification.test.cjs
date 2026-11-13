const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Run the TypeScript helper with an isolated SDK. No real emails or accounts.
const source = fs.readFileSync(path.join(__dirname, '../src/services/emailVerification.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function load({ configured = true, user = { email_confirmed_at: '2026-11-13T00:00:00Z' }, error = null, throws = false } = {}) {
  const calls = [];
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, URL, URLSearchParams, AbortSignal,
    require(name) {
      if (name === './supabaseConfig') return { isSupabaseConfigured: configured, rawSupabaseUrl: 'https://test.supabase.co', rawSupabaseAnonKey: 'test-public-key' };
      assert.equal(name, '@supabase/supabase-js');
      return { createClient(url, key, options) {
        calls.push({ url, key, options });
        // Only getUser exists: setSession, signIn and signOut must never run.
        return { auth: { async getUser(token) {
          calls.push({ token });
          if (throws) throw new Error('offline');
          return { data: { user }, error };
        } } };
      } };
    },
  });
  return { ...exports, calls };
}
const signup = 'https://keep.1203.fyi/auth/verified#type=signup&access_token=test-token&refresh_token=test-refresh';

test('confirmed signup succeeds without adopting or storing a session', async () => {
  const helper = load();
  assert.equal(await helper.verifyEmailCallback(signup), 'success');
  assert.equal(helper.calls.length, 2);
  assert.equal(helper.calls[1].token, 'test-token');
  assert.deepEqual(JSON.parse(JSON.stringify(helper.calls[0].options.auth)), {
    persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
    storageKey: 'study-pet-email-verification',
  });
});
test('missing token, wrong flow and direct visit cannot claim success', async () => {
  const helper = load();
  for (const href of ['https://keep.1203.fyi/auth/verified', signup.replace('type=signup', 'type=recovery'), signup.replace('access_token=test-token', 'other=value')]) {
    assert.equal(await helper.verifyEmailCallback(href), 'invalid');
  }
  assert.equal(helper.calls.length, 0);
});
test('unconfirmed and absent users fail verification', async () => {
  for (const user of [{ email_confirmed_at: null }, null]) {
    assert.equal(await load({ user }).verifyEmailCallback(signup), 'invalid');
  }
});
test('expired or used links and callback errors take priority over a token', async () => {
  const helper = load();
  assert.equal(await helper.verifyEmailCallback(`${signup}&error_code=otp_expired`), 'expired');
  assert.equal(await helper.verifyEmailCallback('https://keep.1203.fyi/auth/verified?error=access_denied&error_code=otp_expired'), 'expired');
  assert.equal(await helper.verifyEmailCallback(`${signup}&error=access_denied`), 'invalid');
  assert.equal(helper.calls.length, 0);
});
test('unconfigured service does not create a client', async () => {
  const helper = load({ configured: false });
  assert.equal(await helper.verifyEmailCallback(signup), 'unconfigured');
  assert.equal(helper.calls.length, 0);
});
test('invalid tokens fail; network and server failures allow retry', async () => {
  assert.equal(await load({ error: { status: 401 } }).verifyEmailCallback(signup), 'invalid');
  assert.equal(await load({ error: { status: 503 } }).verifyEmailCallback(signup), 'failed');
  assert.equal(await load({ error: { name: 'AuthRetryableFetchError' } }).verifyEmailCallback(signup), 'failed');
  assert.equal(await load({ throws: true }).verifyEmailCallback(signup), 'failed');
});
test('old root signup callbacks and errors are routed to verification only', () => {
  const { isEmailVerificationCallback } = load();
  assert.equal(isEmailVerificationCallback(signup.replace('/auth/verified', '/')), true);
  assert.equal(isEmailVerificationCallback('https://keep.1203.fyi/?error_code=otp_expired'), true);
  assert.equal(isEmailVerificationCallback('https://keep.1203.fyi/#error=access_denied'), true);
  assert.equal(isEmailVerificationCallback('https://keep.1203.fyi/'), false);
  assert.equal(isEmailVerificationCallback('https://keep.1203.fyi/#type=recovery'), false);
});
