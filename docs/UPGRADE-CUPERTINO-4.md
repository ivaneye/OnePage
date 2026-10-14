# OnePage 2.0.0：升级 Cupertino 基座到 4.x — 实施计划

> 记录时间：2026-10-10（动工前的方案评审稿，已评审通过）
> 状态：**Phase 2–4 已实施完毕（基座已换 4.1.0），工作区改动均未提交、未发布，待人工验证**。
> 前置工作已完成并发布 **1.3.0**（结构重构 + 兼容修复 + 构建流水线，见 §2）。
> 待定项：透明模式 / 毛玻璃的取舍（§3.5）—— **已定：分区玻璃（Sidebar stays matte）**，见 §3.5。
> 环境：本机 Obsidian 已升级 1.14.4 ✅（`/Applications/Obsidian.app` 内 Electron **43.7.7**，
> 即 `@supports (interpolate-size: allow-keywords)` / `corner-shape: superellipse()` 均可用，Phase 0 的安装包条件已满足）。

---

## 0. 结论速览

| 项 | 现状 | 目标 |
| --- | --- | --- |
| Cupertino 基座 | 3.2.12（2026-07-31） | **4.1.0（2026-10-08，最新）** |
| Cupertino `minAppVersion` | 1.13.4 | **1.14.0** |
| OnePage `minAppVersion` | 1.13.4 | **1.14.0（与上游一致）** |
| OnePage 版本 | 1.2.1 | **2.0.0** |
| 本机 Obsidian | ~~1.13.7~~ → **已升级 1.14.4** ✅ | 1.14.4 |

- 4.0 是 **Liquid Glass 全面重写**：旧基座 1,847 个选择器里 **818 个（44%）被删除**，CSS 变量 **+109 / −88**。不是小版本升级，必须按大版本对待。
- 4.x 的构建产物形态也变了：**从「压缩成 2 行」变成格式化的 7,314 行**。原来「把基座两行内联进 theme.css」的做法必须换成可复现的构建流水线。
- 两个历史补丁上游已自行解决（见 §3.3），2.0.0 时应删除；剩下的定制层风险点见 §3.4。

---

## 1. 现状盘点（2026-10-10 实测）

`theme.css`（1.2.1）= 1,532 行 / 377,415 B（UTF-8 字节 388,546），由 4 段拼成：

| 段 | 行 | 来源 |
| --- | --- | --- |
| `/* @settings … */` | 1–293 | OnePage 手写（Cupertino 设置全部中英化 + OnePage 专属项） |
| 版权头注释 | 295–302 | OnePage 手写 |
| **基座** | 306–307（压缩 2 行） | Cupertino 3.2.12，删掉上游 `@settings` 注释块 + 2 个补丁 |
| OnePage 定制层 | 309–1532（1,225 行 / 16 章节） | 手写 |

**已验证：用 `vendor/cupertino/3.2.12/theme.css` + 2 个补丁 + `src/` 三个源文件重建，产物与 1.2.1 的 `theme.css` 逐字节一致。**（`npm run build -- --check <file>`）

---

## 2. 构建流水线（1.3.0 已落地）

```
vendor/cupertino/VERSION          3.2.12（升级时只改这一行）
vendor/cupertino/<ver>/theme.css  上游原样，一个字节都不改
vendor/cupertino/<ver>/manifest.json
src/00-settings.css               @settings 元数据块（中英双语）
src/10-header.css                 版权头注释
src/90-onepage.css                OnePage 定制层
scripts/build.mjs                 拼装 + 声明式补丁（带命中数断言）
scripts/split.mjs                 一次性拆分 + 等价性证明
scripts/verify.mjs                括号/元数据/版本/变量体检
```

产物 = `[@charset] + 00-settings + 10-header + 补丁后的基座 + 90-onepage`。

**设计要点**：基座保持与上游逐字节一致（便于 diff / 重新下载覆盖），OnePage 需要的所有底座修正都写在 `build.mjs` 的 `PATCHES` 里，**每个补丁声明 `expected` 命中数，不符即构建失败**——避免上游改名后规则静默失配（历史教训：功能区类名硬改名，图标全部消失且无任何报错）。

---

## 3. 4.x 具体变化与适配清单

### 3.1 基座形态
- 4.1.0：`7314` 行 / 326,506 B，开头多一行 `@charset "UTF-8";` → 构建时提到产物首行。
- 上游 `@settings` 块位置改变，构建脚本按**标记**（`/*!` … `/* @settings` … 首个 `*/`）摘除，不依赖行号。

### 3.2 设置项变化（3 处）
| 动作 | id | 说明 |
| --- | --- | --- |
| 新增 | `media-width-fit` | Disable full-width elements（**语义与旧项相反**：开关类名从 `full-width-media-off` 变成 `media-width-fit`） |
| 删除 | `full-width-media-off` | 被上面替代 |
| 删除 | `dynamic-type-off` | 上游取消 |

