#!/usr/bin/env python3
"""Dev-only REST end-to-end test against a throwaway local WordPress (never the live site).
Env: BASE (http://127.0.0.1:18089), V_PW / O_PW / X_PW (member, other member, outsider passwords),
POLL_APP (poller application password), PULLER (path to aegis/oniko-fit-pull.py), MAILLOG."""
import base64, http.cookiejar, json, os, re, subprocess, sys, tempfile, urllib.error, urllib.parse, urllib.request, sqlite3

BASE = os.environ.get("BASE", "http://127.0.0.1:18089")
assert BASE.startswith("http://127.0.0.1"), "tests only run against localhost"
R = BASE + "/wp-json/oniko-fit/v1/"
passed = failed = 0


def ok(c, m):
    global passed, failed
    if c: passed += 1
    else: failed += 1; print("FAIL", m)


class Client:
    def __init__(self, user=None, pw=None, basic=None):
        self.cj = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cj))
        self.nonce = None
        self.basic = basic
        if user:
            data = urllib.parse.urlencode({"log": user, "pwd": pw, "wp-submit": "Log In", "redirect_to": BASE + "/oniko/", "testcookie": "1"}).encode()
            self.cj.set_cookie(http.cookiejar.Cookie(0, "wordpress_test_cookie", "WP Cookie check", None, False, "127.0.0.1", False, False, "/", True, False, None, False, None, None, {}))
            page = self.op.open(BASE + "/wp-login.php", data).read().decode()
            m = re.search(r'"nonce":"([0-9a-f]+)"', page)
            self.nonce = m.group(1) if m else None
            self.page = page

    def call(self, method, path, body=None, nonce=True):
        req = urllib.request.Request(R + path, data=json.dumps(body).encode() if body is not None else None, method=method)
        if body is not None: req.add_header("Content-Type", "application/json")
        if nonce and self.nonce: req.add_header("X-WP-Nonce", self.nonce)
        if self.basic: req.add_header("Authorization", "Basic " + base64.b64encode(self.basic.encode()).decode())
        try:
            with self.op.open(req) as r: return r.status, json.loads(r.read() or b"{}")
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b"{}")


D1, D2 = "2026-11-02", "2026-11-04"
v = Client("vanessa", os.environ["V_PW"])
ok(v.nonce, "member page renders app config with nonce")
ok('class="oniko"' in v.page and "noindex" in v.page and "rel=\"manifest\"" in v.page and "apple-touch-icon" in v.page, "page has app, noindex, manifest, apple-touch-icon")
s, _ = v.call("GET", "day?date=" + D1, nonce=False)
ok(s in (401, 403), "cookie without REST nonce rejected (CSRF)")
s, d = v.call("GET", "day?date=" + D1)
ok(s == 200 and d["session"] is None and d["history"] == [], "empty day")
s, _ = v.call("GET", "day?date=2026-02-31"); ok(s == 400, "invalid date rejected")
s, _ = v.call("GET", "day?date=2099-01-01"); ok(s == 400, "future date rejected")

# Day 1: gym A, warm-up + sets, undo
s, d = v.call("POST", "select", {"date": D1, "program": "gym", "workout": "A"}); ok(s == 200 and d["session"]["program"] == "gym", "select gym A")
s, d = v.call("POST", "set", {"date": D1, "program": "gym", "workout": "A", "ex": "v_squat", "reps": 10, "weight": 0, "warm": True}); ok(s == 200 and d["sets"][0]["warm"] is True, "warm-up set logged and flagged")
for i in range(5):
    s, d = v.call("POST", "set", {"date": D1, "program": "gym", "workout": "A", "ex": "v_squat", "reps": 5, "weight": 20})
