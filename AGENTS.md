# AGENTS.md — OnePage 主题开发规范

本文件记录本仓库的发布规范与高频踩坑点，供 Agent 在开发/修改/发布时遵守。**修改前先读一遍，尤其发布流程。**

## 项目背景

- **项目**：Obsidian 社区主题 OnePage（macOS 原生 × 极客感）
- **仓库**：`/Users/wangyifan/Documents/ob-dev/.obsidian/themes/OnePage`（开发库，即测试库，无第二副本）
- **远端**：`origin = git@github.com:ivaneye/OnePage.git`（SSH），分支 `master`
- **发布人账号**：`ivaneye`（`gh` 已登录）
- **主题文件**：`theme.css`（单文件、约 800 行、独立主题，不依赖外部主题）
- **配色基调**：
  - 浅色「暖白纸张」：背景 `#faf7f1`，强调 `#0e6e63`（深青）
  - 暗色「暖棕·冷锚」：背景 `#262322`，强调 `#6db3a3`（浅青）
  - 自适应颜色优先用 `color-mix(in srgb, var(--text-muted) XX%, var(--background-primary))`，不要写死两套

---

## 发布流程（重点规范 ⚠️）

Obsidian 社区主题靠 **GitHub Release** 分发更新：**只推代码/tag 而没有 Release，用户在 Obsidian 里收不到更新。**

版本号必须 **`x.y.z` 纯数字，禁止 `v` 前缀**（tag、release 名称、manifest 三处统一）。

### 标准发布步骤

1. 改版本号：`manifest.json` 的 `version`（如 `1.0.3`）
2. `versions.json` 追加映射：`"1.0.3": "1.13.4"`（右侧为 `manifest.json` 的 `minAppVersion`）
3. 提交：`git add manifest.json versions.json && git commit -m "release: v1.0.3"`
4. 打 tag：`git tag 1.0.3`（**无 v 前缀**，必须与 manifest 版本一致）
5. 推送：`git push origin master --tags`
6. 建 Release：
   ```bash
   gh release create 1.0.3 --title "1.0.3" --notes "..."
   ```
   - **`--title`（Release 名称）= `1.0.3`，严禁写 `v1.0.3`**
   - tag 名也是 `1.0.3`
7. 校验：`gh release view 1.0.3 --json name,tagName` 确认 name == tagName == 版本号

### 易错点

- ❌ `--title "v1.0.3"`（带 v）→ ✅ `--title "1.0.3"`
- Release 已建后改名称用：`gh release edit 1.0.3 --title "1.0.3"`
- 若 Release 还没建、tag 已推：可移动 tag（`git tag -d 1.0.3 && git tag 1.0.3 && git push origin --tags --force`）把新修复并入同一版本，避免空发一版
- `gh release edit` 没有 `--name` 参数，改标题用 `--title`

---

## 字体规范（易错 ⚠️）

**代码字体必须用 `--font-monospace-theme`，禁止用 `--font-monospace`。**

Obsidian 的解析链：`--font-monospace = var(--font-monospace-override(用户设置), var(--font-monospace-theme(主题默认)))`

- 用 `-theme` 后缀：用户在「设置 → 外观 → 代码字体」的选择优先，主题只做兜底 ✅
- 直接写 `--font-monospace`：会遮蔽整条链，用户的代码字体设置被主题强制覆盖 ❌（历史教训，见 commit `ae95967`）

主题当前字体默认（`theme.css` 约 55 行）：
```css
--font-monospace-theme: "JetBrainsMono NFM", "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
```

---

## 测试须知

- **Obsidian 不热加载外部修改的 theme.css**。改完必须手动刷新：设置 → 外观 → 主题切走再切回 OnePage（或重启）。
- 用户反馈"没生效"时，先问/提醒刷新，不要急着改代码。
- 本机 `app.css`（Obsidian 1.13.7 官方样式，用于查 DOM/默认值）已解压在 `/tmp/ob_asar/app.css`；渲染层 JS 在 `/tmp/ob_asar/app.js`（可 grep 确认元素生成逻辑）。

---

## 复选框规范（属性面板/正文共用 `input[type=checkbox]`）

属性面板复选框 DOM：`input[type=checkbox].metadata-input-checkbox`（与正文任务复选框同一元素、同一套渲染）。

当前修复块在 `theme.css` 约 178-222 行，规则要点（**改动前先理解，别随手改回**）：

- **未选中描边**：`--checkbox-border-color: color-mix(in srgb, var(--text-muted) 62%, var(--background-primary))`（默认 `--text-faint` 太浅几乎不可见）
- **对勾颜色**：`--checkbox-marker-color: var(--background-primary)`（**禁止用白色**——暗色强调色是浅青 `#6db3a3`，白勾看不见；用背景色画对勾才能亮/暗都高对比）
- **对勾尺寸**：`:after` 的 `-webkit-mask-size: 100%`（与正文一致；`65%` 会细一圈）
- **对勾居中**：`:after` 是绝对定位，相对**内边距盒**（边框以内）；复选框有 1px 边框，必须 `top: -1px; inset-inline-start: -1px` 才能盖满可见盒子居中（`top:0` 会偏右下方 1px）
- 属性面板里开关（`.checkbox-container`，兜底）也要配：未启用加深轨道 + `inset 0 0 0 1px` 描边

---

## 属性面板布局规范

- `.metadata-property-key` 默认 `align-items: flex-start`（子元素偏上），value 是 `center` → 两者不对齐。
  主题里已加 `align-items: center !important`（`theme.css` 约 626 行），**不要删**。

---

## 变更纪律

- 改 `theme.css` 后跑一次括号平衡校验：
  ```bash
  node -e "const fs=require('fs');const c=fs.readFileSync('theme.css','utf8');const o=(c.match(/{/g)||[]).length,cl=(c.match(/}/g)||[]).length;console.log(o===cl?'OK':'不平衡: '+o+'/'+cl)"
  ```
- 提交信息用 `fix(...)` / `release: vx.y.z` 风格，中文说明，写清动机。
- 改完记得同步：代码提交 + （如涉及版本）tag + Release 三步都要。
