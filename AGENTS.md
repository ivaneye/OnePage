# AGENTS.md — OnePage 主题开发规范

本文件记录本仓库的发布规范与高频踩坑点，供 Agent 在开发/修改/发布时遵守。**修改前先读一遍，尤其发布流程。**

## 项目背景

- **项目**：Obsidian 社区主题 OnePage（macOS 原生 × 极客感）
- **仓库**：`/Users/wangyifan/Documents/ob-dev/.obsidian/themes/OnePage`（开发库，即测试库，无第二副本）
- **远端**：`origin = git@github.com:ivaneye/OnePage.git`（SSH），分支 `master`
- **发布人账号**：`ivaneye`（`gh` 已登录）
- **主题文件**：`theme.css`（**构建产物，禁止直接编辑**）
- **源文件**：`src/00-settings.css`（`@settings` 元数据）、`src/10-header.css`、`src/90-onepage.css`（OnePage 定制层）
- **基座**：`vendor/cupertino/<版本>/theme.css`（上游 Cupertino **原样**，钉版本，当前值见 `vendor/cupertino/VERSION`）
- **构建**：`npm run build` 生成 `theme.css`；`npm run verify` 做括号 / `@settings` / 版本 / 变量体检
- **升级计划**：`docs/UPGRADE-CUPERTINO-4.md`（2.0.0 换 Cupertino 4.x 的方案，动工前先读）
- **配色基调**：
  - 浅色「暖白纸张」：背景 `#faf7f1`，强调 `#0e6e63`（深青）
  - 暗色「暖棕·冷锚」：背景 `#262322`，强调 `#6db3a3`（浅青）
  - 自适应颜色优先用 `color-mix(in srgb, var(--text-muted) XX%, var(--background-primary))`，不要写死两套

---

## 发布流程（重点规范 ⚠️）

Obsidian 社区主题靠 **GitHub Release** 分发更新：**只推代码/tag 而没有 Release，用户在 Obsidian 里收不到更新。**

版本号必须 **`x.y.z` 纯数字，禁止 `v` 前缀**（tag、release 名称、manifest 三处统一）。

> ⚠️ **安装文件必须作为 Release 的 binary assets 上传**（`manifest.json` + `theme.css`），只提交到仓库不算数。
> 官方原文："When a user installs your theme, Obsidian downloads `manifest.json` and `theme.css` from the GitHub release whose tag matches the `version` in your manifest"。
> 漏传 assets → 社区目录报 `Error: Release is missing a required install file`，且**用户端完全无法安装/更新**（1.0.3–1.1.2 曾因此全部失效，2026-09-11 补齐）。

### 标准发布步骤

1. 改完 `src/` 后先 `npm run build && npm run verify`（`theme.css` 是产物，忘了构建就会发出与源不一致的主题）
2. 改版本号：`manifest.json` 的 `version`（如 `1.0.3`）
3. `versions.json` 追加映射：`"1.0.3": "1.13.4"`（右侧为 `manifest.json` 的 `minAppVersion`）
4. 提交：`git add manifest.json versions.json && git commit -m "release: v1.0.3"`
4. 打 tag：`git tag 1.0.3`（**无 v 前缀**，必须与 manifest 版本一致）
5. 推送：`git push origin master --tags`
6. 建 Release（**必须带上 `manifest.json theme.css` 两个文件**，`gh` 会把它们作为 assets 上传）：
   ```bash
   gh release create 1.0.3 --title "1.0.3" --notes "..." manifest.json theme.css
   ```
   - **`--title`（Release 名称）= `1.0.3`，严禁写 `v1.0.3`**
   - tag 名也是 `1.0.3`
   - 若已配 `.github/workflows/release.yml`，push tag 后 CI 会自动建 Release（含 assets），**跳过本步**，直接做第 7 步校验
7. 校验（三个条件都要过）：
   ```bash
   gh api repos/ivaneye/OnePage/releases/tags/1.0.3 \
     --jq '[.name, .tag_name, (.assets|map(.name)|sort|join(","))] | tostring'
   # 期望: ["1.0.3","1.0.3","manifest.json,theme.css"]
   curl -sIL -o /dev/null -w '%{http_code}\n' \
     https://github.com/ivaneye/OnePage/releases/download/1.0.3/theme.css   # 期望 200
   ```

### 易错点

