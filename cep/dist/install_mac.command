#!/bin/bash
# LyricWave Studio CEP panel - install for the current user (macOS).
# Copies com.duyhuongngv2.lyricwave into the CEP extensions folder and allows unsigned panels (PlayerDebugMode).
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions"
mkdir -p "$DEST"
rm -rf "$DEST/com.duyhuongngv2.lyricwave"
cp -R "$HERE/com.duyhuongngv2.lyricwave" "$DEST/"
for v in 10 11 12 13 14; do defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1; done
killall cfprefsd 2>/dev/null || true
echo "Installed: $DEST/com.duyhuongngv2.lyricwave"
echo "Restart After Effects, then open Window > Extensions > LyricWave Studio."
