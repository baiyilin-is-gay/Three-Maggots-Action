# 上架 GitHub 教程（含免费网页版）

> 目标：把《三个蛆行动》放到 GitHub，得到一个**能直接分享给朋友玩的网址**。
> 全程免费，不需要服务器、不需要域名、不需要备案。
>
> 本项目已初始化好 Git 仓库并完成首次提交，`.gitignore`、`.gitattributes`、`LICENSE`、`.nojekyll`、`favicon.svg` 都已就位。
> **你只需要做第 3 步（关联远程仓库）→ 第 4 步（认证）→ 第 5 步（推送）→ 第 6 步（开 Pages）。**

## 懒人版（三行命令）

在 GitHub 网页建好空仓库后，直接：

```powershell
cd /d D:\FFFFFFF
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main        # 用户名填 GitHub 名，密码粘贴 PAT
```

推送成功后：仓库 **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**，
等 1–3 分钟即可访问 `https://<你的用户名>.github.io/<仓库名>/`。

下面是从装 Git 到排错的完整说明。

---

## 0. 最终效果

- 源码仓库：`https://github.com/<你的用户名>/three-grubs`
- 在线试玩：`https://<你的用户名>.github.io/three-grubs/`

仓库名可以自己换（建议全小写英文、用 `-` 连接），**网页地址会跟着变**。

---

## 1. 准备：账号与 Git

1. 注册 GitHub：<https://github.com/signup>（需要邮箱验证）。
2. 安装 Git for Windows：<https://git-scm.com/download/win>，一路默认下一步即可。
3. 打开 **PowerShell**（或 Git Bash），验证：

```powershell
git --version
# 应输出类似 git version 2.5x
```

4. 配置提交身份（只需一次，名字会显示在提交记录里）：

```powershell
git config --global user.name "你的名字或昵称"
git config --global user.email "你的GitHub邮箱"
```

> 不想暴露真实邮箱？GitHub → Settings → Emails → 勾选 *Keep my email addresses private*，
> 用它给出的 `xxxxx+用户名@users.noreply.github.com` 作为邮箱。

---

## 2. 在网页上创建空仓库

1. 登录 GitHub，右上角 **+ → New repository**。
2. 填写：
   - **Repository name**：`three-grubs`（或你喜欢的名字）
   - **Description**：`《三个蛆行动》—— 2D 俯视角单人搜打撤网页游戏（致敬三角洲行动）`
   - **Public**（公开；免费版 Pages 只对公开仓库开放）
   - **不要**勾选 *Add a README file*、*Add .gitignore*、*Choose a license*（本地已有）
3. 点 **Create repository**，页面会显示仓库地址，记下：
   `https://github.com/<你的用户名>/three-grubs.git`

---

## 3. 关联本地仓库

本项目已经是一个提交好的 Git 仓库（`main` 分支）。进入项目目录，把远程地址换成你自己的：

```powershell
cd /d D:\FFFFFFF

# 如果之前没有远程，直接添加
git remote add origin https://github.com/<你的用户名>/three-grubs.git

# 如果已经存在 origin（重复执行过），改成 set-url
git remote set-url origin https://github.com/<你的用户名>/three-grubs.git

# 确认
git remote -v
```

---

## 4. 认证：HTTPS + Token（推荐新手）

GitHub **不再接受账号密码**，推送时必须用 **Personal Access Token（PAT）** 代替密码。

1. GitHub → 右上角头像 → **Settings**。
2. 左侧最下 **Developer settings** → **Personal access tokens** → **Tokens (classic)**。
3. **Generate new token (classic)**：
   - Note：`three-grubs push`
   - Expiration：90 天（到期再生成一个即可）
   - Scopes：勾选 **`repo`**（整块）
4. **Generate token**，立刻复制那串 `ghp_...`（只显示一次，关掉就没了）。
5. 回到终端执行推送：

```powershell
git push -u origin main
```

弹出登录窗口时：

- Username：你的 GitHub 用户名
- Password：**粘贴 Token**（不是账号密码）

Windows 会把它存进「凭据管理器」，下次不用再输。

### 备选：SSH（一次配置，长期免密）

```powershell
ssh-keygen -t ed25519 -C "你的邮箱"      # 一路回车，默认路径
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub | Set-Clipboard
```

复制内容 → GitHub → **Settings → SSH and GPG keys → New SSH key** → 粘贴保存。然后：

```powershell
ssh -T git@github.com                      # 看到 successfully authenticated 即成功
git remote set-url origin git@github.com:<你的用户名>/three-grubs.git
git push -u origin main
```

---

## 5. 推送

```powershell
git push -u origin main
```

成功后刷新仓库页面，应能看到 `index.html`、`js/`、`css/`、`docs/`、`README.md`。

之后每次改动只需要三条命令：

```powershell
git add -A
git commit -m "fix: 修了巢母血量"
git push
```

---

## 6. 开启 GitHub Pages（关键一步）

