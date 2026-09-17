/**
 * dsh-plugin-hub — Client half.
 * 侧栏「插件坞」：在 footer 槽位里只占一格，内部把各插件入口【垂直堆叠】（新的在上），
 * 点任一项打开「插件集」面板并定位到对应页。面板左右分栏：功能面板 / 已装插件。
 * 主题：全部使用 dsh 的 --dsw-alias-* 变量，自动跟随浅色/深色。
 * 契约（软依赖）：window.__DSH_PLUGIN_HUB__.register({ id, title, icon, order, render, dock })
 */
window.__ModuleLoader__.load({
  id: "dsh-plugin-hub",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const { useState, useEffect, useCallback } = React;
    const h = React.createElement;
    const API = "/plugin-hub/api";

    const HUB_KEY = "__DSH_PLUGIN_HUB__";
    function ensureRegistry() {
      const existing = typeof window !== "undefined" ? window[HUB_KEY] : null;
      if (existing && typeof existing.register === "function" && existing.version >= 1) return existing;
      const entries = [];
      const listeners = new Set();
      const notify = () => listeners.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
      const api = {
        version: 1,
        register(entry) {
          if (!entry || !entry.id) return function () {};
          const i = entries.findIndex((e) => e.id === entry.id);
          if (i >= 0) entries[i] = entry; else entries.push(entry);
          entries.sort((a, b) => (a.order || 100) - (b.order || 100));
          notify();
          return function () {
            const j = entries.findIndex((e) => e.id === entry.id);
            if (j >= 0) { entries.splice(j, 1); notify(); }
          };
        },
        list() { return entries.slice(); },
        subscribe(fn) { listeners.add(fn); return function () { listeners.delete(fn); }; }
      };
      if (typeof window !== "undefined") window[HUB_KEY] = api;
      return api;
    }
    const hub = ensureRegistry();

    async function apiFetch(path) {
      const res = await fetch(API + path);
      let json = null;
      try { json = await res.json(); } catch (e) { json = null; }
      if (!json) throw new Error("响应不是 JSON（HTTP " + res.status + "）");
      if (!json.ok) throw new Error(json.error || ("HTTP " + res.status));
      return json.result;
    }

    const V = {
      panelBg: "var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-base, #232323))",
      text: "var(--dsw-alias-label-primary, #e8e8e8)",
      textDim: "var(--dsw-alias-label-secondary, rgba(200,200,200,0.75))",
      border: "var(--dsw-alias-border-l2, rgba(128,128,128,0.3))",
      hover: "var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.16))",
      active: "var(--dsw-alias-interactive-bg-active, rgba(120,170,255,0.18))",
      sidebarFill: "var(--dsw-specific-sidebar-fill, transparent)"
    };

    const S = {
      dock: { display: "flex", flexDirection: "column", gap: "1px", flex: "0 0 auto", minWidth: 0 },
      dockItem: { cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", border: "none", borderRadius: "6px", background: "transparent", color: "inherit", padding: "3px 6px", fontSize: "12px", lineHeight: 1.35, whiteSpace: "nowrap", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis" },
      panel: { position: "fixed", right: "16px", bottom: "60px", width: "760px", height: "72vh", zIndex: 2147000000, display: "flex", flexDirection: "column", background: V.panelBg, color: V.text, border: "1px solid " + V.border, borderRadius: "10px", boxShadow: "0 10px 36px var(--dsw-alias-bg-mask-drop, rgba(0,0,0,0.45))", overflow: "hidden", fontSize: "12px" },
      head: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid " + V.border, cursor: "move", userSelect: "none" },
      body: { display: "flex", flex: 1, minHeight: 0 },
      side: { width: "210px", flex: "0 0 210px", borderRight: "1px solid " + V.border, overflowY: "auto", padding: "8px 6px" },
      sideGroup: { fontSize: "10px", color: V.textDim, padding: "6px 8px 3px", letterSpacing: "0.05em" },
      sideItem: (on) => ({ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", padding: "5px 8px", borderRadius: "6px", fontSize: "12px", background: on ? V.active : "transparent", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }),
      main: { flex: 1, minWidth: 0, overflowY: "auto", padding: "12px" },
      btn: { cursor: "pointer", border: "1px solid " + V.border, borderRadius: "6px", background: "transparent", color: "inherit", padding: "2px 8px", fontSize: "11px", whiteSpace: "nowrap" },
      row: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", borderBottom: "1px solid " + V.border },
      grow: { flex: 1, minWidth: 0 },
      meta: { fontSize: "11px", color: V.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
      tag: { fontSize: "10px", padding: "0 5px", borderRadius: "4px", border: "1px solid " + V.border, color: V.textDim, whiteSpace: "nowrap" },
      tagOk: { fontSize: "10px", padding: "0 5px", borderRadius: "4px", border: "1px solid var(--dsw-alias-label-primary-bluish, #6b8fd4)", color: "var(--dsw-alias-label-primary-bluish, #6b8fd4)", whiteSpace: "nowrap" },
      hint: { marginTop: "10px", fontSize: "11px", color: V.textDim, lineHeight: 1.6 },
      empty: { color: V.textDim, padding: "16px 0", textAlign: "center" }
    };

    class Boundary extends React.Component {
      constructor(props) { super(props); this.state = { err: null }; }
      static getDerivedStateFromError(err) { return { err: err }; }
      render() {
        if (this.state.err) {
          return h("div", { style: { padding: "10px", color: "var(--dsw-alias-label-error, #e08585)", fontSize: "11px" } },
            "该面板渲染出错：" + String((this.state.err && this.state.err.message) || this.state.err));
        }
        return this.props.children;
      }
    }

    function HoverRow(props) {
      const [hover, setHover] = useState(false);
      const style = Object.assign({}, S.sideItem(props.on), (!props.on && hover) ? { background: V.hover } : null, props.style || null);
      return h("div", {
        style: style, title: props.title,
        onClick: props.onClick,
        onMouseEnter: () => setHover(true),
        onMouseLeave: () => setHover(false)
      }, props.children);
    }

    function PluginDetail(props) {
      const p = props.plugin;
      const rows = [
        ["名称", p.name],
        ["版本", p.version || "—"],
        ["bundle 声明", p.isBundle ? "是" : "否"],
        ["在 bundles 列表", p.inBundleList ? "是" : "否"],
        ["带 client 入口", p.hasClient ? "是" : "否"],
        ["安装状态", p.installed ? "已安装" : "缺失"],
        ["依赖形式", p.linked ? "符号链接（link: / 开发态）" : "常规安装"],
        ["主页", p.homepage || "—"]
      ];
      return h("div", null,
        h("div", { style: { fontSize: "14px", fontWeight: 600, marginBottom: "6px" } }, p.name),
        p.description ? h("div", { style: { fontSize: "11px", color: V.textDim, marginBottom: "10px", lineHeight: 1.6 } }, p.description) : null,
        rows.map((r) => h("div", { key: r[0], style: S.row },
          h("div", { style: { width: "110px", flex: "0 0 110px", color: V.textDim, fontSize: "11px" } }, r[0]),
          h("div", { style: S.grow }, String(r[1]))
        )),
        h("div", { style: S.hint },
          "只读信息展示。" + (p.hasClient ? "该插件带客户端界面。" : "该插件为纯 host 侧。") +
          (p.isBundle ? "已作为 bundle 参与插件树加载。" : "未声明 dsh.bundle，不会作为 bundle 加载。") +
          "具体配置请用它自己的面板或 dsh 设置页。"
        )
      );
    }

    function Panel(props) {
      const onClose = props.onClose;
      const [entries, setEntries] = useState(hub.list());
      const [plugins, setPlugins] = useState(null);
      const [err, setErr] = useState("");
      const [active, setActive] = useState(props.initialActive || null);
      const [pos, setPos] = useState({ right: 16, bottom: 60 });

      useEffect(() => {
        const un = hub.subscribe(() => setEntries(hub.list()));
        return () => { try { un(); } catch (e) { /* ignore */ } };
      }, []);
      const loadPlugins = useCallback(async () => {
        try { setPlugins(await apiFetch("/plugins")); } catch (e) { setErr("读取插件清单失败: " + e.message); }
      }, []);
      useEffect(() => { loadPlugins(); }, [loadPlugins]);
      useEffect(() => {
        if ((!active || active.kind === "page") && entries.length > 0) {
          const ok = active && entries.some((e) => e.id === active.id);
          if (!ok) setActive({ kind: "page", id: entries[0].id });
        }
      }, [entries, active]);

      const startDrag = (e) => {
        const sx = e.clientX, sy = e.clientY;
        const base = { right: pos.right, bottom: pos.bottom };
        const onMove = (ev) => setPos({ right: Math.max(6, base.right - (ev.clientX - sx)), bottom: Math.max(6, base.bottom - (ev.clientY - sy)) });
        const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      };

      const activeEntry = active && active.kind === "page" ? entries.find((e) => e.id === active.id) : null;
      const activePlugin = active && active.kind === "plugin" && plugins ? (plugins.list || []).find((p) => p.name === active.id) : null;

      const head = h("div", { style: S.head, onMouseDown: startDrag, title: "按住可拖动" },
        h("div", { style: { display: "flex", alignItems: "center", gap: "8px" } },
          h("strong", null, "插件集"),
          h("span", { style: S.meta }, "功能面板 " + entries.length + (plugins ? " · 已装 " + plugins.total + "（bundle " + plugins.bundleCount + " / 带界面 " + plugins.clientCount + "）" : ""))
        ),
        h("div", { style: { display: "flex", gap: "6px" }, onMouseDown: (e) => e.stopPropagation() },
          h("button", { type: "button", style: S.btn, onClick: () => { setEntries(hub.list()); loadPlugins(); } }, "刷新"),
          h("button", { type: "button", style: S.btn, onClick: onClose }, "关闭")
        )
      );

      const side = h("div", { style: S.side },
        h("div", { style: S.sideGroup }, "功能面板"),
        entries.length === 0
          ? h("div", { style: { fontSize: "11px", color: V.textDim, padding: "4px 8px" } }, "（暂无插件注册面板）")
          : entries.map((e) => h(HoverRow, {
              key: e.id, title: e.title || e.id,
              on: active && active.kind === "page" && active.id === e.id,
              onClick: () => setActive({ kind: "page", id: e.id })
            }, h("span", null, e.icon || "▫"), h("span", { style: { overflow: "hidden", textOverflow: "ellipsis" } }, e.title || e.id))),
        h("div", { style: S.sideGroup }, "已装插件"),
        !plugins
          ? h("div", { style: { fontSize: "11px", color: V.textDim, padding: "4px 8px" } }, "读取中…")
          : (plugins.list || []).map((p) => h(HoverRow, {
              key: p.name, title: p.name,
              on: active && active.kind === "plugin" && active.id === p.name,
              onClick: () => setActive({ kind: "plugin", id: p.name })
            },
              h("span", { style: p.hasClient ? S.tagOk : S.tag }, p.hasClient ? "UI" : "插件"),
              h("span", { style: { overflow: "hidden", textOverflow: "ellipsis" } }, p.name.replace(/^@[^/]+\//, ""))
            ))
      );

      let mainBody;
      if (activeEntry) mainBody = h(Boundary, null, activeEntry.render ? activeEntry.render({ embedded: true }) : h("div", null, "（该面板未提供 render）"));
      else if (activePlugin) mainBody = h(PluginDetail, { plugin: activePlugin });
      else mainBody = h("div", { style: S.empty }, "左侧选择一个功能面板或已装插件");

      return h("div", { style: Object.assign({}, S.panel, { right: String(pos.right) + "px", bottom: String(pos.bottom) + "px" }) },
        head,
        h("div", { style: S.body },
          side,
          h("div", { style: S.main }, err ? h("div", { style: { color: "var(--dsw-alias-label-error, #e08585)", marginBottom: "8px" } }, err) : null, mainBody)
        )
      );
    }

    function DockItem(props) {
      const [hover, setHover] = useState(false);
      const style = Object.assign({}, S.dockItem, hover ? { background: V.hover } : null);
      return h("button", {
        type: "button", style: style, title: props.title,
        onClick: props.onClick,
        onMouseEnter: () => setHover(true),
        onMouseLeave: () => setHover(false)
      },
        h("span", { style: { flex: "0 0 auto", opacity: 0.85, display: "inline-flex" } }, props.icon || null),
        h("span", { style: { overflow: "hidden", textOverflow: "ellipsis" } }, props.label)
      );
    }

    /** 插件坞：垂直堆叠各插件入口（新的在上），点任一项打开面板并定位 */
    function Dock(props) {
      const [entries, setEntries] = useState(hub.list());
      const [open, setOpen] = useState(false);
      const [initialActive, setInitialActive] = useState(null);
      useEffect(() => {
        const un = hub.subscribe(() => setEntries(hub.list()));
        return () => { try { un(); } catch (e) { /* ignore */ } };
      }, []);

      const openAt = (id) => { setInitialActive(id ? { kind: "page", id: id } : null); setOpen(true); };
      const docked = entries.filter((e) => e.dock !== false);   // 默认都进坞

      const hubIcon = h("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
        h("path", { d: "M12 3l9 5-9 5-9-5 9-5z" }), h("path", { d: "M3 13l9 5 9-5" }));

      return h("div", { style: S.dock },
        h(DockItem, { key: "__hub__", icon: hubIcon, label: "插件集", title: "插件集：查看各插件面板与已安装插件", onClick: () => openAt(null) }),
        docked.map((e) => h(DockItem, {
          key: e.id,
          icon: e.icon ? h("span", { style: { fontSize: "13px", lineHeight: 1 } }, e.icon) : null,
          label: e.title || e.id,
          title: e.title || e.id,
          onClick: () => openAt(e.id)
        })),
        open ? h(Boundary, null, h(Panel, { onClose: () => setOpen(false), initialActive: initialActive })) : null
      );
    }

    function apply(ctx) {
      ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
        name: "sidebar.footer.action",
        id: "plugin-hub-dock",
        order: 34,
        inject: () => ({})
      }, Dock));
    }

    exports.apply = apply;
    exports.inject = ["slots"];
    return module.exports;
  }
});