ok(s == 200 and len(d["sets"]) == 6, "5 working sets logged")
s, d = v.call("POST", "set", {"date": D1, "program": "gym", "workout": "A", "ex": "v_squat", "reps": 3, "weight": 99})
s, d = v.call("POST", "undo", {"date": D1, "ex": "v_squat"}); ok(s == 200 and len(d["sets"]) == 6 and d["sets"][-1]["weight"] == 20, "undo removes last set only")
s, _ = v.call("POST", "set", {"date": D1, "program": "gym", "workout": "A", "ex": "nope", "reps": 5, "weight": 1}); ok(s == 400, "unknown exercise rejected")
s, _ = v.call("POST", "set", {"date": D1, "program": "gym", "workout": "A", "ex": "v_squat", "reps": 500, "weight": 1}); ok(s == 400, "reps out of range rejected")
s, _ = v.call("POST", "set", {"date": D1, "program": "gym", "workout": "Z", "ex": "v_squat", "reps": 5, "weight": 1}); ok(s == 400, "bad workout rejected")
s, _ = v.call("POST", "set", {"date": D1, "program": "gym", "workout": "A", "ex": "v_squat", "reps": 5, "weight": 1, "pad": "x" * 20000}); ok(s == 413, "oversize body rejected")
s, d = v.call("POST", "set", {"date": D1, "program": "gym", "workout": "A", "ex": "iso_bench", "reps": 5, "weight": 15}); ok(s == 200, "bench set")
s, d = v.call("POST", "effort", {"date": D1, "ex": "v_squat", "tap": "Good"}); ok(s == 200 and d["effort"]["v_squat"] == "Good", "effort tap")
s, _ = v.call("POST", "effort", {"date": D1, "ex": "v_squat", "tap": "Meh"}); ok(s == 400, "bad effort rejected")
# switch workout after logging: sets kept
s, d = v.call("POST", "select", {"date": D1, "program": "home", "workout": "B"}); ok(s == 200 and d["session"]["workout"] == "B", "switch after logging")
s, d = v.call("GET", "day?date=" + D1); ok(len(d["session"]["sets"]) == 7 and d["session"]["program"] == "home", "sets kept after switch")
s, d = v.call("POST", "select", {"date": D1, "program": "gym", "workout": "A"})
s, d = v.call("POST", "complete", {"date": D1, "notes": "Felt strong <script>x</script>", "flags": {"low_energy": False, "joint_pain": False}, "highlights": ["Hammer V-Squat: First time logged. Nice start."]})
ok(s == 200 and d["queued"] and d["mailed"] and d["revision"] == 1, "complete queues + mails (stub)")
ok("<script>" not in d["summary_text"] and "Hammer V-Squat" in d["summary_text"] and "volume (no warm-ups): 500" in d["summary_text"], "summary text: escaped notes, volume excludes warm-up")
s, d = v.call("POST", "complete", {"date": "2026-11-03"}); ok(s == 404, "complete with nothing logged rejected")

# Isolation
o = Client("other", os.environ["O_PW"])
s, d = o.call("GET", "day?date=" + D1); ok(s == 200 and d["session"] is None and d["history"] == [], "other member sees nothing of vanessa")
s, d = o.call("POST", "undo", {"date": D1, "ex": "v_squat"}); ok(s == 404, "other member cannot undo vanessa's set")
s, d = v.call("GET", "day?date=" + D1); ok(len(d["session"]["sets"]) == 7, "vanessa's sets untouched")
s, _ = o.call("GET", "outbox"); ok(s in (401, 403), "member cannot read poller outbox")

x = Client("outsider", os.environ["X_PW"])
ok('Oniko Fit' in x.page and 'does not have Oniko Fit turned on' in x.page, "non-member wall")
s, _ = x.call("GET", "day?date=" + D1); ok(s in (401, 403), "non-member REST rejected")
s, _ = Client().call("GET", "day?date=" + D1); ok(s == 401, "anonymous rejected")
anon = urllib.request.urlopen(BASE + "/oniko/").read().decode()
ok("Members only. Sign in." in anon and "wp-login.php" in anon and "ONIKO_CFG" not in anon, "logged-out wall")

# Day 2 history includes day 1
s, d = v.call("GET", "day?date=" + D2); ok(len(d["history"]) == 1 and d["history"][0]["done"], "history includes completed day")
s, d = v.call("POST", "set", {"date": D2, "program": "gym", "workout": "B", "ex": "v_squat", "reps": 5, "weight": 25})
s, d = v.call("POST", "complete", {"date": D2, "flags": {"joint_pain": True}}); ok(s == 200, "complete day 2")

