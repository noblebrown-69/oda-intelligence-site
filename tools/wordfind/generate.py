#!/usr/bin/env python3
"""
Daily word-find generator for odaintelligence.com/wordfind/

Deterministic from America/Phoenix YYYY-MM-DD. No LLM.
Writes static HTML/CSS/JS + data JSON under wordfind/.

Usage:
  python3 tools/wordfind/generate.py                 # today (Phoenix)
  python3 tools/wordfind/generate.py 2026-09-07      # specific date
  python3 tools/wordfind/generate.py --all-week 2026-09-07
"""
from __future__ import annotations

import argparse
import hashlib
import json
import random
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

# repo/tools/wordfind/generate.py -> parents[2] is repo root
REPO = Path(__file__).resolve().parent.parent.parent
DICT_PATH = Path(__file__).resolve().parent / "dictionary.txt"
OUT_DIR = REPO / "wordfind"
PHOENIX = ZoneInfo("America/Phoenix")

DIRECTIONS = [
    (0, 1),   # E
    (0, -1),  # W
    (1, 0),   # S
    (-1, 0),  # N
    (1, 1),   # SE
    (1, -1),  # SW
    (-1, 1),  # NE
    (-1, -1), # NW
]

GRID_SIZE = 13
WORDS_PER_PUZZLE = 10
PUZZLES_PER_DAY = 5
MIN_WORD = 4
MAX_WORD = 9


def load_dictionary() -> list[str]:
    words: set[str] = set()
    for line in DICT_PATH.read_text(encoding="utf-8").splitlines():
        w = line.strip().upper()
        if not w or w.startswith("#"):
            continue
        if w.isalpha() and MIN_WORD <= len(w) <= MAX_WORD:
            words.add(w)
    return sorted(words)


def day_seed(iso_date: str, puzzle_index: int) -> int:
    """Stable 64-bit-ish seed from date + puzzle index."""
    material = f"oda-wordfind|{iso_date}|{puzzle_index}|v1".encode("utf-8")
    digest = hashlib.sha256(material).hexdigest()
    return int(digest[:16], 16)


def can_place(grid: list[list[str | None]], word: str, r: int, c: int, dr: int, dc: int) -> bool:
    n = len(grid)
    for i, ch in enumerate(word):
        rr, cc = r + dr * i, c + dc * i
        if rr < 0 or rr >= n or cc < 0 or cc >= n:
            return False
        cell = grid[rr][cc]
        if cell is not None and cell != ch:
            return False
    return True


def place_word(grid: list[list[str | None]], word: str, r: int, c: int, dr: int, dc: int) -> None:
    for i, ch in enumerate(word):
        grid[r + dr * i][c + dc * i] = ch


def try_place(grid: list[list[str | None]], word: str, rng: random.Random) -> bool:
    n = len(grid)
    dirs = DIRECTIONS[:]
    rng.shuffle(dirs)
    candidates = [(r, c) for r in range(n) for c in range(n)]
    rng.shuffle(candidates)
    for dr, dc in dirs:
        for r, c in candidates:
            if can_place(grid, word, r, c, dr, dc):
                place_word(grid, word, r, c, dr, dc)
                return True
    return False


def build_puzzle(words: list[str], rng: random.Random) -> dict:
    pool = words[:]
    rng.shuffle(pool)
    # Prefer variety of lengths
    chosen: list[str] = []
    for w in pool:
        if len(chosen) >= WORDS_PER_PUZZLE:
            break
        if w in chosen:
            continue
        chosen.append(w)

    # Place longest first for better packing
    chosen.sort(key=len, reverse=True)
    grid: list[list[str | None]] = [[None] * GRID_SIZE for _ in range(GRID_SIZE)]
    placed: list[str] = []
    for w in chosen:
        if try_place(grid, w, rng):
            placed.append(w)
        if len(placed) >= WORDS_PER_PUZZLE:
            break

    # Retry with more words if short
    if len(placed) < 8:
        for w in pool:
            if w in placed:
                continue
            if try_place(grid, w, rng):
                placed.append(w)
            if len(placed) >= WORDS_PER_PUZZLE:
                break

    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    filled = [
        [cell if cell is not None else letters[rng.randrange(26)] for cell in row]
        for row in grid
    ]
    # Word list alphabetical for the reader
    word_list = sorted(placed)
    return {
        "size": GRID_SIZE,
        "grid": ["".join(row) for row in filled],
        "words": word_list,
    }


