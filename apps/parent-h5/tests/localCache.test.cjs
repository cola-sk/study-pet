const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');

function createStorage() {
  const map = new Map();
  return {
    get length() { return map.size; },
    key(index) { return Array.from(map.keys())[index] ?? null; },
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
  };
}

function loadLocalCache(storage = createStorage()) {
  const source = fs.readFileSync(path.join(__dirname, '../src/services/localCache.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    window: { localStorage: storage },
  });
  return { ...exports, storage };
}

test('readUserCache and writeUserCache isolate entries per userId', () => {
  const { readUserCache, writeUserCache } = loadLocalCache();
  writeUserCache('user-a', 'tasks_state', { todayDate: '2026-11-13', children: [{ id: 'c1' }] });
  writeUserCache('user-b', 'tasks_state', { todayDate: '2026-11-12', children: [{ id: 'c2' }] });

  assert.deepEqual(JSON.parse(JSON.stringify(readUserCache('user-a', 'tasks_state'))), { todayDate: '2026-11-13', children: [{ id: 'c1' }] });
  assert.deepEqual(JSON.parse(JSON.stringify(readUserCache('user-b', 'tasks_state'))), { todayDate: '2026-11-12', children: [{ id: 'c2' }] });
  assert.equal(readUserCache('', 'tasks_state'), null);
});

test('clearUserCache removes only the target user entries', () => {
  const { readUserCache, writeUserCache, clearUserCache } = loadLocalCache();
  writeUserCache('user-a', 'tasks_state', { ok: 1 });
  writeUserCache('user-a', 'settings_devices', { ok: 2 });
  writeUserCache('user-b', 'tasks_state', { ok: 3 });

  clearUserCache('user-a');

  assert.equal(readUserCache('user-a', 'tasks_state'), null);
  assert.equal(readUserCache('user-a', 'settings_devices'), null);
  assert.deepEqual(JSON.parse(JSON.stringify(readUserCache('user-b', 'tasks_state'))), { ok: 3 });
});

test('readUserCache returns null on corrupted JSON and ignores storage errors', () => {
  const storage = createStorage();
  storage.setItem('study_pet_cache_v1:user-a:broken', '{bad json');
  const { readUserCache } = loadLocalCache(storage);
  assert.equal(readUserCache('user-a', 'broken'), null);

  const throwingStorage = {
    get length() { return 0; },
    key() { return null; },
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('quota'); },
    removeItem() { throw new Error('denied'); },
  };
  const throwing = loadLocalCache(throwingStorage);
  assert.doesNotThrow(() => throwing.writeUserCache('user-a', 'k', { a: 1 }));
  assert.equal(throwing.readUserCache('user-a', 'k'), null);
  assert.doesNotThrow(() => throwing.clearUserCache('user-a'));
});
