#!/usr/bin/env node
/**
 * OnePage 性能回归探针（无头 Chrome + 真机 app.css + 当前构建的 theme.css）
 * =====================================================================
 * 为什么需要它：CSS 里有几类写法**不会报错、也不会改变外观**，但会让浏览器在每次
 * DOM 变更时做全文档样式重算（`:has()`、`hover` 依赖的兄弟选择器、对 <html> 的
 * `[style*=…]` 匹配……）。这类退化看不见，只有量出来。
 * 换基座（vendor/cupertino/<版本>）或改定制层之后跑一遍，和上次的数对比即可。
 *
 * 用法：
 *   node scripts/perf-probe.mjs <app.css 路径> [--tree 2000] [--lines 500] [--rounds 5]
 *   node scripts/perf-probe.mjs /tmp/ob1144/app.css
 *
 * app.css 的取法：Obsidian.app/Contents/Resources/obsidian.asar 解包（app.asar 里没有），
 * 旧版本可从 GitHub Release 下 obsidian-<ver>.asar.gz（约 8.7MB）后 `npx @electron/asar extract`。
 *
 * 输出：每个交互场景的「单次样式重算耗时」（µs，中位数），三行对照：
 *   app     仅 Obsidian 本体（基准）
 *   theme   当前 theme.css
 * 判定：theme 的滚动/切 tab/点文件/折叠侧栏若比 app 高出两个数量级，说明又引入了
 * 会触发全文档失效的选择器（见 AGENTS.md「性能」一节）。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const argv = process.argv.slice(2);
const num = (flag, def) => {
  const i = argv.indexOf(`--${flag}`);
  return i >= 0 ? Number(argv[i + 1]) : def;
};
const appCssPath = argv.find((a) => !a.startsWith("--") && a !== String(num("tree", "")) && a !== String(num("lines", "")) && a !== String(num("rounds", "")));
const TREE = num("tree", 2000);
const LINES = num("lines", 500);
const ROUNDS = num("rounds", 5);

if (!appCssPath || !fs.existsSync(appCssPath)) {
  console.error("用法: node scripts/perf-probe.mjs <app.css 路径> [--tree 2000] [--lines 500] [--rounds 5]");
  process.exit(2);
}
if (!fs.existsSync(CHROME)) {
  console.error(`找不到 Chrome: ${CHROME}`);
  process.exit(2);
}
const appCss = fs.readFileSync(appCssPath, "utf8");
const themeCss = fs.readFileSync(path.join(ROOT, "theme.css"), "utf8");

/* ---------- 合成 Obsidian 工作区 DOM ---------- */
const buildDom = () => {
  const treeItems = Array.from({ length: TREE }, (_, i) =>
    `<div class="tree-item nav-file"><div class="tree-item-self nav-file-title"><div class="tree-item-inner nav-file-title-content">note-${i}.md</div></div></div>`).join("");
  const lines = Array.from({ length: LINES }, (_, i) =>
    `<div class="cm-line${i % 17 === 0 ? " HyperMD-header HyperMD-header-2" : ""}${i % 11 === 0 ? " HyperMD-codeblock" : ""}">line ${i} — 中文正文 content ${i}</div>`).join("");
  const tabs = Array.from({ length: 6 }, (_, i) =>
    `<div class="workspace-tab-header${i === 1 ? " is-active" : ""}"><div class="workspace-tab-header-inner"><div class="workspace-tab-header-inner-title">tab ${i}</div></div></div>`).join("");
  return `
<div class="app-container"><div class="horizontal-main-container"><div class="workspace is-left-sidedock-open is-right-sidedock-open is-primary-sidedock-open is-secondary-sidedock-open">
  <div class="workspace-ribbon mod-left side-dock-ribbon"><div class="side-dock-actions"><div class="side-dock-ribbon-action clickable-icon"><svg class="svg-icon"></svg></div></div></div>
  <div class="workspace-split mod-sidedock mod-left-split"><div class="workspace-tabs mod-active">
    <div class="workspace-tab-header-container"><div class="workspace-tab-header-container-inner"><div class="workspace-tab-header is-active"><div class="workspace-tab-header-inner"><div class="workspace-tab-header-inner-title">文件</div></div></div></div></div>
    <div class="workspace-tab-container"><div class="workspace-leaf mod-active"><div class="workspace-leaf-content" data-type="file-explorer">
      <div class="view-content"><div class="nav-files-container" role="tree"><div class="nav-folder"><div class="tree-item-children">${treeItems}</div></div></div></div>
    </div></div></div>
  </div></div>
  <div class="workspace-split mod-root"><div class="workspace-tabs mod-active">
    <div class="workspace-tab-header-container"><div class="workspace-tab-header-container-inner">${tabs}<div class="workspace-tab-header-tab-list clickable-icon"><svg class="svg-icon"></svg></div></div></div>
    <div class="workspace-tab-container"><div class="workspace-leaf mod-active"><div class="workspace-leaf-content" data-type="markdown" data-mode="source">
      <div class="view-header"><div class="view-header-title-container"><div class="view-header-title">note</div></div><div class="view-actions"><button class="clickable-icon"><svg class="svg-icon"></svg></button></div></div>
      <div class="view-content"><div class="markdown-source-view mod-cm6 is-live-preview"><div class="cm-editor"><div class="cm-scroller">
        <div class="cm-gutters"><div class="cm-gutterElement">1</div></div>
        <div class="cm-content" contenteditable="true">${lines}</div>
      </div></div></div></div>
    </div></div></div>
  </div></div>
  <div class="workspace-split mod-sidedock mod-right-split"><div class="workspace-tabs mod-active">
    <div class="workspace-tab-header-container"><div class="workspace-tab-header-container-inner"><div class="workspace-tab-header is-active"><div class="workspace-tab-header-inner"><div class="workspace-tab-header-inner-title">大纲</div></div></div></div></div>
    <div class="workspace-tab-container"><div class="workspace-leaf mod-active"><div class="workspace-leaf-content" data-type="outline"><div class="view-content"><div class="tree-item"><div class="tree-item-self">heading</div></div></div></div></div></div>
  </div></div>
</div><div class="status-bar"><div class="status-bar-item">1,234 words</div></div></div></div>`;
};

