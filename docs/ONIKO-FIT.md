# Oniko Fit

Novice workout logger for Vanessa. Lives on odaintelligence.com behind a WordPress login, because she is not on Tailscale. Plugin: `plugin/oniko-fit/`. Aegis side: `aegis/oniko-fit-pull.py`.

## Program

| | Gym (5x5, StrongLifts style) | Home (Bill: 3 x 8–12, double progression) |
|---|---|---|
| A | Hammer V-Squat 5x5 · Hammer Iso-Lateral Bench Press 5x5 · Hammer Iso-Lateral Row 5x5 | Goblet Squat 3x8–12 · Push-Up 3x8–12 · One-Arm DB Row / Band Row 3x8–12 · optional Band Pull-Apart, DB Glute Bridge |
| B | Hammer V-Squat 5x5 · Hammer Iso-Lateral Shoulder Press 5x5 · DB Straight-Leg Deadlift 1x5 (1x8 light option, first 4 weeks) | Goblet Squat 3x8–12 · DB Overhead Press 3x8–12 · DB Romanian Deadlift 2x10–12 |

All program text, cues, start-weight guesses and media slots are in `plugin/oniko-fit/data/program.json`.

**Images (1.0.2).** The 7 home exercises have an Oniko character card (`media_url`, shown at the top of "How to do it") and a plain form diagram (`diagram_url`, shown under "What you should feel"). Files live in `plugin/oniko-fit/assets/img/cards/` and `assets/img/diagrams/`, named by exercise: `goblet-squat`, `push-up`, `db-row`, `db-overhead-press`, `db-rdl`, `band-pull-apart`, `glute-bridge` (all `.jpg`). Paths starting with `assets/img/` are turned into the plugin URL by `includes/data.php` (with `?v=<version>`); a full URL also works. `media_ratio` / `diagram_ratio` (width/height) reserve space so nothing jumps. Gym exercises have no images and still show "Diagram coming soon". A missing or broken image hides itself.

**Replace an image:** resize to max 900 px on the long edge, JPEG q80 (cards) or q85 (diagrams), keep it under 150 KB, overwrite the file with the same name, update the ratio if the shape changed, run `node tests/images.test.js`, bump `ONIKO_FIT_VERSION` (so the `?v=` and service-worker cache change), and upload. `video_url` is still an optional link.

## Progression (assets/engine.js, tested in tests/engine.test.js)

- Home: all sets at 12 → next session add load (next dumbbell: 2, 3, 5, 8, 10, 12, 15, 17.5, 20, 25…) and restart at 8 (hinge at 10). Otherwise same load, +1 rep from the lowest set (+2 if she tapped Easy). Easy and one rep short of 12 on every set also counts as ready. Grind → hold. Before the next dumbbell the app lists the micro-steps in order: 4th set, 3-second lowering, 1-second pause, thicker/second band.
- Push-ups: surface ladder counter → stairs → knees → floor, then reps to 12, then a 4th set.
- Miss rule (home): two or more sets under 8 in two sessions in a row at the same load → drop one step (~10%).
- Gym 5x5: all 25 clean (and not tapped Grind) → +5 lb (dumbbell ladder for the DB hinge). Three non-clean sessions in a row → −10% and rebuild.
- Deload: every 6th week; also after joint pain in the last 2 weeks, low energy on every session for 2 weeks, or two failed lifts in a row → ~12% lighter and 2 sets. Back after 8+ days off → ~90%; 14+ days → ~80%.
- Warm-up sets never count toward top set, volume, progress callouts or progression.
- Callouts compare top-set load (then reps) and volume (sets × reps × weight) with the last session of that exercise. Regressions are said gently.
- With no history the recommendation is labelled **Guess** and shows Bill's start weight.

## Where the data lives (decision)

- **Authoritative:** WordPress tables `wp_oniko_sessions`, `wp_oniko_sets`, `wp_oniko_outbox`. Small, per user, isolated by `user_id = current user` in every query, and included in normal site backups. The page needs it to show "Last time" and recommendations without Aegis being reachable.
- **Long-term archive:** Aegis pulls every completed workout (poller-only REST) into `~/.local/share/oniko-fit/oniko-fit.db`, idempotent by `workout_id` + revision. The live DB stays off Dropbox (SQLite + sync = corruption risk). A nightly `--backup` writes a consistent copy to `~/Dropbox/Oniko/backup/` (keeps 30).
- **Bots:** "Log workout" queues the record for the poller and, if `oniko_fit_notify_emails` is set, sends a plain-text note via `wp_mail`. Mail failing never blocks the queue.

### Privacy tradeoff, plainly

This is health-adjacent data (sets, reps, weights, effort, "low energy" and "joint pain" flags, her free-text notes) stored on a public web host. What limits it:

- No PII beyond her WordPress account (login, display name, email).
- No third parties: no CDN, no external fonts, no analytics, no tracking pixels; the page only calls same-site WordPress REST.
- `noindex, nofollow` (meta, `wp_robots`, `X-Robots-Tag`), `Cache-Control: no-store` on the page and every API response.
- The site cannot reach Aegis. Aegis pulls over HTTPS with an application password for a user that can only read the outbox and ack it.
- Risk that remains: anyone who compromises the WordPress host or an admin login can read the tables. Notify emails travel through whatever mail provider the site uses. If that is not acceptable, leave the notify list empty and rely on the poller only, and/or periodically delete old rows from WordPress once archived (not automated yet).

## Security

- Capability `oniko_fit_use` (granted to administrators on activation; per user for Vanessa). Poller role `oniko_poller` with only `oniko_fit_poll`. Admins do not get poll and there is no cross-user write path: every member endpoint writes only the current user's rows.
- REST cookie auth requires the `X-WP-Nonce` (CSRF). Prepared statements everywhere. Output built with `textContent` in JS and `esc_*` in PHP. Body limit 16 KB, notes 1000 chars, reps 0–100, weight 0–2000, dates validated (no future beyond tomorrow), 80 sets/day cap. Rate limits: 240 writes / 10 min, 20 completions / hour per user.
- Registration stays off. No secrets in the repo.

## PWA

Manifest at `/?oniko_fit=manifest` (scope and start URL = the app page path). Service worker at `/?oniko_fit=sw` with `Service-Worker-Allowed` set to the page path; it caches only the plugin's CSS/JS/icons and never pages, `/wp-json/`, login or admin. Registered only over HTTPS. Icons are drawn in code (`assets/icons/icon-maskable.svg`, rasterised by `tools/oniko-icons.sh`).

**iPhone:** open the page in Safari, sign in, tap Share → Add to Home Screen → Add. It opens full screen with the Oniko icon. If she is signed out it shows the sign-in wall; sign in once inside the app.

## Tests

```
node plugin/oniko-fit/tests/engine.test.js        # progression + content data
python3 plugin/oniko-fit/tests/rest_e2e.py        # needs a throwaway local WordPress; see the header
```
Screens (390×844): `docs/screens/01-login-wall.png` … `05-summary.png`.
