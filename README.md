# PipeCraft

PipeCraft is a small data-ingestion tool that lets you:

- Define **connections** to Postgres and MySQL databases
- Discover **schemas, tables, and columns**
- Configure **Syncs** from a source table to a destination table
- Run **truncate-insert** syncs from a web UI
- Auto-create destination tables (v0) when they don't exist yet

This is the **v0** codebase: a thin but working vertical slice from backend → frontend.

---

## Tech Stack

**Backend**

- Python
- FastAPI
- SQLAlchemy
- PostgreSQL / MySQL drivers (psycopg2, mysqlclient / equivalent)
- Uvicorn

**Frontend**

- Next.js (App Router)
- TypeScript
- React (with React Compiler enabled)
- Tailwind CSS

---

## Repository Structure

```text
pipecraft/
  backend/
    pipecraft/
      api/
        main.py         # FastAPI app
        routers/
          connections.py # Connection CRUD + schema/table/column discovery
          syncs.py       # Sync definitions + run endpoint
        schemas.py       # Pydantic schemas
        deps.py          # DB session dependency
      db/
        base.py          # init_db + engine/session configuration
        models.py        # Connection, Sync, SyncRun, enums
    requirements.txt      # Python deps for backend

  frontend/
    next.config.mjs
    package.json
    postcss.config.mjs
    tailwind.config.mjs
    tsconfig.json
    src/
      app/
        page.tsx           # Home / overview + live connections summary
        connections/
          page.tsx         # Connections list + creation form
          NewConnectionForm.tsx
        syncs/
          page.tsx         # Syncs list + creation form + "Run sync" actions
          NewSyncForm.tsx
          RunSyncButton.tsx

  README.md
Backend: Setup & Run
1. Create & activate virtual env
From repo root:

bash
Copy code
cd backend

# (example using venv)
python -m venv .venv

# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1

# Linux / macOS
source .venv/bin/activate
2. Install dependencies
bash
Copy code
pip install -r requirements.txt
3. Configure database
By default, PipeCraft uses a local SQLite DB (or whatever you configured in pipecraft/db/base.py) to store:

connections

sync definitions

sync run metadata

If you point it to Postgres instead, make sure the database exists and update the connection string accordingly.

4. Run the API
From backend/ with the virtualenv active:

bash
Copy code
uvicorn pipecraft.api.main:app --reload --port 8000
The API will be available at:

OpenAPI / Swagger: http://127.0.0.1:8000/docs

Redoc: http://127.0.0.1:8000/redoc (if enabled)

Backend: Core Endpoints (v0)
Connections
GET /connections
List all configured connections.

POST /connections
Create a connection.

Example body:

json
Copy code
{
  "name": "local_postgres",
  "db_type": "postgres",
  "host": "localhost",
  "port": 5432,
  "database": "mydb",
  "username": "myuser",
  "password": "secret",
  "is_source": true,
  "is_destination": true
}
POST /connections/{name}/test
Test connectivity for a given connection by name. Returns success or error.

GET /connections/{name}/schemas
List schemas for a connection.

GET /connections/{name}/tables?schema={schema}
List tables in a specific schema.

GET /connections/{name}/columns?schema={schema}&table={table}
List columns and basic metadata for a table.

Syncs
GET /syncs
List existing sync definitions.

POST /syncs
Create a new sync.

Example body:

json
Copy code
{
  "name": "sync_users_bronze_to_silver",
  "description": "Sync users from bronze to silver",
  "source_connection_id": 1,
  "source_table": "public.users",
  "dest_connection_id": 2,
  "dest_schema": "public",
  "dest_table": "users_silver",
  "write_mode": "truncate_insert"
}
POST /syncs/{sync_id}/run
Execute a sync run:

Connects to source database

SELECT * from the source table

On destination:

If the table does not exist, it is auto-created based on source columns

Postgres: columns as TEXT

MySQL: columns as VARCHAR(255)

TRUNCATE TABLE destination

INSERT all rows

Records the run in sync_runs with:

status: pending / running / success / failed

row_count

error_message (if any)

Frontend: Setup & Run
From repo root:

bash
Copy code
cd frontend

# Install dependencies (if not already done by create-next-app)
npm install

# Run dev server
npm run dev
The app will be available at:

http://localhost:3000

The frontend talks to the backend at http://localhost:8000 by default via
NEXT_PUBLIC_API_BASE_URL (see below).

Frontend: Pages & Flows (v0)
Home (/)
Shows PipeCraft overview

Small Connections summary panel (live data from backend)

Header nav:

Connections → /connections

Syncs → /syncs

Connections (/connections)
Table listing all connections from GET /connections

New connection form (NewConnectionForm):

Name, DB type (Postgres/MySQL)

Host, port, database

Username/password

Flags: is_source, is_destination

On submit:

Calls POST /connections

Shows success/error messages

Refreshes the table (server-side fetch)

Syncs (/syncs)
Table listing syncs from GET /syncs:

Name + description

Source table (source_table / connection ID)

Destination table (dest_schema.dest_table / connection ID)

Write mode (truncate_insert)

Created timestamp

Run Sync button per row

New sync form (NewSyncForm):

Sync name + description

Source:

Connection (dropdown from GET /connections)

Schema (dropdown from GET /connections/{name}/schemas)

Table (dropdown from GET /connections/{name}/tables?schema=...)

Destination:

Connection (dropdown)

Schema (dropdown)

Table: free-text field

Allows selecting an existing table name or typing a new one

Existing tables in that schema are shown as a hint list

On submit:

Builds source_table as schema.table

Sends POST /syncs

Shows success/error messages

Refreshes the sync list

Run Sync button (RunSyncButton):

Calls POST /syncs/{id}/run

Shows:

status badge (success/failed/running/pending)

row_count if available

error text if the run fails

Configuration
Frontend → Backend URL
The frontend fetches the API from:

ts
Copy code
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
You can override this by setting:

bash
Copy code
# in frontend/.env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
CORS
The backend should have CORS configured to allow requests from the frontend origin
(e.g. http://localhost:3000). If you change ports or domains, update the CORS config
accordingly.

v0 Scope
The current version (v0) intentionally keeps things simple and opinionated:

One write mode: truncate_insert

No column mapping UI yet

No type casting UI (dest table columns are all TEXT/VARCHAR on auto-create)

No scheduling or background workers (runs are synchronous inside the HTTP request)

No auth, RBAC, or multi-tenant features yet

Despite that, v0 provides a solid end-to-end flow:

Add DB connections

Discover schemas/tables

Define syncs

Run a sync & see the results

Future Roadmap Ideas
Some possible next versions:

v0.1 – Column Mapping & Types

Per-sync column mapping (rename, include/exclude columns)

Type casting rules between source and destination

Safer type inference when auto-creating destination tables

v0.2 – Scheduling & History

Sync run history per sync (list of sync_runs)

Filters by status / time

Simple scheduling (cron-style, or UI-based intervals)

v0.3 – Auth & Multi-User

Basic authentication

Per-user or per-team connection scopes

Activity logs

v1.0 – Packaging & Deployment

Docker / docker-compose setup for backend + frontend

Helm / K8s deployment manifests

Configuration via env vars for production

Development Notes
This project targets developer ergonomics first:

Clear, typed interfaces between backend and frontend

Simple, composable APIs (connections, schemas, tables, syncs, runs)

The UI is intentionally minimal but functional:

One place to manage connections

One place to define and run syncs

Most logic is designed to be extended:

New write modes (e.g. upsert/merge)

New connection types (e.g. Snowflake, BigQuery) in future versions

License
TBD