def generate_day(iso_date: str, dictionary: list[str]) -> dict:
    puzzles = []
    for i in range(PUZZLES_PER_DAY):
        rng = random.Random(day_seed(iso_date, i))
        puzzles.append(build_puzzle(dictionary, rng))
    return {
        "date": iso_date,
        "timezone": "America/Phoenix",
        "count": len(puzzles),
        "puzzles": puzzles,
    }


def write_static_assets() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "css").mkdir(exist_ok=True)
    (OUT_DIR / "js").mkdir(exist_ok=True)
    (OUT_DIR / "data").mkdir(exist_ok=True)

    (OUT_DIR / "css" / "wordfind.css").write_text(CSS, encoding="utf-8")
    (OUT_DIR / "js" / "wordfind.js").write_text(JS, encoding="utf-8")
    (OUT_DIR / "index.html").write_text(HTML, encoding="utf-8")
    (OUT_DIR / "robots.txt").write_text(
        "User-agent: *\nDisallow: /\n", encoding="utf-8"
    )


def write_day_json(payload: dict) -> Path:
    path = OUT_DIR / "data" / f"{payload['date']}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    # Also write "today.json" pointer copy when generating Phoenix today
    today = datetime.now(PHOENIX).date().isoformat()
    if payload["date"] == today:
        (OUT_DIR / "data" / "today.json").write_text(
            json.dumps(payload, indent=2) + "\n", encoding="utf-8"
        )
    return path


CSS = r"""/* Oda Intelligence — Word Find (unlisted) */
:root {
  --bg: #070708;
  --gold: #c9a227;
  --crimson: #9a1c1c;
  --ink: #e8e4dc;
  --ink-dim: #a8a49c;
  --cell: #121214;
  --cell-found: #1a3a1a;
  --cell-sel: #3a2a10;
  --border: #2a2a2e;
  --radius: 10px;
  --font-display: "Cormorant Garamond", Georgia, serif;
  --font-ui: "DM Sans", system-ui, sans-serif;
}

*, *::before, *::after { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-ui);
  min-height: 100%;
}

body {
  padding: 1rem 1rem 3rem;
  max-width: 720px;
  margin: 0 auto;
}

header {
  text-align: center;
  margin-bottom: 1.25rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 1rem;
}

header h1 {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(1.75rem, 5vw, 2.25rem);
  color: var(--gold);
  margin: 0 0 0.35rem;
  letter-spacing: 0.02em;
}

header .date-line {
  color: var(--ink-dim);
  font-size: 0.95rem;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin: 1rem 0 1.25rem;
  flex-wrap: wrap;
}

.nav button {
  appearance: none;
  border: 1px solid var(--gold);
  background: transparent;
  color: var(--gold);
  font-family: var(--font-ui);
  font-size: 1rem;
  padding: 0.55rem 1.1rem;
  border-radius: var(--radius);
  cursor: pointer;
  min-width: 6.5rem;
  min-height: 2.75rem;
}

.nav button:hover:not(:disabled) {
  background: var(--gold);
  color: var(--bg);
}

.nav button:disabled {
  opacity: 0.35;
  cursor: default;
}

.nav .puzzle-label {
  font-family: var(--font-display);
  font-size: 1.25rem;
  color: var(--ink);
  min-width: 7rem;
  text-align: center;
}

.status {
  text-align: center;
  margin-bottom: 1rem;
  font-size: 1.05rem;
  color: var(--ink-dim);
}

.status.done {
  color: var(--gold);
  font-weight: 600;
}

.board-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin: 0 auto 1.5rem;
  display: flex;
  justify-content: center;
}

.board {
  display: grid;
  gap: 3px;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}

.cell {
  width: clamp(1.65rem, 6.2vw, 2.35rem);
  height: clamp(1.65rem, 6.2vw, 2.35rem);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--cell);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: var(--font-ui);
  font-weight: 700;
  font-size: clamp(1rem, 3.8vw, 1.35rem);
  letter-spacing: 0;
  color: var(--ink);
  cursor: pointer;
}

.cell.sel { background: var(--cell-sel); color: var(--gold); border-color: var(--gold); }
.cell.found { background: var(--cell-found); color: #c8e8c8; border-color: #2a5a2a; }
.cell.sel.found { background: #2a4a1a; }

.word-list-section h2 {
  font-family: var(--font-display);
  font-size: 1.35rem;
  color: var(--gold);
  margin: 0 0 0.75rem;
  text-align: center;
  font-weight: 600;
}

.word-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  justify-content: center;
  list-style: none;
  margin: 0;
  padding: 0;
}

.word-list li {
  font-size: clamp(1rem, 3.5vw, 1.15rem);
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--ink);
  background: var(--cell);
  letter-spacing: 0.04em;
}

.word-list li.found {
  text-decoration: line-through;
  color: var(--ink-dim);
  border-color: #2a5a2a;
  background: var(--cell-found);
}

.hint {
  text-align: center;
  color: var(--ink-dim);
  font-size: 0.9rem;
  margin-top: 1.5rem;
  line-height: 1.45;
}

.error {
  text-align: center;
  color: #e8a0a0;
  padding: 2rem 1rem;
}

footer {
  margin-top: 2.5rem;
  text-align: center;
  color: var(--ink-dim);
  font-size: 0.8rem;
  border-top: 1px solid var(--border);
  padding-top: 1rem;
}

footer a { color: var(--gold); text-decoration: none; }
"""