- ❌ `--title "v1.0.3"`（带 v）→ ✅ `--title "1.0.3"`
- ❌ `gh release create 1.0.3 --title "1.0.3" --notes "..."`（**漏了 assets**，社区目录会报 `Release is missing a required install file`）
  → ✅ 末尾补 `manifest.json theme.css`；Release 已建也可以补传：
  ```bash
  gh release upload 1.0.3 manifest.json theme.css --clobber
  ```
  ⚠️ 补传时必须用**该 tag 当时的文件**（`git show 1.0.3:manifest.json > /tmp/m.json`），别用工作区当前版本，否则 manifest 里的 version 与 tag 不一致。
- 批量体检所有 Release 是否有 assets：
  ```bash
  for t in $(git tag); do echo -n "$t: "; gh api repos/ivaneye/OnePage/releases/tags/$t --jq '.assets|length'; done   # 全部应为 2
  ```
- Release 已建后改名称用：`gh release edit 1.0.3 --title "1.0.3"`
- 若 Release 还没建、tag 已推：可移动 tag（`git tag -d 1.0.3 && git tag 1.0.3 && git push origin --tags --force`）把新修复并入同一版本，避免空发一版
- `gh release edit` 没有 `--name` 参数，改标题用 `--title`

---

## 字体规范（易错 ⚠️）

**代码字体必须用 `--font-monospace-theme`，禁止用 `--font-monospace`。**

Obsidian 的解析链：`--font-monospace = var(--font-monospace-override(用户设置), var(--font-monospace-theme(主题默认)))`

- 用 `-theme` 后缀：用户在「设置 → 外观 → 代码字体」的选择优先，主题只做兜底 ✅
- 直接写 `--font-monospace`：会遮蔽整条链，用户的代码字体设置被主题强制覆盖 ❌（历史教训，见 commit `ae95967`）

主题当前字体默认（`src/90-onepage.css` 开头的 `body{}`）：
```css
--font-monospace-theme: "JetBrainsMono NFM", "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
```

---

## 测试须知

- **Obsidian 不热加载外部修改的 theme.css**。改完必须手动刷新：设置 → 外观 → 主题切走再切回 OnePage（或重启）。
- 用户反馈"没生效"时，先问/提醒刷新，不要急着改代码。
- 本机官方样式与渲染层 JS 在 `/Applications/Obsidian.app/Contents/Resources/obsidian.asar`（`app.asar` 只是 Electron 壳，里面没有 app.css/app.js）。解压后 `app.css` 查官方默认值，`app.js` grep 元素生成逻辑。旧版本（如 1.13.7）可以从 GitHub Release 单独下载 `obsidian-<ver>.asar.gz`（8.7MB，比整个 dmg 小得多）。
- **规则分三层，改之前先确认该改哪层**：
  - `vendor/cupertino/<版本>/theme.css`：上游原样，**永远不要手改**（升级时整份替换）；需要修正的地方写成 `scripts/build.mjs` 里的声明式补丁。
  - `src/90-onepage.css`：OnePage 自己的规则，**日常改这里**；改完必须 `npm run build`。
  - `theme.css`：构建产物，直接改会在下次构建被覆盖。
- ⚠️ 当前基座 3.2.12 的 `vendor/…/theme.css` **压缩成两行**（每条 200KB+），grep 命中时终端输出会被截断，必须用 python 打印上下文；换成 Cupertino 4.x 后上游已是格式化输出，这个坑会自动消失。

---

## 复选框规范（属性面板/正文共用 `input[type=checkbox]`）

属性面板复选框 DOM：`input[type=checkbox].metadata-input-checkbox`（与正文任务复选框同一元素、同一套渲染）。

当前修复块在 `src/90-onepage.css` 的「属性面板: 复选框直接复用正文样式」章节，规则要点（**改动前先理解，别随手改回**）：

- **未选中描边**：`--checkbox-border-color: color-mix(in srgb, var(--text-muted) 62%, var(--background-primary))`（默认 `--text-faint` 太浅几乎不可见）
- **对勾颜色**：`--checkbox-marker-color: var(--background-primary)`（**禁止用白色**——暗色强调色是浅青 `#6db3a3`，白勾看不见；用背景色画对勾才能亮/暗都高对比）
- **对勾尺寸**：`:after` 的 `-webkit-mask-size: 100%`（与正文一致；`65%` 会细一圈）
- **对勾居中**：`:after` 是绝对定位，相对**内边距盒**（边框以内）；复选框有 1px 边框，必须 `top: -1px; inset-inline-start: -1px` 才能盖满可见盒子居中（`top:0` 会偏右下方 1px）
- 属性面板里开关（`.checkbox-container`，兜底）也要配：未启用加深轨道 + `inset 0 0 0 1px` 描边