其余 23 项 id / 标题 / 默认值均未变；OnePage 刻意隐藏的 `status-bar-baseline` 等保持隐藏。

### 3.3 上游已自行修复（2.0.0 时删除对应补丁）
- `.highlight-swatch`：4.1.0 已写进全宽媒体排除列表（4 处）。
- 功能区：4.1.0 改用**裸 `.workspace-ribbon`**（不再出现 `.mod-left`），改写补丁命中数会变 0。

### 3.4 定制层风险点（按风险排序，逐条需视觉复核）

> 下表结论基于 **4.1.0 / 1.14.4 / 1.13.7 的源码级 diff**（逐条规则对比，非推断）；
> 带 🆕 的行是源码 diff 新发现、文档旧版未记录。**UI 观感仍以 Phase 6 截图为准。**

| 位置 | 实测问题 | 处理方向 | 风险 |
| --- | --- | --- | --- |
| 🆕 **开关 toggle**（`.checkbox-container`） | 4.1.0 新增 `body:not(.accented-interface) .checkbox-container{--interactive-accent:var(--color-green)}`（`:3893`），而 `accented-interface` 全表只出现这一次、无人设置 → **等效把所有开关染成系统绿**。OnePage 的 `--interactive-accent:var(--text-accent)!important`（`src:453/498`）声明在 `body` 上，**继承值打不过元素自身的声明** | 定制层加 `.checkbox-container{--interactive-accent:var(--text-accent)!important}`；并复测 §4 属性面板开关兜底（4.1.0 阴影改用 `--slider-thumb-shadow`） | **中**（用户可见变绿） |
| 🆕 **活动 tab**（§8） | 3.2.12 `background-color: rgba(primary/75%)` + `box-shadow: var(--shadow-tab)` → 4.1.0 `background: var(--raised-background)` + `box-shadow: var(--raised-shadow)`（`:977-980`）；`--shadow-tab` **已删除**。`background:` 简写会同时设 `background-image`，而 OnePage 的透明模式覆盖只写 `background-color`（`src:422`）→ **覆盖静默失效** | 选「全平」：显式 `background: <OnePage 色> !important`（或补 `background-image:none !important`）；顺带 `corner-shape: round`（基座是 `superellipse(1.1)`） | **中** |
| 复选框（约 178–222 行） | **基座侧无实质变化**：`--checkbox-radius:100px` 3.2.12 即有（不是 4.x 新特性）；core `input[type=checkbox]` 整段 1.13.7↔1.14.4 逐字节相同（`--checkbox-size` 仅 `font-text-size`→`font-preferred-size`，而后者默认等于前者）。**真问题是 OnePage 自己的债**：`.markdown-rendered .task-list-item-checkbox{border-radius:4px}`（`src:169`）只命中阅读视图，实时预览/属性面板走基座 100px → 三处本就不一致 | **定稿：统一为圆形。** 删掉 `src:169` 那条 4px 例外（或改成 `border-radius: var(--checkbox-radius)`）；尺寸三处统一用 `var(--checkbox-size)`，不再硬编码 15px。`top:-1px`/`mask-size:100%` 那套对勾补偿与形状无关，原样保留 | 低（纯视觉；**与 4.x 无关，可提前单独修**） |
| `src/90-onepage.css` Bases 卡片 | `var(--shadow-tactile)` 4.1.0 已删除；且 4.1.0 的 `--shadow-s` 换成带 edge-highlight 的新配方 | 1.3.0 已加 fallback `var(--shadow-tactile, var(--shadow-s))`；剩下的是**目视定标**，不是代码修 | 低 |
| 🆕 **代码块** | 3.2.12 有 `--code-background: var(--background-secondary-alt)` + macOS 专属 `pre{background:linear-gradient(primary-alt→secondary); box-shadow:var(--shadow-tactile)}`，4.1.0 **两条都删**，且 `.markdown-rendered pre` 设 `--code-border-width:0px`（`:3044`）→ 回落到 core 的 `--background-primary-alt` 纯色、无阴影。OnePage 只覆盖 `border`/`radius`（`src:117`） | 倾向**接受平底**（更贴纸面语言）；若要恢复，用 OnePage 自己的颜色显式写，别依赖基座 `--code-background`。另需确认行内代码 `padding` 是否被 4.1.0 新规则顶掉 | 低 |
| Callout | **OnePage 一条 callout 规则都没有**（`src` grep = 0）→ 无覆盖可清理。4.1.0 是**换配方**（非删除）：`background: var(--raised-background)` + `background-color: hsl(accent 15%)` + `0.5pt accent 环` + `--raised-shadow`，macOS 下 `border:none`（`:3472-3477`）；`--callout-border-width` 由 `divider-width` 变 `border-width`，新增 `--callout-border-opacity: 0.15`（core 0.25） | **定稿（§3.4.1 / §3.4.1.1）：无描边 + OnePage 自定暖色墨色配色 + 相邻间距 24px。** ⚠️ 关键：4.1.0 在 macOS 下已经 `border:none`（computed 实测 `border-width:0px`），用户看到的那圈框来自 **`box-shadow` 里的两层 `0 0 0 0.5pt`**（accent 环 + `--raised-shadow` 首层的 `rgba(0,0,0,.075)` 灰环）→ **只写 `border:none` / `--callout-border-width:0` 无效，必须重写 `box-shadow`** | 低 |
| 侧边栏卡片（§6/§7 及非透明兜底） | 4.1.0 **没有**给侧边栏加玻璃/圆角/留白（全表 `.mod-sidedock` 上无 `backdrop-filter`/`border`/`border-radius`/`margin`）；新增的只有未聚焦 `opacity:.75`（`:3789`）与分隔线 `border-color:var(--divider-color)`（`:3805`） | 降级：**不是正面冲突**，只需对齐 resize-handle / divider 两条，卡片语言原样保留 | 低 |
| 🆕 **tab 容器 / 侧栏 tab** | 4.1.0 给 `.mod-root .workspace-tab-container` 加 `box-shadow: 0 0 0 var(--tab-outline-width) var(--tab-outline-color)`（`:2983`/`:3800`，macOS 下 transparent，Win/Linux 默认 `rgba(mono,.05)`）；OnePage 的 `box-shadow:none` 清理列表**未含** `.workspace-tab-container`。侧栏 tab 新增收起态（`:not(:hover) .workspace-tab-header{background:var(--background-modifier-hover)}` + `height:var(--header-height)` + `calc-size()`，`:1044-1058`） | 把 `.workspace-tab-container` 补进清理列表；复测侧栏 tab 收起态与 §7 卡片是否打架 | 低 |
| 属性面板（§12） | 4.1.0「Properties 更紧凑」 | 复测 `.metadata-property-key` 居中等覆盖是否仍需要 | 低 |
| 菜单/弹窗（§15） | 4.1.0 在 `.is-translucent` 下已把 `--menu-background`/`--modal-background` 改绑**实色** `--background-primary` + `--blur-*:none`（`:179-181`/`:4166-4170`）→ 老「透字」bug 上游已修 | §15 降级为**兜底保险**（保留、改注释），不再算风险项 | 低 |
| 状态栏（§5） | 4.1.0 新增 hover 玻璃（`:4156-4160`），与 OnePage 的不透明底 `!important` 冲突 → **blur 白挂** | 二者选一：删 `background !important` 让玻璃生效，或显式 `backdrop-filter:none` | 低 |
| Relative Line Numbers | 4.1.0 **仍然保留** `.relative-line-numbers-mono{position:absolute;width:100%}` | `pointer-events:none` 补丁必须保留 | 低（已有补丁） |

