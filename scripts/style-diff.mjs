#!/usr/bin/env node
/**
 * OnePage 样式等价性对比（无头 Chrome）
 * ====================================
 * 用途：重构（把字面值收敛成 --onepage-* 令牌、拆文件、重排规则）时必须证明
 * **外观零变化**。做法是同一份合成 DOM 下先后注入两份 CSS，逐元素比对
 * getComputedStyle（含 ::before / ::after）与 getBoundingClientRect。
 *
 * 为什么不用「文本 diff」：`var(--x)` 与字面值字符串不同，但解析结果可能相同；
 * 而 `calc(100% - 13%)` 与 `87%` 字符串完全不同、结果却相等。只有 computed
 * style 能给出「用户实际看到的」答案。
 *
 * 用法：
 *   node scripts/style-diff.mjs <app.css> <A.css> <B.css>
 *   node scripts/style-diff.mjs /tmp/ob1144/app.css /tmp/theme.before.css theme.css
 *
 * 说明：
 *   - 覆盖 4 个场景：浅色 / 暗色 / 演示模式 / 窗口透明
 *   - 每个场景先做 A→A 噪声对照（同一份 CSS 快照两次），把「跨帧抖动」从结果里扣掉
 *   - 退出码：有差异 → 1（便于接 CI / 提交前检查）
 *
 * app.css 取法见 scripts/perf-probe.mjs 头部注释。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const [appCssPath, aPath, bPath] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!appCssPath || !aPath || !bPath) {
  console.error("用法: node scripts/style-diff.mjs <app.css> <A.css> <B.css>");
  process.exit(2);
}
for (const f of [appCssPath, aPath, bPath]) {
  if (!fs.existsSync(f)) {
    console.error(`文件不存在: ${f}`);
    process.exit(2);
  }
}
if (!fs.existsSync(CHROME)) {
  console.error(`找不到 Chrome: ${CHROME}`);
  process.exit(2);
}
const appCss = fs.readFileSync(appCssPath, "utf8");
const cssA = fs.readFileSync(aPath, "utf8");
const cssB = fs.readFileSync(bPath, "utf8");

/* ---------------------------------------------------------------------
   合成 DOM：覆盖 OnePage 改动过的所有组件
   （侧栏卡片 / 功能区 / tab / 状态栏 / 文件树 / 大纲 / 编辑器 / 表格 /
     Bases / Callout / 属性面板 / 嵌入 / 演示模式）
   --------------------------------------------------------------------- */
