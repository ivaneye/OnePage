# AGENTS.md — OnePage 主题开发规范

本文件记录本仓库的发布规范与高频踩坑点，供 Agent 在开发/修改/发布时遵守。**修改前先读一遍，尤其发布流程。**

## 项目背景

- **项目**：Obsidian 社区主题 OnePage（macOS 原生 × 极客感）
- **仓库**：`/Users/wangyifan/Documents/ob-dev/.obsidian/themes/OnePage`（开发库，即测试库，无第二副本）
- **远端**：`origin = git@github.com:ivaneye/OnePage.git`（SSH），分支 `master`
- **发布人账号**：`ivaneye`（`gh` 已登录）
- **主题文件**：`theme.css`（**构建产物，禁止直接编辑**）
- **源文件**：`src/00-settings.css`（`@settings` 元数据）、`src/10-header.css`、`src/90-onepage.css`（OnePage 定制层）
- **文档**：`README.md` / `README_CN.md`（介绍 + 安装 + 运行要求，**只引用更新日志**）、`RELEASE.md` / `RELEASE_CN.md`（完整更新日志，新版本往下追加）
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
2. **在 `RELEASE.md` / `RELEASE_CN.md` 顶部追加该版本的条目**（README 只保留引用，不要再往 README 里堆日志）
3. 改版本号：`manifest.json` 的 `version`（如 `1.0.3`）；若最低 Obsidian 版本也变了，同步改 `minAppVersion`（它必须与基座的要求一致 —— 例如 2.0.0 换 Cupertino 4.1.0 时提到 `1.14.0`）
4. `versions.json` 追加映射：`"1.0.3": "1.13.4"`（右侧为本版本的 `minAppVersion`）
5. 提交：`git add manifest.json versions.json RELEASE.md RELEASE_CN.md theme.css && git commit -m "release: v1.0.3"`
6. 打 tag：`git tag 1.0.3`（**无 v 前缀**，必须与 manifest 版本一致）
7. 推送：`git push origin master --tags`
8. 建 Release（**必须带上 `manifest.json theme.css` 两个文件**，`gh` 会把它们作为 assets 上传）：
   ```bash
   gh release create 1.0.3 --title "1.0.3" --notes "..." manifest.json theme.css
   ```
   - **`--title`（Release 名称）= `1.0.3`，严禁写 `v1.0.3`**
   - tag 名也是 `1.0.3`
   - 若已配 `.github/workflows/release.yml`，push tag 后 CI 会自动建 Release（含 assets），**跳过本步**，直接做第 9 步校验
9. 校验（三个条件都要过）：
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
- **在真实库里试用未发布构建（推荐做法）**：`npm run install:theme -- <库路径>`
  会在目标库装一个**独立主题**（默认名 `OnePage (dev)`，独立目录，与正式版共存）：
  - `manifest.json` 的 `name` 与正式版不同 → 社区主题更新器不会碰它，也不可能反向覆盖本仓库的产物；
  - `theme.css` **默认拷贝**（**不要用 `--link` 软链**）：Obsidian **只监视库内文件**，软链指向库外时
    ① `npm run build` 不会触发重载；② 切换主题时它可能直接复用内存里缓存的 CSS 文本 → “切了没生效”（实际踩过）。
    拷贝模式下文件在库内，Obsidian 会自己热重载；也可以加 `--watch` 让脚本在 `theme.css` 变化时自动同步。
  ```bash
  node scripts/install-theme.mjs ~/my/obsidian/notes            # 装/同步（拷贝）
  node scripts/install-theme.mjs ~/my/obsidian/notes --watch    # 同步 + 监听，改完自动拷
  node scripts/install-theme.mjs ~/my/obsidian/notes --uninstall  # 卸掉 dev 主题
  ```
  注意：库里启用的 CSS snippet（如 callout 相关）会叠在主题之上，排查“主题是不是没生效”前先看 snippets 列表。
