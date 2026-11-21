// 《三个蛆行动》Windows 启动器
// 单文件自包含：游戏文件以资源形式内嵌。
// 数据目录默认放在 exe 旁边的 ThreeGrubs-data（便携，可整体搬到 D 盘等），
// 也可用 --data-dir=D:\xxx 或环境变量 THREEGRUBS_DATA 指定；
// exe 所在目录不可写时回退到 %LOCALAPPDATA%\ThreeGrubs。
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

static class Program
{
    const string AppName = "ThreeGrubs";

    [STAThread]
    static void Main(string[] args)
    {
        try
        {
            string dataDir = ResolveDataDir(args);
            string appDir = Path.Combine(dataDir, "app");
            string profileDir = Path.Combine(dataDir, "profile");
            string stampFile = Path.Combine(appDir, "version.txt");

            bool extractOnly = false;
            bool fullscreen = false;
            foreach (var a in args)
            {
                if (a == "--extract-only" || a == "--selftest") extractOnly = true;
                if (a == "--fullscreen" || a == "-f") fullscreen = true;
            }

            // 从旧版 %LOCALAPPDATA% 数据目录迁移一次
            MigrateLegacy(dataDir);
            Directory.CreateDirectory(dataDir);

            string version = BuildInfo.Version;
            bool needExtract = !File.Exists(stampFile) ||
                               File.ReadAllText(stampFile).Trim() != version;
            if (needExtract) Extract(appDir, dataDir, version);

            if (extractOnly)
            {
                File.WriteAllText(Path.Combine(Path.GetTempPath(), "threegrubs-extract.txt"), dataDir);
                return;
            }

            string index = Path.Combine(appDir, "index.html");
            if (!File.Exists(index))
                throw new FileNotFoundException("缺少游戏文件 index.html", index);

            Directory.CreateDirectory(profileDir);
            string browser = FindBrowser();
            if (browser != null)
            {
                var psi = new ProcessStartInfo();
                psi.FileName = browser;
                psi.UseShellExecute = false;
                psi.Arguments = string.Format(
                    "--app=\"{0}\" --user-data-dir=\"{1}\" --window-size=1440,900 " +
                    "--no-first-run --no-default-browser-check --disable-sync " +
                    "--disable-features=TranslateUI,msEdgeFirstRunExperience",
                    new Uri(index).AbsoluteUri, profileDir) +
                    (fullscreen ? " --start-fullscreen" : "");
                Process.Start(psi);
            }
            else
            {
                // 没有 Edge/Chrome 时退回默认浏览器
                Process.Start(new ProcessStartInfo(index) { UseShellExecute = true });
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                "启动失败：\n" + ex.Message +
                "\n\n你也可以手动打开：\n" + Path.Combine(ResolveDataDir(args), "app") + "\\index.html",
                "三个蛆行动", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    /// <summary>数据目录优先级：--data-dir → 环境变量 → exe 旁便携目录 → %LOCALAPPDATA%</summary>
    static string ResolveDataDir(string[] args)
    {
        foreach (var a in args)
        {
            if (a.StartsWith("--data-dir=", StringComparison.OrdinalIgnoreCase))
            {
                string v = a.Substring("--data-dir=".Length).Trim().Trim('"');
                if (v.Length > 0) return Path.GetFullPath(v);
            }
        }

        string env = Environment.GetEnvironmentVariable("THREEGRUBS_DATA");
        if (!string.IsNullOrWhiteSpace(env)) return Path.GetFullPath(env.Trim().Trim('"'));

        string exeDir = Path.GetDirectoryName(Application.ExecutablePath);
        string portable = Path.Combine(exeDir, "ThreeGrubs-data");
        if (Directory.Exists(portable) || CanWrite(exeDir)) return portable;

        return Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), AppName);
    }

    static bool CanWrite(string dir)
    {
        try
        {
            string probe = Path.Combine(dir, ".threegrubs-write-test");
            using (var fs = File.Create(probe)) { }
            File.Delete(probe);
            return true;
        }
        catch { return false; }
    }

    /// <summary>旧版把数据放在 %LOCALAPPDATA%\ThreeGrubs；新位置为空时复制过去</summary>
    static void MigrateLegacy(string dataDir)
    {
        string legacy = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), AppName);
        try
        {
            string a = Path.GetFullPath(dataDir).TrimEnd('\\');
            string b = Path.GetFullPath(legacy).TrimEnd('\\');
            if (string.Equals(a, b, StringComparison.OrdinalIgnoreCase)) return;
            if (Directory.Exists(dataDir) || !Directory.Exists(legacy)) return;
            CopyDir(legacy, dataDir);
        }
        catch { /* 迁移失败不阻断启动，按空目录继续 */ }
    }

    static void CopyDir(string src, string dst)
    {
        Directory.CreateDirectory(dst);
        foreach (var file in Directory.GetFiles(src))
            File.Copy(file, Path.Combine(dst, Path.GetFileName(file)), true);
        foreach (var dir in Directory.GetDirectories(src))
            CopyDir(dir, Path.Combine(dst, Path.GetFileName(dir)));
    }

    static void Extract(string appDir, string dataDir, string version)
    {
        string tmp = Path.Combine(dataDir, "app.new");
        if (Directory.Exists(tmp)) Directory.Delete(tmp, true);
        Directory.CreateDirectory(tmp);

        Assembly asm = Assembly.GetExecutingAssembly();
        foreach (string rel in BuildInfo.Files)
        {
            string resName = "Game." + rel.Replace('/', '.').Replace('\\', '.');
            using (Stream s = asm.GetManifestResourceStream(resName))
            {
                if (s == null) throw new InvalidOperationException("内置资源缺失：" + resName);
                string dst = Path.GetFullPath(Path.Combine(tmp, rel));
                string dir = Path.GetDirectoryName(dst);
                if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
                using (var fs = File.Create(dst)) s.CopyTo(fs);
            }
        }
        File.WriteAllText(Path.Combine(tmp, "version.txt"), version);

        if (!Directory.Exists(appDir))
        {
            Directory.Move(tmp, appDir);
            return;
        }
        // 原地覆盖，避免删除正在被浏览器占用的文件
        foreach (var f in Directory.GetFiles(tmp, "*", SearchOption.AllDirectories))
        {
            string rel = f.Substring(tmp.Length + 1);
            string dst = Path.Combine(appDir, rel);
            string dir = Path.GetDirectoryName(dst);
            if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
            File.Copy(f, dst, true);
        }
        File.WriteAllText(Path.Combine(appDir, "version.txt"), version);
        try { Directory.Delete(tmp, true); } catch { }
    }

    static string FindBrowser()
    {
        string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

        string[] cands = new string[]
        {
            Path.Combine(pf86, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf,   @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(local, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf,   @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(pf86, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(local, @"Google\Chrome\Application\chrome.exe"),
        };
        foreach (var c in cands)
            if (File.Exists(c)) return c;
        return null;
    }
}
