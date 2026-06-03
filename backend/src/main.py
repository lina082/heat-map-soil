import logging
from contextlib import asynccontextmanager
from typing import Callable

from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send

import database
from routes import runs, grid, live, internal
from variables import VARIABLES

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


class SkipCORSForWebSocket:
    """Pass WebSocket connections straight through; apply CORS only to HTTP."""

    def __init__(self, app: ASGIApp) -> None:
        self._cors = CORSMiddleware(
            app,
            allow_origins=["*"],
            allow_methods=["*"],
            allow_headers=["*"],
        )
        self._app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "websocket":
            await self._app(scope, receive, send)
        else:
            await self._cors(scope, receive, send)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await database.init_pool()
    yield
    await database.close_pool()


app = FastAPI(
    title="Heat Map Soil API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(SkipCORSForWebSocket)

app.include_router(runs.router,     prefix="/api/v1")
app.include_router(grid.router,     prefix="/api/v1")
app.include_router(live.router,     prefix="/api/v1")
app.include_router(internal.router)


@app.get("/api/v1/variables")
def list_variables():
    return [
        {"key": k, "label": v.label, "unit": v.unit, "description": v.description}
        for k, v in VARIABLES.items()
    ]


@app.get("/health")
def health():
    return {"status": "ok"}
