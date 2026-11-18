const { test, describe, before, after, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');

const taskRepository = require('../../repositories/taskRepository');
const { startServer } = require('../helpers/server');

// Integration tests: real HTTP server + routes + validation + controllers +
// services; only the data access layer is replaced by an in-memory fake.

let server;
let tasks;
let calls;

before(async () => {
  server = await startServer();
});
after(() => server.close());

beforeEach(() => {
  calls = [];
  tasks = [
    { id: 1, title: 'one', completed: false, created_at: '2024-01-01T00:00:00.000Z' },
    { id: 2, title: 'two', completed: true, created_at: '2024-01-02T00:00:00.000Z' },
  ];
  const track = (name, fn) =>
    mock.method(taskRepository, name, async (...args) => {
      calls.push(name);
      return fn(...args);
    });
  track('findAll', () => tasks);
  track('findById', (id) => tasks.find((t) => t.id === id) || null);
  track('create', (title) => {
    const t = { id: 3, title, completed: false, created_at: '2024-01-03T00:00:00.000Z' };
    tasks.push(t);
    return t;
  });
  track('update', (id, { title, completed }) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return null;
    t.title = title;
    t.completed = completed;
    return t;
  });
  track('remove', (id) => {
    const count = tasks.length;
    tasks = tasks.filter((t) => t.id !== id);
    return tasks.length < count;
  });
});

afterEach(() => mock.restoreAll());

const request = (...args) => server.request(...args);

const INVALID_IDS = ['abc', '1.5', '-1', '0', '1abc', '99999999999', '2147483648'];

function assertValidationError(res, expected) {
  assert.strictEqual(res.status, 400);
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.strictEqual(res.json.error, 'Validation failed');
  assert.ok(Array.isArray(res.json.details));
  if (expected) {
    assert.ok(
      res.json.details.some(
        (d) => d.location === expected.location && d.field === expected.field
      ),
      `expected detail for ${expected.location}.${expected.field}, got ${JSON.stringify(res.json.details)}`
    );
  }
  for (const d of res.json.details) {
    assert.deepStrictEqual(Object.keys(d).sort(), ['field', 'location', 'message']);
  }
}

describe('GET /health', () => {
  test('returns 200 {status: "ok"} as JSON without touching the data layer', async () => {
    const res = await request('GET', '/health');
    assert.strictEqual(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
    assert.deepStrictEqual(res.json, { status: 'ok' });
    assert.deepStrictEqual(calls, []);
  });
});

describe('unknown routes', () => {
  test('return a JSON 404', async () => {
    const res = await request('GET', '/nope');
    assert.strictEqual(res.status, 404);
    assert.deepStrictEqual(res.json, { error: 'Not found' });
  });
});

describe('GET /tasks', () => {
  test('lists all tasks', async () => {
    const res = await request('GET', '/tasks');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.json, tasks);
  });

  test('ignores unknown query parameters', async () => {
    const res = await request('GET', '/tasks?foo=bar');
    assert.strictEqual(res.status, 200);
  });

  test('returns 500 with a generic JSON error when the data layer fails', async () => {
    mock.method(console, 'error', () => {});
    taskRepository.findAll.mock.mockImplementation(async () => {
      throw new Error('boom');
    });
    const res = await request('GET', '/tasks');
    assert.strictEqual(res.status, 500);
    assert.deepStrictEqual(res.json, { error: 'Internal server error' });
  });
});

describe('POST /tasks', () => {
  test('creates a task, trimming the title, and returns 201', async () => {
    const res = await request('POST', '/tasks', { title: '  new task ' });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.json.title, 'new task');
    assert.strictEqual(res.json.completed, false);
    assert.strictEqual(tasks.length, 3);
  });

  test('accepts a title of exactly 500 characters', async () => {
    const res = await request('POST', '/tasks', { title: 'a'.repeat(500) });
    assert.strictEqual(res.status, 201);
  });

  test('rejects missing, blank, non-string and over-long titles with 400', async () => {
    for (const body of [{}, { title: '' }, { title: '   ' }, { title: 5 }, { title: null }, { title: 'a'.repeat(501) }]) {
      assertValidationError(await request('POST', '/tasks', body), { location: 'body', field: 'title' });
    }
    assert.deepStrictEqual(calls, []);
  });

  test('rejects a missing or non-object body with 400', async () => {
    assertValidationError(await request('POST', '/tasks'));
    assertValidationError(await request('POST', '/tasks', []));
    // Express's strict JSON parser rejects a bare `null` before validation runs.
    const res = await request('POST', '/tasks', 'null');
    assert.strictEqual(res.status, 400);
    assert.deepStrictEqual(res.json, { error: 'Malformed JSON body' });
    assert.deepStrictEqual(calls, []);
  });

  test('rejects malformed JSON with 400', async () => {
    const res = await request('POST', '/tasks', '{"title": ');
    assert.strictEqual(res.status, 400);
    assert.deepStrictEqual(res.json, { error: 'Malformed JSON body' });
  });
});

