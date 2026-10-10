#!/usr/bin/env node
/**
 * 一次性拆分脚本（provenance / 审计用）。
 *
 * 把历史上的「单文件 theme.css」拆成 src/ 下的三个源文件。
 * 拆分完成后，src/ 就是唯一事实来源，theme.css 变成构建产物（见 build.mjs）。
 *
 * 产物：
 *   src/00-settings.css   /* @settings ... *​/ 块 + 其后空行
 *   src/10-header.css     版权头注释 + 其后的空行（到基座首行为止）
 *   src/90-onepage.css    OnePage 定制层（到文件末尾）
 *
 * 为了可审计，脚本会顺带验证：theme.css 里的「基座段」（即三个源文件之外的部分）
 * 与 build.mjs 用 vendor/ 里的上游 CSS + 补丁重建出来的基座**逐字节一致**。
 * 这是一次性的等价性证明：证明流水线没有改动任何既有样式。
 *
 * 用法：node scripts/split.mjs [--force] [--check-only]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildBase } from "./build.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const THEME = path.join(ROOT, "theme.css");

const args = process.argv.slice(2);
const force = args.includes("--force");
const checkOnly = args.includes("--check-only");

const text = fs.readFileSync(THEME, "utf8");

/** 定位 @settings 注释块的结束位置（返回注释结束符之后的偏移） */
function settingsBlockEnd(src) {
  const start = src.indexOf("/* @settings");
  if (start < 0) throw new Error("theme.css 里找不到 /* @settings 块");
  const end = src.indexOf("*/", start);
  if (end < 0) throw new Error("@settings 块没有闭合的 */");
  return end + 2;
}

/** 从 from 起找下一个非空白字符 */
function skipWs(src, from) {
  let i = from;
  while (i < src.length && /\s/.test(src[i])) i++;
  return i;
}

const sEnd = settingsBlockEnd(text);

// 头部版权注释：@settings 之后的第一段 /*! ... */ 注释
const headerStart = skipWs(text, sEnd);
if (!text.startsWith("/*!", headerStart)) {
  throw new Error(`@settings 之后期望 /*! 头部注释，实际是: ${JSON.stringify(text.slice(headerStart, headerStart + 20))}`);
}
const headerEnd = text.indexOf("*/", headerStart) + 2;
if (headerEnd < 2) throw new Error("头部注释没有闭合");

// 基座首行 = 头部注释之后第一个非空行
const baseStart = skipWs(text, headerEnd);

// 定制层起点 = 「OnePage 定制层」标题所在行首的 /*
const customMarker = text.indexOf("OnePage 定制层");
if (customMarker < 0) throw new Error("找不到「OnePage 定制层」标记");
const customStart = text.lastIndexOf("/*", customMarker);
if (customStart < baseStart) throw new Error("定制层标记位置异常");

const srcSettings = text.slice(0, headerStart);
const srcHeader = text.slice(headerStart, baseStart);
const srcBase = text.slice(baseStart, customStart);
const srcOnepage = text.slice(customStart);

// —— 等价性证明：vendor 重建出来的基座 + '\n\n' 必须等于 theme.css 里的基座段 ——
const rebuilt = buildBase(ROOT);
const rebuiltBase = rebuilt.base + "\n\n";
const baseMatches = rebuiltBase === srcBase;

console.log(`settings : ${srcSettings.length} bytes`);
console.log(`header   : ${srcHeader.length} bytes`);
console.log(`base     : ${srcBase.length} bytes  (vendor 重建 ${rebuiltBase.length} bytes)`);
console.log(`onepage  : ${srcOnepage.length} bytes`);
console.log(`charset  : ${rebuilt.charset ?? "(none)"}`);
console.log(`基座与 vendor 重建逐字节一致: ${baseMatches ? "✅ 是" : "❌ 否"}`);

if (!baseMatches) {
  const n = Math.min(rebuiltBase.length, srcBase.length);
  let i = 0;
  while (i < n && rebuiltBase[i] === srcBase[i]) i++;
  console.error(`  首个差异 @${i}`);
  console.error(`  vendor: ${JSON.stringify(rebuiltBase.slice(Math.max(0, i - 60), i + 60))}`);
  console.error(`  theme : ${JSON.stringify(srcBase.slice(Math.max(0, i - 60), i + 60))}`);
  process.exit(1);
}

if (checkOnly) process.exit(0);

for (const f of ["src/00-settings.css", "src/10-header.css", "src/90-onepage.css"]) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p) && !force) {
    console.error(`✋ ${f} 已存在。确认要覆盖请加 --force（src/ 一旦建立就是唯一事实来源）`);
    process.exit(1);
  }
}
fs.writeFileSync(path.join(ROOT, "src/00-settings.css"), srcSettings);
fs.writeFileSync(path.join(ROOT, "src/10-header.css"), srcHeader);
fs.writeFileSync(path.join(ROOT, "src/90-onepage.css"), srcOnepage);
console.log("✅ 已写出 src/00-settings.css, src/10-header.css, src/90-onepage.css");
