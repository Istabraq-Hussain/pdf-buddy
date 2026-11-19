#!/usr/bin/env bash
# PDF24 Toolkit - Linux installer (no internet needed)
# Copies the app into ~/.local/share/pdf24-toolkit, adds an app-menu entry
# with its own icon, and a "pdf24-toolkit" command.
set -uo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.local/share/pdf24-toolkit"
APPS="$HOME/.local/share/applications"
ICONS="$HOME/.local/share/icons/hicolor/512x512/apps"
BIN="$HOME/.local/bin"

echo "Installing PDF24 Toolkit to $DEST"
mkdir -p "$(dirname "$DEST")" "$APPS" "$ICONS" "$BIN"
rm -rf "$DEST"
cp -a "$SRC" "$DEST"

# Try to enable Chromium's sandbox (needs admin rights). Safe to skip.
if [ -f "$DEST/chrome-sandbox" ]; then
  sudo -n chown root:root "$DEST/chrome-sandbox" 2>/dev/null
  sudo -n chmod 4755 "$DEST/chrome-sandbox" 2>/dev/null
fi

FLAGS=""
if [ "$(stat -c '%U %a' "$DEST/chrome-sandbox" 2>/dev/null)" != "root 4755" ]; then
  FLAGS="--no-sandbox"
fi

cat > "$APPS/pdf24-toolkit.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=PDF24 Toolkit
Comment=Offline PDF tools - merge, split, sign, compress
Exec="$DEST/PDF24-Toolkit" $FLAGS
Path=$DEST
Icon=pdf24-toolkit
Terminal=false
Categories=Utility;Office;
StartupWMClass=pdf24-toolkit
EOF

if [ -f "$DEST/electron/icon.png" ]; then
  cp "$DEST/electron/icon.png" "$ICONS/pdf24-toolkit.png"
fi

ln -sf "$DEST/PDF24-Toolkit" "$BIN/pdf24-toolkit"

update-desktop-database "$APPS" 2>/dev/null
gtk-update-icon-cache "$HOME/.local/share/icons/hicolor" 2>/dev/null

echo
echo "Done. Look for 'PDF24 Toolkit' in your app menu, or run: pdf24-toolkit"
if [ -n "$FLAGS" ]; then
  echo "(Started without the Chromium sandbox; run the two sudo commands"
  echo " in the README if you want it sandboxed.)"
fi
