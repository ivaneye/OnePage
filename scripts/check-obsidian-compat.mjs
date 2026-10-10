#!/usr/bin/env node
/**
 * Obsidian 版本兼容性实测（无头 Chrome）
 *
 * 目的：验证 OnePage 的「功能区 / 侧边栏」在 **不同 Obsidian 版本** 下都成立，
 *       即 1.13 的 `.workspace-ribbon.mod-left` 与 1.14 的 `.workspace-ribbon.mod-primary`
 *       都能命中，且侧边栏卡片规则（.mod-sidedock.mod-left-split）两边都生效。
 *
 * 用法：
 *   node scripts/check-obsidian-compat.mjs <app.css 路径> [<app.css 路径> ...] [--theme <theme.css>]
 * 例：
 *   # 本机已安装版本
 *   node scripts/check-obsidian-compat.mjs /tmp/ob1144/app.css
 *   # 从 GitHub Release 单独取旧版本: obsidian-1.13.7.asar.gz (8.7MB) 解包后 app.css
 *   node scripts/check-obsidian-compat.mjs /tmp/ob1137/ext/app.css /tmp/ob1144/app.css
 *   # 自检工具本身：用一个「没打补丁」的主题跑，应该报 ❌
 *   node scripts/check-obsidian-compat.mjs /tmp/ob1144/app.css --theme /tmp/broken.css
 *
 * 原理：把被测 app.css + 构建产物 theme.css 内联进一个最小 DOM（分别模拟 1.13 / 1.14 的类名），
 *       用 headless Chrome 读 getComputedStyle，输出对照表。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const argv = process.argv.slice(2);
const themeAt = argv.indexOf("--theme");
const themePath = themeAt >= 0 ? argv[themeAt + 1] : path.join(ROOT, "theme.css");
const appCssPaths = themeAt >= 0 ? argv.filter((a, i) => i !== themeAt && i !== themeAt + 1) : argv.filter((a) => !a.startsWith("--"));
if (!appCssPaths.length) {
  console.error("用法: node scripts/check-obsidian-compat.mjs <app.css …> [--theme <theme.css>]");
  process.exit(2);
}
if (!fs.existsSync(CHROME)) {
  console.error(`找不到 Chrome: ${CHROME}`);
  process.exit(2);
}

const themeCss = fs.readFileSync(themePath, "utf8");
console.log(`主题: ${themePath}`);

/** 模拟 DOM；ribbonClass 由调用方给（1.13: mod-left，1.14: mod-primary） */
const dom = (ribbonClass) => `
<div class="workspace">
  <div class="workspace-ribbon ${ribbonClass} side-dock-ribbon">
    <div class="side-dock-actions"><div class="side-dock-ribbon-action clickable-icon"></div></div>
  </div>
  <div class="workspace-split mod-sidedock mod-left-split" style="width:300px">
    <div class="workspace-leaf-content"><div class="view-content">x</div></div>
  </div>
  <div class="workspace-split mod-root"><div class="workspace-leaf"><div class="view-content">正文</div></div></div>
</div>`;

const probe = `
<script>
  addEventListener("load", () => {
    const r = document.querySelector(".workspace-ribbon");
    const s = document.querySelector(".workspace-split.mod-sidedock");
    const out = {
      ribbon_position: getComputedStyle(r).position,
      ribbon_zIndex: getComputedStyle(r).zIndex,
      ribbon_paddingTop: getComputedStyle(r).paddingTop,
      sidedock_margin: getComputedStyle(s).margin,
      sidedock_radius: getComputedStyle(s).borderRadius,
      sidedock_bg: getComputedStyle(s).backgroundColor,
    };
    document.title = "RESULT " + JSON.stringify(out);
    const pre = document.createElement("pre");
    pre.id = "probe-result";
    pre.textContent = JSON.stringify(out);
    document.body.appendChild(pre);
  });
</script>`;

function run(appCssPath, bodyClass, ribbonClass) {
  const html = `<!doctype html><html><head><meta charset="utf-8">
<style>${fs.readFileSync(appCssPath, "utf8")}</style>
<style>${themeCss}</style>
</head><body class="${bodyClass}">${dom(ribbonClass)}${probe}</body></html>`;
  const file = path.join(os.tmpdir(), `onepage-compat-${path.basename(path.dirname(appCssPath))}-${ribbonClass}.html`);
  fs.writeFileSync(file, html);
  const dumped = execFileSync(
    CHROME,
    ["--headless", "--disable-gpu", "--no-sandbox", "--virtual-time-budget=4000", "--dump-dom", `file://${file}`],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
  );
  const m = dumped.match(/<pre id="probe-result">([\s\S]*?)<\/pre>/);
  if (!m) throw new Error(`没拿到探针结果（${appCssPath} / ${ribbonClass}）`);
  return JSON.parse(m[1].replace(/&quot;/g, '"'));
}

// 两种类名 × 每个 app.css；主体类名对齐 OnePage 卡片规则的前提
const BASES = ["theme-light is-focused is-hidden-frameless mod-macos show-ribbon"];
console.log("场景: 非透明模式 + show-ribbon（.workspace-ribbon 需拿到 z-index:11，左侧栏需拿到卡片 margin）\n");
const rows = [];
for (const p of appCssPaths) {
  for (const [label, ribbonClass] of [["1.13 类名 mod-left", "mod-left"], ["1.14 类名 mod-primary", "mod-primary"]]) {
    for (const bc of BASES) {
      rows.push({ app: path.basename(path.dirname(p)), label, ...run(p, bc, ribbonClass) });
    }
  }
}
const pad = (s, n) => String(s).padEnd(n);
console.log(pad("app.css", 22), pad("DOM 类名", 22), pad("ribbon.position", 18), pad("zIndex", 8), pad("sidebar margin", 24), "radius");
for (const r of rows) {
  console.log(pad(r.app, 22), pad(r.label, 22), pad(r.ribbon_position, 18), pad(r.ribbon_zIndex, 8), pad(r.sidedock_margin, 24), r.sidedock_radius);
}
const bad = rows.filter((r) => r.ribbon_position !== "relative" || Number(r.ribbon_zIndex) < 11);
console.log(
  bad.length
    ? `\n❌ ${bad.length} 个场景功能区没拿到 position:relative / z-index>=11（对应「Show Ribbon 后图标被边栏卡片盖住」）`
    : `\n✅ 所有场景功能区都拿到 position:relative + z-index>=11（1.13/1.14 类名都成立）`,
);
process.exit(bad.length ? 1 : 0);
