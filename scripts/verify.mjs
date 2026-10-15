#!/usr/bin/env node
/**
 * OnePage 主题校验脚本
 * ====================
 * 运行 `npm run verify`（或 node scripts/verify.mjs）。硬错误（❌）会导致非零退出。
 *
 * 检查项：
 *   1. theme.css 是否与构建产物一致（防止提交了忘记重新构建的旧产物）
 *   2. 大括号是否平衡
 *   3. 选择器改写是否留下了 :is( 残渣（历史踩坑：漏掉前导点会产生非法的 .:is( ）
 *   4. @settings 元数据块是否合法（id 唯一、每项都有 type）
 *   5. manifest.json / versions.json 版本一致性（x.y.z、无 v 前缀、minAppVersion 对得上）
 *   6. 变量体检：src/ 里引用了「无 fallback 且构建产物中未定义」的 CSS 变量 ——
 *      这些变量要么来自 Obsidian 本体、要么来自 Style Settings 插件注入，
 *      要么就是拼写错误 / 上游已删除（本次 4.x 升级的主要风险就出在这里）。
 *      名单在 EXTERNAL_VARS 里显式声明，新增会报警告，需人工确认后登记。
 */
import fs from "node:fs";
import path from "node:path";
import { build, ROOT } from "./build.mjs";

/**
 * 允许「未在主题中定义、且没有 fallback」的变量白名单。
 * 两类：
 *   - Obsidian 本体内建（app.css 提供）
 *   - Style Settings 插件按 @settings 声明注入（--onepage-* 等）
 * 每项都写明来历，避免以后变成"垃圾抽屉"。
 */
const EXTERNAL_VARS = new Set([
  // —— Style Settings 插件注入（见 src/00-settings.css 的 @settings 声明）——
  "--onepage-accent-h", "--onepage-accent-s", "--onepage-accent-l",
  "--onepage-accent-rgb-r", "--onepage-accent-rgb-g", "--onepage-accent-rgb-b",
  "--onepage-accent-hex", "--onepage-demo-font", "--line-height-normal",
  // —— Obsidian 本体（app.css，1.14.4 已核对）——
  "--text-highlight", "--text-normal-editor", "--img-grid-gap",
  "--readable-spacing-modifier", "--metadata-label-width-modifier",
  "--mobile-sidebar-width-override", "--embed-border-color", "--embed-border-thickness",
  "--table-text-align-header", "--table-text-align-body", "--bases-table-align-items",
  "--mono-rgb-100", "--font-normal", "--checkbox-size", "--size-4-2",
  "--background-modifier-hover", "--font-monospace",
  // 4.1.0 起基座不再自带这一项（3.2.12 里有 3 处定义），改由核心提供：
  // app.css:2949 `--background-modifier-border-hover: var(--color-base-35)`
  // 用途：src/90-onepage.css 的滚动条 thumb:hover。
  "--background-modifier-border-hover",
]);

const errors = [];
const warnings = [];
const ok = [];

/** 1) theme.css 与构建产物一致性 */
const built = build(ROOT);
const onDisk = fs.readFileSync(path.join(ROOT, "theme.css"), "utf8");
if (onDisk === built.css) {
  ok.push(`theme.css 与构建产物一致（${Buffer.byteLength(onDisk)} bytes，基座 Cupertino ${built.version}）`);
} else {
  errors.push("theme.css 与当前 src/ + vendor/ 的构建产物不一致 —— 请运行 npm run build 后重新提交");
}

const css = built.css;

