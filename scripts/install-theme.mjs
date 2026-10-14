#!/usr/bin/env node
/**
 * 把当前构建产物「装」到任意 Obsidian 库，用于本地试用（不影响已发布的正式版主题）
 * ============================================================================
 *
 * 做法：在目标库的 `.obsidian/themes/<名字>` 下生成一个**独立主题**（默认名字 `OnePage (dev)`）：
 *   - `manifest.json` 的 `name` 与正式版不同 → Obsidian 的社区主题更新器永远不会碰它，
 *     也不可能反向覆盖本仓库的构建产物；
 *   - `theme.css` **默认是拷贝**（不是软链）—— 因为 Obsidian 只监视「库内」文件的改动，
 *     软链指向库外时：① 改了构建产物不会触发 Obsidian 重载；② 切换主题时它可能直接复用
 *     内存里缓存的 CSS 文本，看起来“切换了没生效”。拷贝模式下每次 `npm run build` 后
 *     重跑本脚本（或用 `--watch`）即可让 Obsidian 自动热重载。
 *
 * 用法：
 *   node scripts/install-theme.mjs <库路径>                    # 装 / 同步（拷贝，推荐）
 *   node scripts/install-theme.mjs <库路径> --watch            # 装完并监听 theme.css，自动同步
 *   node scripts/install-theme.mjs <库路径> --link             # 改用软链（省一次拷贝，但可能不热重载）
 *   node scripts/install-theme.mjs <库路径> --name "OnePage (dev)"   # 自定义主题名
 *   node scripts/install-theme.mjs <库路径> --uninstall        # 卸载（删掉这个 dev 主题目录）
 *
 * 例：
 *   node scripts/install-theme.mjs ~/my/obsidian/notes
 *   node scripts/install-theme.mjs ~/my/obsidian/notes --watch
 *
 * 正式版发布后怎么切回官方版：
 *   设置 → 外观 → 主题 → 浏览 → OnePage → 安装/更新 → 选中；
 *   然后 `node scripts/install-theme.mjs <库路径> --uninstall` 清掉 dev 目录。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT } from "./build.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const vaultArg = (() => {
  const skip = new Set();
  for (const f of ["--name"]) {
    const i = args.indexOf(f);
    if (i >= 0) skip.add(i + 1);
  }
  return args.find((a, i) => !a.startsWith("--") && !skip.has(i));
})();
const themeName = value("--name", "OnePage (dev)");
const useLink = flag("--link");

if (!vaultArg) {
  console.error(`用法: node scripts/install-theme.mjs <库路径> [--name "${themeName}"] [--watch] [--link] [--uninstall]`);
  console.error(`例:   node scripts/install-theme.mjs ${path.join(os.homedir(), "my/obsidian/notes")} --watch`);
  process.exit(2);
}

const vault = path.resolve(vaultArg.replace(/^~(?=\/)/, os.homedir()));
if (!fs.existsSync(path.join(vault, ".obsidian"))) {
  console.error(`❌ ${vault} 看起来不是 Obsidian 库（没有 .obsidian 目录）`);
  process.exit(2);
}

const target = path.join(vault, ".obsidian", "themes", themeName);
const repoCss = path.join(ROOT, "theme.css");

if (flag("--uninstall")) {
  if (!fs.existsSync(target)) {
    console.log(`（没有找到 ${target}，无需卸载）`);
  } else {
    fs.rmSync(target, { recursive: true, force: true });
    console.log(`🗑  已删除 ${target}`);
    console.log(`   如果在 Obsidian 里还选中着它，记得 设置 → 外观 → 主题 切回「OnePage」，然后 Cmd/Ctrl+R。`);
  }
  process.exit(0);
}

// 前置：确保构建产物存在且比 src 新
if (!fs.existsSync(repoCss)) {
  console.error("❌ 找不到 theme.css，先跑 npm run build");
  process.exit(1);
}
const srcFiles = fs.readdirSync(path.join(ROOT, "src")).map((f) => path.join(ROOT, "src", f));
const newestSrc = Math.max(
  ...srcFiles.map((f) => fs.statSync(f).mtimeMs),
  fs.statSync(path.join(ROOT, "vendor/cupertino/VERSION")).mtimeMs,
);
if (fs.statSync(repoCss).mtimeMs < newestSrc) {
  console.warn("⚠️  theme.css 比 src/ 旧 —— 建议先 npm run build（否则装的是旧构建）");
}

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
const devManifest = { ...manifest, name: themeName };
devManifest.description = `${manifest.description}【本地开发构建，非正式版】`;

fs.mkdirSync(target, { recursive: true });
fs.writeFileSync(path.join(target, "manifest.json"), `${JSON.stringify(devManifest, null, 2)}\n`);

const cssTarget = path.join(target, "theme.css");
if (fs.lstatSync(cssTarget, { throwIfNoEntry: false })) fs.rmSync(cssTarget, { recursive: true, force: true });
if (useLink) fs.symlinkSync(repoCss, cssTarget);
else fs.copyFileSync(repoCss, cssTarget);

console.log(`✅ 已安装/同步主题「${themeName}」到`);
console.log(`   ${target}`);
console.log(`   manifest.json  ${devManifest.version} / minAppVersion ${devManifest.minAppVersion}（真实文件）`);
console.log(`   theme.css      ${useLink ? `软链 → ${repoCss}（不推荐：Obsidian 不监视库外文件，可能不热重载）` : "拷贝（推荐：Obsidian 会监视库内改动并自动重载）"}`);
console.log("");
console.log("在 Obsidian 里启用：");
console.log(`   设置 → 外观 → 主题 → 选「${themeName}」（正式版 OnePage 原样保留，可随时切回对比）`);
if (useLink) {
  console.log("⚠️  软链模式下如果“切换了没生效”，把本脚本换成默认的拷贝模式（去掉 --link）重跑一次，并重启一次 Obsidian。");
} else {
  console.log("改了 src/ 之后：npm run build  →  npm run install:theme -- <库路径>（或加 --watch 让本脚本自动同步）");
}

if (flag("--watch")) {
  let timer = null;
  fs.watch(ROOT, (_event, filename) => {
    if (filename !== "theme.css") return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        fs.copyFileSync(repoCss, cssTarget);
        console.log(`↻ ${new Date().toLocaleTimeString()} 已同步 theme.css（${fs.statSync(repoCss).size} B）`);
      } catch (e) {
        console.error(`✗ 同步失败: ${e.message}`);
      }
    }, 150);
  });
  console.log("👀 监听 theme.css 中（改 src/ → npm run build 就会自动同步到库里；Ctrl+C 退出）");
}
