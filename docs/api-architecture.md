# API architecture

The Express API in `src/api/` is split into layers. Each layer only talks to the one below it.

```
HTTP request
   │
   ▼
routes/        map method + path to validation and a controller
   │
validation/    validate and sanitize params, query and body (400 on failure)
   │
   ▼
controllers/   translate HTTP ⇄ service calls (status codes, JSON)
   │
   ▼
services/      business logic; no knowledge of HTTP
   │
   ▼
repositories/  SQL via the pg pool in db.js
   │
   ▼
PostgreSQL
```

## Layout

| Path | Responsibility |
|------|----------------|
| `index.js` | Server entry point; starts listening on `PORT` (default 3001) |
| `app.js` | Builds the Express app: JSON parsing, routes, 404 and error handlers. Exported for tests |
| `db.js` | PostgreSQL connection pool |
| `errors.js` | `ApiError`, `ValidationError` (400), `NotFoundError` (404) |
| `routes/` | `index.js` mounts `/health` and `/tasks`; `taskRoutes.js`, `healthRoutes.js` |
| `controllers/` | `taskController.js`, `healthController.js` |
| `services/taskService.js` | `listTasks`, `createTask`, `patchTask`, `replaceTask`, `deleteTask` |
| `repositories/taskRepository.js` | `findAll`, `findById`, `create`, `update`, `remove` |
| `validation/` | `schema.js` (field rules), `validate.js` (middleware), `taskSchemas.js` (per-route schemas) |
| `middleware/errorHandler.js` | `notFoundHandler` and `errorHandler` |

## Endpoints

| Method | Path | Success | Notes |
|--------|------|---------|-------|
| GET | `/health` | 200 | Health check |
| GET | `/tasks` | 200 | List tasks |
| POST | `/tasks` | 201 | Body `{ title }` |
| PATCH | `/tasks/:id` | 200 | Optional `title` and/or `completed`; an empty or missing body toggles `completed` |
| PUT | `/tasks/:id` | 200 | Full replacement: `title` and `completed` both required |
| DELETE | `/tasks/:id` | 204 | |

### PUT /tasks/:id

The request passes through `validate(schemas.replace)` → `taskController.replace` → `taskService.replaceTask` → `taskRepository.update`. Both `title` and `completed` are required, so the task is fully replaced. If no row matches the id the service throws `NotFoundError` and the client gets `404`.

```bash
curl -X PUT localhost:3001/tasks/1 -H 'content-type: application/json' \
  -d '{"title":"Write docs","completed":true}'
```

## Validation

Validation is dependency-free. `schema.js` provides field rules (`id`, `title`, `boolean`) and `object(fields, { optional })`. `taskSchemas.js` declares a `{ params, query, body }` schema per route, and `validate(schema)` runs them all, collects every error, and either sets `req.validated` to the sanitized values (unknown keys stripped) or passes a `ValidationError` to `next`. Controllers read from `req.validated`.

Rules:

- `id`: decimal integer in 1..2147483647 (Postgres `int4`).
- `title`: non-blank string, trimmed, at most 500 characters.
- `completed`: strict boolean. `"true"` and `1` are rejected rather than coerced.
- Bodies for POST and PUT must be JSON objects. For PATCH a missing body is treated as `{}`; a non-object body is rejected.
- Unknown query parameters and body keys are ignored.

## Error handling

All errors are JSON: `{ "error": "<message>", "details"?: [...] }`.

| Status | Body | Cause |
|--------|------|-------|
| 400 | `{ "error": "Validation failed", "details": [{ "location", "field", "message" }] }` | Invalid params, query or body. `location` is `params`, `query` or `body`; `field` is `null` when the whole input is wrong (e.g. body not an object) |
| 400 | `{ "error": "Malformed JSON body" }` | Unparseable JSON. Express's strict parser also rejects a bare `null` or other primitives this way |
| 404 | `{ "error": "Not found" }` | Unknown route or task id |
| 413 | `{ "error": "Request body too large" }` | Body over the parser limit |
| 500 | `{ "error": "Internal server error" }` | Unexpected error (logged server-side) |

Services throw `NotFoundError`; controllers let errors propagate to `errorHandler`, so no layer formats error responses by hand.

## Behavior changes from the pre-refactor API

- PATCH `completed` must be a real boolean (previously coerced).
- Invalid ids and titles return the `Validation failed` body instead of messages like `{ "error": "invalid id" }`.
- POST and PATCH with a missing or non-object body return 400. A missing POST body used to produce a 500.

## Tests

Run from `src/api/`:

```bash
npm install
npm test        # node --test "tests/**/*.test.js"
```

- `tests/unit/taskService.test.js`: every service function, with the repository stubbed.
- `tests/unit/taskRepository.test.js`: SQL and parameters, with the pool stubbed.
- `tests/unit/validation.test.js`: schema helpers and the validate middleware.
- `tests/integration/tasks.test.js`: every route over real HTTP against the app, with the repository stubbed (no database needed). `tests/helpers/server.js` starts the app on an ephemeral port.