- 本机官方样式与渲染层 JS 在 `/Applications/Obsidian.app/Contents/Resources/obsidian.asar`（`app.asar` 只是 Electron 壳，里面没有 app.css/app.js）。解压后 `app.css` 查官方默认值，`app.js` grep 元素生成逻辑。旧版本（如 1.13.7）可以从 GitHub Release 单独下载 `obsidian-<ver>.asar.gz`（8.7MB，比整个 dmg 小得多）。
- **规则分三层，改之前先确认该改哪层**：
  - `vendor/cupertino/<版本>/theme.css`：上游原样，**永远不要手改**（升级时整份替换）；需要修正的地方写成 `scripts/build.mjs` 里的声明式补丁。
  - `src/90-onepage.css`：OnePage 自己的规则，**日常改这里**；改完必须 `npm run build`。
  - `theme.css`：构建产物，直接改会在下次构建被覆盖。
- ⚠️ 基座 3.2.12 的 `vendor/…/theme.css` **压缩成两行**（每条 200KB+），grep 命中时终端输出会被截断，必须用 python 打印上下文。
  **4.1.0 起上游改为格式化输出（7,314 行），这个坑已消失**（`grep -n` 直接可用）；若回退到 3.2.12 需重新注意。

---

## 复选框规范（属性面板/正文共用 `input[type=checkbox]`）

属性面板复选框 DOM：`input[type=checkbox].metadata-input-checkbox`（与正文任务复选框同一元素、同一套渲染）。

当前修复块在 `src/90-onepage.css` 的「属性面板: 复选框直接复用正文样式」章节，规则要点（**改动前先理解，别随手改回**）：

- **形状：统一圆形**（2.0.0 定稿）。基座 `--checkbox-radius: 100px`；
  ⚠️ 历史坑：原来阅读视图有一条 `.markdown-rendered .task-list-item-checkbox{border-radius:4px}` 例外，
  但 `.markdown-rendered` 只加在阅读视图 / 嵌入 / CM6 widget 上，**实时预览与属性面板仍是圆** → 同一篇笔记两处不一致。
  现三处均走 `var(--checkbox-radius)` + 尺寸走 `var(--checkbox-size)`，别再硬编码 15px / 4px。
- **未选中描边**：`--checkbox-border-color: color-mix(in srgb, var(--text-muted) 62%, var(--background-primary))`（默认 `--text-faint` 太浅几乎不可见）
- **对勾颜色**：`--checkbox-marker-color: var(--background-primary)`（**禁止用白色**——暗色强调色是浅青 `#6db3a3`，白勾看不见；用背景色画对勾才能亮/暗都高对比）
- **对勾尺寸**：`:after` 的 `-webkit-mask-size: 100%`（与正文一致；`65%` 会细一圈）
- **对勾居中**：`:after` 是绝对定位，相对**内边距盒**（边框以内）；复选框有 1px 边框，必须 `top: -1px; inset-inline-start: -1px` 才能盖满可见盒子居中（`top:0` 会偏右下方 1px）
- 属性面板里开关（`.checkbox-container`，兜底）也要配：未启用加深轨道 + `inset 0 0 0 1px` 描边
- ⚠️ 开关的强调色必须钉在 `.checkbox-container` **自身**（不能只写在 `body` 上）：Cupertino 4.1.0 会在这里注入 `--interactive-accent: var(--color-green)`，
  而「元素自身声明」赢过「带 `!important` 的继承值」→ 不钉就会变系统绿。详见「Cupertino 4.x 静默失效清单」。

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
- **修复方式**（历史）3.2.12 基座里全都写的是 `.workspace-ribbon.mod-left`（实测 37 处），靠 `scripts/build.mjs` 的 `PATCHES` 批量改写为
  `:is(.workspace-ribbon.mod-left,.workspace-ribbon.mod-primary)`（`expected: 37` 断言命中数）。
  `:is()` 取参数中最高特异性，两个参数同为 `(0,2,0)`，改写后**特异性不变**，1.13 / 1.14 双兼容。
  ✅ **4.1.0（2.0.0）起基座改用裸 `.workspace-ribbon`**（不再输出方位类）→ 该补丁已删除，`PATCHES` 现在是**空数组**。
