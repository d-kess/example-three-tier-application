# example-three-tier-application

A reference implementation of a three-tier web application: a Next.js frontend, an Express REST API, and a PostgreSQL database. It runs locally with Docker Compose and deploys to Google Cloud Platform (Cloud Run + Cloud SQL) via Terraform.

## Architecture

```
Browser → Web (Next.js :3000) → API (Express :3001) → PostgreSQL
```

| Layer | Technology | Location |
|-------|-----------|----------|
| Frontend | Next.js 16, React 19, Tailwind CSS | `src/web/` |
| API | Express 5, Node.js 22 | `src/api/` |
| Database | PostgreSQL 17 | managed by Docker / Cloud SQL |
| Migrations | node-pg-migrate | `src/db/` |
| Infrastructure | Terraform (GCP) | `src/infrastructure/` |

The app is a simple task manager (to-do list) that demonstrates how the three tiers communicate.

## Running locally with Docker Compose

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose plugin)

### Start the stack

```bash
docker compose up --build
```

This starts four services in order:

1. **postgres** — PostgreSQL 17 database, waits until healthy
2. **migrate** — runs `node-pg-migrate up` to apply schema migrations, then exits
3. **api** — Express API on port 3001 (internal only)
4. **web** — Next.js frontend on port 3000 (exposed to host)

Once running, open [http://localhost:3000](http://localhost:3000).

### Stop and clean up

```bash
# Stop containers (keeps the postgres_data volume)
docker compose down

# Stop and delete all data
docker compose down -v
```

### Rebuild after code changes

```bash
docker compose up --build
```

### API endpoints

The API is not exposed directly, but you can reach it through the web container or by temporarily mapping its port:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/tasks` | List all tasks |
| POST | `/tasks` | Create a task (`{ "title": "..." }`) |
| POST | `/tasks` | Create a task (`{ "title": "..." }`) → `201` |
| PATCH | `/tasks/:id` | Partially update a task (`{ "completed": true }` and/or `{ "title": "..." }`). An empty or missing body toggles `completed`. |
| PUT | `/tasks/:id` | Replace a task; both `title` and `completed` are required |
| DELETE | `/tasks/:id` | Delete a task → `204` |

#### Validation

Every endpoint validates its input before any business logic runs:

| Input | Rule |
|-------|------|
| `:id` | Integer between 1 and 2147483647 |
| `title` | Non-blank string, at most 500 characters (trimmed) |
| `completed` | Strict boolean (`true` / `false`); strings and numbers are rejected |
| Request body (POST, PUT) | Must be a JSON object; missing or non-object bodies are rejected |

Invalid requests return `400` with a consistent body:

```json
{
  "error": "Validation failed",
  "details": [
    { "location": "body", "field": "title", "message": "is required" }
  ]
}
```

`location` is `params`, `query` or `body`. Other errors: `400 {"error":"Malformed JSON body"}`, `404 {"error":"Not found"}` for unknown tasks or routes, `413` for oversized bodies and `500` for unexpected failures. See [docs/api-architecture.md](docs/api-architecture.md) for details.

## Project structure

```
src/
├── api/            # Express REST API (layered, see docs/api-architecture.md)
│   ├── index.js    # Server entry point
│   ├── app.js      # Express app wiring (middleware, routes, error handling)
│   ├── db.js       # PostgreSQL connection pool
│   ├── errors.js   # ApiError, ValidationError, NotFoundError
│   ├── routes/     # URL → validation → controller mappings
│   ├── controllers/# HTTP request/response handling
│   ├── services/   # Business logic
│   ├── repositories/ # SQL / data access
│   ├── validation/ # Dependency-free schemas and validate middleware
│   ├── middleware/ # Error-handling middleware
│   ├── tests/      # Unit and integration tests (npm test)
│   └── Dockerfile
├── db/             # Database migrations
│   ├── migrations/ # node-pg-migrate migration files
│   └── Dockerfile
├── web/            # Next.js frontend
│   ├── app/        # App Router pages and components
│   └── Dockerfile
└── infrastructure/ # Terraform for GCP deployment
    ├── main.tf
    ├── variables.tf
    └── outputs.tf
```

## Deploying to GCP

The `src/infrastructure/` directory contains Terraform that provisions:

- VPC network and subnet
- Cloud SQL PostgreSQL 17 instance (private IP)
- Cloud Run services for the API and web frontend
- Secret Manager secret for the database URL
- Service accounts and IAM bindings

### Required variables

| Variable | Description |
|----------|-------------|
| `project_id` | GCP project ID |
| `api_image` | Container image URI for the API (e.g. `gcr.io/PROJECT/api:TAG`) |
| `web_image` | Container image URI for the web frontend |
| `region` | GCP region (default: `us-central1`) |
| `environment` | `dev`, `staging`, or `prod` (default: `dev`) |

```bash
cd src/infrastructure
terraform init
terraform apply -var="project_id=my-project" \
                -var="api_image=gcr.io/my-project/api:latest" \
                -var="web_image=gcr.io/my-project/web:latest"
```

After apply, `terraform output web_url` gives the public URL.

## Database migrations

Migrations live in `src/db/migrations/` and use [node-pg-migrate](https://salsita.github.io/node-pg-migrate/).

```bash
# Apply all pending migrations (run inside the db container or with DATABASE_URL set)
cd src/db
DATABASE_URL=postgres://app:app@localhost:5432/app npx node-pg-migrate up

# Roll back the last migration
DATABASE_URL=postgres://app:app@localhost:5432/app npx node-pg-migrate down
```

When running via Docker Compose the `migrate` service handles this automatically on startup.
