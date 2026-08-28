#!/usr/bin/env python3
"""Local archive for odaintelligence.com members-chat.

Writes ~/.hermes/profiles/webdemo/chatlog.sqlite (0600).
Used by oda-guestchat-poller.py. Never stores mailbox/app passwords.
Never writes Hindsight bank oda. Never touches default Oda SOUL / llama.
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path.home() / ".hermes/profiles/webdemo/chatlog.sqlite"
WP_SECRET = Path.home() / ".hermes/secrets/guestchat-wp.env"
IMAP_SECRET = Path.home() / ".hermes/secrets/guestchat.env"

SCHEMA = """
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    wp_msg_id TEXT NOT NULL,
    wp_user_id TEXT,
    wp_user_login TEXT,
    role TEXT NOT NULL,
    body TEXT,
    created_at TEXT,
    source TEXT,
    archived_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_wp_msg_id ON messages(wp_msg_id);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(wp_user_id, wp_user_login);
"""


def load_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for line in path.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def connect(create: bool = True) -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    existed = DB_PATH.exists()
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    if create:
        conn.executescript(SCHEMA)
        conn.commit()
    os.chmod(DB_PATH, 0o600)
    return conn


def init_db() -> Path:
    conn = connect(create=True)
    conn.close()
    os.chmod(DB_PATH, 0o600)
    return DB_PATH


def upsert_message(
    *,
    wp_msg_id: str,
    role: str,
    body: str = "",
    wp_user_id: str | int | None = None,
    wp_user_login: str | None = None,
    created_at: str | None = None,
    source: str = "imap-poller",
) -> bool:
    """Insert one archived row. Returns True if a new row was written."""
    if wp_msg_id is None or str(wp_msg_id).strip() == "":
        raise ValueError("wp_msg_id required")
    init_db()
    conn = connect(create=False)
    try:
        cur = conn.execute(
            """
            INSERT OR IGNORE INTO messages
                (wp_msg_id, wp_user_id, wp_user_login, role, body, created_at, source, archived_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(wp_msg_id),
                None if wp_user_id in (None, "") else str(wp_user_id),
                wp_user_login or None,
                role,
                body if body is not None else "",
                created_at or utc_now(),
                source,
                utc_now(),
            ),
        )
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def row_count() -> int:
    if not DB_PATH.exists():
        return 0
    conn = connect(create=False)
    try:
        return int(conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0])
    finally:
        conn.close()


def _wp_request(path_suffix: str, query: dict[str, str] | None = None) -> dict:
    wp = load_env(WP_SECRET)
    reply_url = wp.get("WP_REPLY_URL", "https://odaintelligence.com/wp-json/oda-chat/v1/reply")
    base = reply_url.rsplit("/", 1)[0]
    url = f"{base}/{path_suffix.lstrip('/')}"
    if query:
        url = url + "?" + urllib.parse.urlencode(query)
    user = wp.get("WP_USER", "")
    password = wp.get("WP_APP_PASSWORD", "")
    if not user or not password:
        raise RuntimeError("WP poller credentials missing")
    import base64

    token = base64.b64encode(f"{user}:{password}".encode()).decode()
    req = urllib.request.Request(url, method="GET")
    req.add_header("Authorization", f"Basic {token}")
    req.add_header("Accept", "application/json")
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()
    return json.loads(raw.decode("utf-8", "replace") or "{}")


def sync_wp_inbox(statuses: tuple[str, ...] = ("pending", "done")) -> int:
    """Backfill user-role rows from the poller inbox. Returns new-row count."""
    if not WP_SECRET.exists():
        return 0
    added = 0
    for status in statuses:
        try:
            data = _wp_request("inbox", {"status": status})
        except (urllib.error.HTTPError, urllib.error.URLError, RuntimeError, json.JSONDecodeError) as exc:
            print(f"inbox sync {status} failed: {type(exc).__name__}", file=sys.stderr)
            continue
        for row in data.get("messages") or []:
            mid = row.get("id")
            if mid is None:
                continue
            if upsert_message(
                wp_msg_id=str(mid),
                wp_user_id=row.get("user_id"),
                wp_user_login=row.get("user_login"),
                role="user",
                body=str(row.get("body") or ""),
                created_at=str(row.get("created_at") or utc_now()),
                source=f"wp-inbox:{status}",
            ):
                added += 1
    return added