- **侧边栏不需要版本判断**：左栏 split / 开关是**双类并存**（`app.js` 里 `AS(side,tpl)` 同时输出 `mod-primary-split` + `mod-left-split`、`is-primary-sidedock-open` + `is-left-sidedock-open`），所以主题里所有 `.mod-sidedock.mod-left-split` 规则在 1.13 / 1.14 都生效（1.14.4 的 `app.js` 已核对）。**只有功能区是硬改名**。
- 版本相关的事实来源（1.14.4 `app.js`）：`TS(e){return "left"===e?"primary":"right"===e?"secondary":e}`；功能区 `createDiv("workspace-ribbon side-dock-ribbon")` + `addClass("mod-"+TS(side))`。
  1.13.7 `app.js` 对照：功能区 `createDiv("workspace-ribbon side-dock-ribbon")` + `addClass("mod-"+side)`（即 `mod-left`）；边栏 `addClass("mod-"+side+"-split")` / `addClass("is-"+side+"-sidedock-open")`。
- **实测工具**：`npm run check:obsidian -- <app.css…>` —— 把指定版本的 `app.css` + `theme.css` 内联进最小 DOM，用无头 Chrome 读 `getComputedStyle`，同时验 1.13 类名（`.mod-left`）与 1.14 类名（`.mod-primary`）下功能区是否都拿到 `position:relative` + `z-index>=11`、左侧栏是否拿到卡片 margin。
  旧版本 `app.css` 的取法：GitHub Release 里单独下 `obsidian-<ver>.asar.gz`（仅 8.7MB），`gunzip` 后 `npx @electron/asar extract`。
  已实测 1.13.7 + 1.14.4：两种类名、两个版本均 ✅（工具本身也自检过：用未打补丁的 theme.css 会报 ❌）。
- ⚠️ **换基座后构建会因为 `expected` 命中数不符而直接失败**（这正是设计目的，代替过去「静默失配」）。用 `node scripts/build.mjs --base | python3 -c "import sys;print(sys.stdin.read().count('.workspace-ribbon.mod-left'))"` 数出新命中数，再更新 `PATCHES`。
  - 已发生：**4.1.0 改用裸 `.workspace-ribbon`** → 命中数为 0，补丁已删除。
  - 本项目所有 Obsidian 原生变量（`--ribbon-width`、`--checkbox-size`、`--mono-rgb-100`、`--font-normal`、`--size-4-2` 等）已逐一在 1.13.7 与 1.14.4 的 `app.css` 里核对存在，侧边栏/复选框等规则在 1.13 上不会因变量缺失而失效。
- 相关说明写在 `src/90-onepage.css`「Obsidian 1.14 兼容层」注释块。

---

## Obsidian 1.14 高亮色（highlight colors）⚠️

1.14 新增高亮色：光标落在高亮文字上时，行内出现色环 widget。DOM 为
`.cm-highlight-color-widget > img.highlight-swatch`（0.9em 圆点，**该 img 没有 `width` 属性**）。

- **踩坑**：基座（Cupertino）的「全宽元素」规则
  `body:not(.full-width-media-off) .cm-content img:not([width],.cm-widgetBuffer,.link-favicon,.emoji,[alt=banner])`
  会命中这个裸 `img`，把它拉成整行宽（用户看到的「颜色红圈被拉宽到和文字一样宽」），且同组的 `background:var(--background-primary-alt)` 还会把圆点颜色覆盖成纸色。
- **修复（历史）**：3.2.12 时靠 `PATCHES` 补丁在基座该 `img:not(...)` 排除列表里补 `.highlight-swatch`（`expected: 4`）。定制层另有一条 `!important` 兜底（`src/90-onepage.css`「Obsidian 1.14 兼容层」），**兜底规则故意不设 `background-color`**，让官方 `.highlight-swatch[data-highlight=red]{background-color:var(--color-red)}` 的配色原样生效。
- ✅ **4.1.0 已自行修复**（排除列表里带了 `.highlight-swatch`，4 处）→ 基座补丁已于 2.0.0 删除，**定制层兜底保留**（防上游回退）。
- 验证示例（无头 Chrome，把 1.14.4 的 `app.css` + `theme.css` 内联进页面）：色环应 `width:14.39px`（0.9em @16px）、`border-radius:50%`、背景为 `--color-red`；同时**真实图片仍是 `width:600px` 全宽**，证明未误伤全宽媒体。

