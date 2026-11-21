《三个蛆行动》 Linux 版
========================

需要：Chromium 内核浏览器（Chrome / Chromium / Edge / Brave / Vivaldi 任一），
      或者 Firefox（会用普通窗口打开）。

直接运行
--------
  chmod +x ThreeGrubs      # 解压工具若丢了执行位，补一下
  ./ThreeGrubs

安装到应用菜单 / 命令行
------------------------
  ./install.sh

卸载
----
  ./uninstall.sh           # 移除命令与桌面项，保留程序与存档
  ./uninstall.sh --purge   # 连程序与存档一起删除

存档位置
--------
  ~/.local/share/ThreeGrubs/profile

说明
----
启动器用浏览器的「应用窗口」模式打开本地 index.html：
  - 不需要联网，不需要 Electron
  - 存档在独立浏览器配置目录里，不影响日常浏览器
  - 如果系统里没有浏览器，按提示安装 chromium 即可

已知限制
--------
  - 以 root 运行时自动加 --no-sandbox
  - 没有图形界面（纯 SSH）时无法打开窗口
  - Firefox 只能普通窗口打开，且 file:// 下存档行为因版本而异，
    推荐安装 Chromium 内核浏览器
