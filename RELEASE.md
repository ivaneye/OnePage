## Changelog

> Full changelog. The README only links here — releases are append-only.

### 2.1.0

**Colors and content width are now fully adjustable: 41 new Style Settings options, plus a new design-token layer.**

Heading colors, all 14 callout colors, every background layer, text and surface shades, and content width were previously fixed. They are now individually adjustable — while **every default stays exactly OnePage's native design**. Change nothing and nothing changes: the theme looks identical to 2.0.2 with or without Style Settings installed.

#### New settings (Style Settings → OnePage)

**Colors (35)**
- Bold accent (reminder) color: the color of `**bold**` text, one value per light/dark mode
- Highlight opacity: background opacity of `==highlight==` (shared by Obsidian 1.14's six highlight colors)
- Callout tint strength: 0 = plain paper, 13 = default
- Six heading colors, 14 callout semantic colors, five background layers (content / sidebar·menu / input·hover / sidebar card / window margin)
- Three text levels (normal / muted / faint) and four surface shades used by native controls

**Typography (2)**
- Content width: 480–1400px, default 700
- Force readable width: applies that width (centered) even when Obsidian's "Readable line length" is off — without it, the width slider has no effect while that setting is disabled

**Layout (3)**
- Sidebar card gap / sidebar card radius / tab radius

**Demo (1)**
- Demo mode line width: default 880px, and the larger of this and "Content width" wins — widening the body never narrows demo mode

Every color option states its **default light / dark value** in the description. The control renders two previews — a swatch on the light paper and a swatch on the dark paper — so you can see how the same color looks in both modes. The first swatch inside the picker is the default — one click to restore.

Two Style Settings control glitches were fixed as well:

- **Swatches rendered as a transparent checkerboard**: when a color has never been set, the plugin writes an empty `--pcr-color`, which CSSOM removes entirely, so `background: var(--pcr-color)` is invalid. The build now generates an initial color per option from its `default-light/dark`; once you pick a color, the plugin's inline style overrides it as usual.
- **Reset icon hugging the bottom edge**: the plugin only sets `padding: 9px` + `line-height: 1`, leaving the SVG baseline-aligned; with the base theme's `.clickable-icon` padding it drifted down. Now centered with flex.

#### Design-token layer (engineering)

- New `src/20-tokens.css`: a single source of truth for every adjustable default plus the base-theme variable wiring. `src/90-onepage.css` now only references tokens, never raw values
- Build order is fixed: settings → header → base → tokens → onepage (tokens must come after the base to override variables such as `--line-width`)
- `npm run verify` now checks that each Style Settings `default` matches its token verbatim — Style Settings always injects defaults, so a mismatch changes the theme even when the user changes nothing
- New `npm run diff:style`: element-by-element `getComputedStyle` comparison (including pseudo-elements and geometry) across light / dark / demo / translucent, used to prove zero visual change
- Fixed: the accent color description was truncated at `#0e6e63` because YAML treated the trailing text as a comment

#### Compatibility

Minimum Obsidian version unchanged (1.14.0). The panel grows from 28 to 69 adjustable options across 7 sections (Colors, Typography, Layout, Demo, Editor, Interface, Accessibility), with 4 collapsible sub-sections under Colors (headings, callouts, backgrounds, text & surfaces) and a “Tabs & Status Bar” sub-section under Layout. Sub-section titles include their item counts, so you can tell whether a group is worth expanding.

### 2.0.2

**Fix: with “Translucent window” enabled, a full-height vertical divider appeared between the left ribbon and the file explorer.**

#### Cause

OnePage's “ribbon merged into the sidebar card” rules in `src/90-onepage.css` are scoped with `:not(.is-translucent)`, so with **Settings → Appearance → Translucent window** on, the card no longer extends left underneath the ribbon. The translucent-mode sidebar card also carries a `1px` hairline border (the “frosted glass” section), and that border lands exactly at the ribbon's right edge (`x = --ribbon-width`) — running from top to bottom, it reads as a divider.

Measured in a real Obsidian 1.14.4: in opaque mode the card uses `margin-left: -36px / padding-left: 44px`, so its left edge sits at x=8 (left of the icons, visually the card's rounded edge); in translucent mode it uses `margin: 0 / padding-left: 0`, putting the left edge at x=44 with the hairline right on the ribbon boundary.

#### Fix

The card now slides under the ribbon in translucent mode as well. The translucent card has no 8px outer gutter (`margin: 0`, flush with the window edge), so the offset is the **full** `--ribbon-width` (opaque mode uses `-ribbon-width + 8px`); the card's left border — now sitting on the window's left edge — is made transparent, otherwise it leaves a 1px band slightly darker than its surroundings. The ribbon needs no extra rule: the base theme already gives it `position: relative; z-index: 11`, while the card's `z-index` is auto, so the icons stay on top.

#### Verified

- Translucent mode: vertical borders in the 0–130 px band go from `borderL @44` to **none** (light and dark), the file tree stays at x=45, and the content column now matches opaque mode (254 px)
- Opaque mode is untouched (regression check: card at x=8, `margin-left: -36px`, `padding-left: 44px`, tree at x=53 — identical to 2.0.1)
- Collapsed sidebar / ribbon disabled / hover-ribbon states unaffected

#### Known, not fixed

On iPad / tablets Obsidian moves the ribbon into the drawer and renames it to `.workspace-drawer-ribbon`; core keeps a `border-inline-end` on that class (`--background-modifier-border`) and neither the base theme nor OnePage resets it — tablets still show a grey vertical line there. Left for a future release.

Minimum Obsidian version is unchanged (1.14.0).

### 2.0.1

**Performance fix: CSS selectors no longer trigger whole-document style recalculation.** No functional or visual change (verified pixel by pixel), but the style recalc that happens on every scroll tick, tab switch, file click and sidebar toggle drops from ~10 ms to well under 1 ms — users who reported the UI feeling sluggish will notice the difference.

#### What changed

- Removed several base-theme selectors that forced a full-document recalc on any DOM mutation:
  - `… .mod-root:has(+ … :hover)`: it cost this even with the "hover sidebar" option turned off
  - `… .mod-sidedock:has(> .workspace-tabs.mod-active)`
  - the `… :hover + / ~ .mod-root …` rule setting `-webkit-app-region` in the hover modes (it only affects window-drag hit areas, never paint)
  - the mobile keyboard check `:not(html:where([style*="--keyboard-height…"]) body)`, which made *every* inline-style write recalculate the whole document → moved behind `@media (pointer: coarse)`
- OnePage's "dim other panes while editing" no longer uses `body:has(…)` (now unconditional at 8% / 20% opacity); the ribbon rule uses Obsidian's own `.workspace.is-left-sidedock-open` class instead
- Layout transitions are turned off while dragging a split or sidebar edge: width now follows the cursor immediately instead of catching up ~263 ms later (Obsidian already adds `.is-grabbing` to `body` while dragging, and `.no-transition` on the app container for sidebar resizing)

#### Measured (synthetic 6k-node workspace, style recalc per interaction)

| Scenario | 2.0.0 | 2.0.1 |
| --- | --- | --- |
| Scrolling (5-line viewport churn) | 17.3 ms | 1.8 ms |
| Switching tabs | 17.0 ms | 0.04 ms |
| Clicking a file in the explorer | 1.2 ms | 0.03 ms |
| Collapsing / expanding a sidebar | 17.2 ms | 0.27 ms |
| Dragging a split (inline width write) | 16.9 ms | 0.13 ms |

#### Appearance

Injecting the old and new `theme.css` into the same DOM and comparing `getComputedStyle` (including pseudo-elements), element geometry and a full-page screenshot pixel by pixel: **9 scenarios (light / dark / translucent / collapsed sidebar / hover ribbon / demo mode / phone keyboard closed & open) show 0 differing pixels.** Two deliberate differences remain:

- With a **non-note view** active (canvas, graph, PDF…), sidebars are also dimmed by 8% (previously only while a note was active)
- In "hover sidebar" / "hover ribbon" mode (off by default), dragging the tab bar no longer disables window dragging

Known, not addressed: scrolling through notes that contain **blockquotes** costs about 1.5 ms extra per frame (the base theme draws the rounded caps of quote blocks with sibling/`has()` selectors; removing them would flatten the corners).

Minimum Obsidian version is unchanged (1.14.0).

### 2.0.0

**Base theme upgraded: Cupertino 3.2.12 → 4.1.0** (a full "Liquid Glass" rewrite — roughly 44% of the base's selectors were replaced). This is the biggest visual change since 1.0.0, so please read the notes below.

#### ⚠️ Requirements changed

- **Minimum Obsidian version is now 1.14.0** (was 1.13.4). On 1.13.x, Obsidian will keep you on 1.3.0 and won't offer 2.0.0.
- **Desktop: update the Obsidian *installer* as well**, not just the app. The new base probes for modern rendering features (`interpolate-size`) and otherwise shows “Cupertino requires a newer Obsidian installer” at the top of the window.
- **Mobile:** the base ships its own touch/mobile styling (upstream advertises mobile support), but OnePage's custom layer is desktop-first and mobile was **not** specifically verified for this release.

#### ✨ Deliberate visual changes

- **Callouts, rebuilt for this palette**
  - The hairline ring around every callout is gone. In 4.1.0 that frame is no longer a `border` but two `0.5pt` layers inside `box-shadow`, so it needs an explicit override.
  - Colours are now OnePage's own muted “ink” palette (slate blue / teal-green / ochre / moss green / dusty purple / amber / brick / warm grey) instead of the base's bright macOS system colours, which read like stickers on warm paper.
  - The tint is a flat 13% accent over the paper colour instead of a washed-out glass gradient, so callout *types* are actually distinguishable again.
  - Callouts inside embeds (`![[note#section]]`, hover previews) no longer sit flush against each other — Live Preview renders embeds in a nested editor where the base zeroes margins.
- **Checkboxes are circles everywhere.** Reading view used to draw small rounded squares (15px / 4px radius) while Live Preview and the properties panel drew circles (16px). All three are now 16px circles driven by the base variables.
- **Toggles are teal again.** 4.1.0 injects `--interactive-accent: var(--color-green)` on `.checkbox-container`; OnePage declares its accent on `body`, and an inherited value can never beat a declaration on the element itself — toggles would have turned macOS green.
- **The active tab is flat again** — no glass gradient, no hairline ring. (4.1.0 switched to a `background:` *shorthand*, which silently swallows a `background-color`-only override.)
- **The status bar stays an opaque capsule** (hover glass disabled): in translucent mode the base's glass resolves to “semi-transparent with no blur”, which lets text show through.
- **Glass surfaces are warm** — menus, modals, the command palette and notices used the base's neutral grey glass, which goes muddy over warm paper.
- **Code blocks and tables are flatter** — 4.1.0 removed the gradient background and shadow from code blocks, and its hairline colour moved from translucent ink to opaque grey (matching the current macOS look).
- **New option: “Collapse Properties by Default”** (Style Settings → Editor). Collapsed by default; click the properties card to expand, click elsewhere to collapse. Obsidian has no such setting and does not remember the state in Live Preview.
- Typography: heading/list spacing and table font sizes follow 4.1.0's updated metrics.

#### 🔧 Settings changes

- **“Disable full-width elements” has a new id** (`media-width-fit`, previously `full-width-media-off`). If you had it enabled, **re-enable it once** — Style Settings cannot migrate the old key.
- Removed “Standard font size” (`dynamic-type-off`) — dropped upstream.
- OnePage still exposes every base option bilingually (34 items in total).

#### ⚪ Unchanged

- “Window translucent” is still **not recommended** (macOS Electron vibrancy + `backdrop-filter` ghosting — an upstream Electron issue closed as won't-fix).
- JetBrains Mono Nerd Font is still the default code font, with a system fallback.
- The theme is still assembled from a pinned upstream base plus the `src/` layer (`npm run build` / `npm run verify`).

### 1.3.0

- **Internal refactor (no visual change)**: the theme is now assembled from a pinned upstream Cupertino base + a OnePage layer, instead of being one hand-maintained file. Sources live in `src/`, the base in `vendor/`, and `npm run build` / `npm run verify` regenerate and sanity-check `theme.css` (now a build artifact). This is the groundwork for the Cupertino 4.x upgrade — the rebuild is byte-for-byte identical to 1.2.1, so nothing should look different
- **Compatibility hardening**: `--ribbon-width` and the Bases card `--shadow-tactile` now have fallback values, so the sidebar card layout and card hover shadow survive missing or renamed variables (in Obsidian or in the upstream base)
- Docs: added `docs/UPGRADE-CUPERTINO-4.md` — the 2.0.0 upgrade plan

### 1.2.1

- **Fixed**: sidebar ribbon icons disappeared on Obsidian 1.14 — the ribbon's position class was hard-renamed from `.mod-left` to `.mod-primary`, so the base rules silently stopped matching and the sidebar card drew over the ribbon. The theme now matches both
- **Fixed**: on Obsidian 1.14, the highlight-colour swatch next to highlighted text was stretched to the full line width

### 1.2.0

- **New: Bases redesign** — tables and cards now speak the theme's own table language
  - Table: restrained accent header + 2px accent divider + 1px full grid, no outer frame; row/header hover uses the same accent tint as the active-line highlight; grouped headings get a mini-section treatment (bold value, faint label, tinted bar + hairline); font size aligned with markdown tables; tabular numerals
  - **Worked around an Obsidian layout flaw** (affects the default theme too): after manually resizing the last column, the header line ended short of the body — the header lacks the `min-width: 100%` fallback the body chain has; now defended in-theme
  - Cards: hairline cover seam, 600-weight titles, group bars matching table groups, hover lift / press settle
  - Embedded bases now render identical to standalone (restored header line, body bottom line and first-column line; squared corners)
- **Fixed**: the gray band above/below images in the editor that looked like a phantom input line (#4) — lines containing block widgets (images, embeds, tables) no longer get the active-line background fill
- **Fixed**: dark-mode menus were nearly see-through glass (7.5% white) and unreadable over accent-colored content; now a darker frosted glass

### 1.1.4

- **Fixed**: with the *Relative Line Numbers* plugin enabled, repeated clicks or text selection inside the active paragraph no longer lose editor focus — the plugin's decorative gutter marker (`position: absolute; width: 100%`, inherited from Cupertino) had a hit area spanning the whole editor, so it swallowed pointer events over the text. It is now `pointer-events: none`
- OnePage is now listed in Obsidian's in-app theme browser (Settings → Appearance → Themes → Browse)

### 1.1.3

- English is now the default README; the Chinese version moved to [README_CN.md](./README_CN.md)
- **Fixed missing release assets** — installing and updating from within Obsidian works again; every release now ships `manifest.json` + `theme.css` as binary attachments
- Releases are now published automatically by GitHub Actions when a version tag is pushed

### 1.1.0

- Full **Style Settings** support (inherits all Cupertino toggles + OnePage-specific options)
  - **Colors**: accent (light/dark), disable typographic colors, body line height, tinted sidebar, dynamic color
  - **Layout**: hover ribbon/sidebar, focus view, always-show Vault switcher & status bar, compact panels, etc.
  - **Demo**: demo mode (bindable hotkey), demo font size
  - **Editor / Accessibility**: active line, banner, block width, font variants, adaptive mode, motion, font/icon size, etc.
- Bilingual settings panel (follows the Obsidian UI language automatically)
- Removed the "Disable compact status bar" toggle
- Fixed text showing through when "Always show Vault switcher" is enabled

### 1.0.0

- Initial release: based on Cupertino 3.2.12
- Fixed dual color schemes (Warm Paper / Warm Brown · Cool Anchor)
- Integrated geeky editor details, macOS capsule tabs, Notion-style file tree, and more
