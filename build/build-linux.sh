#!/usr/bin/env bash
# 构建 Linux 发行包：dist/ThreeGrubs-linux-x64.tar.gz
# 可在 Linux / macOS / Git Bash 下运行（需要 bash、tar、coreutils）
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
STAGE="$ROOT/build/linux-stage"
PKG="$STAGE/ThreeGrubs-linux-x64"
OUT="$ROOT/dist/ThreeGrubs-linux-x64.tar.gz"

rm -rf "$STAGE"
mkdir -p "$PKG/app/css" "$PKG/app/js"

# 游戏文件
cp "$ROOT/index.html" "$ROOT/favicon.svg" "$ROOT/favicon.ico" "$PKG/app/"
cp "$ROOT/css/"*.css "$PKG/app/css/"
cp "$ROOT/js/"*.js "$PKG/app/js/"

# 启动器与安装文件
cp "$ROOT/build/linux/ThreeGrubs" \
   "$ROOT/build/linux/install.sh" \
   "$ROOT/build/linux/uninstall.sh" \
   "$ROOT/build/linux/ThreeGrubs.desktop" \
   "$ROOT/build/linux/README.txt" \
   "$PKG/"

# 图标
if [ ! -f "$ROOT/build/app-256.png" ]; then
  echo "缺少 build/app-256.png，请先运行：python build/make-icon.py" >&2
  exit 1
fi
cp "$ROOT/build/app-256.png" "$PKG/ThreeGrubs.png"

# 权限
chmod 755 "$PKG/ThreeGrubs" "$PKG/install.sh" "$PKG/uninstall.sh"
chmod 644 "$PKG/ThreeGrubs.desktop" "$PKG/README.txt" "$PKG/ThreeGrubs.png"
find "$PKG/app" -type f -exec chmod 644 {} +
find "$PKG/app" -type d -exec chmod 755 {} +

# 打包（保留权限与相对路径）
mkdir -p "$ROOT/dist"
rm -f "$OUT"
tar -czf "$OUT" -C "$STAGE" ThreeGrubs-linux-x64

echo "打包完成：$OUT"
echo "大小：$(du -h "$OUT" | cut -f1)"
echo "--- 内容（前 12 项）---"
tar -tvf "$OUT" > "$STAGE/list.txt"
head -12 "$STAGE/list.txt"