describe('PATCH /tasks/:id', () => {
  test('toggles completed when the body is empty', async () => {
    let res = await request('PATCH', '/tasks/1', {});
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.completed, true);
    res = await request('PATCH', '/tasks/1', {});
    assert.strictEqual(res.json.completed, false);
    res = await request('PATCH', '/tasks/2', {});
    assert.strictEqual(res.json.completed, false);
  });

  test('toggles completed when there is no body at all', async () => {
    const res = await request('PATCH', '/tasks/1');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.completed, true);
  });

  test('sets completed explicitly', async () => {
    const res = await request('PATCH', '/tasks/2', { completed: true });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.completed, true);
  });

  test('renames without changing completed', async () => {
    const res = await request('PATCH', '/tasks/2', { title: '  renamed ' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.title, 'renamed');
    assert.strictEqual(res.json.completed, true);
  });

  test('returns 404 when the task does not exist', async () => {
    const res = await request('PATCH', '/tasks/999', {});
    assert.strictEqual(res.status, 404);
    assert.deepStrictEqual(res.json, { error: 'Not found' });
    assert.ok(!calls.includes('update'));
  });

  test('returns 400 for an invalid id', async () => {
    for (const bad of INVALID_IDS) {
      assertValidationError(await request('PATCH', `/tasks/${bad}`, {}), { location: 'params', field: 'id' });
    }
    assert.deepStrictEqual(calls, []);
  });

  test('returns 400 for an invalid title or completed', async () => {
    assertValidationError(await request('PATCH', '/tasks/1', { title: '   ' }), { location: 'body', field: 'title' });
    assertValidationError(await request('PATCH', '/tasks/1', { title: 5 }), { location: 'body', field: 'title' });
    assertValidationError(await request('PATCH', '/tasks/1', { title: 'a'.repeat(501) }), { location: 'body', field: 'title' });
    assertValidationError(await request('PATCH', '/tasks/1', { completed: 'yes' }), { location: 'body', field: 'completed' });
    assertValidationError(await request('PATCH', '/tasks/1', []));
    assert.deepStrictEqual(calls, []);
  });

  test('reports id and body problems together', async () => {
    const res = await request('PATCH', '/tasks/abc', { title: '' });
    assertValidationError(res);
    assert.strictEqual(res.json.details.length, 2);
  });
});

describe('PUT /tasks/:id', () => {
  test('replaces title and completed', async () => {
    const res = await request('PUT', '/tasks/1', { title: '  replaced ', completed: true });
    assert.strictEqual(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
    assert.deepStrictEqual(res.json, {
      id: 1,
      title: 'replaced',
      completed: true,
      created_at: '2024-01-01T00:00:00.000Z',
    });
    assert.strictEqual(tasks[0].title, 'replaced');
  });

  test('can set completed back to false', async () => {
    const res = await request('PUT', '/tasks/2', { title: 'two', completed: false });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.completed, false);
  });

  test('returns 404 when the task does not exist', async () => {
    const res = await request('PUT', '/tasks/999', { title: 'x', completed: false });
    assert.strictEqual(res.status, 404);
    assert.deepStrictEqual(res.json, { error: 'Not found' });
  });

  test('returns 400 for an invalid id', async () => {
    for (const bad of INVALID_IDS) {
      assertValidationError(
        await request('PUT', `/tasks/${bad}`, { title: 'x', completed: false }),
        { location: 'params', field: 'id' }
      );
    }
    assert.deepStrictEqual(calls, []);
  });

  test('requires both title and completed', async () => {
    assertValidationError(await request('PUT', '/tasks/1', {}), { location: 'body', field: 'title' });
    assertValidationError(await request('PUT', '/tasks/1', { title: 'x' }), { location: 'body', field: 'completed' });
    assertValidationError(await request('PUT', '/tasks/1', { completed: true }), { location: 'body', field: 'title' });
    assertValidationError(await request('PUT', '/tasks/1'));
    assert.deepStrictEqual(calls, []);
  });

  test('rejects invalid field values', async () => {
    assertValidationError(await request('PUT', '/tasks/1', { title: '   ', completed: true }), { location: 'body', field: 'title' });
    assertValidationError(await request('PUT', '/tasks/1', { title: 'a'.repeat(501), completed: true }), { location: 'body', field: 'title' });
    assertValidationError(await request('PUT', '/tasks/1', { title: 'x', completed: 'true' }), { location: 'body', field: 'completed' });
    assertValidationError(await request('PUT', '/tasks/1', { title: 'x', completed: 1 }), { location: 'body', field: 'completed' });
    assert.deepStrictEqual(calls, []);
  });
});

describe('DELETE /tasks/:id', () => {
  test('deletes an existing task and returns 204 with no body', async () => {
    const res = await request('DELETE', '/tasks/1');
    assert.strictEqual(res.status, 204);
    assert.strictEqual(res.text, '');
    assert.deepStrictEqual(tasks.map((t) => t.id), [2]);
  });

  test('returns 404 when the task does not exist', async () => {
    const res = await request('DELETE', '/tasks/999');
    assert.strictEqual(res.status, 404);
    assert.deepStrictEqual(res.json, { error: 'Not found' });
    assert.strictEqual(tasks.length, 2);
  });

  test('returns 400 for an invalid id', async () => {
    for (const bad of INVALID_IDS) {
      assertValidationError(await request('DELETE', `/tasks/${bad}`), { location: 'params', field: 'id' });
    }
    assert.deepStrictEqual(calls, []);
    assert.strictEqual(tasks.length, 2);
  });
});
