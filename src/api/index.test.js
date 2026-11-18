const { test, beforeEach, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

// Replace the db module with an in-memory fake before loading the app.
const calls = [];
let tasks = [];
const fakeDb = {
  query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.startsWith('DELETE FROM tasks')) {
      const before = tasks.length;
      tasks = tasks.filter((t) => t.id !== params[0]);
      return { rows: [], rowCount: before - tasks.length };
    }
    throw new Error(`unexpected query: ${sql}`);
  },
};
const dbPath = require.resolve('./db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakeDb };

const app = require(path.join(__dirname, 'index.js'));

let server;
let base;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  calls.length = 0;
  tasks = [
    { id: 1, title: 'one', completed: false },
    { id: 2, title: 'two', completed: true },
  ];
});

test('GET /health returns 200 with {status: "ok"} as JSON', async () => {
  const res = await fetch(`${base}/health`);
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.deepStrictEqual(await res.json(), { status: 'ok' });
  assert.strictEqual(calls.length, 0);
});

test('DELETE /tasks/:id deletes an existing task and returns 204', async () => {
  const res = await fetch(`${base}/tasks/1`, { method: 'DELETE' });
  assert.strictEqual(res.status, 204);
  assert.strictEqual(await res.text(), '');
  assert.deepStrictEqual(tasks.map((t) => t.id), [2]);
});

test('DELETE /tasks/:id returns 404 when the task does not exist', async () => {
  const res = await fetch(`${base}/tasks/999`, { method: 'DELETE' });
  assert.strictEqual(res.status, 404);
  assert.deepStrictEqual(await res.json(), { error: 'Not found' });
  assert.strictEqual(tasks.length, 2);
});

test('DELETE /tasks/:id returns 400 for an invalid id', async () => {
  for (const bad of ['abc', '1.5', '-1', '0', '1abc', '99999999999']) {
    const res = await fetch(`${base}/tasks/${bad}`, { method: 'DELETE' });
    assert.strictEqual(res.status, 400, `id ${bad}`);
    assert.deepStrictEqual(await res.json(), { error: 'invalid id' });
  }
  assert.strictEqual(calls.length, 0);
  assert.strictEqual(tasks.length, 2);
});