#### 3.4.1 Callout 定稿：保留 4.1.0 玻璃淡底，只去掉那圈框

**结论（用户选定）**：要 4.1.0 那个柔和淡底（对照图 B），但**不要那圈 border**；**不要左侧强调条**。

**关键发现（computed style 实测，非推断）**：4.1.0 在 macOS 下的 callout **已经是 `border: none`（实测 `border-width: 0px`）**，
用户看到的"四个角上的 border"是 **`box-shadow` 里的两层 `0 0 0 0.5pt` 环**：

```
box-shadow: color(accent / 0.15) 0 0 0 0.666667px,      ← accent 环（Cupertino 自己的）
            rgba(255,255,255,.25) inset 0 0 0 0.666667px,
            rgba(0,0,0,0.075) 0 0 0 0.666667px,          ← 灰环（--shadow-edges 首层，视觉上最明显）
            rgba(0,0,0,.3) -1px 0 0 -0.666667px,
            rgba(0,0,0,.3) 1px 0 0 -0.666667px,
            inset rgba(255,255,255,.5) 0 2px 2px -2px,
            inset rgba(255,255,255,.5) 0 -2px 2px -2px,
            rgba(0,0,0,0.035) 0 2px 8px 0
```

→ **`border: none` / `--callout-border-width: 0` 对它完全无效**（本来就是 0px）；只把 `--callout-border-opacity` 置 0 也只能干掉第一层，
剩下第三层的灰环仍是肉眼可见的一条线（像素实测：页面底 `(232,232,232)` → 灰环处 `(169,169,169)`；去掉两层环后为 `(229,229,229)`，与页面底几乎无差）。

**定稿 CSS**（保留玻璃底 + 保留基座的内高光 + 只重写 box-shadow）：

```css
/* Callout: 保留 4.1.0 的玻璃淡底, 只去掉两层 0.5pt 环与左右细线 */
.callout {
  --callout-border-width: 0px;
  --callout-border-opacity: 0;
  border: none !important;
  box-shadow:
    inset 0 1.5pt 1.5pt -1.5pt hsl(0 0% 100% / 0.5),
    inset 0 -1.5pt 1.5pt -1.5pt hsl(0 0% 100% / 0.5),
    0 2px 8px hsl(0 0% 0% / 0.035) !important;
}
body.theme-dark .callout {
  box-shadow:
    inset 0 1.5pt 1.5pt -1.5pt hsl(0 0% 100% / 0.25),
    inset 0 -1.5pt 1.5pt -1.5pt hsl(0 0% 100% / 0.25),
    0 2px 8px hsl(0 0% 0% / 0.2) !important;
}
```