JS = r"""(function () {
  "use strict";

  const DIRS = [
    [0, 1], [0, -1], [1, 0], [-1, 0],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  function phoenixDateISO() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Phoenix",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }

  function formatDisplayDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 18, 0, 0));
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Phoenix",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(dt);
  }

  const els = {
    dateLine: document.getElementById("date-line"),
    puzzleLabel: document.getElementById("puzzle-label"),
    status: document.getElementById("status"),
    board: document.getElementById("board"),
    wordList: document.getElementById("word-list"),
    prev: document.getElementById("btn-prev"),
    next: document.getElementById("btn-next"),
    error: document.getElementById("error"),
    main: document.getElementById("main"),
  };

  let dayData = null;
  let idx = 0;
  let found = new Set();
  let selecting = false;
  let startCell = null;
  let currentPath = [];

  function cellKey(r, c) {
    return r + "," + c;
  }

  function loadStateKey(date, puzzleIdx) {
    return "oda-wf:" + date + ":" + puzzleIdx;
  }

  function saveFound() {
    if (!dayData) return;
    try {
      localStorage.setItem(
        loadStateKey(dayData.date, idx),
        JSON.stringify([...found])
      );
    } catch (_) {}
  }

  function loadFound() {
    found = new Set();
    if (!dayData) return;
    try {
      const raw = localStorage.getItem(loadStateKey(dayData.date, idx));
      if (raw) JSON.parse(raw).forEach((w) => found.add(w));
    } catch (_) {}
  }

  function lineBetween(r0, c0, r1, c1) {
    const dr = r1 - r0;
    const dc = c1 - c0;
    if (dr === 0 && dc === 0) return [[r0, c0]];
    const steps = Math.max(Math.abs(dr), Math.abs(dc));
    if (Math.abs(dr) !== 0 && Math.abs(dc) !== 0 && Math.abs(dr) !== Math.abs(dc)) {
      return null; // not straight / diagonal
    }
    const sr = dr === 0 ? 0 : dr / Math.abs(dr);
    const sc = dc === 0 ? 0 : dc / Math.abs(dc);
    if (Math.abs(dr) !== steps * Math.abs(sr) || Math.abs(dc) !== steps * Math.abs(sc)) {
      return null;
    }
    const path = [];
    for (let i = 0; i <= steps; i++) {
      path.push([r0 + sr * i, c0 + sc * i]);
    }
    return path;
  }

  function wordFromPath(path, grid) {
    return path.map(([r, c]) => grid[r][c]).join("");
  }

  function clearSel() {
    els.board.querySelectorAll(".cell.sel").forEach((el) => el.classList.remove("sel"));
    currentPath = [];
  }

  function paintPath(path) {
    clearSel();
    path.forEach(([r, c]) => {
      const el = els.board.querySelector('[data-r="' + r + '"][data-c="' + c + '"]');
      if (el) el.classList.add("sel");
    });
    currentPath = path;
  }

  function markFoundCells(word, puzzle) {
    const grid = puzzle.grid;
    const n = puzzle.size;
    const target = word;
    const rev = word.split("").reverse().join("");
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        for (const [dr, dc] of DIRS) {
          let ok = true;
          const path = [];
          for (let i = 0; i < target.length; i++) {
            const rr = r + dr * i;
            const cc = c + dc * i;
            if (rr < 0 || rr >= n || cc < 0 || cc >= n) {
              ok = false;
              break;
            }
            path.push([rr, cc]);
          }
          if (!ok) continue;
          const w = wordFromPath(path, grid);
          if (w === target || w === rev) {
            path.forEach(([rr, cc]) => {
              const el = els.board.querySelector(
                '[data-r="' + rr + '"][data-c="' + cc + '"]'
              );
              if (el) el.classList.add("found");
            });
            return;
          }
        }
      }
    }
  }

  function updateStatus(puzzle) {
    const n = puzzle.words.length;
    const f = found.size;
    els.status.textContent = f + " of " + n + " words found";
    els.status.classList.toggle("done", f >= n);
    if (f >= n) {
      els.status.textContent = "All " + n + " words found — nice work!";
    }
  }

  function renderWordList(puzzle) {
    els.wordList.innerHTML = "";
    puzzle.words.forEach((w) => {
      const li = document.createElement("li");
      li.textContent = w;
      li.dataset.word = w;
      if (found.has(w)) li.classList.add("found");
      els.wordList.appendChild(li);
    });
  }

  function tryCommit(puzzle) {
    if (!currentPath.length) return;
    const w = wordFromPath(currentPath, puzzle.grid);
    const rev = w.split("").reverse().join("");
    let hit = null;
    if (puzzle.words.includes(w) && !found.has(w)) hit = w;
    else if (puzzle.words.includes(rev) && !found.has(rev)) hit = rev;
    if (hit) {
      found.add(hit);
      saveFound();
      markFoundCells(hit, puzzle);
      renderWordList(puzzle);
      updateStatus(puzzle);
    }
    clearSel();
  }

  // Remove previous window listeners by regenerating board DOM each render
  // (mousemove/up stay but tryCommit is scoped — rebind carefully)
  let moveHandler = null;
  let endHandler = null;

  function unbindGlobal() {
    if (moveHandler) {
      window.removeEventListener("mousemove", moveHandler);
      window.removeEventListener("touchmove", moveHandler);
    }
    if (endHandler) {
      window.removeEventListener("mouseup", endHandler);
      window.removeEventListener("touchend", endHandler);
    }
  }

  function renderPuzzle() {
    if (!dayData) return;
    const puzzle = dayData.puzzles[idx];
    loadFound();
    els.puzzleLabel.textContent =
      "Puzzle " + (idx + 1) + " of " + dayData.puzzles.length;
    els.prev.disabled = idx <= 0;
    els.next.disabled = idx >= dayData.puzzles.length - 1;

    unbindGlobal();
    els.board.innerHTML = "";
    els.board.style.gridTemplateColumns =
      "repeat(" + puzzle.size + ", auto)";

    for (let r = 0; r < puzzle.size; r++) {
      for (let c = 0; c < puzzle.size; c++) {
        const div = document.createElement("div");
        div.className = "cell";
        div.dataset.r = r;
        div.dataset.c = c;
        div.textContent = puzzle.grid[r][c];
        els.board.appendChild(div);
      }
    }

    found.forEach((w) => markFoundCells(w, puzzle));
    renderWordList(puzzle);
    updateStatus(puzzle);

    selecting = false;
    startCell = null;
    currentPath = [];

    function posFromEvent(e) {
      const t = e.touches ? e.touches[0] || e.changedTouches[0] : e;
      if (!t) return null;
      const el = document.elementFromPoint(t.clientX, t.clientY);
      if (!el || !el.classList.contains("cell")) return null;
      return { r: +el.dataset.r, c: +el.dataset.c };
    }

    function onStart(e) {
      e.preventDefault();
      const p = posFromEvent(e);
      if (!p) return;
      selecting = true;
      startCell = p;
      paintPath([[p.r, p.c]]);
    }

    moveHandler = function (e) {
      if (!selecting || !startCell) return;
      e.preventDefault();
      const p = posFromEvent(e);
      if (!p) return;
      const path = lineBetween(startCell.r, startCell.c, p.r, p.c);
      if (path) paintPath(path);
    };

    endHandler = function (e) {
      if (!selecting) return;
      e.preventDefault();
      selecting = false;
      tryCommit(puzzle);
      startCell = null;
    };

    els.board.querySelectorAll(".cell").forEach((el) => {
      el.addEventListener("mousedown", onStart);
      el.addEventListener("touchstart", onStart, { passive: false });
    });
    window.addEventListener("mousemove", moveHandler);
    window.addEventListener("touchmove", moveHandler, { passive: false });
    window.addEventListener("mouseup", endHandler);
    window.addEventListener("touchend", endHandler);
  }

  els.prev.addEventListener("click", () => {
    if (idx > 0) {
      idx--;
      renderPuzzle();
    }
  });
  els.next.addEventListener("click", () => {
    if (dayData && idx < dayData.puzzles.length - 1) {
      idx++;
      renderPuzzle();
    }
  });

  async function boot() {
    const params = new URLSearchParams(location.search);
    const forced = params.get("date");
    const iso = forced || phoenixDateISO();
    els.dateLine.textContent = formatDisplayDate(iso);

    const urls = [
      "data/" + iso + ".json",
      "data/today.json",
    ];
    let data = null;
    let lastErr = null;
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(url + " " + res.status);
        data = await res.json();
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!data || !data.puzzles || !data.puzzles.length) {
      els.main.hidden = true;
      els.error.hidden = false;
      els.error.textContent =
        "No puzzles for " +
        iso +
        ". Generate with tools/wordfind/generate.py";
      console.error(lastErr);
      return;
    }
    dayData = data;
    if (data.date !== iso && !forced) {
      els.dateLine.textContent =
        formatDisplayDate(data.date) + " (bundled)";
    }
    idx = 0;
    renderPuzzle();
  }

  boot();
})();
"""

HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Word Find — Oda Intelligence</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=DM+Sans:wght@400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/wordfind.css">
</head>
<body>
  <header>
    <h1>Word Find</h1>
    <p class="date-line" id="date-line">Loading…</p>
  </header>

  <p class="error" id="error" hidden></p>

  <main id="main">
    <nav class="nav" aria-label="Puzzle navigation">
      <button type="button" id="btn-prev" aria-label="Previous puzzle">← Prev</button>
      <span class="puzzle-label" id="puzzle-label">Puzzle 1 of 5</span>
      <button type="button" id="btn-next" aria-label="Next puzzle">Next →</button>
    </nav>

    <p class="status" id="status" aria-live="polite"></p>

    <div class="board-wrap">
      <div class="board" id="board" role="grid" aria-label="Word search grid"></div>
    </div>

    <section class="word-list-section" aria-label="Words to find">
      <h2>Find these words</h2>
      <ul class="word-list" id="word-list"></ul>
    </section>

    <p class="hint">
      Drag across letters in a straight line (including diagonals).
      Progress is saved on this device for today’s puzzles.
    </p>
  </main>

  <footer>
    <p>Unlisted page · <a href="https://odaintelligence.com/">Oda Intelligence</a></p>
  </footer>

  <script src="js/wordfind.js"></script>