const buildDom = () => {
  const treeItems = Array.from({ length: 12 }, (_, i) =>
    `<div class="tree-item nav-file"><div class="tree-item-self nav-file-title${i === 2 ? " is-active" : ""}"><div class="tree-item-inner nav-file-title-content">note-${i}.md</div></div>${i === 0 ? `<div class="tree-item-children"><div class="tree-item nav-file"><div class="tree-item-self nav-file-title"><div class="tree-item-inner nav-file-title-content">nested.md</div></div></div></div>` : ""}</div>`).join("");
  const lines = Array.from({ length: 12 }, (_, i) =>
    `<div class="cm-line${i === 3 ? " cm-active" : ""}${i === 0 ? " HyperMD-header HyperMD-header-2" : ""}"><span class="cm-formatting">## </span>line ${i} <strong class="cm-strong">bold</strong> <em class="cm-em">em</em></div>`).join("");
  return `
<div class="app-container"><div class="horizontal-main-container"><div class="workspace is-left-sidedock-open is-right-sidedock-open is-primary-sidedock-open is-secondary-sidedock-open">
  <div class="workspace-ribbon mod-left side-dock-ribbon"><div class="side-dock-actions"><div class="side-dock-ribbon-action clickable-icon"><svg class="svg-icon"></svg></div></div></div>
  <div class="workspace-split mod-sidedock mod-left-split"><div class="workspace-tabs mod-active">
    <div class="workspace-tab-header-container"><div class="workspace-tab-header-container-inner"><div class="workspace-tab-header is-active"><div class="workspace-tab-header-inner"><div class="workspace-tab-header-inner-title">文件</div></div></div></div></div>
    <div class="workspace-tab-container"><div class="workspace-leaf mod-active"><div class="workspace-leaf-content" data-type="file-explorer">
      <div class="view-content"><div class="nav-files-container" role="tree"><div class="nav-folder"><div class="tree-item-children">${treeItems}</div></div></div></div>
    </div></div></div>
    <div class="workspace-sidedock-vault-profile"><div class="workspace-drawer-vault-switcher"><div class="workspace-drawer-vault-name">vault</div></div></div>
  </div></div>
  <div class="workspace-split mod-root"><div class="workspace-tabs mod-active">
    <div class="workspace-tab-header-container"><div class="workspace-tab-header-container-inner">
      <div class="workspace-tab-header is-active"><div class="workspace-tab-header-inner"><div class="workspace-tab-header-inner-title">note</div></div></div>
      <div class="workspace-tab-header"><div class="workspace-tab-header-inner"><div class="workspace-tab-header-inner-title">other</div></div></div>
      <div class="workspace-tab-header-tab-list clickable-icon"><svg class="svg-icon"></svg></div>
      <div class="workspace-tab-header-new-tab clickable-icon"><svg class="svg-icon"></svg></div>
    </div></div>
    <div class="workspace-tab-container"><div class="workspace-leaf mod-active"><div class="workspace-leaf-content" data-type="markdown" data-mode="source">
      <div class="view-header"><div class="view-header-title-container"><div class="view-header-title">note</div></div><div class="view-actions"><button class="clickable-icon"><svg class="svg-icon"></svg></button><button class="clickable-icon"><svg class="svg-icon"></svg></button></div></div>
      <div class="view-content">
        <div class="markdown-source-view mod-cm6 is-live-preview is-readable-line-width"><div class="cm-editor"><div class="cm-scroller">
          <div class="cm-gutters"><div class="cm-gutterElement">1</div><div class="cm-gutterElement">2</div></div>
          <div class="cm-content" contenteditable="true">${lines}</div>
        </div></div></div>
        <div class="markdown-preview-view markdown-rendered">
          <div class="metadata-container"><div class="metadata-properties-heading"><div class="collapse-indicator"><svg class="svg-icon"></svg></div><div class="metadata-properties-title">属性</div></div>
            <div class="metadata-content"><div class="metadata-properties"><div class="metadata-property"><div class="metadata-property-key"><input class="metadata-property-key-input" value="tags"><div class="metadata-property-icon"><svg class="svg-icon"></svg></div></div><div class="metadata-property-value"><div class="multi-select-pill"><div class="multi-select-pill-content">tag</div></div></div></div></div></div>
          </div>
          <h1>Heading 1</h1><h2>Heading 2</h2><h3>Heading 3</h3>
          <p>paragraph <strong>bold reminder</strong> and <em>italic</em> <code>inline</code> <a href="#">link</a> <mark>highlight</mark></p>
          <blockquote><p>quote</p></blockquote>
          <pre><code class="language-js">const x = 1;</code></pre>
          <table><thead><tr><th>head</th><th>head2</th></tr></thead><tbody><tr><td>cell</td><td>cell2</td></tr></tbody></table>
          <div class="callout" data-callout="warning"><div class="callout-title"><div class="callout-icon"><svg class="svg-icon"></svg></div><div class="callout-title-inner">Warning</div></div><div class="callout-content"><p>content</p></div></div>
          <div class="callout" data-callout="note"><div class="callout-title"><div class="callout-title-inner">Note</div></div></div>
          <div class="markdown-embed"><div class="markdown-embed-content"><div class="callout" data-callout="tip"><div class="callout-title"><div class="callout-title-inner">Embedded</div></div></div></div></div>
          <div class="task-list-item"><input type="checkbox" class="task-list-item-checkbox" checked></div>
          <div class="bases-view"><div class="bases-header"><div class="title">Base</div></div>
            <div class="bases-table-container"><div class="bases-thead"><div class="bases-tr"><div class="bases-th">col</div></div></div>
              <div class="bases-tbody"><div class="bases-tr"><div class="bases-td"><div class="multi-select-pill">pill</div></div></div></div></div>
          </div>
          <div class="bases-view"><div class="bases-cards-container"><div class="bases-cards-group"><div class="bases-group-heading"><div class="bases-group-heading-value">group</div></div><div class="bases-cards-item"><div class="bases-cards-cover"></div><div class="bases-cards-property mod-title">card</div></div></div></div></div>
        </div>
      </div>
    </div></div></div>
  </div></div>
  <div class="workspace-split mod-sidedock mod-right-split"><div class="workspace-tabs mod-active">
    <div class="workspace-tab-header-container"><div class="workspace-tab-header-container-inner"><div class="workspace-tab-header is-active"><div class="workspace-tab-header-inner"><div class="workspace-tab-header-inner-title">大纲</div></div></div></div></div>
    <div class="workspace-tab-container"><div class="workspace-leaf mod-active"><div class="workspace-leaf-content" data-type="outline"><div class="view-content"><div class="tree-item"><div class="tree-item-self is-active">heading</div><div class="tree-item-children"><div class="tree-item-self">sub</div></div></div></div></div></div></div>
  </div></div>
</div><div class="status-bar"><div class="status-bar-item">1,234 words</div></div></div></div>`;
};