~~不设 `background` → 继续用基座的 `--raised-background` + accent 15%~~（**已在第一轮走查后改掉，见下**）。

#### 3.4.1.1 走查反馈（2026-10-10）与追加决策

用户实测后提了两条：**① 相邻 callout 挤在一块；② 整体配色与主题不搭**。均已修（`src/90-onepage.css` §18）：

1. ~~相邻 callout 贴死~~ → **这条判断是错的，已回退**（第二次走查纠正）。
   当时的依据是「无头 Chrome 合成 DOM 量到实时预览间距 0px」，但那个合成 DOM **漏了空行对应的 `.cm-line`**：
   真实 Obsidian 里两个 callout 必须空一行才分得开，**那一行本身就是间距**。
   再叠一层 `margin-block` 就变成「空行 + 24px」→ 用户实测“距离很大”。
   ✅ 定稿：**不给 callout 加任何额外 margin**，保持 upstream 行为。实测（含空行）：
   - 实时预览：间距 = 空行自身高度 **28px**（notes 库 17px 字号；`margin: 0`，来自 core 的 `.mod-cm6 .callout{margin:0}`）
   - 阅读视图：间距 = core 的 **`1em` = 16px**（无空行渲染）
   （若以后觉得阅读视图太紧，不要动实时预览 —— 用 `.markdown-preview-view .callout` 单独加。）
   ⚠️ **嵌入态（`![[笔记#小节]]` / hover 预览）是例外**：LP 里的嵌入内容是一个**嵌套的只读编辑器**，
   继承了 core 的 `.mod-cm6 .callout{margin:0}`，而嵌入里不渲染源码空行 → 相邻 callout **完全贴死**（走查实证）。
   修法：`.markdown-embed .callout:not(.callout .callout) { margin-block: 1em }` ——
   1em 取的就是 core 阅读视图的默认值，所以在 RV 嵌入里等于没改，只有 LP 嵌入被抬回来。
   （不要用 `.callout + .callout`：LP 里两个 callout 各自在 `.cm-line > .cm-embed-block` 里，不是兄弟节点。）
2. **配色不搭**：基座浅色用的是 macOS 系统色（`#6aadfa` / `#38dbd6` / `#bb9ef5` / `#4ad55f` …），
   高彩度且偏冷，放在暖白 `#faf7f1` / 暖棕 `#262322` 上像贴纸。改为 OnePage 自定的**暖色墨色体系**：
   只覆写核心的 14 个 `--callout-*` 语义变量（图标 / 标题 / 淡染底 / 内嵌表格自动跟随），
   浅色用低彩度「墨」、暗色用提亮降彩度的「粉」，两端保持同一色相关系
   （石板蓝陈述 / 青灰绿摘要 / 赭金技巧 / 苔绿成功 / 藤紫疑问 / 琥珀警告 / 砖红失败 / 暖灰褐引用）。
3. **底色结构改了**：不再叠 `--raised-background`（那层 ~50% 透明玻璃渐变会把 15% 淡染冲成灰白，
   实测在玻璃下几乎分不出类型）→ 改成 `background: color-mix(in srgb, var(--background-primary) 87%, var(--callout-color))`，
   内高光仍由 inset `box-shadow` 提供，所以不会变平。
   → callout 从此**不吃 `--blur-background`**，§3.5.3 第 1 条的副作用说明对 callout 不再适用。

对照截图（用真实 `theme.css` 渲染，`node /tmp/final-callout-render.mjs` 可复现）：
`/tmp/palette-final-light.png`、`/tmp/palette-final-dark.png`（14 种类型全览）；
调色过程中的 A/B 对照：`/tmp/palette-T1-light.png`（玻璃底 + 墨色，太淡）/ `/tmp/palette-T2-light.png`（定稿）。

**对照截图**（`node /tmp/callout-preview4.mjs` 可复现）：

| 变体 | 文件 | 结论 |
| --- | --- | --- |
| B base 4.1.0 原样（用户认可观感，但带框） | `/tmp/callout-B-410-upstream.png`、放大图 `/tmp/zoom-callout-B-410-upstream.png` | 柔和淡底 + **一圈清晰的灰蓝 hairline** |
| 只关 accent 环（不够） | `/tmp/callout-B1-accentring-off.png` | 灰环仍在（像素 `(169,169,169)`） |
| **定稿：去掉两层环 + 保留内高光** | `/tmp/callout-G1-fix-light.png`、`/tmp/callout-G1-fix-dark.png`、放大图 `/tmp/zoom-callout-B3-keep-sheen.png` | 框消失，观感与 B 一致 ✅ 浅/暗双模式均成立 |
| 定稿 + §3.5.1 暖色玻璃 | `/tmp/callout-G2-fix-warm-light.png`、`/tmp/callout-G2-fix-warm-dark.png` | 浅色无差、暗色略暖 → 无需额外处理 |