</body>
</html>
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate daily word-find puzzles")
    parser.add_argument(
        "date",
        nargs="?",
        help="YYYY-MM-DD in America/Phoenix (default: today Phoenix)",
    )
    parser.add_argument(
        "--assets-only",
        action="store_true",
        help="Only rewrite HTML/CSS/JS, skip puzzle JSON",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=1,
        help="Generate this many consecutive days starting at date",
    )
    args = parser.parse_args()

    if args.date:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", args.date):
            print("Date must be YYYY-MM-DD", file=sys.stderr)
            return 2
        start = date.fromisoformat(args.date)
    else:
        start = datetime.now(PHOENIX).date()

    write_static_assets()
    if args.assets_only:
        print(f"Wrote static assets under {OUT_DIR}")
        return 0

    dictionary = load_dictionary()
    if len(dictionary) < 50:
        print("Dictionary too small", file=sys.stderr)
        return 1

    for offset in range(args.days):
        d = start + timedelta(days=offset)
        iso = d.isoformat()
        payload = generate_day(iso, dictionary)
        path = write_day_json(payload)
        counts = [len(p["words"]) for p in payload["puzzles"]]
        print(
            f"{iso}: {payload['count']} puzzles, words/puzzle={counts} -> {path}"
        )
        # Prove invariants
        assert payload["count"] == PUZZLES_PER_DAY
        for p in payload["puzzles"]:
            assert p["size"] == GRID_SIZE
            assert 8 <= len(p["words"]) <= WORDS_PER_PUZZLE
            assert len(p["grid"]) == GRID_SIZE
            assert all(len(row) == GRID_SIZE for row in p["grid"])

    print(f"Player: {OUT_DIR / 'index.html'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
