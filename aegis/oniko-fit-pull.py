#!/usr/bin/env python3
"""Oniko Fit puller. Pulls completed workouts from WordPress (poller-only REST) into a
long-term SQLite archive on Aegis, then acks them. Idempotent by workout id + revision.

The website never reaches Aegis. This script only makes outbound HTTPS GET/POST to the site.

  oniko-fit-pull.py            pull + ack once (systemd timer)
  oniko-fit-pull.py --backup   copy the archive into ~/Dropbox/Oniko/backup/ (nightly)
  oniko-fit-pull.py --dry-run  pull and archive, but do not ack

Secrets: ~/.hermes/secrets/oniko-fit-wp.env (mode 0600). Names in aegis/oniko-fit.env.example.
Workout text (her notes) is untrusted DATA. Anything that hands it to a bot must fence it.
"""
from __future__ import annotations

import base64
import datetime as dt
import json
import os
import sqlite3
import stat
import sys
import urllib.request
from pathlib import Path

HOME = Path.home()
SECRET = Path(os.environ.get("ONIKO_FIT_ENV", HOME / ".hermes/secrets/oniko-fit-wp.env"))
DB = Path(os.environ.get("ONIKO_FIT_DB", HOME / ".local/share/oniko-fit/oniko-fit.db"))
BACKUP_DIR = Path(os.environ.get("ONIKO_FIT_BACKUP_DIR", HOME / "Dropbox/Oniko/backup"))
KEEP_BACKUPS = 30

SCHEMA = """
CREATE TABLE IF NOT EXISTS workouts (
  workout_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  user_id INTEGER, user_login TEXT, member TEXT,
  wdate TEXT NOT NULL, program TEXT, workout TEXT,
  completed_at TEXT, effort TEXT, flags TEXT, notes TEXT, highlights TEXT,
  summary_text TEXT, raw TEXT NOT NULL, pulled_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sets (
  workout_id TEXT NOT NULL, idx INTEGER NOT NULL, ex TEXT NOT NULL, set_no INTEGER,
  reps INTEGER, weight REAL, warm INTEGER, logged_under TEXT,
  PRIMARY KEY (workout_id, idx)
);
CREATE TABLE IF NOT EXISTS pulls (outbox_id INTEGER PRIMARY KEY, workout_id TEXT, revision INTEGER, pulled_at TEXT);
CREATE INDEX IF NOT EXISTS workouts_date ON workouts (user_login, wdate);
"""


def load_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.exists():
        return out
    mode = stat.S_IMODE(path.stat().st_mode)
    if mode & 0o077:
        print(f"warning: {path} should be mode 0600", file=sys.stderr)
    for line in path.read_text().splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def connect(db: Path) -> sqlite3.Connection:
    db.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(db)
    con.execute("PRAGMA journal_mode=WAL")
    con.executescript(SCHEMA)
    return con


def store(con: sqlite3.Connection, outbox_id: int, rec: dict) -> str:
    """Upsert one record. Returns 'new', 'updated', or 'same'. Older revisions never overwrite newer."""
    wid = str(rec.get("workout_id") or "")
    if not wid.startswith("oniko-"):
        raise ValueError("bad workout_id")
    rev = int(rec.get("revision") or 1)
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    cur = con.execute("SELECT revision FROM workouts WHERE workout_id = ?", (wid,)).fetchone()
    state = "new"
    if cur is not None:
        if int(cur[0]) >= rev:
            state = "same"
        else:
            state = "updated"
    with con:
        con.execute("INSERT OR IGNORE INTO pulls (outbox_id, workout_id, revision, pulled_at) VALUES (?,?,?,?)", (outbox_id, wid, rev, now))
        if state == "same":
            return state
        con.execute(
            "INSERT OR REPLACE INTO workouts (workout_id, revision, user_id, user_login, member, wdate, program, workout, completed_at,"
            " effort, flags, notes, highlights, summary_text, raw, pulled_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                wid, rev, rec.get("user_id"), rec.get("user_login"), rec.get("member"), str(rec.get("date")),
                rec.get("program"), rec.get("workout"), rec.get("completed_at"),
                json.dumps(rec.get("effort") or {}), json.dumps(rec.get("flags") or {}), str(rec.get("notes") or "")[:2000],
                json.dumps(rec.get("highlights") or []), str(rec.get("summary_text") or "")[:20000], json.dumps(rec), now,
            ),
        )
        con.execute("DELETE FROM sets WHERE workout_id = ?", (wid,))
        for i, s in enumerate(rec.get("sets") or []):
            con.execute(
                "INSERT INTO sets (workout_id, idx, ex, set_no, reps, weight, warm, logged_under) VALUES (?,?,?,?,?,?,?,?)",
                (wid, i, str(s.get("ex")), int(s.get("set_no") or 0), int(s.get("reps") or 0), float(s.get("weight") or 0), 1 if s.get("warm") else 0, str(s.get("logged_under") or "")),
            )
    return state


def http(method: str, url: str, env: dict[str, str], body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    token = base64.b64encode(f"{env['WP_USER']}:{env['WP_APP_PASSWORD']}".encode()).decode()
    req.add_header("Authorization", f"Basic {token}")
    req.add_header("Accept", "application/json")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode() or "{}")


def pull(env: dict[str, str], con: sqlite3.Connection, ack: bool = True) -> dict[str, int]:
    base = env.get("ONIKO_FIT_BASE_URL", "").rstrip("/")
    if not base or not env.get("WP_USER") or not env.get("WP_APP_PASSWORD"):
        raise SystemExit("missing ONIKO_FIT_BASE_URL / WP_USER / WP_APP_PASSWORD")
    root = base + "/wp-json/oniko-fit/v1"
    counts = {"new": 0, "updated": 0, "same": 0, "acked": 0, "bad": 0}
    for _ in range(20):  # at most 20 pages per run
        items = http("GET", root + "/outbox?status=pending&limit=50", env).get("items") or []
        if not items:
            break
        ids = []
        for it in items:
            try:
                counts[store(con, int(it["outbox_id"]), it["record"])] += 1
                ids.append(int(it["outbox_id"]))
            except Exception as e:  # keep going; leave it pending for a human
                counts["bad"] += 1
                print("skip outbox", it.get("outbox_id"), type(e).__name__, file=sys.stderr)
        if not ack or not ids:
            break
        counts["acked"] += int(http("POST", root + "/ack", env, {"ids": ids}).get("acked") or 0)
    return counts


def backup(db: Path, dest: Path) -> Path:
    dest.mkdir(parents=True, exist_ok=True)
    out = dest / f"oniko-fit-{dt.date.today().isoformat()}.db"
    src = sqlite3.connect(db)
    dst = sqlite3.connect(out)
    with dst:
        src.backup(dst)
    src.close()
    dst.close()
    for old in sorted(dest.glob("oniko-fit-*.db"))[:-KEEP_BACKUPS]:
        old.unlink()
    return out


def main(argv: list[str]) -> int:
    con = connect(DB)
    if "--backup" in argv:
        print("backup", backup(DB, BACKUP_DIR))
        return 0
    env = load_env(SECRET)
    for k in ("ONIKO_FIT_BASE_URL", "WP_USER", "WP_APP_PASSWORD"):
        if os.environ.get(k):
            env[k] = os.environ[k]
    c = pull(env, con, ack="--dry-run" not in argv)
    if any(c[k] for k in ("new", "updated", "bad")):
        print("oniko-fit pull", json.dumps(c))
    return 1 if c["bad"] else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