（已否掉的备选：纸面 88% + accent 12% 淡染（C/E/F）、左侧 3px 强调条（D）—— 用户明确不要左条。）

---

### 3.5 决策：透明模式 / 毛玻璃 — **分区玻璃（Sidebar stays matte）**

> 状态：**已定稿**（2026-10-10 评审）。一句话：玻璃只给「小面积 + 悬浮 + 自带实色兜底」的层；
> 侧边栏与编辑器主体继续用 OnePage 的实色卡片语言，不引入 `backdrop-filter`。

#### 3.5.1 决策表

| 表面 | 决策 | 理由 |
| --- | --- | --- |
| 菜单 / 右键 / 建议列表 / popover | ✅ 接受上游 `--blur-m`，**只把颜色调成暖玻璃** | 小面积、瞬时悬浮，macOS 观感核心 |
| 命令面板 / 弹窗 / notice | ✅ 接受 `--blur-l` / `--blur-s` | 同上；4.1.0 在透明模式已自动退回实色 |
| 编辑器活动 tab | ⚠️ **不全盘接受**：用 OnePage 自有色 + 显式 `background-image:none`（4.1.0 的 `background:` 简写会静默吃掉 OnePage 的 `background-color` 覆盖） | 小面积但改法有陷阱；见 §3.4「活动 tab」行 |
| 状态栏悬浮 | ⚠️ 接受玻璃，但**必须删掉 OnePage 的 `background-color !important`** | 现状是「不透明底 + 上游 blur」= blur 白挂 |
| 侧边栏卡片（§6/§7/非透明兜底） | ❌ 不 blur，保持 OnePage 卡片 | 大面积 GPU；透明模式必重影；卡片+留白是品牌识别点 |
| 编辑器主体 / tab 栏容器 | ❌ 不 blur | 大面积 |

**透明模式铁律**：`body.is-translucent` 下**不新增任何 `backdrop-filter`**，只做「底色不透明」兜底。
**非透明模式**（Win/Linux、macOS 关窗口透明/全屏）才是谈玻璃的地方。

#### 3.5.2 依据（实测，非推断）

1. **桌面端玻璃完全是 Cupertino 加的，核心没做** → OnePage 有完全自由，不必跟核心对抗。
   - Obsidian 1.14.4 `app.css:9137-9147`：`.menu{background:var(--menu-background);backdrop-filter:var(--menu-backdrop-filter)}`，
     而 `--menu-backdrop-filter: none`（`:2543`）；`--raised-*` 只在手机端被消费（`:22209-22243`），桌面休眠。
   - 4.1.0 才是给桌面加玻璃的人：`:4172-4186` 给 `.prompt/.modal` 上 `blur-l`、`.menu/.suggestion-container/.popover` 上 `blur-m`、
     `.cm-tooltip/.notice` 上 `blur-s`；状态栏 hover `:4156-4160`。
     活动 tab（`:977-980`）只有 `--raised-background`（半透明渐变）+ `--raised-shadow`，**没有 `backdrop-filter`**
     → 不受「透明模式不 blur」铁律约束，但要处理 `background` 简写陷阱（见 §3.4）。
2. **「透明模式透字」的历史 bug 上游已自行修好** → §15 从「防御补丁」降级为「冗余保险」。
   - 4.1.0 `:4166-4170`：`.is-translucent` 下 `--modal-background / --menu-background / --background-modifier-message` 全部改绑**实色** `--background-primary`；
     同时 `:179-181` 把 `--blur-s/m/l` 强制 `none !important`。3.2.12 时代「blur=none 但底色仍半透明」的矛盾，两边都堵了。
3. **透明模式不 blur 是 Electron 的硬约束，不是审美偏好** → OnePage「不用 blur 防重影」的立场正确且与上游一致。
   - Electron #39529（vibrancy + `backdrop-filter` 渲染错乱，表现为「模糊了又没模糊」）：Electron 25→32 一直复现，
     **2025-05-27 closed as NOT_PLANNED**；Obsidian 官方论坛同题帖（2021）官方回复「won't fix or change this」。
4. **4.1.0 的侧边栏其实没加玻璃、也没加卡片** → §3.4 里「侧边栏 vs Liquid Glass 正面冲突」被高估，已降级。
5. **玻璃底色是中性灰，与 OnePage 暖调打架**（必须改，非可选）：
   - 4.1.0 浅色 `--blur-background: hsl(0 0% 95% / .5)`、深色 `hsl(0 0% 20% / .5)`（`:3936` / `:3953`），再叠 `white 25% / 3.5%` 做纵向高光。
     浮在 `#faf7f1` 暖白或 `#262322` 暖棕上会出现「灰玻璃浮在暖纸上」的脏感。