/* 参与比对的 computed 属性：覆盖 OnePage 全部可调项（颜色 / 尺寸 / 排版 / 阴影） */
const PROPS = [
  "color", "background-color", "background-image", "opacity", "box-shadow", "filter",
  "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "border-top-color", "border-bottom-color", "border-left-color", "border-right-color",
  "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius", "border-bottom-right-radius",
  "padding-top", "padding-bottom", "padding-left", "padding-right",
  "margin-top", "margin-bottom", "margin-left", "margin-right",
  "width", "height", "min-width", "min-height", "max-width", "max-height",
  "font-size", "font-weight", "line-height", "letter-spacing", "font-family", "font-variant-ligatures", "font-feature-settings",
  "text-decoration-color", "text-decoration-thickness", "text-underline-offset",
  "display", "position", "z-index", "overflow-x", "overflow-y", "transform", "gap",
  "justify-content", "align-items", "outline-color", "outline-width", "backdrop-filter",
];
/* 直接读取的自定义属性（getComputedStyle 的枚举里不含自定义属性） */
const VARS = [
  // 不含 --file-line-width：它可能是 max(...)/calc(...) 未解析字符串，实际效果看 max-width
  "--line-width", "--line-width-wide", "--p-spacing", "--radius-window",
  "--highlight-opacity", "--text-highlight-bg", "--typo-bold", "--typo-italic",
  // --background-* / --callout-* 只比"实际渲染属性"（它们可能是 color-mix 表达式，
  // 与等价的 hex 计算值序列化不同但 8bit 输出相同；渲染属性已在 PROPS 里覆盖）
  "--text-accent", "--interactive-accent",
  "--onepage-bold-color", "--onepage-callout-tint", "--onepage-sidebar-bg", "--onepage-window-bg",
  "--onepage-grid-line", "--onepage-head-text", "--onepage-head-line",
  "--onepage-line-width", "--onepage-paragraph-spacing", "--onepage-code-size", "--onepage-code-radius",
  "--onepage-tree-indent", "--onepage-outline-indent", "--onepage-sidebar-gap",
  "--onepage-tab-radius", "--onepage-tab-inset", "--onepage-scrollbar-size",
  "--onepage-statusbar-height", "--onepage-statusbar-font-size",
  "--onepage-dim-opacity", "--onepage-dim-opacity-tab",
  "--onepage-table-pad-y", "--onepage-table-pad-x",
  "--onepage-bases-row-height", "--onepage-bases-group-gap", "--onepage-bases-card-radius",
  "--onepage-demo-font", "--onepage-demo-line-width", "--onepage-demo-padding-top", "--onepage-demo-line-height",
];

const SNAPSHOT = `
function snapshot() {
  const out = [];
  const props = ${JSON.stringify(PROPS)};
  const vars = ${JSON.stringify(VARS)};
  document.querySelectorAll('*').forEach((el, i) => {
    const cs = getComputedStyle(el);
    const rec = { i, tag: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '') };
    for (const p of props) rec[p] = cs.getPropertyValue(p);
    // 自定义属性会向下继承：只在 body 上取一次，避免每个后代都刷一条「新增令牌」噪声
    if (el === document.body) for (const v of vars) rec[v] = cs.getPropertyValue(v).trim().toLowerCase();
    const r = el.getBoundingClientRect();
    rec.rect = [r.x, r.y, r.width, r.height].map(n => Math.round(n * 100) / 100).join(',');
    for (const ps of ['::before', '::after']) {
      const s = getComputedStyle(el, ps);
      for (const p of ['content','color','background-color','background-image','border-top-width','border-bottom-width','box-shadow','width','height','opacity','transform']) {
        const val = s.getPropertyValue(p);
        if (val && val !== 'none' && val !== 'normal' && val !== 'auto') rec[ps + p] = val;
      }
    }
    out.push(rec);
  });
  return out;
}
window.__snap = snapshot;
`;

const SCENARIOS = [
  { name: "浅色", body: "theme-light is-focused mod-macos show-ribbon is-hidden-frameless" },
  { name: "暗色", body: "theme-dark is-focused mod-macos show-ribbon is-hidden-frameless" },
  { name: "演示模式", body: "theme-light is-focused mod-macos show-ribbon demo-mode is-hidden-frameless" },
  { name: "窗口透明", body: "theme-light is-focused mod-macos show-ribbon is-translucent is-hidden-frameless" },
];

const page = (scenario) => `<!doctype html><html><head><meta charset="utf-8">
<style>${appCss}</style><style id="theme"></style>
<style>*{transition:none!important;animation:none!important}</style>
</head><body class="${scenario.body}">${buildDom()}<script>${SNAPSHOT}</script></body></html>`;

