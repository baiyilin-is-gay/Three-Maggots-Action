#!/usr/bin/env bash
# 卸载：默认保留程序与存档；--purge 连存档一起删
set -eu

DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
DEST="$DATA/ThreeGrubs"
BIN="$HOME/.local/bin/ThreeGrubs"
DESKTOP="$DATA/applications/ThreeGrubs.desktop"
ICON="$DATA/icons/hicolor/256x256/apps/ThreeGrubs.png"

rm -f "$BIN" "$DESKTOP" "$ICON"

if [ "${1:-}" = "--purge" ]; then
  rm -rf "$DEST"
  echo "已卸载，并删除程序与存档：$DEST"
else
  echo "已移除命令与桌面项。"
  echo "程序与存档仍保留在：$DEST"
  echo "如需彻底删除（含存档），运行：./uninstall.sh --purge"
fi

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$DATA/applications" >/dev/null 2>&1 || true
fi