---

## 插件兼容（继承 Cupertino）

Cupertino 基座里有一段第三方插件兼容层（上游 `src/app/community-plugins.scss`），会直接改插件元素，**已有踩坑**：

- `Relative Line Numbers`（`nadavspi/obsidian-relative-line-numbers`）：基座给了 `.relative-line-numbers-mono{position:absolute;width:100%}`。该标记只在**当前行**渲染，而它最近的 positioned 祖先是 `.cm-scroller`（CM6 基座 `position: relative`；`.cm-gutters`/`.cm-gutter` 均无 position），于是命中区 = 整个编辑区宽，盖在正文上抢鼠标事件 → 同一段落内重复点击/选字丢失焦点。
  主题已在定制层加 `pointer-events: none`（**不要删**）；后续从上游合并 Cupertino 时注意别把这条覆盖回去，也建议顺手给上游提 issue（baseline / lumin 等衍生主题同样中招）。
- 排查同类问题的手法：定位元素 → 看 class → 在 `vendor/` 基座里 grep 该 class（3.2.12 是压缩两行要用 python；4.1.0 已是格式化输出，`grep -n` 即可）→ 优先在 `src/90-onepage.css` 里加修正。

---

## Cupertino 4.x 静默失效清单（踩过的坑，改动前先读）

换到 4.1.0（2.0.0）时实测到的「不报错但失效/变形」三处，均已修在 `src/90-onepage.css`：

1. **开关（toggle）被基座染成系统绿**。4.1.0 新增
   `body:not(.accented-interface) .checkbox-container{--interactive-accent:var(--color-green)}`（`accented-interface` 全表只出现这一次、无人设置）。
   ⚠️ 它声明在 `.checkbox-container` **自身**，而 OnePage 的 `--interactive-accent: var(--text-accent) !important` 声明在 **`body`** 上：
   **CSS 里「元素自身的声明」永远赢过「继承值」（哪怕继承值带 `!important`）** → 继承链防不住。
   修法：定制层 `.checkbox-container { --interactive-accent: var(--text-accent) !important; }`。
2. **活跃 tab 的 `background:` 简写会吃掉 OnePage 的 `background-color` 覆盖**。4.1.0 把活跃 tab 从
   `background-color: rgba(primary/75%) + box-shadow: var(--shadow-tab)` 改成 `background: var(--raised-background) + box-shadow: var(--raised-shadow)`
   （`--shadow-tab` 已删除）。`background` 是**简写**，会一并设上 `background-image: linear-gradient(...)`，
   只写 `background-color` 的旧覆盖会静默失效（渐变盖在上面）。
   修法：定制层用 `background: <色> !important` 或补 `background-image: none !important`。
3. **Callout 的「边框」不是 border，而是 box-shadow 里的两层 `0 0 0 0.5pt` 环**。4.1.0 在 macOS 下 callout 已是
   `border: none`（实测 `border-width: 0px`），那圈框来自 `box-shadow`：
   `color(accent / var(--callout-border-opacity)) 0 0 0 0.5pt` + `rgba(0,0,0,.075) 0 0 0 0.5pt`（后者来自 `--shadow-edges` 首层，最显眼）。
   ⇒ **`border: none` / `--callout-border-width: 0` 一点用都没有，必须重写 `box-shadow`**。
   修法见 `src/90-onepage.css` §18（保留 inset 内高光 + 柔和投影，去掉两层环与左右细线；排除 `note-toolbar` / `banner-icon` 两个非内容 callout）。
   同一节还有另两条与基座无关、但同样容易踩的：
   - **不要给 callout 加 `margin-block`**：两个 callout 之间**必须空一行**才分得开，**那一行本身就是间距**
     （实时预览 ≈ 一个行高 28px@17px；阅读视图是 core 的 `1em`=16px）。多加 margin 会变成「空行 + 额外间距」，
     用户第一眼就是“距离太大”。
     ⚠️ 方法论坑：曾用无头 Chrome 合成 DOM 量到“实时预览间距 0px”并据此加过 1.5em —— 那是合成 DOM
     **漏了空行对应的 `.cm-line`** 造成的假象。**涉及 CM6 行距/空行/块间距的测量，必须在合成 DOM 里补上空行节点，否则数值不可信。**
   - **但嵌入态（`![[...]]`）是例外，必须给间距**：实时预览里的嵌入内容是一个**嵌套的只读编辑器**，
     它继承了 core 的 `.mod-cm6 .callout{margin:0}`，而嵌入里不渲染源码空行 → 相邻 callout 贴死。
     定制层用 `.markdown-embed .callout:not(.callout .callout) { margin-block: 1em }` 抬高（值取 core 阅读视图默认值，
     所以在阅读视图的嵌入里等于没改）。注意：**不能用 `.callout + .callout` 相邻选择器** —— LP 里两个 callout
     各自在 `.cm-line > .cm-embed-block` 里，不是兄弟节点。
   - **配色走 OnePage 自定的 14 个 `--callout-*` 语义变量**：基座用的是 macOS 系统色（高彩度偏冷），
     放在暖白/暖棕纸面上像贴纸。另：callout **不再用 `--raised-background`**（那层 ~50% 透明玻璃渐变会把 13% 淡染冲成灰白，
     实测分不出类型）。改配色只改 §18 那张表，**不要去改 `--color-*`**（那会影响标签 / canvas / 报错等全局配色）。

