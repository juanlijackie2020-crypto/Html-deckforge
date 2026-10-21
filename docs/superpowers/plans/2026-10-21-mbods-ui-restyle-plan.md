# DeckForge × MBODS UI 重构 实施计划

依据 spec：`docs/superpowers/specs/2026-10-21-mbods-ui-restyle-design.md`（commit `b3ab38d`）。token 定义、组件原语、边界行为一律以 spec 为准；本计划只定实施顺序、类名映射决策与验证门。

## 已核实的代码事实（写计划时确认，实现时直接依赖）

1. 待改 18 个文件全部通读：LandingPage 287 / MarketplacePage 423 / TemplatePreview 188 / SlideEditor 404 / SlidePanel 280 / AiPanel 343 / ComponentEditor 604 / Sidebar 70 / Toast 59 / ThemePanel 61 / BrandKitPanel 154 / ExportPanel 114 / DeckManager 45 / App 169 / main.tsx 32 / index.html 16 / globals.css / tailwind.config.js。
2. `mb-*` 色类只出现在待改文件（App/Sidebar/SlidePanel/AiPanel/ExportPanel/BrandKitPanel/ThemePanel/DeckManager/ComponentEditor/SlideEditor）；SlidePreview、deck themes、renderers、exporters 已验证零引用 → 末尾整体删除 `mb` palette 安全。
3. 硬编码 hex 集中在：LandingPage（inline `#0a0a0a` 底 + `#FF7500/#FF9102` 渐变）、MarketplacePage（`#0a0a0a/#FF9102/#FFC767/#00adef` + sky/emerald chips）、TemplatePreview（`#0a0a0a` 上下条 + 渐变 CTA + `#111` 舞台）、SlideEditor（`#0d0d0d→#111` 渐变、`rgba(255,145,2,.18)`）、App ShortcutsOverlay（`#1a1a1a`）。
4. 灰阶 alpha 类（`bg-white/5`、`text-white/60`、`border-white/10`、`bg-black/40` 等）遍布各面板 → 统一按下表映射。
5. 字体：globals.css 已注册 A Title Cond 400 + S Text Regular/Bold（`C:/Windows/Fonts/`）；本机已确认存在 S Text Light → 新增 @font-face；body 栈首 `'Inter'` 从未加载 → 删。
6. index.html 现为 `<style>body{margin:0;background:#0a0a0a}</style>`；main.tsx 无主题逻辑；App 容器 `bg-mb-black text-white`。
7. Toast：模块级 `addToastFn` 单例、`showToast(type,text)`、3500ms 自动消失；类型 success/error/info。
8. 既有 30 用例全部按可见文本断言，类名重写不影响；需要 DOM 的测试文件用 `// @vitest-environment jsdom` pragma（theme.test.ts 沿用）。
9. dev server 后台任务 boazbib7n（端口 5174）运行中，热更目检；不重启。
10. 验证命令：`npx tsc --noEmit`、`npx vitest run`、`npx vite build`（勿用 `npm test`/`npm run build`）。

## 类名映射决策（全局统一，spec §3–4 的落地细节）

| 现状 | 新 | 说明 |
|---|---|---|
| `bg-mb-charcoal/50`、`bg-mb-black`、`bg-[#0a0a0a]`、`bg-white/[0.03]` 面板底 | `bg-surface` | 侧栏 / 面板 |
| `bg-white/5`、`bg-[#151515]` 输入控件 | `bg-surface-elev` + `border-hairline`，focus `border-brand` | 表单规则，全 app 统一 |
| `text-white`、`text-white/80` | `text-ink` | |
| `text-white/50–60`、`text-mb-gray` | `text-ink-2` | |
| `text-white/30–40`、`text-mb-gray/50`、placeholder | `text-ink-3` | |
| `border-white/5–15` 边 | `border-hairline`（hover `border-hairline-hover`） | |
| `text-mb-orange`、`#FF9102`、橙渐变按钮 | `text-brand` / `.btn-primary` | AI / 生成类 |
| 模板 / 导入元素（DeckManager 导入、raw 模板、marketplace 入口） | `text-ai` / `border-ai` / `bg-ai-soft` | 双色规则蓝侧 |
| `text-green-400`、`bg-green-400/10`（自动保存、DeepSeek badge） | `text-success`（badge 加 `border-success`） | |
| `text-yellow-400` warning | `text-warning` + 左缘 3px `border-warning` 条 | |
| `text-red-400` / `red-500` | `text-destructive` / `border-destructive` | |
| `bg-black/60` 浮层 chip（缩放 pill、页码角标） | `bg-surface-elev` + `border-hairline` + 微 shadow | 深浅主题都可读 |
| 遮罩（ShortcutsOverlay backdrop、TemplatePreview 全屏底） | `bg-black/50`、`bg-black/95` 保留 | 中性 scrim 不属于主题色 |