#### 3.5.3 落地清单（Phase 4 的玻璃部分，约半天）

1. 覆写暖色玻璃底（注意压过 Cupertino 的 `(0,2,1)` 特异性，加一个 `:not(.is-mobile)`）；
   `--raised-background` 是 `linear-gradient(… var(--blur-background) …)`，会自动跟随，不用重写渐变。
   影响面：菜单 / 弹窗 / 命令面板 / 通知 / tooltip / 活动 tab（**callout 已改为自有淡染底，不再消费它**，见 §3.4.1.1）：
   ```css
   body:is(.mod-macos,.adaptive-mode-off):not(.is-mobile) {
     --blur-background: hsl(from var(--background-primary) h s l / 50%);
   }
   ```
2. 删掉/收紧状态栏的 `background-color: var(--background-secondary) !important`，让上游 hover 玻璃生效；
   或明确写 `backdrop-filter: none` —— 二者选一，别留「不透明底 + 空转 blur」。
3. 统一铁律：`body.is-translucent` 下不新增 `backdrop-filter`。顺手修正现有不一致 ——
   `src/90-onepage.css:1228-1232` 的 vault-profile 在透明模式单独加了 `blur(24px)`（而侧栏卡片本身没 blur），改成卡片同色实底更稳。
4. §15 保留（零风险），注释改为「上游 4.1.0 已实色化，此为兜底」；若瘦身可只留 background、删 `backdrop-filter:none` 两行。
5. **补一个上游没有的护栏**（4.1.0 全表只有一个 `@supports`，没有 backdrop-filter 探测），
   防止「不支持 blur 时菜单变成半透明无模糊 → 透字」（§15 老 bug 的另一条触发路径，根因在 `--blur-opacity` 类变量）：
   ```css
   @supports not (backdrop-filter: blur(1px)) {
     body:is(.mod-macos,.adaptive-mode-off) { --raised-background: var(--background-primary); }
   }
   ```
6. 侧边栏：**一行玻璃都不加**，只按 §3.4 对齐 resize-handle / divider。

#### 3.5.4 明确排除的备选方案

- **全盘接受上游玻璃（含侧边栏）**：❌ 失去品牌识别、大面积 GPU 开销、透明模式必重影。
- **全盘关掉玻璃（一切实色）**：❌ 要在菜单/弹窗/tooltip/notice/活动 tab/状态栏/canvas 菜单逐条 `!important` 对抗基座，
  每次上游升级都要重打一遍；且 4.x 的 `--raised-background` 横向贯穿多处，长期成本高于收益。

> 附注（源码 diff 后修正）：风险最高的不再是「复选框/callout/tab 变量体系」这几条显眼的写法变化，
> 而是两条**静默失效**：① 开关 `.checkbox-container` 被基座染绿（`--interactive-accent` 继承打不过元素自身声明）；
> ② 活动 tab 的 `background:` 简写吃掉 OnePage 的 `background-color` 覆盖。两者都不会报错，只能靠 Phase 6 目视发现。

---

## 4. 分阶段实施（Phase 0–7）

- **Phase 0 · 前置与基线**：Obsidian 升到 1.14.4 + **更新安装包**（4.x 用 `@supports (interpolate-size: allow-keywords)` 探测，属 Electron 能力），确认无 `Cupertino requires a newer Obsidian installer` 提示；打 `backup/1.2.1` tag、开分支；**冻结同版本基线截图**。
- **Phase 1 · 流水线**：✅ **已在 1.3.0 完成**（含字节一致自证）。
- **Phase 2 · 换基座**：`VERSION` 改 4.1.0、删除 2 个已失效补丁、构建 → 产出失配清单。
- **Phase 3 · 设置面板**：按 §3.2 增删 3 项（补中英双语）。
- **Phase 4 · 定制层适配**：按 §3.4 逐条修，每条要求「新基座证据 + 基线截图对照」。
  两条**与 4.x 无关、可提前单独修**（建议先提一个小版本，别混进 2.0.0 的大 diff）：
  ① 复选框统一为圆形（删 `src:169` 的 4px 例外 + 尺寸统一用 `var(--checkbox-size)`）；
  ② 开关 `.checkbox-container` 的 `--interactive-accent` 重新钉回 OnePage 强调色（现行代码在 4.x 上会被基座染绿，在 3.2.12 上也建议显式钉住）。
- **Phase 5 · 元数据与文档**：manifest 2.0.0 / minAppVersion 1.14.0；versions.json 追加 `"2.0.0": "1.14.0"`；README（中英）更新基座版本、最低 Obsidian 版本、安装包提示；AGENTS.md 更新「基座不再是压缩两行」「补丁清单」「新踩坑」。
- **Phase 6 · 测试**：浅/暗 × 透明(0/50/90%) × 布局开关 × 视图（编辑/阅读/属性/Bases 表+卡片/Canvas/设置面板/命令面板/菜单）；插件回归（Relative Line Numbers、Style Settings 双语、quick-explorer、Dataview、Kanban）；headless Chrome 抽样校验（复选框尺寸、色环 0.9em、图片全宽未误伤、功能区 position/z-index）；与 Phase 0 截图逐屏比对。
- **Phase 7 · 发布**：`git tag 2.0.0`（无 v 前缀）→ CI 自动 Release（assets = manifest.json + theme.css）→ 三项校验。
  ⚠️ Obsidian 不认 prerelease，且 tag 必须等于 manifest version，所以**不发 rc**；本地验证充分后直接发 2.0.0。