const BENCH = `
<script>
function bench() {
  const content = document.querySelector('.cm-content');
  const lines = [...content.querySelectorAll('.cm-line')];
  const treeItems = [...document.querySelectorAll('.tree-item.nav-file .tree-item-self')];
  const tabHeaders = [...document.querySelectorAll('.mod-root .workspace-tab-header')];
  const leftSplit = document.querySelector('.workspace-split.mod-left-split');
  const out = {};
  const flush = () => document.body.getBoundingClientRect().width;
  function timeIt(fn, n) {
    fn(0); flush();
    const s = [];
    for (let r = 0; r < ${ROUNDS}; r++) {
      const t0 = performance.now();
      for (let i = 0; i < n; i++) { fn(i); flush(); }
      s.push((performance.now() - t0) / n * 1000);
    }
    s.sort((a, b) => a - b);
    return +s[Math.floor(s.length / 2)].toFixed(1);
  }
  // 光标移动：CM6 给行加/去 .cm-active
  out.active_line = timeIt((i) => {
    lines[i % lines.length].classList.remove('cm-active');
    lines[(i * 37 + 13) % lines.length].classList.add('cm-active');
  }, 120);
  // 点文件树：.is-active 转移
  out.tree_click = timeIt((i) => {
    treeItems[i % treeItems.length].classList.remove('is-active');
    treeItems[(i * 31 + 5) % treeItems.length].classList.add('is-active');
  }, 60);
  // 切 tab
  out.tab_switch = timeIt((i) => {
    const cur = tabHeaders.find(t => t.classList.contains('is-active'));
    cur && cur.classList.remove('is-active');
    tabHeaders[i % tabHeaders.length].classList.add('is-active');
  }, 40);
  // 滚动：CM6 视口换 5 行
  out.scroll = timeIt((i) => {
    for (let k = 0; k < 5; k++) {
      content.removeChild(content.firstElementChild);
      const el = document.createElement('div');
      el.className = 'cm-line';
      el.textContent = 'line new ' + i + '-' + k;
      content.appendChild(el);
    }
  }, 60);
  // 写 inline style：拖分隔条 / 画布 / 浮层定位都会写
  out.style_write = timeIt((i) => { leftSplit.style.width = (260 + (i % 80)) + 'px'; }, 40);
  // 折叠/展开侧栏
  out.sidebar_toggle = timeIt(() => { leftSplit.classList.toggle('is-sidedock-collapsed'); }, 20);
  out.rules = [...document.styleSheets].reduce((a, s) => { try { return a + s.cssRules.length; } catch { return a; } }, 0);
  out.nodes = document.querySelectorAll('*').length;
  return out;
}
addEventListener('load', () => {
  let r;
  try { r = bench(); } catch (e) { r = { error: String(e && e.stack || e) }; }
  const pre = document.createElement('pre');
  pre.id = 'probe-result'; pre.textContent = JSON.stringify(r);
  document.body.appendChild(pre);
});
</script>`;

