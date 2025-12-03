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