---

## 5. 风险与回滚

| 风险 | 应对 |
| --- | --- |
| 4.x 是整体重写，静态分析无法完全预判 | Phase 6 全量截图比对，不接受「看着还行」 |
| 上游新增 `!important` / 提高特异性，压过定制层 | 比对脚本标出同选择器冲突点，重点复测 |
| 用户未更新 Obsidian 安装包 | README 明确提示；发版前本机实测 |
| 最低版本跳到 1.14.0 后 1.13.x 用户收不到更新 | 上游硬要求，已确认接受 |
| 一次性换基座 diff 巨大 | Phase 1 的重构提交独立存在，Phase 4 按风险分组小步提交 |
| 回滚 | `backup/1.2.1` tag + 1.2.1 Release 仍在，用户可手装退回 |

预计工作量：4–6 个工作日（流水线已完成，实际剩余 3–5 天）；此后每次上游升级预计 0.5–1 天。

---

## 6. 实施记录（Phase 2–4，未提交，待验证）

### 6.1 已完成

| Phase | 内容 |
| --- | --- |
| 0 | 本机 Obsidian 1.14.4（Electron **43.7.7**）→ 安装包条件满足（`interpolate-size` / `corner-shape: superellipse()` 均可用） |
| 1 | 已在 1.3.0 完成 |
| 2 | 新增 `vendor/cupertino/4.1.0/`（theme.css + manifest.json，上游原样；3.2.12 保留供 diff/回滚）；`VERSION` → 4.1.0；**`PATCHES` 清空**（功能区改写与 `.highlight-swatch` 两条上游已自行解决） |
| 3 | `src/00-settings.css`：`full-width-media-off` → `media-width-fit`；删除 `dynamic-type-off`（现 33 项） |
| 4 | 定制层适配（定稿见 §3.4 / §3.4.1 / §3.5.3）：复选框统一圆形、开关强调色钉回、活跃 tab 全平、tab 容器去环、侧栏 divider 置透明、状态栏去玻璃、callout 去环、暖色玻璃底、`@supports` 护栏、vault-profile 透明模式去 blur |

### 6.2 实施时对文档定稿的两处修正

1. **状态栏**：§3.5.1 原写「删掉 `background-color !important`，让上游 hover 玻璃生效」；实施改为**保留 OnePage 不透明胶囊 + 显式 `backdrop-filter: none` + `box-shadow: none`**。
   原因：透明模式下基座把 `--blur-*` 置 none，而 `--raised-background` 仍是 ~50% 透明渐变 → 会变成「半透明但没模糊」的胶囊（正是 §15 那个老 bug 的形态），不可控。
2. **活动 tab**：§3.5.1 原写「接受 `--raised-background`」→ 实施改为**用 OnePage 自有色 + `background-image: none`**，与 §8 既有的 `box-shadow: none` 保持一致（玻璃不能只取一半）。

### 6.3 验证记录（无头 Chrome，可复现）

- `npm run build && npm run verify` → 全绿（产物 397,916 B / 8,792 行；@settings 33 项；变量体检无未登记项）。
- `npm run check:obsidian -- /tmp/ob1137/ext/app.css /tmp/ob1144/app.css` → 4/4 场景通过（1.13 / 1.14 类名 × 两个版本）。
- `node /tmp/probe-onepage-200.mjs`（浅）与 `-dark.mjs`（暗）—— 用**构建产物**读 computed style：
  - callout：`border 0px / none`，box-shadow 中无 `0 0 0` 环，保留 inset 内高光 + 柔和投影；
  - 复选框三处（实时预览 / 阅读视图 / 属性面板）均为 `16×16 / radius 100px`（圆）；
  - 开关 `--interactive-accent` = `#0e6e63`（浅）/ `#6db3a3`（暗），未被染绿；
  - 活跃 tab：`background-image: none` + 78% 纸色 + 6px 圆角；tab 容器无环；
  - 状态栏：`backdrop-filter: none` + `box-shadow: none`；
  - `--blur-background` = `hsl(from #faf7f1|#262322 h s l / 50%)`（暖玻璃已生效）。
- 冲突扫描（基座 vs 定制层，选择器文本完全相同者 40 条）：**无「基座 `!important` 压过定制层同属性」的情况**。
- 截图（真实 `theme.css` 渲染）：`/tmp/onepage-200-content-light.png`、`/tmp/onepage-200-content-dark.png`；callout 变体对照见 §3.4.1。

