#!/usr/bin/env node
/**
 * OnePage 主题构建脚本
 * ====================
 *
 * 设计目标：把「上游 Cupertino 基座」和「OnePage 自己的层」解耦，让基座升级变成
 * 一次可复现、可审查、可回滚的操作，而不是手工把新基座塞回单文件里。
 *
 * 产物 theme.css = [@charset] + src/00-settings.css + src/10-header.css
 *                          + vendor 基座（已打补丁） + src/20-tokens.css + src/90-onepage.css
 *
 *   src/00-settings.css  Style Settings 的 @settings 元数据块（中英双语）
 *   src/10-header.css    版权头注释 + 分隔空行
 *   vendor/cupertino/    上游 Cupertino 原样 CSS（钉版本，见 vendor/cupertino/VERSION）
 *   src/20-tokens.css    设计令牌（可定制项的默认值 + 基座变量接线）
 *   src/90-onepage.css   OnePage 定制层（覆盖在基座与令牌之后，后写者胜）
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
  // 2.0.0（基座 Cupertino 4.1.0）起，下列两条历史补丁上游已自行解决，遂删除：
  //   1. obsidian-1.14 功能区类名硬改名：4.1.0 改用裸 `.workspace-ribbon`（不再输出 .mod-left/.mod-primary），
  //      基座侧不再需要批量改写；定制层仍保留 :is(.mod-left,.mod-primary) 写法，对 1.13 也无害。
  //   2. 高亮色环 .highlight-swatch：4.1.0 的全宽 img 排除列表里已自带 .highlight-swatch（4 处），
  //      定制层的 !important 兜底保留（见 src/90-onepage.css「1.14 兼容层」）。
  //
  // 新增补丁的写法：search 必须是全局正则、replace 是替换串、expected 是期望命中次数
  //（命中数不符即构建失败 —— 这是故意设计：宁可报错，不要静默失配）。

  // ---- 2.0.1 性能补丁：消除「单次 DOM 变更 = 全文档样式重算」 ----------------
  // 实测（scripts/perf-probe.mjs，1.14.4 app.css + 6000 节点合成工作区）：
  //   滚动换视口行 13.1ms、切 tab 13.2ms、点文件树 0.9ms、写一次 inline style 12.7ms；
  //   修完分别是 1.4ms / 0.035ms / 0.03ms / 0.1ms（原生 Obsidian 0.22 / 0.05 / 0.002 / 0.013）。
  // 详见 AGENTS.md「性能：不要让选择器触发全文档重算」。
  {
    // 上游 hover-sidedock 这条 `:has(+ … :hover)` 即使 .hover-sidedock 关着也要付代价：
    // 任何元素改 class 都会让 Blink 从 body 重新求值一遍，等于全文档重算。
    // 丢掉的是「鼠标悬停在折叠的右侧栏上时，主区 tab 头不参与窗口拖拽」这一个子特性
    //（该规则块另有 `.is-sidedock-collapsed div:is(...)` 一条仍保留，左侧栏不受影响）。
    name: "perf: hover-sidedock 去掉 :has(+ … :hover) 选择器",
    search:
      /^body:not\(\.is-mobile\)\.hover-sidedock \.mod-root:has\(\+ \.mod-sidedock\.is-sidedock-collapsed\.mod-right-split:hover\) div:is\(\.workspace-tab-header-container, \.workspace-tab-header-container-inner\),\n/gm,
    replace: "",
    expected: 1,
  },
  {
    // 同上的另一种写法：`… .mod-sidedock:has(> .workspace-tabs.mod-active)`（「该侧栏的标签组是否激活」）。
    // 同样只要改 class 就要从上层重新求值，实测单次 13ms；而它要表达的只是
    // 「鼠标在侧栏上时侧栏保持展开」，同一个规则块的 `…[style*=display]:hover` 那几条已经覆盖了。
    // 丢掉的是：用键盘（非鼠标）把焦点切到悬停展开的侧栏时，它不会被立刻推回去 —— 极少见。
    name: "perf: hover-sidedock 去掉 :has(> .workspace-tabs.mod-active) 选择器",
    search: /,\nbody:not\(\.is-mobile\)\.hover-sidedock \.mod-sidedock:has\(> \.workspace-tabs\.mod-active\)/g,
    replace: "",
    expected: 2,
  },
  {
    // 上游这三条手机端「键盘是否弹出」判定，在 html 上按 style 属性做子串匹配：
    // 等于告诉 Blink「任何元素的 style 变化都可能影响根节点」→ 每次写 inline style 全文档重算
    //（Obsidian 拖分隔条/画布/浮层定位都会写 inline style）。
    // 用 `pointer: coarse` 把规则限制到触摸设备：桌面端它们本来就不可能命中(body.is-phone)，
    // 手机端判定完全不变，因此没有任何视觉差异。
    name: "perf: 手机键盘判定规则移入 @media (pointer: coarse)",
    search:
      /^(body\.is-phone:not\(html:where\(\[style\*="--keyboard-height: 0px"\], :not\(\[style\*="--keyboard-height"\]\)\) body\)[^{]*\{[^}]*\}\n)/gm,
    replace: "@media (pointer: coarse) {\n$1}\n",
    expected: 3,
  },
  {
    // 同一块里的 `:hover + .mod-root` / `:hover ~ .mod-root` 兄弟选择器同样是「hover 依赖的失效」：
    // 改侧栏的 class（折叠/展开）就要重新求值 → 实测 7ms。它们只做一件事：hover 模式下属卡浮层出来时，
    // 不让主区 tab 头被当成窗口拖拽区（`-webkit-app-region` 只影响窗口拖拽，不参与绘制，无视觉影响）。
    // 取舍：hover-sidedock / hover-ribbon（默认关）下，拖 tab 头可能拖动窗口；
    // 换来的是所有人折叠/展开侧栏时不再付 7ms 的样式失效开销。
    name: "perf: hover 模式去掉 -webkit-app-region 规则（hover 依赖的兄弟选择器）",
    search:
      /^body:not\(\.is-mobile\)\.hover-sidedock \.mod-sidedock\.is-sidedock-collapsed\.mod-left-split:hover \+ \.mod-root div:is\(\.workspace-tab-header-container, \.workspace-tab-header-container-inner\),\nbody:not\(\.is-mobile\)\.hover-sidedock \.mod-sidedock\.is-sidedock-collapsed div:is\(\.workspace-tab-header-container, \.workspace-tab-header-container-inner\),\nbody:not\(\.is-mobile\)\.hover-ribbon \.workspace-ribbon:hover ~ \.mod-root div:is\(\.workspace-tab-header-container, \.workspace-tab-header-container-inner\) \{\n  -webkit-app-region: no-drag;\n\}\n/gm,
    replace: "",
    expected: 1,
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


/**
 * Style Settings 颜色控件的初始色（构建期生成）。
 *
 * 插件在「用户从未改过」时把 --pcr-color 设成空字符串，而 CSSOM 里
 * `style.setProperty("--pcr-color", "")` 等价于**移除该属性** → wrapper 上没有 inline style，
 * `background: var(--pcr-color)` 无 fallback → ::after 变透明（用户看到的是棋盘格）。
 *
 * 这里从 @settings 的 default-light / default-dark 生成两条规则，给色块一个初始色：
 *   - 用户没改过：规则生效，色块显示默认色
 *   - 用户改过：插件写 inline style，inline 永远赢普通声明 → 正常显示用户值
 * 值来自 @settings 的 default，而 default 又由 verify 校验与 20-tokens.css 一致，不会漂移。
 */
