# dsh-plugin-hub

dsh web 的「插件集」面板：侧栏**一个入口**，内部把各插件的面板与入口**纵向堆叠**，点开即用。

## 为什么需要它

- dsh 的 `sidebar.footer.action` 槽位是 **`display:flex`（水平、不换行）** —— 插件一多就互相挤压，文字会被压成竖排；
- `sidebar.settings` 是**单例槽位**，已被官方「设置」占用，无法再挂第二个；
- 于是把多个入口**收进一个坞（dock）**，坞内部纵向排列 —— 不再互挤，新增插件自动往上叠。

## 能力

- **侧栏插件坞**：插件集 + 各插件注册的入口（纵向排列，`order` 越小越靠上）
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
    dock: true,     // 是否出现在侧栏插件坞
    render: () => React.createElement(MyPanel)   // 面板内容
  });
}
```

**hub 未安装时，各插件仍能独立工作**（软依赖 + 优雅降级）—— 这也是本插件不改动别人代码就能接入的原因。

## 安装

```bash
dsh plugin --profile web add github:<owner>/dsh-plugin-hub
dsh-daemon restart
```

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
