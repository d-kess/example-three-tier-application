const { test, describe, beforeEach, mock } = require('node:test');
const assert = require('node:assert');

const db = require('../../db');
const taskRepository = require('../../repositories/taskRepository');

let query;
beforeEach(() => {
  mock.restoreAll();
});

function stubQuery(result) {
  query = mock.method(db, 'query', async () => result);
  return query;
}

describe('taskRepository', () => {
  test('findAll selects all tasks ordered by created_at', async () => {
    stubQuery({ rows: [{ id: 1 }, { id: 2 }] });
    assert.deepStrictEqual(await taskRepository.findAll(), [{ id: 1 }, { id: 2 }]);
    assert.match(query.mock.calls[0].arguments[0], /^SELECT \* FROM tasks ORDER BY created_at ASC/);
  });

  test('findById returns the row or null', async () => {
    stubQuery({ rows: [{ id: 1 }] });
    assert.deepStrictEqual(await taskRepository.findById(1), { id: 1 });
    assert.deepStrictEqual(query.mock.calls[0].arguments[1], [1]);
    stubQuery({ rows: [] });
    assert.strictEqual(await taskRepository.findById(2), null);
  });

  test('create inserts with a parameterized title', async () => {
    stubQuery({ rows: [{ id: 1, title: 't' }] });
    assert.deepStrictEqual(await taskRepository.create('t'), { id: 1, title: 't' });
    assert.match(query.mock.calls[0].arguments[0], /^INSERT INTO tasks/);
    assert.deepStrictEqual(query.mock.calls[0].arguments[1], ['t']);
  });

  test('update returns the row or null', async () => {
    stubQuery({ rows: [{ id: 1 }] });
    assert.deepStrictEqual(await taskRepository.update(1, { title: 't', completed: true }), { id: 1 });
    assert.deepStrictEqual(query.mock.calls[0].arguments[1], [true, 't', 1]);
    stubQuery({ rows: [] });
    assert.strictEqual(await taskRepository.update(2, { title: 't', completed: true }), null);
  });

  test('remove returns whether a row was deleted', async () => {
    stubQuery({ rows: [], rowCount: 1 });
    assert.strictEqual(await taskRepository.remove(1), true);
    assert.deepStrictEqual(query.mock.calls[0].arguments[1], [1]);
    stubQuery({ rows: [], rowCount: 0 });
    assert.strictEqual(await taskRepository.remove(1), false);
  });
});