export function buildPreviewColorDefaults(settingsCss) {
  const lines = [
    "/* =====================================================================",
    "   Style Settings 颜色控件的初始色（由 scripts/build.mjs 自动生成，请勿手改）",
    "   来源：src/00-settings.css 里每个 variable-themed-color 的 default-light/dark",
    "   ===================================================================== */",
  ];
  let n = 0;
  for (const item of settingsCss.split(/^ {4}-\s*$/m).slice(1)) {
    if (!/^ {8}type:\s*variable-themed-color\s*$/m.test(item)) continue;
    const id = /^ {8}id:\s*(\S+)/m.exec(item)?.[1];
    const dl = /^ {8}default-light:\s*'?([^'\s]+)'?/m.exec(item)?.[1];
    const dd = /^ {8}default-dark:\s*'?([^'\s]+)'?/m.exec(item)?.[1];
    if (!id || !dl || !dd) continue;
    lines.push(`.setting-item[data-id="${id}"] .themed-color-wrapper > .theme-light { --pcr-color: ${dl}; }`);
    lines.push(`.setting-item[data-id="${id}"] .themed-color-wrapper > .theme-dark { --pcr-color: ${dd}; }`);
    n++;
  }
  if (!n) return "";
  return lines.join("\n");
}

/** 组装最终 theme.css */
export function build(root = ROOT, opts) {
  const { version, charset, base, report } = buildBase(root, opts);
  const settings = readSrc(root, "00-settings.css");
  const header = readSrc(root, "10-header.css");
  const tokens = readSrc(root, "20-tokens.css");
  const onepage = readSrc(root, "90-onepage.css");
  // 顺序不可换：令牌必须落在基座之后，才能覆盖基座的同名变量
  //（如 --line-width / --p-spacing / --radius-window），又必须落在定制层之前。
  const previews = buildPreviewColorDefaults(settings);
  const out = `${charset ? `@charset "${charset}";\n` : ""}${settings}${header}${base}\n\n${tokens}\n${previews}\n${onepage}`;
  return { css: out, version, charset, base, settings, header, tokens, previews, onepage, report };
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