1. 打开仓库 → 顶部 **Settings**。
2. 左侧 **Pages**。
3. **Build and deployment → Source** 选 **Deploy from a branch**。
4. **Branch** 选 **`main`**，目录选 **`/ (root)`**，点 **Save**。
5. 等 1–3 分钟，刷新 Pages 页面，顶部会出现：
   `Your site is live at https://<你的用户名>.github.io/three-grubs/`
6. 打开这个网址，游戏就能直接玩了（手机打开也行，但本作需要键鼠）。

> 本项目是纯静态 HTML/CSS/JS，全部使用**相对路径**，放在仓库根目录即可被 Pages 正确加载；
> 已附带 `.nojekyll`，避免 GitHub 的 Jekyll 处理干扰。

---

## 7. 以后更新游戏

改完本地文件后：

```powershell
git add -A
git commit -m "feat: 新增一张地图"
git push
```

Pages 会自动重新构建，约 1 分钟后线上就是新版（浏览器记得 `Ctrl+F5` 强刷）。

---

## 8. 让仓库更体面（可选）

- **About 简介 + 话题标签**：仓库首页右侧齿轮 → Description 填一句话，Topics 填
  `game` `canvas` `javascript` `roguelike` `extraction-shooter` `html5-game` `chinese`。
- **社交预览图**：Settings → General → Social preview → 上传 `docs/assets/title.png`。
- **打版本标签**：右侧 Releases → *Create a new release* → Tag `v1.0.0` → 标题/说明 → **把 `dist/ThreeGrubs.exe` 和 `dist/ThreeGrubs-linux-x64.tar.gz` 一起拖进附件** → Publish。
  这样别人点开仓库的 Releases 就能直接下载 Windows / Linux 版；构建与发布细节见 [EXE.md](EXE.md) 与 [LINUX.md](LINUX.md)。
- **README 加上线徽章**：把下面两行贴到 `README.md` 顶部（替换用户名和仓库名）：

```markdown
[![在线试玩](https://img.shields.io/badge/%E5%9C%A8%E7%BA%BF%E8%AF%95%E7%8E%A9-Play-9ad42f)](https://<你的用户名>.github.io/three-grubs/)
[![GitHub stars](https://img.shields.io/github/stars/<你的用户名>/three-grubs?style=social)](https://github.com/<你的用户名>/three-grubs)
```

- **许可证署名**：`LICENSE` 目前写的是「三个蛆行动」，可改成你的名字或昵称。

---

## 9. 常见问题

| 现象 | 原因与解决 |
| --- | --- |
| `Authentication failed` / 403 | GitHub 不收账号密码，改用 PAT（勾 `repo`）或换成 SSH。 |
| `remote: Repository not found` | 仓库名或用户名拼错；或 token 没勾 `repo`；私有仓库需要权限。 |
| `src refspec main does not match any` | 还没提交过：`git add -A && git commit -m "init"`。 |
| `error: remote origin already exists` | 用 `git remote set-url origin <地址>` 改地址。 |
| Pages 打不开 / 404 | 等 1–3 分钟；确认 Settings→Pages 里分支是 `main`、目录是 `/ (root)`；确认 `index.html` 在仓库根目录。 |
| 页面白屏、控制台 404 | 打开 F12 看缺哪个文件；本项目路径全为相对路径，**不要**把 `index.html` 挪进子目录。 |
| 游戏存档没了 | 存档存在浏览器 `localStorage`，按「域名」隔离；换设备/清缓存/换网址都会丢，属正常现象。 |
| 修改文件名大小写没生效 | Windows 不区分大小写、GitHub 区分，需要借助 `git mv` 改名后再提交。 |
| 仓库太大 | 当前约 2.6 MB，远低于限制（单文件 100 MB、仓库建议 <1 GB）。 |

---

## 10. 命令速查

```powershell
# 一次性
cd /d D:\FFFFFFF
git remote add origin https://github.com/<用户名>/<仓库>.git
git push -u origin main

# 日常更新
git status                  # 看改了哪些文件
git add -A                  # 全部暂存
git commit -m "说明"        # 提交
git push                    # 推送

# 查看与回退
git log --oneline -5        # 最近 5 条提交
git diff                    # 未暂存的改动
git restore <文件>          # 丢弃某个文件的修改
```

---

## 11. 我已经替你做了什么

- `git init -b main` + 首次提交（含全部源码与截图）
- `.gitignore`：忽略系统垃圾文件、编辑器目录、依赖与临时测试目录
- `.gitattributes`：统一 LF 换行，避免 Windows 提交产生 CRLF 噪音
- `.nojekyll`：让 Pages 按纯静态站点发布
- `favicon.svg`：站点图标，避免浏览器控制台里的 favicon 404
- `LICENSE`：MIT 开源许可
- 本教程

**你需要做的只有三件事：**

1. 在 GitHub 建一个空仓库；
2. `git remote add origin ...` 然后 `git push -u origin main`；
3. Settings → Pages → `main` / `/ (root)` → Save。

完成后把 `https://<你的用户名>.github.io/<仓库名>/` 发给朋友就能玩。
