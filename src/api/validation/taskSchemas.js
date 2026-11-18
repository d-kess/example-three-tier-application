const { id, title, boolean, object } = require('./schema');

const idParams = object({ id: id({ required: true }) });
// No query parameters are accepted yet; unknown ones are ignored.
const noQuery = object({});

module.exports = {
  // GET /tasks
  list: { query: noQuery },
  // POST /tasks
  create: {
    query: noQuery,
    body: object({ title: title({ required: true }) }),
  },
  // PATCH /tasks/:id — a missing/empty body toggles `completed`
  patch: {
    params: idParams,
    query: noQuery,
    body: object({ title: title(), completed: boolean() }, { optional: true }),
  },
  // PUT /tasks/:id — full replacement, both fields required
  replace: {
    params: idParams,
    query: noQuery,
    body: object({ title: title({ required: true }), completed: boolean({ required: true }) }),
  },
  // DELETE /tasks/:id
  remove: {
    params: idParams,
    query: noQuery,
  },
};
