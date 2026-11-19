#!/usr/bin/env bash
# PDF24 Toolkit - Linux uninstaller. Removes the app, its menu entry,
# icon, command and saved settings. Your own PDF files are never touched.
set -uo pipefail

rm -rf "$HOME/.local/share/pdf24-toolkit"
rm -f "$HOME/.local/share/applications/pdf24-toolkit.desktop"
rm -f "$HOME/.local/share/icons/hicolor/512x512/apps/pdf24-toolkit.png"
rm -f "$HOME/.local/bin/pdf24-toolkit"
rm -rf "$HOME/.config/pdf24-toolkit" "$HOME/.cache/pdf24-toolkit"
rm -rf "$HOME/.config/tanstack_start_ts" "$HOME/.config/PDF24 Toolkit"

update-desktop-database "$HOME/.local/share/applications" 2>/dev/null
gtk-update-icon-cache "$HOME/.local/share/icons/hicolor" 2>/dev/null

echo "PDF24 Toolkit removed."
