from contextlib import asynccontextmanager
from functools import partial
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from florapi import utc_now
from florapi.configuration import Options
from florapi.middleware import ProxyHeadersMiddleware, TimedLogMiddleware
from florapi.security import RateLimiter
from florapi.sqlite import open_sqlite_connection, register_adaptors

THIS_DIR = Path(__file__).parent
GRAPHQL_API = "https://api.github.com/graphql"
# This query was originally written by Jakub Kuczys (GitHub: @Jackenmen) who graciously
# gave me permission to use his work freely here.
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
opt = Options()
GITHUB_TOKEN = opt("github-token", type=str)
DATABASE_PATH = opt("database", default=THIS_DIR / "db.sqlite3", type=Path)
opt.report_errors()

register_adaptors()
open_sqlite_connection = partial(open_sqlite_connection, DATABASE_PATH)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await http.aclose()


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ichard26.github.io"],
    allow_methods=["GET", "HEAD"],
)
app.add_middleware(ProxyHeadersMiddleware)
app.add_middleware(TimedLogMiddleware, sqlite_factory=open_sqlite_connection)
http = httpx.AsyncClient()


@app.get("/")
async def get_next_number(owner: str, name: str) -> int:
    db = open_sqlite_connection()
    if not db.existing_table("queries"):
        db.create_table("queries", {
            "datetime":   "TEXT PRIMARY KEY NOT NULL",
            "owner":      "TEXT NOT NULL",
            "name":       "TEXT NOT NULL",
            "result":     "INTEGER NOT NULL",
        })

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

    # These four lines were originally written by Jakub Kuczys (GitHub: @Jackenmen) who
    # graciously gave me permission to use his work freely here.
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


@app.head("/")
def read_root_head():
    return Response()
