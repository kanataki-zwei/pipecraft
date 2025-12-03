# backend/pipecraft/api/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from pipecraft.api.routers import connections, syncs
from pipecraft.db.base import init_db    

app = FastAPI(title="PipeCraft API", version="0.1.0")

# For v0, allow local Next.js frontend (will run on 3000)
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure DB tables exist (connections table)
init_db()


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "pipecraft"}


# Register routers
app.include_router(connections.router)
app.include_router(syncs.router)
