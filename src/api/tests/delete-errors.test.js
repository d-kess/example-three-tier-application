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
  it('deletes an existing task and returns 204', async () => {
    const res = await request(app).delete('/tasks/1');
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(mockFake.state.tasks.map((t) => t.id)).toEqual([2]);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).delete('/tasks/999');
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'not_found', message: 'Task 999 not found' });
    expect(mockFake.state.tasks).toHaveLength(2);
  });

  it('returns 404 when deleting the same task twice', async () => {
    await request(app).delete('/tasks/1');
    const res = await request(app).delete('/tasks/1');
    expect(res.status).toBe(404);
  });

  it.each(['abc', '1.5', '-1', '0', '1abc', '99999999999'])(
    'returns 400 for invalid id %s',
    async (id) => {
      const res = await request(app).delete(`/tasks/${id}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('validation_error');
      expect(mockFake.state.calls).toHaveLength(0);
      expect(mockFake.state.tasks).toHaveLength(2);
    }
  );
});

describe('error handling', () => {
  it('returns 400 with a JSON error for malformed JSON', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Content-Type', 'application/json')
      .send('{"title": ');
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({
      error: { code: 'bad_request', message: 'Malformed JSON body' },
    });
  });

  it('returns 400 for malformed JSON on PUT and PATCH', async () => {
    for (const method of ['put', 'patch']) {
      const res = await request(app)
        [method]('/tasks/1')
        .set('Content-Type', 'application/json')
        .send('not json');
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Malformed JSON body');
    }
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
    expect(res.body.error.message).toBe('Route not found: GET /nope');
  });

  it('returns a JSON 404 for unsupported methods on known paths', async () => {
    const res = await request(app).delete('/tasks');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });

  it('does not leak internal error details on 500', async () => {
    mockFake.state.failWith = new Error('secret db password');
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).delete('/tasks/1');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret');
    console.error.mockRestore();
  });
});