组件级小项（spec 未逐一列到的）：

- MarketplacePage `SOURCE_META` chips：builtin=`text-brand-amber border-brand bg-brand-subtle`；folder=`text-ai border-ai bg-ai-soft`；upload=`text-success border-hairline bg-surface-elev`。
- 卡片顶部 3px 状态条按 importMode：structured=`--brand`、raw=`--ai`（spec §4.3）。
- AiPanel polished textarea 态：`border-success` + `bg-surface-elev`；"DeepSeek V4" badge = `text-success border-success`。
- ComponentEditor 设计警告：`text-warning` + `border-l-2 border-warning` + `bg-surface-elev`；组件类型标签 `text-mb-orange` → `text-brand`；AiRewriteBar 四按钮换 `.pill`（loading 加 `border-brand`）。
- SlideEditor：自动保存 `text-success`；AI Fill / Present = `.btn-primary` 小号；ChapterNav `bg-surface` + hairline；sorter / 缩略图拖拽激活 `border-brand`；缩放 pill `bg-surface-elev`。
- 主题切换按钮三处入口：Landing 右上角、Marketplace 头部、SlideEditor 工具栏右侧（spec §2 只说"顶栏按钮"，编辑器补齐）。lucide `Sun`/`Moon`，dark 显示 Sun、light 显示 Moon；组件内 `useState(() => getInitialTheme())` + `setTheme(toggleTheme())`，theme.ts 保持无框架依赖。
- ShortcutsOverlay：遮罩 `bg-black/50`，对话框 `.card` + `--radius-xl` + `--shadow-lg`，kbd=`bg-surface border-hairline`。
- ThemePanel / BrandKitPanel 的 deck 内容色板色值（`#FF0000`…）是 deck 数据不是 chrome，保留；只 token 化容器。

## Phase 1 — 主题基建（6 文件）

1. `src/lib/theme.ts`（新增）：`Theme` / `getInitialTheme` / `applyTheme` / `toggleTheme`，spec §4.1 签名；matchMedia try/catch 回退 `'light'`；localStorage 脏值视为未设置；`applyTheme` 附带 300ms `theme-anim`。
2. `src/lib/__tests__/theme.test.ts`（新增，jsdom pragma）：5 用例——stored 优先 / 系统偏好回退 / 脏值回退 / toggle 翻转 + 持久化 + `html.dark` 同步 / applyTheme 幂等。
3. `tailwind.config.js`：`darkMode:'class'`、语义色全表（spec §3.4）、字体栈去 Inter 加 PingFang SC / Microsoft YaHei；**mb palette 本阶段保留**（组件未迁移完，删除放 Phase 6）。
4. `src/styles/globals.css` 全量重写：@font-face 增 S Text Light；`:root` / `html.dark` token 表（spec §3.1–3.2）；`@layer components` 原语（`.kicker`(+`.cool`)、`.card`、`.pill`(+`.on`+`.cool`)、`.btn-primary`、`.btn-ghost`、`.og`/`.bl`）；环境层（`.orb.o1/o2/o3`、`.grid-lines`）；动效（`.rv`/`.rv-d1…d6`、既有 keyframes 重定时 `var(--ease)`、`theme-anim`、`prefers-reduced-motion` 清零含 `.rv` 终态）；全局修正（滚动条按主题、`html.dark select option` 写死 `#1A1A1A` 加注释、focus ring `color-mix` brand 50%）。保留 `slide-up/fade-in/scale-in/shimmer/soft-pulse` 类名（旧组件还在用）。
5. `index.html`：删 background 内联样式，`<head>` 首段加内联 FOUC 脚本（try/catch，逻辑同 §2）。
6. `src/main.tsx`：启动 `applyTheme(getInitialTheme())`。