/** 2) 大括号平衡（CSS 注释先剔除，注释里的 {} 不参与） */
const cssNoComment = css.replace(/\/\*[\s\S]*?\*\//g, "");
const open = (cssNoComment.match(/{/g) ?? []).length;
const close = (cssNoComment.match(/}/g) ?? []).length;
if (open === close) ok.push(`大括号平衡（{ ${open} / } ${close}）`);
else errors.push(`大括号不平衡：{ ${open} / } ${close}`);

/** 3) :is( 残渣（同样只看非注释部分） */
for (const bad of [".:is(", ":is(,", ":is()"]) {
  if (cssNoComment.includes(bad)) errors.push(`发现可疑选择器残渣 ${JSON.stringify(bad)}（多为批量改写漏了前导点）`);
}
if (!cssNoComment.includes(".:is(")) ok.push("无 .:is( 残渣");

/** 4) @settings 元数据块 */
{
  const start = css.indexOf("/* @settings");
  const end = css.indexOf("*/", start);
  const block = start >= 0 && end > start ? css.slice(start, end) : "";
  if (!block) {
    errors.push("找不到 /* @settings 元数据块（Style Settings 将完全失效）");
  } else {
    // 顶层条目固定为 8 空格缩进；alt-format 里的子 id（16 空格）属于上一项的备用格式，没有 type
    const ids = [...block.matchAll(/^ {8}id:\s*(\S+)/gm)].map((m) => m[1]);
    const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
    // 逐条校验：每个 id 到下一个 id 之间的片段里必须有 type
    const noType = [];
    ids.forEach((id, i) => {
      const from = block.indexOf(id);
      const to = i + 1 < ids.length ? block.indexOf(ids[i + 1], from) : block.length;
      if (!/^ {8}type:\s*\S+/m.test(block.slice(from, to))) noType.push(id);
    });
    if (dupes.length) errors.push(`@settings 里 id 重复：${[...new Set(dupes)].join(", ")}`);
    else ok.push(`@settings id 唯一（共 ${ids.length} 项）`);
    if (noType.length) errors.push(`@settings 缺少 type 字段：${noType.join(", ")}`);

    // 4.1) YAML 值安全：Style Settings 用 js-yaml 解析 @settings，普通标量里出现「冒号+空格」
    // 会被当成嵌套 mapping → YAMLException: bad indentation of a mapping entry（真实踩坑：232:33）。
    // 这里扫一遍：未加引号 / 非块标量的值里若含 ASCII「: 」直接报错。
    {
      const lines = block.split("\n");
      let blockBase = null; // 处于块标量（| 或 >）中时的基准缩进
      const bad = [];
      lines.forEach((line, idx) => {
        const indent = line.match(/^ */)[0].length;
        if (blockBase !== null) {
          if (line.trim() === "" || indent > blockBase) return; // 块标量内容
          blockBase = null; // 块结束
        }
        const m = line.match(/^(\s*)([A-Za-z][A-Za-z0-9_.]*):(.*)$/);
        if (!m) return;
        const [, , key, rest] = m;
        const value = rest.trim();
        if (value === "") return;
        if (/^[|>`"']/.test(value)) {
          if (/^[|>]/.test(value)) blockBase = indent + 1; // 进入块标量
          return; // 引号 / 块标量 / 折叠标量都安全
        }
        if (/:\s/.test(value)) bad.push(`第 ${idx + 1} 行（${key}）：${value.slice(0, 70)}…`);
      });
      if (bad.length)
        errors.push(
          `@settings 有 YAML 不安全的值（未加引号的值里含「冒号+空格」，Style Settings 会报 YAMLException）：\n      ${bad.join("\n      ")}\n      → 用 | 块标量书写，或给值加引号`,
        );
      else ok.push("@settings 值无 YAML 不安全写法（未加引号的值里无「冒号+空格」）");
    }
  }
}

/** 5) 版本一致性 */
{
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  const versions = JSON.parse(fs.readFileSync(path.join(ROOT, "versions.json"), "utf8"));
  const v = manifest.version;
  if (!/^\d+\.\d+\.\d+$/.test(v)) errors.push(`manifest.version 必须是纯数字 x.y.z（当前 ${JSON.stringify(v)}，禁止 v 前缀）`);
  else ok.push(`manifest.version = ${v}`);
  if (versions[v] === undefined) errors.push(`versions.json 缺少 ${v} 的映射（Obsidian 靠它判断兼容性）`);
  else if (versions[v] !== manifest.minAppVersion) {
    errors.push(`versions.json["${v}"] = ${versions[v]}，但 manifest.minAppVersion = ${manifest.minAppVersion}，两者必须一致`);
  } else ok.push(`versions.json["${v}"] = minAppVersion = ${manifest.minAppVersion}`);
  if (!/^\d+\.\d+\.\d+$/.test(manifest.minAppVersion)) errors.push(`minAppVersion 格式异常：${manifest.minAppVersion}`);
}

/** 6) 变量体检（只看 OnePage 自己写的两个源文件） */
{
  const defined = new Set([...css.matchAll(/(--[A-Za-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const own = ["90-onepage.css", "00-settings.css"].map((f) => fs.readFileSync(path.join(ROOT, "src", f), "utf8")).join("\n");
  // 只挑「var(--x)」这种没有 fallback 的写法
  const bare = new Set([...own.matchAll(/var\(\s*(--[A-Za-z0-9-]+)\s*\)/g)].map((m) => m[1]));
  const unknown = [...bare].filter((v) => !defined.has(v) && !EXTERNAL_VARS.has(v)).sort();
  if (unknown.length) {
    warnings.push(
      `以下变量既未在构建产物中定义、也没有 fallback、也不在白名单里：\n      ${unknown.join("\n      ")}\n` +
        `      → 请确认它来自 Obsidian 本体还是插件；若合法请登记进 scripts/verify.mjs 的 EXTERNAL_VARS`,
    );
  } else {
    ok.push(`无 fallback 的外部变量均已登记（${bare.size} 个）`);
  }
}

for (const m of ok) console.log(`✅ ${m}`);
for (const m of warnings) console.log(`⚠️  ${m}`);
for (const m of errors) console.log(`❌ ${m}`);
console.log(errors.length ? `\n校验失败：${errors.length} 个错误` : "\n校验通过");
process.exit(errors.length ? 1 : 0);
