# dsh-plugin-hub

dsh web 的「插件集」面板：侧栏**默认只放一个入口**，各插件的面板收进坞里**纵向堆叠**、点开即用；某个插件要不要在侧栏单独露出入口，由你在面板里逐个开关。

## 为什么需要它

- dsh 的 `sidebar.footer.action` 槽位是 **`display:flex`（水平、不换行）** —— 插件一多就互相挤压，文字会被压成竖排；
- `sidebar.settings` 是**单例槽位**，已被官方「设置」占用，无法再挂第二个；
- 于是把多个入口**收进一个坞（dock）**，坞内部纵向排列 —— 不再互挤，新增插件自动往上叠。

## 能力

- **侧栏插件坞**：默认只有「插件集」一项；注册进来的插件**默认不占侧栏**，在面板里打开它的「侧栏」开关后才出现在坞里（纵向排列，`order` 越小越靠上，状态存 localStorage）
- **面板**：左侧【功能面板】+【已装插件】，右侧渲染选中项
- **已装插件清单**：列出版本、是否声明 `dsh.bundle`、是否带客户端界面、安装形式（符号链接/常规）
- 每个功能页外套 **ErrorBoundary** —— 单个插件面板崩溃不会带崩整个「插件集」

## 注册契约（软依赖，任何插件都能挂上来）

```js
const hub = window.__DSH_PLUGIN_HUB__;
if (hub && typeof hub.register === "function") {
  hub.register({
    id: "my-plugin",
    title: "我的面板",
    icon: "🔧",
    order: 50,      // 越小越靠上
    dock: true,     // 允许进侧栏插件坞（仍需用户在面板里打开「侧栏」开关，默认关）
    render: () => React.createElement(MyPanel)   // 面板内容
  });
}
```

### 侧栏入口开关（registry v2）

```js
hub.sidebarOn("my-plugin")            // 当前是否在侧栏显示独立入口（默认 false）
hub.setSidebarOn("my-plugin", true)   // 打开/关闭：写 localStorage 并通知所有订阅者
hub.subscribe(fn)                     // 订阅变化，返回取消函数
```

设计取向：**侧栏默认只留「插件集」一个入口**，插件一多也不会把底栏挤变形；需要常驻哪个插件的入口，用户自己在面板里点开。

**hub 未安装时，各插件仍能独立工作**（软依赖 + 优雅降级）—— 插件会退回自己的 `sidebar.footer.action` 入口，功能不丢。

## 安装与运行（macOS / Linux / Windows）

### 1. dsh 本体（三平台一致）

需要 Node.js 22+：

```bash
npm i -g @deepseek-ai/dsh
dsh --version
```

### 2. 装这个插件（三平台一致）

```bash
dsh plugin --profile web add github:zzdhsxk/dsh-plugin-hub
```

该命令在 profile 目录里执行 `pnpm add`，并自动把声明了 `dsh.bundle` 的依赖同步进 `dsh.profile.bundles`。

### 3. 启动与守护（三平台同一组命令）

```bash
dsh-daemon install      # 注册开机自启 + 每 30s 探活自愈（macOS→LaunchAgent，Linux→systemd user，Windows→VBS + 任务计划）
dsh-daemon status       # 守护与 web 健康状态
dsh-daemon restart      # 重启 web 让新插件生效（会中断当前会话，先确认没在跑任务）
dsh-daemon stop         # 暂停守护并停掉 web
dsh-daemon uninstall    # 卸载守护
```

> 插件的界面代码在 dsh web 启动时载入内存，所以**装完/改完必须重启 web** 才会生效；只刷新页面不够。

### 4. 不装守护、临时前台跑（三平台一致）

```bash
dsh web --port 3080 --no-open
```

⚠️ **不要写 `--host 0.0.0.0`** —— dsh 出于安全考虑会**主动拒绝**（它会把远程代码执行能力暴露到网络上），并提示改用 `127.0.0.1`。需要跨机访问请用 SSH 隧道或反向代理，并把来源加进 `--trusted-host`。

### 平台差异一览

| 平台 | 命令 | dsh 数据目录 | 守护落地 |
|------|------|--------------|----------|
| macOS | 全部同上 | `~/.dsh` | `~/Library/LaunchAgents/com.deepseek-ai.dsh-watchdog.plist` |
| Linux | 全部同上 | `~/.dsh` | systemd user 服务（无 systemd 时退化为 cron） |
| Windows | 全部同上（PowerShell / cmd 均可） | `%USERPROFILE%\.dsh` | 任务计划程序（VBS 启动脚本） |

### 5. Docker 运行（可选，自建镜像）

官方没有现成镜像，用 Node 官方镜像自建即可。

⚠️ **容器里同样不能用 `--host 0.0.0.0`** —— dsh 会直接拒绝并退出（它会把远程代码执行能力暴露到网络上）。正确做法是：**让 dsh 只监听 `127.0.0.1`，再用 socat 把端口转到容器外**，最后由 `-p` 映射给宿主。

`Dockerfile`：

```dockerfile
FROM node:22-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends socat \
 && rm -rf /var/lib/apt/lists/* \
 && npm i -g @deepseek-ai/dsh
EXPOSE 3080
# 转发 0.0.0.0:3080 -> 127.0.0.1:13080（dsh 只肯监听回环地址）
CMD ["bash","-lc","socat TCP-LISTEN:3080,fork,reuseaddr TCP:127.0.0.1:13080 & exec dsh web --port 13080 --no-open"]
```

构建并运行（三个平台一致）：

```bash
docker build -t dsh-web .
docker run -d --name dsh-web -p 3080:3080 -v "$HOME/.dsh:/root/.dsh" dsh-web
```

Windows 的差别只在**挂载路径写法**：

```powershell
# PowerShell
docker run -d --name dsh-web -p 3080:3080 -v "$env:USERPROFILE\.dsh:/root/.dsh" dsh-web
```

```bat
REM cmd.exe
docker run -d --name dsh-web -p 3080:3080 -v "%USERPROFILE%\.dsh:/root/.dsh" dsh-web
```

首次访问需要带认证的 URL（token 由 dsh 启动时打印）：

```bash
docker logs dsh-web 2>&1 | grep -o "http://[^ ]*token[^ ]*"
```

> Linux 上还可以直接用 `--network host`，省掉 socat（容器与宿主共用网络栈）；
> Docker Desktop for macOS / Windows 需要先在设置里启用 host networking 才支持 `--network host`。
> 想改端口就同时改 `-p`、`--port` 与 socat 里的两个端口号。

## HTTP API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/plugin-hub/api/plugins` | 已装插件清单（版本 / bundle / 客户端界面 / 安装形式）|
| GET | `/plugin-hub/api/info` | hub 版本与注册契约 |

## 目录结构

```
lib/index.js     host 侧：读 profile 的 package.json + node_modules 探测
lib/client.js    client 侧：插件坞 + 左右分栏面板 + 全局注册表
cordis.patch.yml bundle 声明
```

## 许可

MIT
