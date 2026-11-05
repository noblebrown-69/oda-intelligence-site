#!/bin/sh
# Rasterise the Oniko Fit icons from icon-maskable.svg with headless Chromium. Dev-only.
set -e
D="$(cd "$(dirname "$0")/../plugin/oniko-fit/assets/icons" && pwd)"
CH="$(command -v chromium || command -v google-chrome)"
T="$(mktemp -d)"
for s in 512 192 180; do
  printf '<html><body style="margin:0;background:#0b0709"><img src="file://%s/icon-maskable.svg" width="%s" height="%s" style="display:block"></body></html>' "$D" "$s" "$s" > "$T/i.html"
  "$CH" --headless=new --no-sandbox --disable-gpu --hide-scrollbars --allow-file-access-from-files --window-size="$s,$s" --screenshot="$T/$s.png" "file://$T/i.html" >/dev/null 2>&1
done
cp "$T/512.png" "$D/icon-512.png"; cp "$T/192.png" "$D/icon-192.png"; cp "$T/180.png" "$D/apple-touch-icon.png"
rm -rf "$T"
