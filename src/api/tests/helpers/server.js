const app = require('../../app');

/**
 * Start the app on an ephemeral port. Returns `{ request, close }` where
 * `request(method, path, body?)` resolves to `{ status, headers, text, json }`.
 * A string body is sent as-is (useful for malformed JSON); anything else is
 * JSON-encoded; `undefined` sends no body.
 */
async function startServer() {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  async function request(method, path, body) {
    const init = { method };
    if (body !== undefined) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    const res = await fetch(`${base}${path}`, init);
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }
    return { status: res.status, headers: res.headers, text, json };
  }

  const close = () => new Promise((resolve) => server.close(resolve));
  return { request, close };
}

module.exports = { startServer };
