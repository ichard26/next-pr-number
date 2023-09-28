from __future__ import annotations

import itertools
import sqlite3
from collections.abc import Iterable, Mapping, Sequence
from datetime import datetime, timedelta, timezone
from typing import Final, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T")
RateLimits = dict[int, int]


def flatten(iterables: Iterable[Iterable[T]]) -> list[T]:
    """Flatten nested iterables into a single list."""
    return list(itertools.chain.from_iterable(iterables))


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def adapt_datetime_iso(dt: datetime) -> str:
    """Adapt datetime.datetime to a ISO 8601 date."""
    return dt.isoformat()


sqlite3.register_adapter(datetime, adapt_datetime_iso)


class SQLiteConnection(sqlite3.Connection):
    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)

    def insert(
        self,
        table: str,
        columns_or_values: Sequence[str] | Mapping[str, object],
        values: Sequence[object] | None = None,
    ) -> sqlite3.Cursor:
        if not self._existing_table(table):
            raise sqlite3.DatabaseError(f"table '{table}' does not exist")

        columns_string = ",".join(columns_or_values)
        if isinstance(columns_or_values, Mapping):
            values = columns_or_values
            values_string = ",".join(f":{col}" for col in columns_or_values)
        else:
            values_string = ",".join("?" * len(columns_or_values))
        self.execute(f"INSERT INTO {table}({columns_string}) VALUES({values_string});", values)

    def _existing_table(self, table: str) -> bool:
        """Check if a table exists in the database."""
        return table in flatten(self.execute("SELECT name FROM sqlite_master WHERE type='table'"))


class RateLimitWindow(BaseModel):
    duration: int
    limit: int
    value: int
    expiry: datetime


class RateLimiter:
    MINUTE: Final = 1
    HOUR: Final = 60
    DAY: Final = 1440

    class SQLiteBackend:
        def __init__(self, db: sqlite3.Connection, max_windows: int = 5000) -> None:
            self.db = db
            self.max_windows = max_windows
            self.commit = db.commit

        def get_window(self, key: str, duration: int, limit: int) -> Optional[RateLimitWindow]:
            cur = self.db.execute(
                "SELECT rowid, value, expiry FROM ratelimits WHERE key = ? AND duration = ?;",
                [key, duration]
            )
            if row := cur.fetchone():
                return RateLimitWindow(duration=duration, limit=limit, value=row[1], expiry=row[2])
            return None

        def create_window(self, key: str, duration: int, limit: int, expiry: datetime) -> RateLimitWindow:
            self.db.execute(
                "INSERT INTO ratelimits(key, duration, value, expiry) VALUES(?, ?, ?, ?);",
                [key, duration, 0, expiry]
            )
            return RateLimitWindow(duration=duration, limit=limit, value=0, expiry=expiry)

        def update_window_key(self, key: str, by: int) -> None:
            self.db.execute(
                "UPDATE ratelimits SET value = value + ? WHERE key = ?;", [by, key]
            )

        def delete_window(self, key: str, duration: int) -> None:
            self.db.execute(
                "DELETE FROM ratelimits WHERE key = ? AND duration = ?;", [key, duration]
            )

        def prune(self) -> int:
            count = self.db.execute("SELECT COUNT(*) FROM ratelimits;").fetchone()[0]
            if (to_prune := count - self.max_windows) > 0:
                self.db.execute("DELETE FROM ratelimits ORDER BY expiry LIMIT ?;", [to_prune])

    def __init__(self, key_prefix: str, limits: RateLimits, db: sqlite3.Connection) -> None:
        self.key_prefix = key_prefix + ":"
        self.limits = limits
        self.backend = RateLimiter.SQLiteBackend(db)

    def update(self, key: str, by: int = 1) -> None:
        """Increment all windows.

        New windows are created as needed (none existed or old one was expired).
        """
        for duration in self.limits:
            self._get_or_create_window(self.key_prefix + key, duration)
        self.backend.update_window_key(self.key_prefix + key, by)
        self.backend.prune()
        self.backend.commit()

    def should_block(self, key: str) -> bool:
        """Return whether at least one limit has been reached."""
        return len(self.reached_limits(key)) > 0

    def update_and_check(self, key: str, by: int = 1) -> bool:
        """update() and should_block() combined."""
        block = self.should_block(key)
        self.update(key, by)
        return block

    def windows(self, key: str) -> Sequence[RateLimitWindow]:
        """Return rate limit windows."""
        wins = [self._get_or_create_window(self.key_prefix + key, duration) for duration in self.limits]
        self.backend.commit()
        return wins

    def reached_limits(self, key: str) -> Sequence[RateLimitWindow]:
        """Like windows() but returns only windows whose limit has been reached."""
        return [w for w in self.windows(key) if w.value >= self.limits[w.duration]]

    def _get_or_create_window(self, key: str, duration: int) -> RateLimitWindow:
        limit = self.limits[duration]
        if stored := self.backend.get_window(key, duration, limit):
            if stored.expiry > utc_now():
                return stored

            self.backend.delete_window(key, duration)
        return self.backend.create_window(
            key, duration, limit, expiry=utc_now() + timedelta(minutes=duration)
        )