/* ---------- CDP ---------- */
const port = 9200 + Math.floor(Math.random() * 300);
const udir = fs.mkdtempSync(path.join(os.tmpdir(), "onepage-diff-"));
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

const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
/**
 * 注入主题 CSS。
 * ⚠️ 连续注入相同内容两次：实测「页面导航后的第一次注入」偶尔会读到上一份样式表的
 * 残留计算值（曾稳定复现功能区 z-index 10 vs 11 的假差异）。第二次注入后才稳定。
 * 这是测量夹具的预热，不影响任何主题逻辑。
 */
const setTheme = async (css) => {
  const code = `document.getElementById('theme').textContent = ${JSON.stringify(css)}; void document.body.offsetWidth; 'ok'`;
  await evaluate(code);
  await evaluate(code);
};

/**
 * 颜色归一化到 8bit RGBA。
 * color-mix(...) 的计算结果可能是 `color(srgb 0.191569 …)` 这类浮点值，与等价的
 * hex（rgb(49,46,45)）**屏幕输出相同**但序列化不同 —— 不算视觉差异。
 * 只处理 rgb()/rgba()/color(srgb …)；oklch 等保持原样（两边同源时本来就一致）。
 */
const parseColor8 = (v) => {
  if (typeof v !== "string") return null;
  let m = v.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/);
  if (m) return `rgba(${Math.round(+m[1])},${Math.round(+m[2])},${Math.round(+m[3])},${m[4] === undefined ? 1 : Math.round(+m[4] * 100) / 100})`;
  m = v.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/);
  if (m) return `rgba(${Math.round(+m[1] * 255)},${Math.round(+m[2] * 255)},${Math.round(+m[3] * 255)},${m[4] === undefined ? 1 : Math.round(+m[4] * 100) / 100})`;
  return null;
};
const norm = (v) => parseColor8(v) ?? v;

const diffSnapshots = (a, b) => {
  const diffs = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i], y = b[i];
    if (!x || !y) { diffs.push(`#${i} 元素数量不一致`); continue; }
    for (const key of Object.keys(x)) {
      if (key === "i" || key === "tag") continue;
      if (norm(x[key]) === norm(y[key])) continue;
      // 新增的自定义属性定义（""→值）本身不参与渲染：重构时新增 --onepage-* 令牌属于预期变化
      if (key.startsWith("--") && x[key] === "") continue;
      diffs.push(`${x.tag} #${i} ${key}: ${JSON.stringify(x[key])} → ${JSON.stringify(y[key])}`);
    }
  }
  return diffs;
};

let total = 0;
const report = [];
for (const sc of SCENARIOS) {
  const file = path.join(udir, `s${SCENARIOS.indexOf(sc)}.html`);
  fs.writeFileSync(file, page(sc));
  await send("Page.navigate", { url: `file://${file}` });
  for (let i = 0; i < 200; i++) {
    if (await evaluate(`typeof window.__snap === 'function'`)) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  // 噪声对照：同一份 CSS 连拍两次
  await setTheme(cssA);
  const a1 = await evaluate("window.__snap()");
  await setTheme(cssA);
  const a2 = await evaluate("window.__snap()");
  const noise = diffSnapshots(a1, a2);
  // A → B
  await setTheme(cssA);
  const before = await evaluate("window.__snap()");
  await setTheme(cssB);
  const after = await evaluate("window.__snap()");
  // 噪声按「元素 + 属性」整键排除：同一份 CSS 连拍时 rect 抖动的**值**每次都不同，
  // 用字符串相等过滤不掉，必须按属性键过滤。
  const noiseKeys = new Set(noise.map((d) => d.split(":")[0]));
  const diffs = diffSnapshots(before, after).filter((d) => !noiseKeys.has(d.split(":")[0]));
  total += diffs.length;
  report.push({ name: sc.name, nodes: before.length, noise: noise.length, diffs });
}

for (const r of report) {
  console.log(`\n【${r.name}】元素 ${r.nodes} 个，噪声对照 ${r.noise} 条，差异 ${r.diffs.length} 条`);
  for (const d of r.diffs.slice(0, 40)) console.log(`  • ${d}`);
  if (r.diffs.length > 40) console.log(`  … 另有 ${r.diffs.length - 40} 条`);
}
ws.close();
chrome.kill();

if (total === 0) {
  console.log("\n✅ 两份 CSS 在 4 个场景下解析结果完全一致（零视觉差异）");
  process.exit(0);
}
console.log(`\n❌ 共 ${total} 条差异`);
process.exit(1);