### 6.4 待人工验证（Phase 6 入口清单）

**在真实库（`~/my/obsidian/notes`）里试用未发布构建**（不碰正式版主题，二者可随时对比）：

```bash
npm run install:theme -- ~/my/obsidian/notes            # 装成独立主题「OnePage (dev)」，theme.css 为拷贝
# 设置 → 外观 → 主题 → 选「OnePage (dev)」
# 改完 src/：npm run build → npm run install:theme -- ~/my/obsidian/notes（或装一次时加 --watch 自动同步）
npm run install:theme -- ~/my/obsidian/notes --uninstall  # 用完删掉
```

> ⚠️ **不要用 `--link`（软链）**：Obsidian 只监视**库内**文件，软链指向库外时 ① `npm run build` 不会触发重载；
> ② 切换主题时它可能复用内存里缓存的 CSS 文本 → 表现为「切换了没生效」（2026-10-10 在 notes 库实测踩过）。

（演示库 `ob-dev` 里的元素走查页仍可用于逐项对照：`3-Resources/OnePage 元素演示/`。）

1. Obsidian 里刷新主题（设置→外观→主题切走再切回，Obsidian 不热加载外部改动的 theme.css），逐屏看：浅/暗 × 透明(0/50/90%) × 编辑/阅读/属性/Bases 表+卡片/Canvas/设置面板/命令面板/菜单。
2. 重点看三处「值变了但不报错」（详见 AGENTS.md「Cupertino 4.x 静默失效清单」末段）：
   - `--background-modifier-border` 冷灰是否显脏（代码块描边 / 行内代码底 / 状态栏上边框 / 滚动条）；
   - Bases 卡片 hover 的 `--shadow-s` 新配方是否多出一圈环；
   - 状态栏 `--border-width` 0.5px → 1px。
3. 透明模式下确认无重影（侧栏 / 菜单 / vault 选择器）。
4. 插件回归：Relative Line Numbers、Style Settings 双语、quick-explorer、Dataview、Kanban。

### 6.5 已完成 / 尚未做

- ✅ **Phase 5（元数据与文档）已完成**：`manifest.json` = **2.0.0 / minAppVersion 1.14.0**，`versions.json` 追加 `"2.0.0": "1.14.0"`，
  README 增加「运行要求」段并改为**引用**更新日志；更新日志拆到 `RELEASE.md` / `RELEASE_CN.md`（2.0.0 条目含全部观感变化与设置项变更）。
- ⏳ **Phase 6 收尾**：真实库（notes）里长期使用验证（`npm run install:theme -- ~/my/obsidian/notes`）。
- ⏳ **Phase 7**：`git tag 2.0.0` + Release（assets 必须含 `manifest.json` + `theme.css`）。

---

## 附录：Obsidian 1.13 / 1.14 兼容性实测（2026-10-10，1.3.0 期间完成）

结论：**不需要版本判断；1.13 与 1.14 都已覆盖，侧边栏样式不会在 1.13 上坏掉。**

证据（直接读 `app.js` / `app.css`，非推断）：

| 项 | 1.13.7 | 1.14.4 |
| --- | --- | --- |
| 功能区类名 | `createDiv("workspace-ribbon side-dock-ribbon")` + `addClass("mod-"+side)` → **`.workspace-ribbon.mod-left`** | `addClass("mod-"+TS(side))`，`TS('left')='primary'` → **`.workspace-ribbon.mod-primary`** |
| 侧边栏类名 | `addClass("mod-"+side+"-split")` → `.mod-sidedock.mod-left-split` | `AS(side, tpl)` **同时输出** `mod-primary-split` + `mod-left-split` |
| 左栏开关 | `.is-left-sidedock-open` | 同时输出 `is-primary-sidedock-open` + `is-left-sidedock-open` |
| `--ribbon-width` | ✅ 44px | ✅ 44px |
| `--checkbox-size` / `--size-4-2` / `--mono-rgb-100` / `--font-normal` / `--background-modifier-hover` / `--font-monospace` | ✅ 全部存在 | ✅ 全部存在 |

- **只有功能区是硬改名**，主题用 `:is(.workspace-ribbon.mod-left,.workspace-ribbon.mod-primary)` 同时覆盖（特异性不变），基座里那 37 处由构建期补丁处理。
- **侧边栏从来不受影响**：`.mod-sidedock.mod-left-split` 在两个版本都命中，所以侧边栏卡片样式不需要任何兼容分支。
- 实测工具：`npm run check:obsidian -- <app.css …>`（无头 Chrome 读 `getComputedStyle`），已跑 1.13.7 + 1.14.4 × 两套类名，全绿；工具自检过（未打补丁的主题会报 ❌）。
- 顺手加固：`--ribbon-width` 增加 `44px` 兜底（取不到值时整条 `calc()` 会失效，卡片不再向左延伸、图标会压在侧栏内容上）；`--shadow-tactile` 增加兜底以对冲 4.x 删除该变量（见 §3.4）。