---

## 属性面板布局规范

- `.metadata-property-key` 默认 `align-items: flex-start`（子元素偏上），value 是 `center` → 两者不对齐。
  主题里已加 `align-items: center !important`（`src/90-onepage.css`「属性面板」章节），**不要删**。

---

## Obsidian 1.14 类名适配（⚠️ 硬改名，必修）

Obsidian 1.14 为支持 RTL 翻转，把工作区物理方位类换成了逻辑方位类（`app.js` 里 `TS(side)` / `AS(side, tpl)`）：

| 元素 | 1.13 旧类 | 1.14 新类 | 是否双类并存 |
| --- | --- | --- | --- |
| 左侧功能区 ribbon | `.workspace-ribbon.mod-left` | `.workspace-ribbon.mod-primary` | ❌ **只输出新类（硬改名）** |
| 左侧边栏 split | `.mod-left-split` | `.mod-primary-split` | ✅ 新旧都输出（`AS()` 返回两个类） |
| 左栏开关 | `.is-left-sidedock-open` | `.is-primary-sidedock-open` | ✅ 新旧都输出 |

- **只有功能区是硬改名**，所以主题里所有 `.workspace-ribbon.mod-left` 规则在 1.14 **全部失配**。Cupertino 基座里给功能区 `position:relative; z-index:11` 的那条规则失配后，功能区退回 `position:static`，被 OnePage「向左延伸的边栏卡片」（负 margin + 后绘制）盖住 → **Show Ribbon 打开后侧边栏工具图标全部看不见**（1.14.4 实测复现）。
- **修复方式（已工程化，不要再手工改 theme.css）**：`scripts/build.mjs` 的 `PATCHES` 里有一条补丁，把基座里所有 `.workspace-ribbon.mod-left` 改写为
  `:is(.workspace-ribbon.mod-left,.workspace-ribbon.mod-primary)`（`expected: 37` = 当前基座里的命中数）。
  `:is()` 取参数中最高特异性，两个参数同为 `(0,2,0)`，改写后**特异性不变**，1.13 / 1.14 双兼容。
- **侧边栏不需要版本判断**：左栏 split / 开关是**双类并存**（`app.js` 里 `AS(side,tpl)` 同时输出 `mod-primary-split` + `mod-left-split`、`is-primary-sidedock-open` + `is-left-sidedock-open`），所以主题里所有 `.mod-sidedock.mod-left-split` 规则在 1.13 / 1.14 都生效（1.14.4 的 `app.js` 已核对）。**只有功能区是硬改名**。
- 版本相关的事实来源（1.14.4 `app.js`）：`TS(e){return "left"===e?"primary":"right"===e?"secondary":e}`；功能区 `createDiv("workspace-ribbon side-dock-ribbon")` + `addClass("mod-"+TS(side))`。
  1.13.7 `app.js` 对照：功能区 `createDiv("workspace-ribbon side-dock-ribbon")` + `addClass("mod-"+side)`（即 `mod-left`）；边栏 `addClass("mod-"+side+"-split")` / `addClass("is-"+side+"-sidedock-open")`。
- **实测工具**：`npm run check:obsidian -- <app.css…>` —— 把指定版本的 `app.css` + `theme.css` 内联进最小 DOM，用无头 Chrome 读 `getComputedStyle`，同时验 1.13 类名（`.mod-left`）与 1.14 类名（`.mod-primary`）下功能区是否都拿到 `position:relative` + `z-index>=11`、左侧栏是否拿到卡片 margin。
  旧版本 `app.css` 的取法：GitHub Release 里单独下 `obsidian-<ver>.asar.gz`（仅 8.7MB），`gunzip` 后 `npx @electron/asar extract`。
  已实测 1.13.7 + 1.14.4：两种类名、两个版本均 ✅（工具本身也自检过：用未打补丁的 theme.css 会报 ❌）。
