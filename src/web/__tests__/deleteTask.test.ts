jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

import { revalidatePath } from 'next/cache';
import { deleteTask } from '../app/actions';

const fetchMock = jest.fn();

// jsdom has no Response global, so use a minimal response-like object.
function fakeRes(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new SyntaxError('no body');
      return body;
    },
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  (revalidatePath as jest.Mock).mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('deleteTask', () => {
  it('calls DELETE /tasks/:id and revalidates on success', async () => {
    fetchMock.mockResolvedValue(fakeRes(204));
    const result = await deleteTask(7);
    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/tasks\/7$/);
    expect(init.method).toBe('DELETE');
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });

  it('returns the API error message on 404 and does not revalidate', async () => {
    fetchMock.mockResolvedValue(fakeRes(404, { error: { code: 'NOT_FOUND', message: 'Task not found' } }));
    const result = await deleteTask(99);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Task not found');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('falls back to a generic message for a non-JSON 404', async () => {
    fetchMock.mockResolvedValue(fakeRes(404));
    const result = await deleteTask(99);
    expect(result).toEqual(expect.objectContaining({ ok: false, error: 'Request failed (404)' }));
  });

  it('reports unreachable API', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const result = await deleteTask(1);
    expect(result).toEqual({ ok: false, error: 'Could not reach the server' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
