# OnePage 2.0.0：升级 Cupertino 基座到 4.x — 实施计划

> 记录时间：2026-10-10（动工前的方案评审稿）
> 状态：**方案已确认，尚未实施**。本次先做「结构重构 + 兼容修复 + 发版」（1.3.0），2.0.0 见下文 Phase 0~7。

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
| 位置 | 问题 | 处理方向 |
| --- | --- | --- |
| `src/90-onepage.css` Bases 卡片 | `var(--shadow-tactile)`，4.1.0 已删除该变量 | 1.3.0 已加 fallback `var(--shadow-tactile, var(--shadow-s))` |
| 复选框（约 178–222 行） | 4.x 改用 `--checkbox-color` + `--checkbox-radius:100px`（圆形）+ `.checkbox-container` 体系 | 重做，保证正文/属性面板/开关三处一致 |
| 侧边栏卡片（§6/§7 及非透明兜底） | **4.1.0 给侧边栏新增 border**（对齐 macOS 27.2）+ Liquid Glass | 正面冲突，需重新对齐 margin/radius/描边 |
| 属性面板（§12） | 4.1.0「Properties 更紧凑」 | 复测 `.metadata-property-key` 居中等覆盖是否仍需要 |
| 菜单/弹窗（§15） | 4.x 改 `--menu-background: var(--modal-background)` / `--raised-background` | 复测透明模式防透字 |
| 状态栏（§5） | 4.1.0 新增 Liquid Glass 状态栏 | 复测悬浮胶囊/紧凑样式 |
| Callout / 代码块 | 4.1.0 **移除**了 border / 渐变 / 阴影 | 清理或重定义 OnePage 的相关覆盖 |
| Tab（§8） | 圆角/胶囊变量体系变化 | 复测 |
| Relative Line Numbers | 4.1.0 **仍然保留** `.relative-line-numbers-mono{position:absolute;width:100%}` | `pointer-events:none` 补丁必须保留 |

### 3.5 待定决策（动工时再定）
- **透明模式 / 毛玻璃**：OnePage 现在是「侧栏卡片 + 不用 blur 防重影」，4.x 主推 Liquid Glass。
  是「全盘接受上游玻璃」还是「继续 OnePage 自己的卡片语言」，**未定**，动工前确认。

---

## 4. 分阶段实施（Phase 0–7）

- **Phase 0 · 前置与基线**：Obsidian 升到 1.14.4 + **更新安装包**（4.x 用 `@supports (interpolate-size: allow-keywords)` 探测，属 Electron 能力），确认无 `Cupertino requires a newer Obsidian installer` 提示；打 `backup/1.2.1` tag、开分支；**冻结同版本基线截图**。
- **Phase 1 · 流水线**：✅ **已在 1.3.0 完成**（含字节一致自证）。
- **Phase 2 · 换基座**：`VERSION` 改 4.1.0、删除 2 个已失效补丁、构建 → 产出失配清单。
- **Phase 3 · 设置面板**：按 §3.2 增删 3 项（补中英双语）。
- **Phase 4 · 定制层适配**：按 §3.4 逐条修，每条要求「新基座证据 + 基线截图对照」。
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