另有两处**值变了但没报错**的变量（已实测，待目视定标）：
- `--background-modifier-border`：3.2.12 = `rgba(var(--mono-rgb-100), .075)`（墨 7.5% 透明）→ 4.1.0 = 不透明冷灰 `#d0d0d2` / `#4d4d51`。
  OnePage 自用四处（代码块描边、行内代码底、状态栏上边框、滚动条）。在暖白/暖棕纸面上会显冷，如需回暖色可用
  `color-mix(in srgb, var(--text-muted) 22%, var(--background-primary))`。
- `--shadow-s`：4.1.0 换成带 `0 0 0 var(--border-width) hsl(0 0% 0% / .05)` 环的新配方（`--shadow-tactile` 已删除）→
  Bases 卡片的 fallback `var(--shadow-tactile, var(--shadow-s))` 会连带多一圈环。
- `--border-width`：0.5px → 1px（OnePage 只有状态栏一处用到）。

---

## 性能：不要让选择器触发「全文档样式重算」（⚠️ 2.0.0 踩过，用户反馈"慢"）

CSS 里有几类写法**不报错、不改外观、也不影响任何断言**，但会让浏览器在**每次 DOM 变更**时重算整个文档。
2.0.0 就因为下面三类混在一起，把常见操作放大 40~250 倍（用户反馈"响应有点慢"，快机器上只表现为轻微掉帧）：

| 场景（6000 节点合成 DOM，µs/次） | 原生 Obsidian | 2.0.0 | 修复后 |
| --- | --- | --- | --- |
| 滚动（CM6 视口换 5 行，**笔记含引用块**） | 233 | **17 315** | 1 753 |
| 滚动（不含引用块） | 228 | 17 315 | **222** |
| 切标签页 | 60 | **17 028** | 37 |
| 文件树点选 | 1.7 | **1 203** | 33 |
| 折叠/展开侧栏 | 90 | **17 240** | 265 |
| 写一次 inline style（拖分隔条/画布/浮层定位） | 15 | **16 943** | 132 |

### 三类元凶（附 2.0.1 的处理）

1. **挂在 `body` 上的 `:has()`**：任何元素改 class 都要从 body 重新求值一遍。
   - 基座 `… .mod-root:has(+ .mod-sidedock…:hover)`（**即使 `.hover-sidedock` 关着也照付**）、
     `… .mod-sidedock:has(> .workspace-tabs.mod-active)` → 已在 `scripts/build.mjs` 的 `PATCHES` 里删掉。
   - 定制层「聚焦弱化」曾用 `body:has(.workspace-leaf.mod-active .markdown-source-view) …`（8 个选择器）
     → 改成无条件弱化（见 `src/90-onepage.css` §9）。**想按状态分支时，优先找 Obsidian 已经维护好的类名**
     （如 `.workspace.is-left-sidedock-open`），而不是写 `:has()`。