# Poller: pull + ack idempotency via the real aegis script
poll_basic = "onikopoller:" + os.environ["POLL_APP"]
p = Client(basic=poll_basic)
s, d = p.call("GET", "outbox"); ok(s == 200 and len(d["items"]) == 2, "poller sees 2 pending")
tmp = tempfile.mkdtemp()
db = os.path.join(tmp, "a.db")
env = dict(os.environ, ONIKO_FIT_ENV=os.path.join(tmp, "none.env"), ONIKO_FIT_DB=db, ONIKO_FIT_BACKUP_DIR=os.path.join(tmp, "bk"),
           ONIKO_FIT_BASE_URL=BASE, WP_USER="onikopoller", WP_APP_PASSWORD=os.environ["POLL_APP"])
r = subprocess.run([sys.executable, os.environ["PULLER"]], env=env, capture_output=True, text=True)
ok(r.returncode == 0 and '"new": 2' in r.stdout and '"acked": 2' in r.stdout, "puller archived + acked 2: " + r.stdout + r.stderr)
s, d = p.call("GET", "outbox"); ok(len(d["items"]) == 0, "nothing pending after ack")
r = subprocess.run([sys.executable, os.environ["PULLER"]], env=env, capture_output=True, text=True); ok(r.returncode == 0 and r.stdout == "", "second run is a no-op")
# re-complete day 1 -> revision 2 replaces, no duplicate
v.call("POST", "set", {"date": D1, "program": "gym", "workout": "A", "ex": "iso_row", "reps": 5, "weight": 15})
s, d = v.call("POST", "complete", {"date": D1}); ok(d["revision"] == 2, "re-complete bumps revision")
r = subprocess.run([sys.executable, os.environ["PULLER"]], env=env, capture_output=True, text=True); ok('"updated": 1' in r.stdout, "revision 2 updates archive")
con = sqlite3.connect(db)
ok(con.execute("select count(*) from workouts").fetchone()[0] == 2, "archive has 2 workouts (idempotent)")
ok(con.execute("select revision from workouts where workout_id like 'oniko-%' order by wdate limit 1").fetchone()[0] == 2, "archive keeps latest revision")
ok(con.execute("select count(*) from sets where warm=1").fetchone()[0] == 1, "warm flag archived")
# replaying an old record must not downgrade
s, d = p.call("GET", "outbox?status=acked")
import importlib.util
spec = importlib.util.spec_from_file_location("pull", os.environ["PULLER"]); mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
old = [i for i in d["items"] if i["record"]["revision"] == 1 and i["record"]["date"] == D1][0]
ok(mod.store(con, old["outbox_id"] + 1000, old["record"]) == "same", "older revision never overwrites newer")
r = subprocess.run([sys.executable, os.environ["PULLER"], "--backup"], env=env, capture_output=True, text=True)
ok(r.returncode == 0 and os.listdir(os.path.join(tmp, "bk")), "backup copy written")
s, _ = p.call("POST", "set", {"date": D1, "program": "gym", "workout": "A", "ex": "v_squat", "reps": 5, "weight": 1}); ok(s in (401, 403), "poller cannot log sets")
s, _ = Client(basic="vanessa:" + os.environ["V_APP"]).call("POST", "ack", {"ids": [1]}); ok(s in (401, 403), "member cannot ack")

mail = open(os.environ["MAILLOG"]).read().splitlines()
m = json.loads(mail[0])
ok(len(mail) == 3 and m["subject"] == "[Oniko Fit] Vanessa — Gym A — 2026-11-02" and m["to"] == ["bot-a@example.test", "bot-b@example.test"], "mail stub: subject + recipients")
# manifest + sw
man = json.loads(urllib.request.urlopen(BASE + "/?oniko_fit=manifest").read())
ok(man["scope"] == "/oniko/" and man["start_url"] == "/oniko/" and len(man["icons"]) == 2, "manifest scope/start_url/icons")
sw = urllib.request.urlopen(BASE + "/?oniko_fit=sw")
ok(sw.headers.get("Service-Worker-Allowed") == "/oniko/" and "wp-json" in sw.read().decode(), "service worker served with scope header and skips API")
print(f"rest e2e: {passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
