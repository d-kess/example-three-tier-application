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
  const del = (id) => request(app).delete(`/tasks/${id}`);

  it('returns 204 with no body and removes the task', async () => {
    const res = await del(1);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(mockFake.state.tasks.map((t) => t.id)).toEqual([2]);
    expect(mockFake.state.calls[0].sql).toBe('DELETE FROM tasks WHERE id = $1 RETURNING *');
    expect(mockFake.state.calls[0].params).toEqual([1]);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await del(999);
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'not_found', message: 'Task 999 not found' });
    expect(mockFake.state.tasks).toHaveLength(2);
  });

  it.each(['abc', '1.5', '-1', '0', '1abc', '99999999999'])(
    'returns 400 validation_error for invalid id %s without querying the db',
    async (id) => {
      const res = await del(id);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('validation_error');
      expect(res.body.error.details).toEqual([
        { field: 'id', message: 'id must be a positive integer' },
      ]);
      expect(mockFake.state.calls).toHaveLength(0);
    }
  );
});