2. **`:hover` 参与的兄弟选择器与 `:has(... :hover)`**：`… :hover + .mod-root …`、`… :hover ~ .mod-root …` 同理，
   改 class 就要重新判定 hover 依赖，实测 7ms。基座 hover 模式那条 `-webkit-app-region: no-drag` 规则已整块删掉
   （`-webkit-app-region` 只影响窗口拖拽区，不参与绘制，无视觉影响）。
3. **在 `<html>` 上按 `style` 属性做子串匹配**：基座三条手机端键盘判定
   `body.is-phone:not(html:where([style*="--keyboard-height: 0px"], … ) body) …`
   等于告诉浏览器"任何元素的 style 变化都可能影响根节点" → 每次写 inline style 全文档重算（实测 11ms/次）。
   已用 `@media (pointer: coarse)` 包起来（桌面端本来就不可能命中，手机端判定不变）。

### 验收方式

```bash
node scripts/perf-probe.mjs /tmp/ob1144/app.css --tree 2000   # 或 npm run perf -- <app.css>
```

三行对照 `app`（原生）/ `theme`（当前构建），任一场景超过 `max(2ms, 原生×20)` 会 **exit 1**。
换基座后必须跑一遍；改定制层里任何带 `:has(` / `:hover +` / `[style*=` 的规则也要跑。

### 已知的"地板"（不必再折腾）

- 基座规则体量本身就比原生多 ~1100 条规则，编辑器每帧样式重算 ≈ 0.2~1.3ms（原生 ~0.2ms）。
- **笔记里有引用块时**，滚动每帧还要多 ~1.5ms：基座用
  `.HyperMD-quote:first-child, .cm-line:not(.HyperMD-quote) + .HyperMD-quote` 和
  `.cm-line.HyperMD-quote:has(+ .cm-line:not(.HyperMD-quote))` 给引用块首尾行做圆角，
  这两个选择器依赖兄弟/后继节点，删行插行都要重新判定。要抹掉它就得放弃引用块首尾圆角，暂不处理。
- 无头 Chrome 量到的绝对值和真机不同，看**相对倍数**，别看绝对值。

### 改视觉时的回归检查（合成 DOM 对比）

改动若声称"不影响外观"，用同一份 DOM 把旧/新 `theme.css` 先后注入，逐元素比
`getComputedStyle`（含 `::before/::after`）+ `getBoundingClientRect` + 整页截图逐像素；
同时用**同一份 CSS 连拍两张**做噪声对照（跨帧重绘会有假差异）。
2.0.1 实测 9 个场景（浅/深/透明/侧栏折叠/悬停功能区/演示模式/手机键盘收放）像素差异 0，
仅两处**有意**差异：非笔记视图（画布/图谱）激活时侧栏也会 8% 弱化；hover 模式下拖 tab 头不再禁用窗口拖拽。

---

## 变更纪律

- **只改 `src/`，改完必须重建并校验**：
  ```bash
  npm run build && npm run verify
  ```
  `verify` 会检查：产物与源是否一致（防忘构建）、大括号平衡、选择器改写残渣、`@settings` 元数据、`manifest`/`versions` 版本一致性、变量体检。
- 提交信息用 `fix(...)` / `refactor(...)` / `release: vx.y.z` 风格，中文说明，写清动机。
- 改完记得同步：代码提交 + （如涉及版本）tag + Release 三步都要。

## 「属性面板默认收起」为什么是 CSS 而不是设置项（⚠️ 已踩过两次坑）

Obsidian **没有**「属性面板默认收起」这个设置项（`app.js` 里设置默认值只有
`propertiesInDocument: visible / hidden / source`），而且它的「记忆」只在**阅读视图**生效：
`MarkdownView` 上有个全局静态 `collapseProperties`（默认 `true` = 收起），但只有阅读视图的加载路径
会 `setCollapse(它)`；**实时预览的 frontmatter 每次新建视图都是展开的** → 用户感受就是「每次都要手动点收起」。

OnePage 用 Style Settings 开关 `properties-collapsed`（`src/90-onepage.css` §12.1）在 CSS 层补上。
**当前实现 = 焦点机制**（`src` 里有完整注释）。

