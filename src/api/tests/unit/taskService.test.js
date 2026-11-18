const { test, describe, afterEach, mock } = require('node:test');
const assert = require('node:assert');

const taskRepository = require('../../repositories/taskRepository');
const taskService = require('../../services/taskService');
const { NotFoundError } = require('../../errors');

const task = (overrides = {}) => ({
  id: 1,
  title: 'one',
  completed: false,
  created_at: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

afterEach(() => mock.restoreAll());

describe('taskService.listTasks', () => {
  test('returns whatever the repository returns', async () => {
    const rows = [task(), task({ id: 2 })];
    const findAll = mock.method(taskRepository, 'findAll', async () => rows);
    assert.deepStrictEqual(await taskService.listTasks(), rows);
    assert.strictEqual(findAll.mock.callCount(), 1);
  });

  test('propagates repository errors', async () => {
    mock.method(taskRepository, 'findAll', async () => {
      throw new Error('db down');
    });
    await assert.rejects(taskService.listTasks(), /db down/);
  });
});

describe('taskService.createTask', () => {
  test('creates via the repository with the given title', async () => {
    const created = task({ title: 'new' });
    const create = mock.method(taskRepository, 'create', async () => created);
    assert.deepStrictEqual(await taskService.createTask({ title: 'new' }), created);
    assert.deepStrictEqual(create.mock.calls[0].arguments, ['new']);
  });
});

describe('taskService.patchTask', () => {
  function stub(current) {
    mock.method(taskRepository, 'findById', async () => current);
    return mock.method(taskRepository, 'update', async (id, fields) => ({
      ...current,
      ...fields,
    }));
  }

  test('toggles completed when neither field is given', async () => {
    const update = stub(task({ completed: false }));
    const result = await taskService.patchTask(1, {});
    assert.strictEqual(result.completed, true);
    assert.deepStrictEqual(update.mock.calls[0].arguments, [
      1,
      { title: 'one', completed: true },
    ]);
  });

  test('toggles completed when called without a body', async () => {
    stub(task({ completed: true }));
    assert.strictEqual((await taskService.patchTask(1)).completed, false);
  });

  test('sets completed explicitly, even to the same value', async () => {
    stub(task({ completed: true }));
    assert.strictEqual((await taskService.patchTask(1, { completed: true })).completed, true);
    assert.strictEqual((await taskService.patchTask(1, { completed: false })).completed, false);
  });

  test('renames without changing completed', async () => {
    const update = stub(task({ completed: true }));
    const result = await taskService.patchTask(1, { title: 'renamed' });
    assert.strictEqual(result.title, 'renamed');
    assert.strictEqual(result.completed, true);
    assert.deepStrictEqual(update.mock.calls[0].arguments[1], {
      title: 'renamed',
      completed: true,
    });
  });

  test('updates both fields when both are given', async () => {
    const update = stub(task());
    await taskService.patchTask(1, { title: 'x', completed: true });
    assert.deepStrictEqual(update.mock.calls[0].arguments[1], { title: 'x', completed: true });
  });

  test('throws NotFoundError and does not update when the task is missing', async () => {
    const update = stub(null);
    await assert.rejects(taskService.patchTask(9, {}), NotFoundError);
    assert.strictEqual(update.mock.callCount(), 0);
  });

  test('throws NotFoundError when the row disappears before the update', async () => {
    mock.method(taskRepository, 'findById', async () => task());
    mock.method(taskRepository, 'update', async () => null);
    await assert.rejects(taskService.patchTask(1, {}), NotFoundError);
  });
});

describe('taskService.replaceTask', () => {
  test('replaces title and completed and returns the updated task', async () => {
    const update = mock.method(taskRepository, 'update', async (id, f) => task({ id, ...f }));
    const result = await taskService.replaceTask(3, { title: 'new', completed: true });
    assert.deepStrictEqual(result, task({ id: 3, title: 'new', completed: true }));
    assert.deepStrictEqual(update.mock.calls[0].arguments, [
      3,
      { title: 'new', completed: true },
    ]);
  });

  test('throws NotFoundError when the task does not exist', async () => {
    mock.method(taskRepository, 'update', async () => null);
    await assert.rejects(
      taskService.replaceTask(9, { title: 'x', completed: false }),
      (err) => err instanceof NotFoundError && err.status === 404
    );
  });
});

describe('taskService.deleteTask', () => {
  test('resolves when the task was deleted', async () => {
    const remove = mock.method(taskRepository, 'remove', async () => true);
    assert.strictEqual(await taskService.deleteTask(1), undefined);
    assert.deepStrictEqual(remove.mock.calls[0].arguments, [1]);
  });

  test('throws NotFoundError when nothing was deleted', async () => {
    mock.method(taskRepository, 'remove', async () => false);
    await assert.rejects(taskService.deleteTask(1), NotFoundError);
  });
});
