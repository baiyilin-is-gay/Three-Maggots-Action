# Linux 版

游戏本体是纯静态网页，Linux 版就是一个**自包含启动器 + 游戏文件**的压缩包，
用系统里的浏览器以无边框应用窗口打开。不需要 Electron、不需要联网、不用安装依赖。

发行包：`dist/ThreeGrubs-linux-x64.tar.gz`（约 104 KB，含全部游戏文件）

## 系统要求

- 64 位 Linux（x86_64 / ARM64 都能跑，包里没有二进制程序）
- 任意 Chromium 内核浏览器：**Chrome / Chromium / Edge / Brave / Vivaldi / Opera**
- 或者 Firefox（会以普通窗口打开，`file://` 下的存档行为因版本而异，**推荐 Chromium**）

## 快速开始

```bash
tar -xzf ThreeGrubs-linux-x64.tar.gz
cd ThreeGrubs-linux-x64
chmod +x ThreeGrubs          # 解压工具如果丢了执行位
./ThreeGrubs
```

第一次启动会用独立配置目录建一个 profile，之后双击/命令启动都是秒开。

## 安装到应用菜单 / 命令行

```bash
./install.sh
```

会做这些事：

- 复制到 `~/.local/share/ThreeGrubs`
- 在 `~/.local/bin/ThreeGrubs` 生成转发脚本
- 写入 `~/.local/share/applications/ThreeGrubs.desktop`（应用菜单里出现「三个蛆行动」）
- 安装图标到 `~/.local/share/icons/hicolor/256x256/apps/`

如果 `~/.local/bin` 不在 PATH 里，按提示在 `~/.bashrc` 加：

```bash
export PATH="$HOME/.local/bin:$PATH"
```

## 全屏

- 游戏内按 `Alt+Enter`，或点行动界面右侧的「全屏」按钮
- 启动即全屏：

```bash
./ThreeGrubs --fullscreen
```

## 存档位置

```
~/.local/share/ThreeGrubs/profile
```

也可以用环境变量指定到别的盘/目录：

```bash
THREEGRUBS_DATA=/mnt/games/ThreeGrubs ./ThreeGrubs
```

这是独立的浏览器配置目录，和日常用的 Chrome/Chromium 互不影响。
备份或换机器时整个目录拷走即可。

## 卸载

```bash
./uninstall.sh           # 移除命令与桌面项，保留程序与存档
./uninstall.sh --purge   # 连程序与存档一起删除
```

## 自己构建

需要 `bash`、`tar`、`coreutils`（Linux 自带；Windows 用 Git Bash 也行）：

```bash
python build/make-icon.py     # 生成图标（需要 Pillow，仅首次/改图标时）
bash build/build-linux.sh     # 输出 dist/ThreeGrubs-linux-x64.tar.gz
```

包内结构：

```
ThreeGrubs-linux-x64/
├── ThreeGrubs            启动器（bash，755）
├── ThreeGrubs.desktop    便携桌面项
├── ThreeGrubs.png        图标
├── install.sh / uninstall.sh
├── README.txt
└── app/                  游戏文件（index.html / css / js / 图标）
```

## 可选：打成 AppImage / .deb

发行包已经能直接跑；想要单文件或系统包，在 Linux 上再包一层：

**AppImage**

```bash
mkdir -p AppDir/usr/bin
cp -a ThreeGrubs-linux-x64/* AppDir/usr/bin/
cat > AppDir/AppRun <<'EOF'
#!/bin/sh
exec "$APPDIR/usr/bin/ThreeGrubs" "$@"
EOF
chmod +x AppDir/AppRun
sed 's|^Exec=.*|Exec=ThreeGrubs|' AppDir/usr/bin/ThreeGrubs.desktop > AppDir/ThreeGrubs.desktop
cp AppDir/usr/bin/ThreeGrubs.png AppDir/ThreeGrubs.png
appimagetool AppDir ThreeGrubs-x86_64.AppImage
```

**deb**

```bash
mkdir -p pkg/DEBIAN pkg/opt/ThreeGrubs pkg/usr/share/applications pkg/usr/bin
cp -a ThreeGrubs-linux-x64/* pkg/opt/ThreeGrubs/
ln -s /opt/ThreeGrubs/ThreeGrubs pkg/usr/bin/ThreeGrubs
cat > pkg/DEBIAN/control <<'EOF'
Package: threegrubs
Version: 1.0.0
Section: games
Priority: optional
Architecture: all
Description: Operation Three Grubs - 2D solo extraction shooter
EOF
dpkg-deb --build pkg ThreeGrubs_1.0.0_all.deb
```

## 常见问题

| 现象 | 说明 |
| --- | --- |
| `没有找到可用的浏览器` | 安装 `chromium`：`sudo apt install chromium` / `sudo dnf install chromium` / `sudo pacman -S chromium` |
| 以 root 运行报沙箱错误 | 启动器检测到 root 会自动追加 `--no-sandbox`，仍建议用普通用户运行 |
| 双击 `.desktop` 没反应 | 多数文件管理器需要先「允许启动 / Allow Launching」；或直接运行 `./ThreeGrubs` |
| 远程 SSH 里打不开窗口 | 需要 X11/Wayland 图形会话；纯终端无法显示 |
| 存档没了 | 存档在 `~/.local/share/ThreeGrubs/profile`；清缓存或换用户会丢，属于浏览器存储的正常行为 |
| 想用 Firefox | 可以，但只能普通窗口打开；`file://` 存储策略各版本不同，建议装 Chromium |
| 图标不显示 | 安装后注销重新登录，或运行 `gtk-update-icon-cache -f -t ~/.local/share/icons/hicolor` |

## 与 Windows 版的区别

| | Windows | Linux |
| --- | --- | --- |
| 形式 | 单文件 `ThreeGrubs.exe`（内嵌游戏） | `tar.gz` 包 + bash 启动器 |
| 解压位置 | `%LOCALAPPDATA%\ThreeGrubs\app` | 原地运行，无解压 |
| 存档 | `%LOCALAPPDATA%\ThreeGrubs\profile` | `~/.local/share/ThreeGrubs/profile` |
| 依赖 | Edge / Chrome | Chromium 内核浏览器或 Firefox |
