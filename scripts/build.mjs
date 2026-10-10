#!/usr/bin/env node
/**
 * OnePage 主题构建脚本
 * ====================
 *
 * 设计目标：把「上游 Cupertino 基座」和「OnePage 自己的层」解耦，让基座升级变成
 * 一次可复现、可审查、可回滚的操作，而不是手工把新基座塞回单文件里。
 *
 * 产物 theme.css = [@charset] + src/00-settings.css + src/10-header.css
 *                          + vendor 基座（已打补丁） + src/90-onepage.css
 *
 *   src/00-settings.css  Style Settings 的 @settings 元数据块（中英双语）
 *   src/10-header.css    版权头注释 + 分隔空行
 *   src/90-onepage.css   OnePage 定制层（16 个章节，覆盖在基座之后，后写者胜）
 *   vendor/cupertino/    上游 Cupertino 原样 CSS（钉版本，见 vendor/cupertino/VERSION）
 *
 * 补丁（PATCHES）：
 *   上游基座不能改（保持可 diff、可重新下载覆盖），所有 OnePage 需要的底座修正
 *   都在这里声明式地打上去。每个补丁都要写 expected 命中数，命中数不符直接报错
 *   —— 这样上游改名 / 重构时会立刻失败，而不是静默失效（历史教训：功能区类名
 *   改名导致规则静默失配，图标全部消失却没有任何报错）。
 *
 * 用法：
 *   node scripts/build.mjs                 写入 theme.css
 *   node scripts/build.mjs --check <file>  只构建到内存并与 <file> 比较（不改文件）
 *   node scripts/build.mjs --base          只输出基座段（供 split.mjs 做等价性校验）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * 声明式补丁表。
 * search 必须是全局正则；expected 是期望命中次数（不符即报错）。
 */
export const PATCHES = [
  {
    name: "obsidian-1.14: 功能区类名硬改名 .mod-left → .mod-primary",
    // 1.13 及以前: .workspace-ribbon.mod-left
    // 1.14+:       .workspace-ribbon.mod-primary（只输出新类，旧类消失）
    // :is() 取参数中最高特异性，三个参数同为 (0,2,0)，改写后特异性不变，1.13/1.14 双兼容。
    search: /\.workspace-ribbon\.mod-left/g,
    replace: ":is(.workspace-ribbon.mod-left,.workspace-ribbon.mod-primary)",
    expected: 37,
  },
  {
    name: "obsidian-1.14: 高亮色环 .highlight-swatch 不能吃「全宽元素」规则",
    // 基座把 .cm-content 下的裸 img 拉成整行宽（色环 img 没有 width 属性），
    // 会把 0.9em 的圆点拉成整行宽。把它加进排除列表。
    search: /img:not\(\[width\],\.cm-widgetBuffer,\.link-favicon,\.emoji,\[alt=banner\]\)/g,
    replace: "img:not([width],.cm-widgetBuffer,.link-favicon,.emoji,[alt=banner],.highlight-swatch)",
    expected: 4,
  },
];

/** 从上游 theme.css 里取出 @charset（若有），并从正文中移除 */
export function extractCharset(css) {
  const m = css.match(/^@charset\s+"?([\w-]+)"?\s*;\s*\n?/);
  if (!m) return { charset: null, rest: css };
  return { charset: m[1], rest: css.slice(m[0].length) };
}

/**
 * 由 vendor 上游 CSS 构造基座段（不含首尾分隔空行）。
 * 上游 theme.css 的结构是：CSS + `/*!` + `/* @settings ... *​/` + CSS
 * （`/*!` 那个注释把 @settings 整段吞掉，所以对 CSS 来说是惰性文本）
 * 这里把「`/*!` 起到设置块闭合为止」整段摘掉。
 */
export function buildBase(root = ROOT, { patches = PATCHES } = {}) {
  const version = fs.readFileSync(path.join(root, "vendor/cupertino/VERSION"), "utf8").trim();
  const raw = fs.readFileSync(path.join(root, "vendor/cupertino", version, "theme.css"), "utf8");
  const { charset, rest } = extractCharset(raw);

  const settingsIdx = rest.indexOf("/* @settings");
  if (settingsIdx < 0) throw new Error(`${version}/theme.css 里找不到 /* @settings 块`);
  const bangIdx = rest.lastIndexOf("/*!", settingsIdx);
  if (bangIdx < 0) throw new Error(`${version}/theme.css 里找不到 @settings 之前的 /*! 起始注释`);
  const closeIdx = rest.indexOf("*/", settingsIdx);
  if (closeIdx < 0) throw new Error(`${version}/theme.css 的 @settings 块没有闭合`);

  const head = rest.slice(0, bangIdx).replace(/\s+$/, "");
  const tail = rest.slice(closeIdx + 2).replace(/^\s+/, "");
  let base = `${head}\n${tail}`;

  const report = [];
  for (const p of patches) {
    const hits = (base.match(p.search) ?? []).length;
    if (hits !== p.expected) {
      throw new Error(
        `补丁「${p.name}」命中 ${hits} 处，期望 ${p.expected} 处 —— 上游基座可能已改动，请人工确认后再更新 expected。`,
      );
    }
    base = base.replace(p.search, p.replace);
    report.push(`${p.name} × ${hits}`);
  }
  return { version, charset, base, report };
}

function readSrc(root, name) {
  const p = path.join(root, "src", name);
  if (!fs.existsSync(p)) throw new Error(`缺少源文件 src/${name}（首次可从旧 theme.css 用 scripts/split.mjs 拆出）`);
  return fs.readFileSync(p, "utf8");
}

/** 组装最终 theme.css */
export function build(root = ROOT, opts) {
  const { version, charset, base, report } = buildBase(root, opts);
  const settings = readSrc(root, "00-settings.css");
  const header = readSrc(root, "10-header.css");
  const onepage = readSrc(root, "90-onepage.css");
  const out = `${charset ? `@charset "${charset}";\n` : ""}${settings}${header}${base}\n\n${onepage}`;
  return { css: out, version, charset, base, settings, header, onepage, report };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = process.argv.slice(2);
  const checkAt = args.indexOf("--check");

  if (args.includes("--base")) {
    process.stdout.write(buildBase(ROOT).base);
  } else {
    const { css, version, charset, report } = build(ROOT);
    console.log(`基座版本: Cupertino ${version}${charset ? `  (@charset ${charset} 已提到文件首行)` : ""}`);
    for (const r of report) console.log(`  补丁 ✅ ${r}`);
    console.log(`产物大小: ${Buffer.byteLength(css)} bytes`);

    if (checkAt >= 0) {
      const target = args[checkAt + 1];
      const ref = fs.readFileSync(target, "utf8");
      if (ref === css) {
        console.log(`等价性校验 ✅ 与 ${target} 逐字节一致`);
      } else {
        const n = Math.min(ref.length, css.length);
        let i = 0;
        while (i < n && ref[i] === css[i]) i++;
        console.error(`等价性校验 ❌ 与 ${target} 不一致：ref ${ref.length} bytes / built ${css.length} bytes，首个差异 @${i}`);
        console.error(`  ref  : ${JSON.stringify(ref.slice(Math.max(0, i - 80), i + 80))}`);
        console.error(`  built: ${JSON.stringify(css.slice(Math.max(0, i - 80), i + 80))}`);
        process.exit(1);
      }
    } else {
      fs.writeFileSync(path.join(ROOT, "theme.css"), css);
      console.log("✅ 已写入 theme.css");
    }
  }
}
