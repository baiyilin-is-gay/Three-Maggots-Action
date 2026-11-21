#!/usr/bin/env bash
# 安装到当前用户：应用菜单 + ~/.local/bin/ThreeGrubs
set -eu

resolve_self() {
  local src="${BASH_SOURCE[0]}" dir
  while [ -L "$src" ]; do
    dir=$(cd -P "$(dirname -- "$src")" && pwd)
    src=$(readlink -- "$src")
    case "$src" in
      /*) ;;
      *) src="$dir/$src" ;;
    esac
  done
  cd -P "$(dirname -- "$src")" && pwd
}
HERE=$(resolve_self)
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
DEST="$DATA/ThreeGrubs"
BIN="$HOME/.local/bin"
APPS="$DATA/applications"
ICONS="$DATA/icons/hicolor/256x256/apps"

mkdir -p "$DEST" "$BIN" "$APPS" "$ICONS"

cp -a "$HERE/ThreeGrubs" "$HERE/app" "$HERE/README.txt" "$DEST/"
if [ -f "$HERE/ThreeGrubs.png" ]; then
  cp -a "$HERE/ThreeGrubs.png" "$DEST/"
  cp -a "$HERE/ThreeGrubs.png" "$ICONS/ThreeGrubs.png"
fi
chmod +x "$DEST/ThreeGrubs"

cat > "$APPS/ThreeGrubs.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=三个蛆行动
Name[en]=Operation Three Grubs
Comment=2D 俯视角单人搜打撤
Comment[en]=Solo top-down extraction shooter
Exec="$DEST/ThreeGrubs"
Icon=$ICONS/ThreeGrubs.png
Terminal=false
Categories=Game;ActionGame;
StartupWMClass=ThreeGrubs
EOF
chmod +x "$APPS/ThreeGrubs.desktop"

# 生成转发脚本（比软链接更稳：不依赖 readlink 解析）
cat > "$BIN/ThreeGrubs" <<EOF
#!/usr/bin/env bash
exec "$DEST/ThreeGrubs" "\$@"
EOF
chmod +x "$BIN/ThreeGrubs"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APPS" >/dev/null 2>&1 || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f -t "$DATA/icons/hicolor" >/dev/null 2>&1 || true
fi

echo "安装完成："
echo "  程序目录：$DEST"
echo "  命令：$BIN/ThreeGrubs"
echo "  桌面项：$APPS/ThreeGrubs.desktop"
echo "  存档：$DEST/profile"
case ":$PATH:" in
  *":$BIN:"*) ;;
  *) echo ""
     echo "提示：$BIN 不在 PATH 中，可在 ~/.bashrc 里加："
     echo '  export PATH="$HOME/.local/bin:$PATH"' ;;
esac
