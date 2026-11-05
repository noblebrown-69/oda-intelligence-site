# Oniko Fit — deploy steps (Noble)

Nothing here has been deployed. Build the zip, upload it, then do the one-time setup.

## 1. Build the zip (on Aegis)

```
cd ~/Dropbox/Development/oda-intelligence-site/plugin
rm -f oniko-fit.zip && zip -r oniko-fit.zip oniko-fit -x 'oniko-fit/tests/*' 'oniko-fit/assets/icons/icon-maskable.svg'
```
`plugin/oniko-fit.zip` is git-ignored.

## 2. Install

WP Admin → Plugins → Add New → Upload Plugin → `oniko-fit.zip` → Install → Activate.
Activation creates the tables, the `oniko_poller` role, gives administrators `oniko_fit_use`, keeps registration off, and creates the page **/oniko/** with `[oniko_fit]` if no page with that slug exists.

To use a different slug: Pages → Add New, title "Oniko Fit", content `[oniko_fit]`, publish, then `wp option update oniko_fit_page_id <ID>` (the manifest uses it for scope). Exclude the page from any caching plugin (it already sends `Cache-Control: no-store`).

## 3. Vanessa's account (by an administrator; registration stays off)

Admin UI: Users → Add New → username, email, role **Subscriber**, send the user notification (she sets her password) → then Users → Edit her → **Oniko Fit access** checkbox → Update.

WP-CLI:
```
wp user create <vanessa-login> <vanessa-email> --role=subscriber --first_name=Vanessa --display_name=Vanessa --send-email
wp user add-cap <vanessa-login> oniko_fit_use
```

## 4. Notify emails (optional; default empty)

Settings → Oniko Fit → Notify emails → `<vanessa-grok-bot-address>, <noble-grok-bot-address>` → Save.
Or `wp option update oniko_fit_notify_emails '<a>, <b>'`. A filter `oniko_fit_notify_emails` can override it. The site must be able to send mail (same as members chat).

## 5. Poller user + application password

```
wp user create onikopoller <some-unused-address> --role=oniko_poller
wp user application-password create onikopoller aegis-oniko --porcelain
```
(or Users → onikopoller → Application Passwords → name "aegis-oniko" → Add). Copy the password once.

## 6. Aegis

```
mkdir -p ~/.hermes/scripts ~/.hermes/secrets ~/.config/systemd/user ~/Dropbox/Oniko/backup
cp aegis/oniko-fit-pull.py ~/.hermes/scripts/
cp aegis/oniko-fit.env.example ~/.hermes/secrets/oniko-fit-wp.env && chmod 600 ~/.hermes/secrets/oniko-fit-wp.env
#   fill ONIKO_FIT_BASE_URL, WP_USER=onikopoller, WP_APP_PASSWORD=<from step 5>
cp aegis/oniko-fit-pull.service aegis/oniko-fit-pull.timer aegis/oniko-fit-backup.service aegis/oniko-fit-backup.timer ~/.config/systemd/user/
systemctl --user daemon-reload
python3 ~/.hermes/scripts/oniko-fit-pull.py --dry-run     # check it connects
systemctl --user enable --now oniko-fit-pull.timer oniko-fit-backup.timer
```
Archive: `~/.local/share/oniko-fit/oniko-fit.db`. Nightly copy: `~/Dropbox/Oniko/backup/oniko-fit-YYYY-MM-DD.db`.

## 7. Check

1. Signed out, `/oniko/` shows "Members only. Sign in."
2. Sign in as Vanessa, log one set, Undo it.
3. iPhone Safari → Share → Add to Home Screen.
4. Log a test workout, tap **Log workout**, confirm the email (if set) and `oniko-fit-pull.py` archives it (`sqlite3 ~/.local/share/oniko-fit/oniko-fit.db 'select workout_id,wdate,program,workout from workouts'`).

## Update later

Zip again and upload over the old plugin (Upload Plugin → Replace current with uploaded). Data tables are kept. Bump `ONIKO_FIT_VERSION` so phones fetch new assets.