def backfill_imap() -> int:
    """Archive user-side bodies still in the guest mailbox. No passwords stored."""
    if not IMAP_SECRET.exists():
        return 0
    import email
    import imaplib
    import re
    import ssl
    from email.header import decode_header

    env = load_env(IMAP_SECRET)
    host = env.get("GUESTCHAT_IMAP_HOST")
    port = int(env.get("GUESTCHAT_IMAP_PORT") or "993")
    user = env.get("GUESTCHAT_EMAIL")
    password = env.get("GUESTCHAT_PASSWORD")
    if not host or not user or not password:
        return 0

    def decode_subj(raw: str) -> str:
        parts = []
        for txt, enc in decode_header(raw or ""):
            if isinstance(txt, bytes):
                parts.append(txt.decode(enc or "utf-8", "replace"))
            else:
                parts.append(txt)
        return "".join(parts)

    ctx = ssl.create_default_context()
    M = imaplib.IMAP4_SSL(host, port, ssl_context=ctx)
    M.login(user, password)
    M.select("INBOX")
    typ, data = M.search(None, "ALL")
    ids = (data[0] or b"").split()
    added = 0
    for mid in ids:
        typ, raw = M.fetch(mid, "(RFC822)")
        if typ != "OK":
            continue
        msg = email.message_from_bytes(raw[0][1])
        subj = decode_subj(msg.get("Subject", ""))
        meta = dict(re.findall(r"(thread|msg|user)=([^\s\]]+)", subj))
        if not meta.get("msg"):
            continue
        body = ""
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "text/plain" and "attachment" not in str(
                    part.get("Content-Disposition", "")
                ):
                    body = part.get_payload(decode=True).decode(
                        part.get_content_charset() or "utf-8", "replace"
                    )
                    break
        else:
            payload = msg.get_payload(decode=True)
            body = (
                payload.decode(msg.get_content_charset() or "utf-8", "replace")
                if payload
                else str(msg.get_payload())
            )
        if upsert_message(
            wp_msg_id=str(meta["msg"]),
            wp_user_id=meta.get("thread"),
            wp_user_login=meta.get("user"),
            role="user",
            body=body,
            created_at=msg.get("Date") or utc_now(),
            source="imap-backfill",
        ):
            added += 1
    M.logout()
    return added


def smoke_test() -> None:
    marker = "__smoke_test_do_not_keep__"
    inserted = upsert_message(
        wp_msg_id=marker,
        wp_user_id="0",
        wp_user_login="__smoke__",
        role="user",
        body="smoke",
        source="smoke-test",
    )
    conn = connect(create=False)
    try:
        row = conn.execute("SELECT id FROM messages WHERE wp_msg_id = ?", (marker,)).fetchone()
        if row is None:
            raise RuntimeError("smoke insert not visible")
        conn.execute("DELETE FROM messages WHERE wp_msg_id = ?", (marker,))
        conn.commit()
        gone = conn.execute("SELECT id FROM messages WHERE wp_msg_id = ?", (marker,)).fetchone()
    finally:
        conn.close()
    if gone is not None:
        raise RuntimeError("smoke row not deleted")
    print(f"smoke ok inserted={int(inserted)} deleted=1 db={DB_PATH}")


def stats() -> None:
    init_db()
    conn = connect(create=False)
    try:
        total = conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
        by_role = list(conn.execute("SELECT role, COUNT(*) c FROM messages GROUP BY role"))
        by_src = list(conn.execute("SELECT source, COUNT(*) c FROM messages GROUP BY source"))
        users = list(
            conn.execute(
                "SELECT wp_user_id, wp_user_login, COUNT(*) c FROM messages GROUP BY wp_user_id, wp_user_login"
            )
        )
    finally:
        conn.close()
    mode = oct(DB_PATH.stat().st_mode & 0o777)
    print(f"db={DB_PATH}")
    print(f"mode={mode}")
    print(f"rows={total}")
    print("by_role", [(r[0], r[1]) for r in by_role])
    print("by_source", [(r[0], r[1]) for r in by_src])
    print("by_user", [(r[0], r[1], r[2]) for r in users])


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Oda members-chat local archive")
    ap.add_argument("--init", action="store_true")
    ap.add_argument("--backfill", action="store_true", help="WP inbox pending+done")
    ap.add_argument("--backfill-imap", action="store_true")
    ap.add_argument("--smoke", action="store_true")
    ap.add_argument("--stats", action="store_true")
    args = ap.parse_args(argv)
    if args.init or not any([args.backfill, args.backfill_imap, args.smoke, args.stats]):
        path = init_db()
        print(f"init {path}")
    if args.smoke:
        smoke_test()
    if args.backfill:
        n = sync_wp_inbox()
        print(f"wp-inbox new_rows={n}")
    if args.backfill_imap:
        n = backfill_imap()
        print(f"imap new_rows={n}")
    if args.stats or args.backfill or args.backfill_imap or args.smoke:
        stats()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
