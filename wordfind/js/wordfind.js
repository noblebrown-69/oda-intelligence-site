(function () {
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