const page = (css) => `<!doctype html><html><head><meta charset="utf-8">
<style>${appCss}</style><style>${css}</style></head>
<body class="theme-light is-focused is-hidden-frameless mod-macos show-ribbon">${buildDom()}${BENCH}</body></html>`;

/* ---------- CDP ---------- */
const port = 9200 + Math.floor(Math.random() * 300);
const udir = fs.mkdtempSync(path.join(os.tmpdir(), "onepage-perf-"));
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`,
  `--user-data-dir=${udir}`, "--no-first-run", "--no-default-browser-check",
  "--window-size=1440,900", "about:blank"], { stdio: "ignore" });

const wsUrl = await (async () => {
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const p = list.find((t) => t.type === "page");
      if (p) return p.webSocketDebuggerUrl;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Chrome 没起来");
})();

const ws = new WebSocket(wsUrl);
let id = 0;
const pend = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
});
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id;
  pend.set(i, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)));
  ws.send(JSON.stringify({ id: i, method, params }));
});
await send("Page.enable");
await send("Runtime.enable");

const rows = [];
for (const [label, css] of [["app (仅 Obsidian)", ""], ["theme (当前构建)", themeCss]]) {
  const file = path.join(udir, `p${rows.length}.html`);
  fs.writeFileSync(file, page(css));
  await send("Page.navigate", { url: `file://${file}` });
  let r = null;
  for (let i = 0; i < 900; i++) {
    const q = await send("Runtime.evaluate", {
      expression: `(document.getElementById('probe-result')||{}).textContent||''`,
      returnByValue: true,
    });
    if (q.result.value) { r = JSON.parse(q.result.value); break; }
    await new Promise((rr) => setTimeout(rr, 100));
  }
  if (!r || r.error) throw new Error(`${label}: ${r ? r.error : "没拿到结果"}`);
  rows.push({ label, ...r });
}

ws.close();
chrome.kill();
try { fs.rmSync(udir, { recursive: true, force: true }); } catch {}

const cols = ["active_line", "tree_click", "tab_switch", "scroll", "style_write", "sidebar_toggle"];
const pad = (s, n) => String(s).padEnd(n);
console.log(`\napp.css: ${appCssPath}`);
console.log(`DOM ${rows[0].nodes} 节点 / CSS ${rows[0].rules} 条规则；单位 µs/次（中位数 ${ROUNDS} 轮）\n`);
console.log(pad("变体", 22) + cols.map((c) => pad(c, 15)).join(""));
for (const r of rows) console.log(pad(r.label, 22) + cols.map((c) => pad(r[c], 15)).join(""));

const app = rows[0];
const theme = rows[1];
const bad = cols.filter((c) => theme[c] > Math.max(2000, app[c] * 20));
if (bad.length) {
  console.log(`\n❌ ${bad.join(", ")} 比原生高两个数量级 —— 大概率又引入了会触发全文档重算的选择器`);
  console.log("   排查方向：`body:has(...)`、`… :has(... :hover)`、`… :hover + 兄弟`、`html[style*=…]`（见 AGENTS.md「性能」）");
  process.exit(1);
}
console.log("\n✅ 各场景均在可接受范围（< 2ms 且 < 原生 20 倍）");