**对外说明（写在 @settings 的 description 里，注意 class-toggle 的描述只支持纯文本单行 ——
Style Settings 的 class-toggle 渲染走 `setDesc`，不解析 markdown，`\n` 也不会换行）**：

- 默认收起（只留「属性」标题栏）；点击属性卡片展开并保持；
- **再次点击卡片不会收起** —— 收起要点卡片以外的任意位置（点进属性行编辑不算）；
- 状态不记忆（换笔记/重启回到收起）；侧栏「属性」视图不受影响；
- Style Settings 会为 class-toggle 自动注册命令（`Toggle <title>`）→ 可绑快捷键随时切换。

- 默认隐藏 `.metadata-content`；点击属性卡片 → `.metadata-container`（Obsidian 给了 `tabindex="-1"`）获得焦点
  → `:focus-within` 成立 → 展开；点到别处失焦 → 自动收起；
- 收起态把 `.metadata-properties-heading` 设成 `pointer-events: none`，让点击**穿透到卡片本身**
  （否则点标题栏只会触发 Obsidian 自己的折叠开关，而那个开关的状态我们不用）；
- 展开态必须 `!important` 压掉 `display`/`height`/`overflow`，并恢复 `.metadata-property { display: flex }`
  （core 有 `.metadata-container.is-collapsed .metadata-property { display: none }`）；
- 作用域限定在正文：侧栏「属性」视图（`.workspace-leaf-content[data-type=file-properties]`）复用同一套 DOM/类，
  不限定会连它一起收起。

### ❌ 两次失败尝试（别再回头试）

1. **用 `:hover` 展开** —— 用户否：鼠标移开就缩回，晃动。
2. **用 `.is-collapsed` 反色显示**（借用 Obsidian 自己的点击开关，点标题栏切换）—— **不可靠**：
   markdown 视图的 `metadataEditor` 实例在「阅读视图 / 实时预览」之间是**同一个 DOM 复用**的，
   只要某篇笔记在阅读视图里被套用过收起状态（全局 `collapseProperties` 默认就是 true），
   切到实时预览就带着 `is-collapsed` 进来 → 反色后正好显示成展开。用户实测「总有些笔记打开是展开的」。

### 验证方法（可复现）

不要只靠合成 DOM 推测 —— 用 CDP 派发**真实鼠标点击**才能证明焦点链路：
`/tmp/cdp-click-test.mjs`（思路：headless Chrome 开 `--remote-debugging-port`，
`Input.dispatchMouseEvent` 点击收起后的标题栏区域，再读 `document.activeElement` 与
`.metadata-content` 的 computed display）。实测结论：
点击前 59px（只有标题栏）→ 点击后 137px（展开，`activeElement` = `.metadata-container`）→ 点正文失焦后回到 59px；
带 `is-collapsed` 残留的容器同样能正常展开。

### 属性面板里的多选药丸（aliases / cssclasses / tags）⚠️

core 有一条 **`.metadata-property-value .multi-select-pill { --pill-padding-x: 0; --pill-padding-y: 0 }`**
（Obsidian 的设计：属性面板里的 pill 贴住文字、看起来像纯文本）。它比定制层那条全局 `.multi-select-pill`
（`src/90-onepage.css`「标签 = 青色」章节）**特异性高**，而 OnePage 给这些 pill 加了青色底 + 圆角 →
**底色生效、内边距被归零** → 文字和 × 按钮直接贴着青色底边缘（用户反馈「底框和内容之间没有空隙」，
aliases / cssclasses 这种较长的值最明显）。

修法：在同章节里追加一条同特异性、后写的覆盖，把内边距还给属性面板内的 pill
（`.metadata-property-value .multi-select-pill { --pill-padding-x: 0.55em; --pill-padding-y: 0.2em }`）。
**Bases 表格/卡片里的 pill 不受影响**（core 那条归零规则不含 Bases 作用域），改这里不要去动 Bases 的规则。

验证手法：无头 Chrome 量「药丸盒子 vs 文字盒子的四个间隙」（`/tmp/probe-pill.mjs`），
修复前 文字左/下/×右 间隙全是 `0`，修复后为 `6.3 / 2.3 / 6px`，行高仍是 28px（不撑高行）。