- ⚠️ **换基座后构建会因为 `expected` 命中数不符而直接失败**（这正是设计目的，代替过去「静默失配」）。用 `node scripts/build.mjs --base | python3 -c "import sys;print(sys.stdin.read().count('.workspace-ribbon.mod-left'))"` 数出新命中数，再更新 `PATCHES`。
  - 已知：**Cupertino 4.1.0 改用裸 `.workspace-ribbon`**（不再有 `.mod-left`），届时该补丁命中数为 0，应删除。
  - 本项目所有 Obsidian 原生变量（`--ribbon-width`、`--checkbox-size`、`--mono-rgb-100`、`--font-normal`、`--size-4-2` 等）已逐一在 1.13.7 与 1.14.4 的 `app.css` 里核对存在，侧边栏/复选框等规则在 1.13 上不会因变量缺失而失效。
- 相关说明写在 `src/90-onepage.css`「Obsidian 1.14 兼容层」注释块。

---

## Obsidian 1.14 高亮色（highlight colors）⚠️

1.14 新增高亮色：光标落在高亮文字上时，行内出现色环 widget。DOM 为
`.cm-highlight-color-widget > img.highlight-swatch`（0.9em 圆点，**该 img 没有 `width` 属性**）。

- **踩坑**：基座（Cupertino）的「全宽元素」规则
  `body:not(.full-width-media-off) .cm-content img:not([width],.cm-widgetBuffer,.link-favicon,.emoji,[alt=banner])`
  会命中这个裸 `img`，把它拉成整行宽（用户看到的「颜色红圈被拉宽到和文字一样宽」），且同组的 `background:var(--background-primary-alt)` 还会把圆点颜色覆盖成纸色。
- **修复（当前 3.2.12 基座）**：`scripts/build.mjs` 的 `PATCHES` 里有补丁，在基座该 `img:not(...)` 排除列表里补 `.highlight-swatch`（`expected: 4`），定制层另有一条 `!important` 兜底（`src/90-onepage.css`「Obsidian 1.14 兼容层」）。兜底规则**故意不设 `background-color`**，让官方 `.highlight-swatch[data-highlight=red]{background-color:var(--color-red)}` 的配色原样生效。
- 已知：**Cupertino 4.1.0 已自行修复**（排除列表里带了 `.highlight-swatch`，4 处）→ 2.0.0 时删除基座补丁，保留定制层兜底。
- 验证示例（无头 Chrome，把 1.14.4 的 `app.css` + `theme.css` 内联进页面）：色环应 `width:14.39px`（0.9em @16px）、`border-radius:50%`、背景为 `--color-red`；同时**真实图片仍是 `width:600px` 全宽**，证明未误伤全宽媒体。

---

## 插件兼容（继承 Cupertino）

Cupertino 基座里有一段第三方插件兼容层（上游 `src/app/community-plugins.scss`），会直接改插件元素，**已有踩坑**：

- `Relative Line Numbers`（`nadavspi/obsidian-relative-line-numbers`）：基座给了 `.relative-line-numbers-mono{position:absolute;width:100%}`。该标记只在**当前行**渲染，而它最近的 positioned 祖先是 `.cm-scroller`（CM6 基座 `position: relative`；`.cm-gutters`/`.cm-gutter` 均无 position），于是命中区 = 整个编辑区宽，盖在正文上抢鼠标事件 → 同一段落内重复点击/选字丢失焦点。
  主题已在定制层加 `pointer-events: none`（**不要删**）；后续从上游合并 Cupertino 时注意别把这条覆盖回去，也建议顺手给上游提 issue（baseline / lumin 等衍生主题同样中招）。
- 排查同类问题的手法：定位元素 → 看 class → 在 `vendor/` 基座里 grep 该 class（3.2.12 是压缩的两行，要用 python 打印上下文）→ 优先在 `src/90-onepage.css` 里加修正。

---

## 变更纪律

- **只改 `src/`，改完必须重建并校验**：
  ```bash
  npm run build && npm run verify
  ```
  `verify` 会检查：产物与源是否一致（防忘构建）、大括号平衡、选择器改写残渣、`@settings` 元数据、`manifest`/`versions` 版本一致性、变量体检。
- 提交信息用 `fix(...)` / `refactor(...)` / `release: vx.y.z` 风格，中文说明，写清动机。
- 改完记得同步：代码提交 + （如涉及版本）tag + Release 三步都要。
