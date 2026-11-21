# =========================================================
#  构建单文件 Windows 启动器：dist\ThreeGrubs.exe
#  用法：pwsh -File build\build-exe.ps1
#  依赖：Windows 自带的 .NET Framework csc.exe（无需安装 SDK）
# =========================================================
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$build = $PSScriptRoot
$dist = Join-Path $root 'dist'
$csc = @(
  'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe',
  'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $csc) { throw '找不到 csc.exe（需要 .NET Framework 4.x）' }

# 参与打包的游戏文件（相对项目根目录）
$files = @('index.html', 'favicon.svg', 'favicon.ico')
$files += Get-ChildItem (Join-Path $root 'css') -File | ForEach-Object { 'css/' + $_.Name }
$files += Get-ChildItem (Join-Path $root 'js') -File | ForEach-Object { 'js/' + $_.Name }

# 版本号 = 全部文件内容的 SHA256 前 12 位（内容一变就重新解压）
$sb = New-Object System.Text.StringBuilder
foreach ($f in $files) {
  $p = Join-Path $root ($f -replace '/', '\')
  $h = (Get-FileHash $p -Algorithm SHA256).Hash
  [void]$sb.Append($f).Append(':').Append($h).Append("`n")
}
$sha = [System.Security.Cryptography.SHA256]::Create()
$version = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($sb.ToString())))).Replace('-', '').Substring(0, 12)
Write-Host "打包版本：$version"

# 生成 BuildInfo.g.cs
$list = ($files | ForEach-Object { '        "' + $_ + '",' }) -join "`n"
$code = @"
// 由 build-exe.ps1 自动生成，请勿手改
static class BuildInfo
{
    public const string Version = "$version";
    public static readonly string[] Files = new string[]
    {
$list
    };
}
"@
$infoPath = Join-Path $build 'BuildInfo.g.cs'
[IO.File]::WriteAllText($infoPath, $code, (New-Object Text.UTF8Encoding $false))

# 编译
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$resArgs = $files | ForEach-Object {
  $abs = Join-Path $root ($_ -replace '/', '\')
  $name = 'Game.' + ($_ -replace '[/\\]', '.')
  '/resource:"' + $abs + '",' + $name
}
$out = Join-Path $dist 'ThreeGrubs.exe'
$args = @(
  '/nologo', '/target:winexe', '/optimize+', '/platform:anycpu',
  ('/win32icon:"' + (Join-Path $build 'app.ico') + '"'),
  ('/out:"' + $out + '"'),
  '/r:System.Windows.Forms.dll',
  ('"' + (Join-Path $build 'launcher.cs') + '"'),
  ('"' + $infoPath + '"')
) + $resArgs

Write-Host "编译中…"
& $csc @args
if ($LASTEXITCODE -ne 0) { throw "编译失败（csc 退出码 $LASTEXITCODE）" }
if (-not (Test-Path $out)) { throw '未生成 exe' }

$size = [math]::Round((Get-Item $out).Length / 1MB, 2)
Write-Host "完成：$out（$size MB）"
