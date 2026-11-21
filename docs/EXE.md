# Windows 可执行版（ThreeGrubs.exe）

不想装环境、不想开浏览器地址栏？直接用打包好的 **`dist\ThreeGrubs.exe`**。

> Linux 用户请见 [LINUX.md](LINUX.md)（`dist/ThreeGrubs-linux-x64.tar.gz`）。

## 怎么用

1. 双击 `ThreeGrubs.exe`。
2. 首次启动会在 exe 旁边创建 `ThreeGrubs-data\`（含 `app\` 游戏文件与 `profile\` 存档），
   然后用系统里的 **Edge / Chrome** 以无边框应用窗口打开。
3. 之后每次双击都是秒开；更新 exe 后会自动重新解压（版本号 = 游戏文件内容哈希）。

### 数据放哪（便携模式）

默认 **跟着 exe 走**，不写 C 盘：

```
ThreeGrubs.exe
ThreeGrubs-data\
├── app\        解压出来的游戏文件（约 0.3 MB）
└── profile\    浏览器存档配置（含 localStorage 存档）
```

- 把 `ThreeGrubs.exe` 和 `ThreeGrubs-data` 一起拷到别的盘/电脑，存档跟着走
- 如果 exe 所在目录不可写（例如放在 Program Files），自动回退到 `%LOCALAPPDATA%\ThreeGrubs`
- 想指定位置：

```powershell
ThreeGrubs.exe --data-dir="D:\Games\ThreeGrubs"
# 或设置环境变量
$env:THREEGRUBS_DATA = "D:\Games\ThreeGrubs"
ThreeGrubs.exe
```

- 从旧版升级：如果新位置还没有数据，会自动把 `%LOCALAPPDATA%\ThreeGrubs` 复制过来
- 完全卸载：删除 `ThreeGrubs.exe` 和 `ThreeGrubs-data` 文件夹即可

> **SmartScreen 提示**：exe 未做代码签名，首次运行可能出现「Windows 已保护你的电脑」。
> 点 **更多信息 → 仍要运行** 即可；这是未签名程序的正常提示，不是报错。

## 全屏

- 游戏内：行动界面右侧的「全屏」按钮，或按 `Alt+Enter`
- 启动即全屏：`ThreeGrubs.exe --fullscreen`
- 也可以按 `F11`（浏览器级全屏）

> 高分屏（Windows 125% / 150% 缩放）下如果画面右侧出现拉伸残影，是旧版本没有按 DPI 缩放导致的；
> 本版本已修复，更新 exe 即可。

## 自己重新构建

只需要 Windows 自带的 .NET Framework（`csc.exe`），**不用装 SDK**：

```powershell
powershell -ExecutionPolicy Bypass -File build\build-exe.ps1
```

产物：`dist\ThreeGrubs.exe`（约 0.3 MB，游戏文件全部内嵌）。

构建做了什么：

1. 收集运行时文件：`index.html`、`favicon.svg`、`favicon.ico`、`css/*`、`js/*`
2. 按文件内容算出版本哈希，生成 `build/BuildInfo.g.cs`
3. 用 `csc` 把每个文件和 `build/launcher.cs` 一起编译，`/win32icon:build/app.ico` 写入图标
4. 输出到 `dist/ThreeGrubs.exe`

图标可以用 `build/make-icon.py` 重新生成（需要 Pillow）。

### 启动器逻辑（`build/launcher.cs`）

- 首次运行把内嵌资源解压到 `%LOCALAPPDATA%\ThreeGrubs\app`
- 依次查找 Edge / Chrome 的安装路径，用
  `--app=file:///.../index.html --user-data-dir=...\profile --window-size=1440,900`
  打开
- 启动器本身启动后立即退出，不驻留后台
- 找不到浏览器时用默认浏览器打开 `index.html`
- 出错弹窗提示，并给出手动打开路径

## 上传 exe 到 GitHub（三种方式）

### 方式 A：Releases（推荐，专门放安装包）

exe 属于二进制文件，GitHub 的 **Releases** 就是干这个的：有独立下载页、下载统计、固定「最新版」链接。

1. 先把最新代码推上去（**exe 已经在仓库里**，push 会一起上传）：
   ```powershell
   cd /d D:\FFFFFFF
   git add -A
   git commit -m "release: v1.0.0"
   git push
   ```
2. 打开仓库页面 → 右侧 **Releases** → **Create a new release**（地址可直接访问 `https://github.com/<用户名>/<仓库>/releases/new`）
3. **Choose a tag** 输入 `v1.0.0` → 点 **Create new tag on publish**
4. **Release title** 填 `三个蛆行动 v1.0.0`
5. 在 **Attach binaries by dropping them here or selecting them** 区域，把 `dist\ThreeGrubs.exe` 拖进去
6. 点 **Publish release**

下载链接（资产名必须一致）：

```
https://github.com/<用户名>/<仓库>/releases/latest/download/ThreeGrubs.exe
```

把这个链接贴到 README 顶部，别人点开就是最新版下载。

### 固定下载链接是怎么来的

这条链接**不是手动创建的**，是 GitHub 的固定规则：

| 片段 | 含义 |
| --- | --- |
| `<用户名>/<仓库>` | 换成你自己的，例如 `grub-fan/three-grubs` |
| `releases/latest` | 该仓库**最新一个已发布、非预发布**的 Release |
| `download/ThreeGrubs.exe` | 这个 Release 里**文件名完全一致**的附件 |

GitHub 收到请求会自动 302 跳转到真实的文件地址（`objects.githubusercontent.com`）。

**生效需要同时满足三个条件：**

1. 仓库至少有一个 **Published** 的 Release（草稿 Draft 和预发布 Pre-release 都不算）
2. 该 Release 的附件名必须是 `ThreeGrubs.exe`（大小写一致，不能用「三个蛆行动.exe」）
3. 仓库是公开的（私有仓库需要登录且有权限才能下载）

**怎么拿到自己仓库的真实链接：**

1. 先看仓库地址：`https://github.com/你的用户名/你的仓库名`
2. 拼出：`https://github.com/你的用户名/你的仓库名/releases/latest/download/ThreeGrubs.exe`
3. 或者：Release 页面里右键附件 → 复制链接，会得到带版本号的
   `.../releases/download/v1.0.0/ThreeGrubs.exe`；把 `releases/download/v1.0.0` 换成
   `releases/latest/download`，就是「永远指向最新版」的固定链接。

**验证（Windows 自带 curl）：**

```powershell
curl.exe -I "https://github.com/<用户名>/<仓库>/releases/latest/download/ThreeGrubs.exe"
```

看到 `302` 且 `Location:` 指向 `objects.githubusercontent.com` 就说明配置正确；
看到 `404` 见下面的排查表。

| 现象 | 原因 |
| --- | --- |
| 404 | 还没有已发布的 Release；或附件名不是 `ThreeGrubs.exe`；或 Release 是草稿/预发布 |
| 404（私有仓库） | 未登录或没有仓库权限 |
| 下载到旧版 | `latest` 指向最新 Release，但新 Release 没传附件；**每个新 Release 都要重新拖一次同名 exe** |
| 链接里中文变乱码 | 附件名用了中文，URL 会百分号编码；建议附件名统一用 `ThreeGrubs.exe` |

> 小技巧：发新版时不用改 README 里的链接——只要新 Release 的附件名还是 `ThreeGrubs.exe`，
> `latest` 链接就自动指向它。

### 方式 B：网页直接上传到仓库（不想用命令行）

1. 仓库首页 → **Add file → Upload files**
2. 把 `dist\ThreeGrubs.exe` 拖进去 → 底部 **Commit changes**
3. 之后在仓库文件页点开它，右上角有 **Download** 按钮

限制：网页上传单文件 25 MB、Git 单文件 100 MB。本项目 exe 只有 0.32 MB，完全没问题。

> 注意：仓库里同时存在 `dist/ThreeGrubs.exe` 和 Release 里同名的资产会重复占空间，
> 只选一种作为正式下载入口即可；推荐网页版仓库里保留，正式发布走 Releases。

### 方式 C：什么也不做（已经在仓库里）

`dist/ThreeGrubs.exe` 从第 6 个提交起就已经在仓库里了。只要你执行过 `git push`，
它就已经在 GitHub 上，不需要再单独「上传」一次。

<!-- 下面是原 Releases 说明，保留作细节参考 -->

## 发布到 GitHub Releases（细节）

1. 本地构建：`dist\ThreeGrubs.exe`
2. GitHub 仓库 → 右侧 **Releases → Create a new release**
3. Tag 填 `v1.0.0`，标题写版本名
4. **Attach binaries** 把 `ThreeGrubs.exe` 拖进去
5. Publish
6. 在 README 里加上下载链接：

```markdown
[下载 Windows 版](https://github.com/<用户名>/<仓库名>/releases/latest/download/ThreeGrubs.exe)
```

> 仓库里的 `dist/ThreeGrubs.exe` 是方便直接取用的副本；如果你不想把二进制放进 Git 历史，
> 可以把 `dist/` 加进 `.gitignore`，只通过 Releases 分发。

## 常见问题

| 现象 | 说明 |
| --- | --- |
| 双击没反应 | 可能被杀毒软件静默拦截；把 exe 加白名单，或改用 `index.html` 网页版 |
| 打开是普通浏览器标签页 | 系统里没找到 Edge/Chrome 的常见路径，退回默认浏览器；用网页版体验一致 |
| 窗口太小/太大 | 改 `build/launcher.cs` 里的 `--window-size=1440,900` 后重新构建 |
| 存档想搬走 | 复制 `ThreeGrubs-data` 整个目录即可（或连 exe 一起搬） |
| 更新后存档还在吗 | 在。解压只覆盖 `app\`，不动 `profile\` |
| 想放 D 盘 | 把 exe 放到 D 盘即可；或用 `--data-dir=D:\...` 指定 |