**门**：`npx tsc --noEmit` 干净；`npx vitest run` 35/35（30 旧 + 5 新）。

## Phase 2 — 编辑器外壳（9 文件）

App.tsx（容器 `bg-canvas text-ink` + ShortcutsOverlay 重构，PresentationMode 黑底不动）、Sidebar（rail：`bg-surface` + 右 hairline，激活 tab 左缘 3px brand 竖条 + brand 图标 + brand-subtle 底，badge=brand 胶囊）、SlidePanel、AiPanel、ExportPanel、BrandKitPanel、ThemePanel、DeckManager、Toast（callout 化：surface-elev 底 + 左缘 3px 语义条 + `--shadow-lg`，info=`--ai`）。区块标题统一 `.kicker`；表单按映射表。

**门**：tsc 干净；dev server 目检编辑器三面板（浅 / 深主题各一遍）。

## Phase 3 — 画布区（2 文件）

SlideEditor（顶栏 surface-elev + 底 hairline；生成横幅：进行中=`--warning` 竖条 + surface-elev 底，失败=`--destructive` 竖条 + 跳过 `.btn-primary` / 重试 `.btn-ghost`；画布区 `bg-surface`；ChapterNav / sorter / 缩略条 / notes 按映射表；工具栏补主题切换按钮）、ComponentEditor（浮动面板 surface-elev + hairline + `--radius-lg` + `--shadow-lg`；全部表单按映射表；AiRewriteBar `.pill` 化）。

**门**：tsc 干净；目检生成横幅三态（进行中 / 失败 / 无）。

## Phase 4 — LandingPage（1 文件）

cover 化：orbs + grid-lines 替换 tri-star / 双光晕 / vignette；主题切换按钮右上；kicker `DECKFORGE ｜ AI PRESENTATION STUDIO` + H1（A Title Cond + `.og` span）+ 副行；入口 duo 橙 / 蓝 3px 顶线；composer `.card` + `--radius-xl` + `--shadow-md`；六组选项 `.pill`（Theme 组选的是 deck 主题，纯视觉同用 `.pill`）；CTA `.btn-primary`；Recent Decks `.kicker` + `.card` 横排；`.rv`/`.rv-d1/2/3` 入场。handleGenerate / handleFiles / 选项 state 零改动。

**门**：tsc 干净；目检浅 / 深两主题入场动效与 orbs。

## Phase 5 — Marketplace（2 文件）

MarketplacePage（头部 `.btn-ghost` 返回 + `.kicker` + 搜索框 surface 底 + 筛选 `.pill` + 主题切换；gallery-card：`.card` + 顶部 3px 状态条 + hover .5s `var(--ease)`；上传卡 token 化；页码角标 surface-elev）、TemplatePreview（头部条 surface-elev + 底 hairline、控制按钮 `.btn-ghost`、CTA `.btn-primary`；舞台与全屏黑底不动）。

**门**：tsc 干净；目检卡片 hover 与全屏预览。

## Phase 6 — 清理、验证、收尾

1. tailwind.config.js 删 `mb` palette。
2. Grep 清零验证：`(bg|text|border|from|to|via|ring|fill|stroke)-mb-` 在 src/ 零命中；待改 18 文件内 `text-white`、`bg-white/`、`border-white/` 零命中（App.tsx PresentationMode 与 TemplatePreview 舞台黑底区白名单除外）；`#FF|#0a0a0a|#262626` 等 chrome hex 残留清零（deck 内容色板数据值除外）；无 token 色透明度修饰符误用（`-brand/10` 之类）。
3. `npx tsc --noEmit` + `npx vitest run` 35/35 + `npx vite build` 全绿。
4. 提交（含 `Co-Authored-By: Claude Code <noreply@anthropic.com>`）；更新 memory：新增 MBODS restyle 条目，并指向 landing / marketplace 两份既有手工 QA 清单（新皮肤下需整体回归一遍）。
5. 用户手工 QA：双主题过 spec §7 清单。

## 风险与回退

- 全部改动纯视觉层 + 新增独立 theme 模块；逻辑 / store / 导出一律未动，回退 = revert 单个 restyle commit。
- var() 色不支持透明度修饰符：Phase 6 grep 同时查误用。
- 中间态（Phase 1 后、Phase 6 前）旧组件颜色未迁移完属预期，只在最终态验证视觉。
