import os
import sqlite3
import time
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.background import BackgroundTask

from lib import RateLimiter, SQLiteConnection, utc_now

THIS_DIR = Path(__file__).parent
GRAPHQL_API = "https://api.github.com/graphql"
GRAPHQL_QUERY = """
query getLastIssueNumber {
  repository(owner: "$owner", name: "$name") {
    discussions(orderBy: {field: CREATED_AT, direction: DESC}, first: 1) {
      nodes {
        number
      }
    }
    issues(orderBy: {field: CREATED_AT, direction: DESC}, first: 1) {
      nodes {
        number
      }
    }
    pullRequests(orderBy: {field: CREATED_AT, direction: DESC}, first: 1) {
      nodes {
        number
      }
    }
  }
}
"""
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", None)
DATABASE_PATH = Path(THIS_DIR, "db.sqlite3")

if not GITHUB_TOKEN:
    raise RuntimeError("GITHUB_TOKEN is missing!")


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await http.aclose()


app = FastAPI(lifespan=lifespan)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ichard26.github.io"],
    allow_methods=["GET"],
)
http = httpx.AsyncClient()


@app.get("/")
async def get_next_number(owner: str, name: str) -> int:
    db = sqlite3.connect(DATABASE_PATH, factory=SQLiteConnection)
    limiter = RateLimiter("api", {RateLimiter.HOUR: 25, RateLimiter.DAY: 100}, db)
    if limiter.update_and_check("query"):
        raise HTTPException(429, "API rate limit exceeded")

    query = GRAPHQL_QUERY.replace("$owner", owner).replace("$name", name)
    response = await http.post(
        GRAPHQL_API, json={"query": query}, headers={"Authorization": f"Bearer {GITHUB_TOKEN}"}
    )
    repository_data = response.json()["data"]["repository"]
    if repository_data is None:
        raise HTTPException(404, "repository not found")

    current_number = max(
        next(iter(data["nodes"]), {"number": 0})["number"]
        for data in repository_data.values()
    )
    db.insert("queries", {
        "datetime": utc_now(),
        "owner": owner,
        "name": name,
        "result": current_number + 1
    })
    db.commit()
    return current_number + 1


@app.middleware("http")
async def log_and_send_timing(request: Request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    elapsed = round((time.perf_counter() - start_time) * 1000, 2)

    async def log() -> None:
        db = sqlite3.connect(DATABASE_PATH, factory=SQLiteConnection)
        try:
            with db:
                db.insert("requests", entry)
        finally:
            db.close()

    entry = {
        "datetime": utc_now(),
        "ip": getattr(request.client, "host", None),
        "useragent": request.headers.get("User-Agent"),
        "verb": request.method,
        "path": request.url.path,
        "status": response.status_code,
        "duration": elapsed,
    }
    response.background = BackgroundTask(log)
    response.headers["Server-Timing"] = f"endpoint;dur={elapsed:.1f}"
    return response
