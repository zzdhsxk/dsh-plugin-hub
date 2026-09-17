/**
 * dsh-plugin-hub — Host half.
 * 只提供一处只读数据：已安装插件清单（读 dsh web profile 的 package.json + node_modules 探测）。
 * 面板本身完全在 client 侧实现；功能页通过 window.__DSH_PLUGIN_HUB__ 注册（软依赖）。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
const PROFILE_DIR = path.join(DSH_HOME, "profiles", "web");
const PROFILE_PKG = path.join(PROFILE_DIR, "package.json");
const API_PREFIX = "/plugin-hub/api";

export const name = "dsh-plugin-hub";
export const inject = ["webServer"];

async function readJson(p) {
  try { return JSON.parse(await fs.readFile(p, "utf8")); } catch { return null; }
}

/** 列出 profile 依赖里的插件，并探测各自是否为 bundle / 是否带 client 入口。 */
async function listPlugins() {
  const pkg = await readJson(PROFILE_PKG);
  if (!pkg) return { error: "无法读取 profile 的 package.json", dir: PROFILE_DIR, list: [] };
  const deps = Object.keys(pkg.dependencies || {});
  const bundles = new Set(((pkg.dsh || {}).profile || {}).bundles || []);
  const out = [];
  for (const dep of deps) {
    const depDir = path.join(PROFILE_DIR, "node_modules", dep);
    const depPkg = await readJson(path.join(depDir, "package.json"));
    let linked = false;
    try { const st = await fs.lstat(depDir); linked = st.isSymbolicLink(); } catch { /* not installed */ }
    const dsh = (depPkg && depPkg.dsh) || {};
    out.push({
      name: dep,
      version: (depPkg && depPkg.version) || null,
      description: (depPkg && depPkg.description) || null,
      installed: Boolean(depPkg),
      linked: linked,
      isBundle: bundles.has(dep) || Boolean(dsh.bundle),
      inBundleList: bundles.has(dep),
      hasClient: Boolean(dsh.client),
      homepage: (depPkg && (depPkg.homepage || (depPkg.repository && (typeof depPkg.repository === "string" ? depPkg.repository : depPkg.repository.url)))) || null
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return {
    dir: PROFILE_DIR,
    bundles: Array.from(bundles),
    total: out.length,
    bundleCount: out.filter((p) => p.isBundle).length,
    clientCount: out.filter((p) => p.hasClient).length,
    list: out
  };
}

function send(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(obj));
}

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: API_PREFIX,
    handler: async (req, res) => {
      try {
        const url = new URL(req.url || "/", "http://localhost");
        const sub = url.pathname.startsWith(API_PREFIX) ? (url.pathname.slice(API_PREFIX.length) || "/") : "/";
        if (req.method === "GET" && sub === "/plugins") {
          return send(res, 200, { ok: true, result: await listPlugins() });
        }
        if (req.method === "GET" && sub === "/info") {
          return send(res, 200, { ok: true, result: {
            hub: "dsh-plugin-hub",
            version: "0.2.0",
            profileDir: PROFILE_DIR,
            registryVersion: 2,
            registerContract: "window.__DSH_PLUGIN_HUB__.register({ id, title, icon, order, dock, render })",
            sidebarApi: "sidebarOn(id) / setSidebarOn(id, on) / subscribe(fn) —— 插件默认不进侧栏，由用户在面板里逐个开启"
          } });
        }
        return send(res, 404, { ok: false, error: "未知端点: " + sub });
      } catch (error) {
        const msg = error && error.message ? error.message : String(error);
        ctx.logger.warn("plugin-hub: api error: " + msg);
        return send(res, 500, { ok: false, error: msg });
      }
    }
  }), "plugin-hub: api routes");
}
