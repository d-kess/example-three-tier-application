const request = require('supertest');
const { createFakeDb } = require('./fakeDb');

const mockFake = createFakeDb();
jest.mock('../db', () => mockFake.db);
const app = require('../app');

beforeEach(() => {
  mockFake.reset([
    { id: 1, title: 'one', completed: false },
    { id: 2, title: 'two', completed: true },
  ]);
});

describe('DELETE /tasks/:id', () => {
  it('deletes an existing task and returns 204 with no body', async () => {
    const res = await request(app).delete('/tasks/1');

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(mockFake.state.calls).toEqual([
      { sql: 'DELETE FROM tasks WHERE id = $1 RETURNING *', params: [1] },
    ]);
    expect(mockFake.state.tasks.map((t) => t.id)).toEqual([2]);
  });

  it('returns 404 not_found when the task does not exist', async () => {
    const res = await request(app).delete('/tasks/99');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'not_found', message: 'Task 99 not found' },
    });
    expect(mockFake.state.tasks).toHaveLength(2);
  });

  it('returns 404 on a repeated delete of the same id', async () => {
    await request(app).delete('/tasks/1');
    const res = await request(app).delete('/tasks/1');

    expect(res.status).toBe(404);
  });

  it.each([
    ['non-numeric', 'abc'],
    ['decimal', '1.5'],
    ['zero', '0'],
    ['negative', '-3'],
  ])('rejects a %s id with a 400 validation_error and runs no query', async (_name, id) => {
    const res = await request(app).delete(`/tasks/${id}`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: 'validation_error',
        message: 'Request validation failed',
        details: [{ field: 'id', message: 'id must be a positive integer' }],
      },
    });
    expect(mockFake.state.calls).toHaveLength(0);
    expect(mockFake.state.tasks).toHaveLength(2);
  });
});
